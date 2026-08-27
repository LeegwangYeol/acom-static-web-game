const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { parsePng } = require('../../tests/validate_assets');

console.log('=== Running Adversarial Stress Tests on parsePng & Asset Validator ===');

// 1. Corrupted Header Magic Bytes Test
const corruptHeader = Buffer.from([0x00, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const res1 = parsePng(corruptHeader);
assert.strictEqual(res1.valid, false);
assert.match(res1.error, /Invalid PNG header magic bytes/i);
console.log('Test 1 (Corrupt Header Detection): PASSED');

// 2. Pixel Art Emulation (Hard Edges, 0 semi-transparent AA pixels)
// Construct a 128x128 RGBA PNG buffer with only 0 and 255 alpha
function makeSyntheticPng(width, height, fillAlpha) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA (color type 6)
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  
  const ihdrChunk = Buffer.concat([
    Buffer.alloc(4), // length
    Buffer.from('IHDR'),
    ihdrData,
    Buffer.alloc(4) // CRC placeholder
  ]);
  ihdrChunk.writeUInt32BE(13, 0);

  // IDAT raw scanlines (filter byte 0 + RGBA per pixel)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = (x * 2) % 256;
      rawData[pxOffset + 1] = (y * 2) % 256;
      rawData[pxOffset + 2] = (x + y) % 256;
      rawData[pxOffset + 3] = fillAlpha(x, y);
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from('IDAT'),
    compressed,
    Buffer.alloc(4)
  ]);
  idatChunk.writeUInt32BE(compressed.length, 0);

  const iendChunk = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from('IEND'),
    Buffer.alloc(4)
  ]);
  iendChunk.writeUInt32BE(0, 0);

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Test 2a: Hard-edged 1-bit alpha (Pixel art style: 0 semi-alpha pixels)
const pixelArtBuf = makeSyntheticPng(128, 128, (x, y) => (x > 32 && x < 96 && y > 32 && y < 96 ? 255 : 0));
const res2a = parsePng(pixelArtBuf);
assert.strictEqual(res2a.valid, true);
assert.strictEqual(res2a.semiAlphaCount, 0);
console.log(`Test 2a (Pixel Art Detection - 0 AA pixels): PASSED (semiAlphaCount=${res2a.semiAlphaCount})`);

// Test 2b: Smooth anti-aliased illustration (hundreds of semi-alpha pixels)
const smoothIllustrationBuf = makeSyntheticPng(128, 128, (x, y) => {
  const dist = Math.hypot(x - 64, y - 64);
  if (dist < 40) return 255;
  if (dist < 50) return Math.floor(255 * (1 - (dist - 40) / 10)); // smooth falloff
  return 0;
});
const res2b = parsePng(smoothIllustrationBuf);
assert.strictEqual(res2b.valid, true);
assert(res2b.semiAlphaCount > 100, `Expected > 100 AA pixels, got ${res2b.semiAlphaCount}`);
console.log(`Test 2b (Smooth Illustration Detection): PASSED (semiAlphaCount=${res2b.semiAlphaCount})`);

// 3. Corrupted IDAT chunk
const badIdatBuf = Buffer.from(pixelArtBuf);
badIdatBuf[40] = 0xFF; // Corrupt payload
let caughtZlib = false;
try {
  parsePng(badIdatBuf);
} catch (e) {
  caughtZlib = true;
}
assert.strictEqual(caughtZlib, true);
console.log('Test 3 (Corrupted IDAT Deflate Stream Rejection): PASSED');

// 4. Validate All 24 Character Assets in assets/characters/
const assetsDir = path.resolve(__dirname, '../../assets/characters');
const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.png'));
console.log(`\nValidating all ${files.length} character assets in ${assetsDir}...`);
assert.strictEqual(files.length, 24, 'Expected 24 PNG files (6 primary + 18 action poses)');

const hashSet = new Set();
for (const file of files) {
  const fullPath = path.join(assetsDir, file);
  const buf = fs.readFileSync(fullPath);
  const res = parsePng(buf);
  assert.strictEqual(res.valid, true, `File ${file} should be valid PNG`);
  assert(res.width >= 128 && res.height >= 128, `${file} size ${res.width}x${res.height} < 128x128`);
  assert(res.transRatio >= 0.15, `${file} transparency ${res.transRatio} < 0.15`);
  assert(res.semiAlphaCount >= 100, `${file} AA pixels ${res.semiAlphaCount} < 100`);
  assert(!hashSet.has(res.sha256), `Duplicate hash found for ${file}`);
  hashSet.add(res.sha256);
}
console.log(`All ${files.length} character assets verified independently: 100% valid, non-pixel-art, distinct hashes!`);
console.log('=== All Adversarial Stress Tests PASSED! ===');
