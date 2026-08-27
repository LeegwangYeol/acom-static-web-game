#!/usr/bin/env node
/**
 * ACOM Asset Validation Script
 * Programmatically verifies that all 6 required character assets in assets/characters/
 * are high-resolution, valid PNG files with true transparent backgrounds, anti-aliased edges,
 * and rich non-pixel-art color depth.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ASSETS = [
  'ally_assault.png',
  'ally_recon.png',
  'ally_heavy.png',
  'enemy_mutant.png',
  'enemy_scout.png',
  'enemy_heavy.png'
];

const ASSETS_DIR = path.resolve(__dirname, '../assets/characters');
const REPORT_DIR = path.resolve(__dirname, '../.agents/reports');

function parsePng(buffer) {
  // Magic bytes check: 89 50 4E 47 0D 0A 1A 0A
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== magic[i]) {
      return { valid: false, error: 'Invalid PNG header magic bytes' };
    }
  }

  // IHDR chunk is immediately after magic bytes (length: 13 bytes, offset: 8)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);

  let offset = 8;
  const idatChunks = [];
  const plteColors = [];
  let trnsData = null;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const chunkType = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (chunkType === 'IDAT') {
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (chunkType === 'PLTE') {
      for (let i = dataStart; i < dataEnd; i += 3) {
        plteColors.push([buffer[i], buffer[i + 1], buffer[i + 2]]);
      }
    } else if (chunkType === 'tRNS') {
      trnsData = buffer.subarray(dataStart, dataEnd);
    }
    offset = dataEnd + 4; // Skip 4-byte CRC
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  const totalPixels = width * height;
  let transparentCount = 0;
  let semiAlphaCount = 0;
  let opaqueCount = 0;
  const uniqueColors = new Set();

  if (colorType === 6) {
    // RGBA
    const bytesPerPixel = 4;
    const stride = 1 + width * bytesPerPixel;
    for (let y = 0; y < height; y++) {
      const rowOffset = y * stride + 1;
      for (let x = 0; x < width; x++) {
        const pxOffset = rowOffset + x * bytesPerPixel;
        const r = decompressed[pxOffset];
        const g = decompressed[pxOffset + 1];
        const b = decompressed[pxOffset + 2];
        const a = decompressed[pxOffset + 3];
        uniqueColors.add(`${r},${g},${b},${a}`);

        if (a === 0) transparentCount++;
        else if (a === 255) opaqueCount++;
        else semiAlphaCount++;
      }
    }
  } else if (colorType === 3) {
    // Indexed color with tRNS
    const stride = 1 + width;
    for (let y = 0; y < height; y++) {
      const rowOffset = y * stride + 1;
      for (let x = 0; x < width; x++) {
        const colorIdx = decompressed[rowOffset + x];
        uniqueColors.add(colorIdx);
        let alpha = 255;
        if (trnsData && colorIdx < trnsData.length) {
          alpha = trnsData[colorIdx];
        }
        if (alpha === 0) transparentCount++;
        else if (alpha === 255) opaqueCount++;
        else semiAlphaCount++;
      }
    }
  } else {
    return { valid: false, error: `Unsupported color type: ${colorType}` };
  }

  const transRatio = transparentCount / totalPixels;
  const opaqueRatio = opaqueCount / totalPixels;
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    valid: true,
    width,
    height,
    bitDepth,
    colorType,
    totalPixels,
    transparentCount,
    semiAlphaCount,
    opaqueCount,
    transRatio,
    opaqueRatio,
    uniqueColorCount: uniqueColors.size,
    sha256
  };
}

function runAssetValidation() {
  console.log('=== Running ACOM Asset Validation Suite ===');
  const results = {};
  const seenHashes = new Set();
  let allPassed = true;

  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`Asset directory not found: ${ASSETS_DIR}`);
    process.exit(1);
  }

  for (const filename of ASSETS) {
    const filePath = path.join(ASSETS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.error(`[FAIL] Asset missing: ${filename}`);
      results[filename] = { passed: false, error: 'File missing' };
      allPassed = false;
      continue;
    }

    const fileBuf = fs.readFileSync(filePath);
    const parsed = parsePng(fileBuf);

    if (!parsed.valid) {
      console.error(`[FAIL] ${filename}: ${parsed.error}`);
      results[filename] = { passed: false, error: parsed.error };
      allPassed = false;
      continue;
    }

    // Heuristics checks
    const failures = [];
    if (parsed.width < 128 || parsed.height < 128) {
      failures.push(`Dimensions too small: ${parsed.width}x${parsed.height} (min 128x128)`);
    }
    if (parsed.transRatio < 0.15) {
      failures.push(`Insufficient transparent background: ${(parsed.transRatio * 100).toFixed(1)}% < 15%`);
    }
    if (parsed.opaqueRatio < 0.10) {
      failures.push(`Insufficient subject content: ${(parsed.opaqueRatio * 100).toFixed(1)}% < 10%`);
    }
    if (parsed.semiAlphaCount < 100) {
      failures.push(`Insufficient anti-aliasing edge pixels: ${parsed.semiAlphaCount} < 100 (possible pixel art)`);
    }
    if (parsed.uniqueColorCount < 50) {
      failures.push(`Low color palette count: ${parsed.uniqueColorCount} < 50`);
    }
    if (seenHashes.has(parsed.sha256)) {
      failures.push(`Duplicate SHA256 hash detected: ${parsed.sha256}`);
    }
    seenHashes.add(parsed.sha256);

    if (failures.length > 0) {
      console.error(`[FAIL] ${filename}: ${failures.join(', ')}`);
      results[filename] = { passed: false, failures, ...parsed };
      allPassed = false;
    } else {
      console.log(`[PASS] ${filename} - ${parsed.width}x${parsed.height}, ${(parsed.transRatio * 100).toFixed(1)}% trans, ${parsed.semiAlphaCount} AA px, ${parsed.uniqueColorCount} colors, sha256: ${parsed.sha256.substring(0, 12)}...`);
      results[filename] = { passed: true, ...parsed };
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    status: allPassed ? 'PASS' : 'FAIL',
    totalAssets: ASSETS.length,
    passedAssets: Object.values(results).filter(r => r.passed).length,
    failedAssets: Object.values(results).filter(r => !r.passed).length,
    results
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORT_DIR, 'asset_validation_report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(`\nValidation Report written to: .agents/reports/asset_validation_report.json`);
  if (!allPassed) {
    console.error('=== Asset Validation FAILED ===');
    if (require.main === module) process.exit(1);
  } else {
    console.log('=== All 6 character assets PASSED asset validation! ===');
  }
  return report;
}

if (require.main === module) {
  const rep = runAssetValidation();
  if (rep.status !== 'PASS') process.exit(1);
}

module.exports = {
  runAssetValidation,
  parsePng,
  ASSETS,
  validateAllAssets: runAssetValidation,
  parsePNG: (filePathOrBuf) => {
    const buf = Buffer.isBuffer(filePathOrBuf) ? filePathOrBuf : fs.readFileSync(filePathOrBuf);
    return parsePng(buf);
  }
};

