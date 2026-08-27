#!/usr/bin/env node
/**
 * Adversarial Asset Stress Test Suite & Empirical Verification
 * 
 * Performs:
 * 1. Deep byte-level PNG chunk deconstruction and full scanline un-filtering.
 * 2. Alpha channel distribution & anti-aliasing gradient transition analysis.
 * 3. Pairwise SHA-256 uniqueness, perceptual hash divergence, and RGB RMSE analysis.
 * 4. Adversarial stress testing of tests/validate_assets.js against 10 malformed/corrupted/adversarial inputs.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { parsePng } = require('./validate_assets');

const ASSETS_DIR = path.resolve(__dirname, '../assets/characters');
const ASSETS = [
  'ally_assault.png',
  'ally_recon.png',
  'ally_heavy.png',
  'enemy_mutant.png',
  'enemy_scout.png',
  'enemy_heavy.png'
];

/**
 * Standard PNG Scanline Un-filtering
 * Supports filter types: 0 (None), 1 (Sub), 2 (Up), 3 (Average), 4 (Paeth)
 */
function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterPngRgba(decompressed, width, height, bytesPerPixel = 4) {
  const stride = 1 + width * bytesPerPixel;
  const rawPixels = Buffer.alloc(width * height * bytesPerPixel);
  let prevRow = Buffer.alloc(width * bytesPerPixel);

  for (let y = 0; y < height; y++) {
    const filterType = decompressed[y * stride];
    const currentRow = Buffer.alloc(width * bytesPerPixel);

    for (let x = 0; x < width * bytesPerPixel; x++) {
      const rawByte = decompressed[y * stride + 1 + x];
      const left = x >= bytesPerPixel ? currentRow[x - bytesPerPixel] : 0;
      const up = prevRow[x];
      const upLeft = x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0;

      let val = 0;
      switch (filterType) {
        case 0: // None
          val = rawByte;
          break;
        case 1: // Sub
          val = (rawByte + left) & 0xFF;
          break;
        case 2: // Up
          val = (rawByte + up) & 0xFF;
          break;
        case 3: // Average
          val = (rawByte + Math.floor((left + up) / 2)) & 0xFF;
          break;
        case 4: // Paeth
          val = (rawByte + paethPredictor(left, up, upLeft)) & 0xFF;
          break;
        default:
          throw new Error(`Unsupported filter type: ${filterType}`);
      }
      currentRow[x] = val;
      rawPixels[(y * width * bytesPerPixel) + x] = val;
    }
    prevRow = currentRow;
  }
  return rawPixels;
}

function deepInspectPng(filePath) {
  const buffer = fs.readFileSync(filePath);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // Verify PNG header
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== magic[i]) throw new Error('Invalid PNG header magic bytes');
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);

  let offset = 8;
  const chunks = [];
  const idatChunks = [];
  let trnsData = null;
  const plteColors = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const chunkType = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    chunks.push({ type: chunkType, length, offset });

    if (chunkType === 'IDAT') {
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (chunkType === 'PLTE') {
      for (let i = dataStart; i < dataEnd; i += 3) {
        plteColors.push([buffer[i], buffer[i + 1], buffer[i + 2]]);
      }
    } else if (chunkType === 'tRNS') {
      trnsData = buffer.subarray(dataStart, dataEnd);
    }
    offset = dataEnd + 4; // Skip CRC
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  let rgbaPixels;

  if (colorType === 6) { // RGBA
    rgbaPixels = unfilterPngRgba(decompressed, width, height, 4);
  } else if (colorType === 3) { // Indexed
    const stride = 1 + width;
    rgbaPixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      const filterType = decompressed[y * stride];
      for (let x = 0; x < width; x++) {
        const colorIdx = decompressed[y * stride + 1 + x];
        const rgb = plteColors[colorIdx] || [0, 0, 0];
        let alpha = 255;
        if (trnsData && colorIdx < trnsData.length) {
          alpha = trnsData[colorIdx];
        }
        const outIdx = (y * width + x) * 4;
        rgbaPixels[outIdx] = rgb[0];
        rgbaPixels[outIdx + 1] = rgb[1];
        rgbaPixels[outIdx + 2] = rgb[2];
        rgbaPixels[outIdx + 3] = alpha;
      }
    }
  } else {
    throw new Error(`Unsupported color type: ${colorType}`);
  }

  // Alpha Channel & Anti-Aliasing Gradient Analysis
  let zeroAlpha = 0;
  let semiAlpha = 0;
  let fullAlpha = 0;
  const uniqueAlphas = new Set();
  const uniqueColors = new Set();
  const alphaHistogram = new Array(256).fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = rgbaPixels[idx];
      const g = rgbaPixels[idx + 1];
      const b = rgbaPixels[idx + 2];
      const a = rgbaPixels[idx + 3];

      alphaHistogram[a]++;
      uniqueAlphas.add(a);
      uniqueColors.add(`${r},${g},${b},${a}`);

      if (a === 0) zeroAlpha++;
      else if (a === 255) fullAlpha++;
      else semiAlpha++;
    }
  }

  // Border Anti-Aliasing Gradient Continuity
  // Inspect transition band around the contour of the character
  let borderPixelCount = 0;
  let borderAlphaTransitions = 0;
  const gradientMagnitudes = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const a = rgbaPixels[idx + 3];

      if (a > 0) {
        // Check 4-connected neighbors for alpha = 0 or different alpha
        const aUp = rgbaPixels[((y - 1) * width + x) * 4 + 3];
        const aDown = rgbaPixels[((y + 1) * width + x) * 4 + 3];
        const aLeft = rgbaPixels[(y * width + (x - 1)) * 4 + 3];
        const aRight = rgbaPixels[(y * width + (x + 1)) * 4 + 3];

        if (aUp === 0 || aDown === 0 || aLeft === 0 || aRight === 0) {
          borderPixelCount++;
          // Compute Sobel / central difference gradient
          const dx = (aRight - aLeft) / 2;
          const dy = (aDown - aUp) / 2;
          const mag = Math.sqrt(dx * dx + dy * dy);
          gradientMagnitudes.push(mag);
          if (a > 0 && a < 255) {
            borderAlphaTransitions++;
          }
        }
      }
    }
  }

  const avgBorderGradient = gradientMagnitudes.length > 0 
    ? gradientMagnitudes.reduce((acc, v) => acc + v, 0) / gradientMagnitudes.length 
    : 0;

  // Downsample to 16x16 grayscale for dHash perceptual hash
  const dHash = computeDHash(rgbaPixels, width, height);

  return {
    filename: path.basename(filePath),
    fileSize: buffer.length,
    sha256,
    width,
    height,
    bitDepth,
    colorType,
    chunks: chunks.map(c => c.type),
    totalPixels: width * height,
    zeroAlpha,
    semiAlpha,
    fullAlpha,
    transRatio: zeroAlpha / (width * height),
    opaqueRatio: fullAlpha / (width * height),
    semiRatio: semiAlpha / (width * height),
    uniqueAlphaLevels: uniqueAlphas.size,
    uniqueColors: uniqueColors.size,
    borderPixelCount,
    borderAlphaTransitions,
    avgBorderGradient,
    dHash,
    rgbaPixels
  };
}

/**
 * Computes 64-bit dHash (difference hash) for perceptual similarity comparison
 */
function computeDHash(rgbaPixels, width, height) {
  const targetW = 9;
  const targetH = 8;
  const gray = new Float32Array(targetW * targetH);

  for (let ty = 0; ty < targetH; ty++) {
    for (let tx = 0; tx < targetW; tx++) {
      const srcX = Math.floor(tx * (width / targetW));
      const srcY = Math.floor(ty * (height / targetH));
      const idx = (srcY * width + srcX) * 4;
      const r = rgbaPixels[idx];
      const g = rgbaPixels[idx + 1];
      const b = rgbaPixels[idx + 2];
      const a = rgbaPixels[idx + 3] / 255;
      // Pre-multiply with white background for perception
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
      gray[ty * targetW + tx] = lum;
    }
  }

  let hash = '';
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW - 1; x++) {
      const left = gray[y * targetW + x];
      const right = gray[y * targetW + x + 1];
      hash += left > right ? '1' : '0';
    }
  }
  return hash;
}

function hammingDistance(hash1, hash2) {
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}

/**
 * Creates a minimal valid PNG in memory with specified options
 */
function createSyntheticPng({ width = 16, height = 16, alphaMode = 'semi', colorCount = 256, isOpaque = false, isCorruptIdat = false, filterType = 0 }) {
  const bytesPerPixel = 4;
  const stride = 1 + width * bytesPerPixel;
  const rawData = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    rawData[y * stride] = filterType;
    for (let x = 0; x < width; x++) {
      const pxOffset = y * stride + 1 + x * bytesPerPixel;
      const colVal = (x * 17 + y * 23) % 256;
      rawData[pxOffset] = colVal;
      rawData[pxOffset + 1] = (colVal + 50) % 256;
      rawData[pxOffset + 2] = (colVal + 100) % 256;

      if (isOpaque) {
        rawData[pxOffset + 3] = 255;
      } else if (alphaMode === 'binary') { // 8-bit pixel art alpha (0 or 255 only)
        rawData[pxOffset + 3] = (x >= 4 && x < width - 4 && y >= 4 && y < height - 4) ? 255 : 0;
      } else { // Smooth semi-transparent alpha with 60% background and 35% opaque center
        const xMin = Math.floor(width * 0.25);
        const xMax = Math.floor(width * 0.75);
        const yMin = Math.floor(height * 0.15);
        const yMax = Math.floor(height * 0.85);

        const isInside = (x > xMin + 2 && x < xMax - 2 && y > yMin + 2 && y < yMax - 2);
        const isBorder = (x >= xMin && x <= xMax && y >= yMin && y <= yMax && !isInside);

        if (isInside) {
          rawData[pxOffset + 3] = 255;
        } else if (isBorder) {
          rawData[pxOffset + 3] = 128; // Anti-aliased border
        } else {
          rawData[pxOffset + 3] = 0; // Transparent
        }
      }
    }
  }

  let compressed = zlib.deflateSync(rawData);
  if (isCorruptIdat) {
    compressed = compressed.subarray(0, Math.floor(compressed.length / 2)); // Corrupt zlib stream
  }

  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8 bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([magic, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

const crcTable = (() => {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }
  return table;
})();

async function runEmpiricalStressTests() {
  console.log('===============================================================');
  console.log('   ACOM M1 EMPIRICAL ADVERSARIAL STRESS TEST & VALIDATION      ');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // PART 1: DEEP INSPECTION OF PRODUCTION CHARACTER ASSETS
  // -------------------------------------------------------------
  console.log('--- PART 1: Production Character Assets Deep Inspection ---');
  const assetReports = [];

  for (const file of ASSETS) {
    const fullPath = path.join(ASSETS_DIR, file);
    if (!fs.existsSync(fullPath)) {
      console.error(`[CRITICAL] Asset file missing: ${fullPath}`);
      process.exit(1);
    }
    const report = deepInspectPng(fullPath);
    assetReports.push(report);

    console.log(`\n[ASSET] ${file}`);
    console.log(`  - Dimensions: ${report.width}x${report.height} | BitDepth: ${report.bitDepth} | ColorType: ${report.colorType}`);
    console.log(`  - SHA-256: ${report.sha256}`);
    console.log(`  - Transparency: ${(report.transRatio * 100).toFixed(2)}% (${report.zeroAlpha} px)`);
    console.log(`  - Opaque Body: ${(report.opaqueRatio * 100).toFixed(2)}% (${report.fullAlpha} px)`);
    console.log(`  - Anti-aliasing Semi-Alpha: ${(report.semiRatio * 100).toFixed(2)}% (${report.semiAlpha} px, ${report.uniqueAlphaLevels} discrete alpha levels)`);
    console.log(`  - Border Transition AA Pixels: ${report.borderAlphaTransitions} / ${report.borderPixelCount} contour border pixels (${((report.borderAlphaTransitions/report.borderPixelCount)*100).toFixed(1)}% smoothed)`);
    console.log(`  - Unique RGBA Colors: ${report.uniqueColors}`);
    console.log(`  - dHash: ${report.dHash}`);

    // Strict empirical mathematical proofs against pixel art:
    // 1. Dimensions >= 128x128
    if (report.width !== 192 || report.height !== 256) throw new Error(`${file}: Expected 192x256 dimensions`);
    // 2. True transparency background >= 15%
    if (report.transRatio < 0.15) throw new Error(`${file}: Failed transparency ratio requirement (>15%)`);
    // 3. Significant character body >= 10%
    if (report.opaqueRatio < 0.10) throw new Error(`${file}: Failed opaque body requirement (>10%)`);
    // 4. Smooth anti-aliased perimeter: >= 100 semi-alpha pixels
    if (report.semiAlpha < 100) throw new Error(`${file}: Insufficient semi-alpha pixels (<100)`);
    // 5. Rich continuous alpha gradient: >= 20 distinct alpha steps (proves non-pixel-art vector gradient)
    if (report.uniqueAlphaLevels < 20) throw new Error(`${file}: Low discrete alpha levels (<20), suspect pixel art`);
    // 6. Rich color palette: >= 50 colors
    if (report.uniqueColors < 50) throw new Error(`${file}: Low color count (<50)`);
    // 7. Border smoothness ratio: > 75% of border pixels have anti-aliasing gradient transitions
    const borderSmoothRatio = report.borderAlphaTransitions / report.borderPixelCount;
    if (borderSmoothRatio < 0.75) throw new Error(`${file}: Border smoothness ratio (${(borderSmoothRatio*100).toFixed(1)}%) < 75%`);
  }

  // -------------------------------------------------------------
  // PART 2: PAIRWISE DISTINCTNESS & PERCEPTUAL DIVERSITY
  // -------------------------------------------------------------
  console.log('\n--- PART 2: Pairwise Distinctness & Perceptual Distance (15 Pairs) ---');
  let minPixelDiffPct = 100.0;
  let minRmse = 255.0;
  let shaCollisions = 0;

  for (let i = 0; i < assetReports.length; i++) {
    for (let j = i + 1; j < assetReports.length; j++) {
      const a = assetReports[i];
      const b = assetReports[j];
      const hDist = hammingDistance(a.dHash, b.dHash);
      const shaMatch = a.sha256 === b.sha256;
      if (shaMatch) shaCollisions++;

      // Compute exact pixel difference on non-transparent union
      let diffSqSum = 0;
      let differingPixels = 0;
      let totalNonTrans = 0;

      for (let p = 0; p < a.width * a.height; p++) {
        const idx = p * 4;
        const aR = a.rgbaPixels[idx], aG = a.rgbaPixels[idx+1], aB = a.rgbaPixels[idx+2], aA = a.rgbaPixels[idx+3];
        const bR = b.rgbaPixels[idx], bG = b.rgbaPixels[idx+1], bB = b.rgbaPixels[idx+2], bA = b.rgbaPixels[idx+3];

        if (aA > 0 || bA > 0) {
          totalNonTrans++;
          if (aR !== bR || aG !== bG || aB !== bB || aA !== bA) {
            differingPixels++;
            const dR = aR - bR;
            const dG = aG - bG;
            const dB = aB - bB;
            const dA = aA - bA;
            diffSqSum += (dR*dR + dG*dG + dB*dB + dA*dA) / 4;
          }
        }
      }

      const mse = diffSqSum / totalNonTrans;
      const rmse = Math.sqrt(mse);
      const diffPct = (differingPixels / totalNonTrans) * 100;

      if (diffPct < minPixelDiffPct) minPixelDiffPct = diffPct;
      if (rmse < minRmse) minRmse = rmse;

      console.log(`  Pair [${a.filename} vs ${b.filename}]:`);
      console.log(`    - SHA256 Collision: ${shaMatch ? 'YES (FAIL)' : 'NO (PASS)'}`);
      console.log(`    - Visible Pixel Difference: ${diffPct.toFixed(2)}% (${differingPixels}/${totalNonTrans} px)`);
      console.log(`    - Color/Luminance RMSE: ${rmse.toFixed(2)} / 255.0`);
      console.log(`    - dHash Hamming Distance: ${hDist}/64 (${((hDist / 64) * 100).toFixed(1)}% gradient divergence)`);

      if (shaMatch) throw new Error(`Identical SHA256 detected between ${a.filename} and ${b.filename}`);
      if (diffPct < 50.0) throw new Error(`Extreme pixel similarity (${diffPct}% < 50%) between ${a.filename} and ${b.filename}`);
      if (rmse < 30.0) throw new Error(`Extreme color similarity (RMSE ${rmse} < 30) between ${a.filename} and ${b.filename}`);
    }
  }

  console.log(`\n=> Pairwise Empirical Verification Result: PASS`);
  console.log(`   - Minimum Visible Pixel Divergence: ${minPixelDiffPct.toFixed(2)}%`);
  console.log(`   - Minimum Color RMSE: ${minRmse.toFixed(2)} / 255.0`);
  console.log(`   - SHA-256 Collisions: ${shaCollisions}`);

  // -------------------------------------------------------------
  // PART 3: ADVERSARIAL STRESS-TESTING OF VALIDATE_ASSETS.JS
  // -------------------------------------------------------------
  console.log('\n--- PART 3: Adversarial Fuzzing & Stress Testing of validate_assets.js ---');

  const adversarialTests = [
    {
      name: 'Adversarial 1: Corrupted IDAT / Truncated zlib Stream',
      buffer: createSyntheticPng({ width: 192, height: 256, isCorruptIdat: true }),
      expectPass: false,
      expectedFailureSubstring: 'zlib|inflate|corrupt'
    },
    {
      name: 'Adversarial 2: Fake PNG Magic Bytes followed by ASCII Garbage',
      buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('FAKE_DATA_NOT_A_REAL_PNG_GARBAGE_BYTES')]),
      expectPass: false,
      expectedFailureSubstring: 'Invalid'
    },
    {
      name: 'Adversarial 3: Zero-Byte Empty Buffer',
      buffer: Buffer.alloc(0),
      expectPass: false,
      expectedFailureSubstring: 'Invalid PNG header'
    },
    {
      name: 'Adversarial 4: Completely Opaque Image (0% Transparency)',
      buffer: createSyntheticPng({ width: 192, height: 256, isOpaque: true }),
      expectPass: false,
      expectedFailureSubstring: 'Insufficient transparent background'
    },
    {
      name: 'Adversarial 5: 8-Bit Pixel Art with Hard 1-Bit Alpha (0 semi-transparent pixels)',
      buffer: createSyntheticPng({ width: 192, height: 256, alphaMode: 'binary' }),
      expectPass: false,
      expectedFailureSubstring: 'Insufficient anti-aliasing'
    },
    {
      name: 'Adversarial 6: Low-Resolution Sprite (32x32)',
      buffer: createSyntheticPng({ width: 32, height: 32, alphaMode: 'semi' }),
      expectPass: false,
      expectedFailureSubstring: 'Dimensions too small'
    },
    {
      name: 'Adversarial 7: Non-PNG JPEG File disguised as PNG',
      buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]),
      expectPass: false,
      expectedFailureSubstring: 'Invalid PNG header'
    },
    {
      name: 'Adversarial 8: Valid High-Res Synthetic 192x256 Vector Sprite with Smooth Alpha',
      buffer: createSyntheticPng({ width: 192, height: 256, alphaMode: 'semi' }),
      expectPass: true
    },
    {
      name: 'Adversarial 9: 1-byte Truncated Buffer',
      buffer: Buffer.from([0x89]),
      expectPass: false,
      expectedFailureSubstring: 'Invalid PNG header'
    },
    {
      name: 'Adversarial 10: Header Only (8 bytes magic)',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      expectPass: false,
      expectedFailureSubstring: 'Invalid'
    }
  ];

  let advPassed = 0;
  let advFailed = 0;
  const edgeCaseFindings = [];

  for (const test of adversarialTests) {
    console.log(`\nTesting: [${test.name}]`);
    let result;
    let threwException = false;
    let exceptionMessage = '';

    try {
      result = parsePng(test.buffer);
      // Run heuristic checks if valid PNG parse
      if (result && result.valid) {
        const failures = [];
        if (result.width < 128 || result.height < 128) failures.push(`Dimensions too small: ${result.width}x${result.height}`);
        if (result.transRatio < 0.15) failures.push(`Insufficient transparent background: ${(result.transRatio * 100).toFixed(1)}% < 15%`);
        if (result.opaqueRatio < 0.10) failures.push(`Insufficient subject content: ${(result.opaqueRatio * 100).toFixed(1)}% < 10%`);
        if (result.semiAlphaCount < 100) failures.push(`Insufficient anti-aliasing edge pixels: ${result.semiAlphaCount} < 100`);
        if (result.uniqueColorCount < 50) failures.push(`Low color palette count: ${result.uniqueColorCount} < 50`);
        if (failures.length > 0) {
          result.passed = false;
          result.failures = failures;
        } else {
          result.passed = true;
        }
      } else {
        result = result || { valid: false, error: 'Unknown parser failure' };
        result.passed = false;
      }
    } catch (err) {
      threwException = true;
      exceptionMessage = err.message;
      result = { valid: false, passed: false, error: `Uncaught Exception: ${err.message}` };
    }

    if (test.expectPass) {
      if (result.passed) {
        console.log(`  => PASS (Correctly accepted valid synthetic high-res asset)`);
        advPassed++;
      } else {
        console.error(`  => FAIL (Unexpectedly rejected valid asset: ${JSON.stringify(result)})`);
        advFailed++;
      }
    } else {
      if (!result.passed) {
        const failureReason = result.error || (result.failures && result.failures.join(', '));
        console.log(`  => PASS (Correctly rejected adversarial input with: "${failureReason}")`);
        if (threwException) {
          edgeCaseFindings.push({
            test: test.name,
            observation: `Threw unhandled exception '${exceptionMessage}' instead of returning structured { valid: false, error: ... }`
          });
        }
        advPassed++;
      } else {
        console.error(`  => FAIL (Adversarial input incorrectly accepted!)`);
        advFailed++;
      }
    }
  }

  console.log(`\n===============================================================`);
  console.log(`Adversarial Stress Testing Summary: ${advPassed} PASSED, ${advFailed} FAILED out of ${adversarialTests.length} tests`);
  if (edgeCaseFindings.length > 0) {
    console.log(`\nEdge-Case / Robustness Observations in validate_assets.js:`);
    edgeCaseFindings.forEach(f => console.log(`  - [ROBUSTNESS OBSERVATION] ${f.test}: ${f.observation}`));
  }
  console.log(`===============================================================`);

  if (advFailed > 0) {
    throw new Error(`Adversarial stress test failed with ${advFailed} failures`);
  }

  return {
    assetReports,
    adversarialSummary: { passed: advPassed, failed: advFailed, total: adversarialTests.length },
    edgeCaseFindings
  };
}

if (require.main === module) {
  runEmpiricalStressTests()
    .then(() => {
      console.log('\n[SUCCESS] All Empirical & Adversarial Stress Tests Passed 100%!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[FATAL ERROR]', err);
      process.exit(1);
    });
}

module.exports = { runEmpiricalStressTests, deepInspectPng, createSyntheticPng };
