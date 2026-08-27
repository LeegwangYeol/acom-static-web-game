const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

/**
 * Validates whether a PNG image is a high-resolution 2D illustration
 * and not an 8-bit / retro pixel-art placeholder.
 */
function inspectPng(filePath) {
    if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'File not found' };
    }

    const buf = fs.readFileSync(filePath);
    if (buf.length < 8) {
        return { valid: false, error: 'File too small' };
    }

    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!buf.subarray(0, 8).equals(pngHeader)) {
        return { valid: false, error: 'Invalid PNG header' };
    }

    let pos = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idatChunks = [];

    while (pos < buf.length) {
        if (pos + 8 > buf.length) break;
        const len = buf.readUInt32BE(pos);
        const type = buf.subarray(pos + 4, pos + 8).toString('ascii');
        
        if (type === 'IHDR' && pos + 8 + 13 <= buf.length) {
            width = buf.readUInt32BE(pos + 8);
            height = buf.readUInt32BE(pos + 12);
            bitDepth = buf.readUInt8(pos + 16);
            colorType = buf.readUInt8(pos + 17);
        } else if (type === 'IDAT') {
            idatChunks.push(buf.subarray(pos + 8, pos + 8 + len));
        }
        pos += 12 + len;
    }

    const hasAlpha = (colorType === 6 || colorType === 4);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');

    let decompressedBytes = 0;
    let uniqueOpaqueColors = 0;
    let intermediateAlphaRatio = 0;
    let pixelArtScore = 0; // 0 = illustration, 1 = strict pixel art

    try {
        const rawData = zlib.inflateSync(Buffer.concat(idatChunks));
        decompressedBytes = rawData.length;

        if (colorType === 6 && bitDepth === 8) {
            const bytesPerPixel = 4;
            const rowBytes = 1 + width * bytesPerPixel;
            const colorSet = new Set();
            let nonZeroAlpha = 0;
            let intermediateAlpha = 0;

            for (let y = 0; y < height; y++) {
                const rowStart = y * rowBytes + 1;
                for (let x = 0; x < width; x++) {
                    const r = rawData[rowStart + x * bytesPerPixel];
                    const g = rawData[rowStart + x * bytesPerPixel + 1];
                    const b = rawData[rowStart + x * bytesPerPixel + 2];
                    const a = rawData[rowStart + x * bytesPerPixel + 3];

                    if (a > 0) {
                        nonZeroAlpha++;
                        if (a < 255) intermediateAlpha++;
                        if (a > 20) {
                            colorSet.add((r << 16) | (g << 8) | b);
                        }
                    }
                }
            }

            uniqueOpaqueColors = colorSet.size;
            intermediateAlphaRatio = nonZeroAlpha > 0 ? (intermediateAlpha / nonZeroAlpha) : 0;
            
            // Pixel art has binary alpha (intermediateAlphaRatio == 0) and low unique colors
            if (intermediateAlphaRatio < 0.005 && uniqueOpaqueColors < 500) {
                pixelArtScore = 1.0;
            } else if (intermediateAlphaRatio < 0.01) {
                pixelArtScore = 0.8;
            } else {
                pixelArtScore = 0.0;
            }
        }
    } catch (e) {
        // In case zlib fails or unusual color type
    }

    return {
        valid: true,
        fileName: path.basename(filePath),
        sizeBytes: buf.length,
        width,
        height,
        bitDepth,
        colorType,
        hasAlpha,
        sha256: hash,
        uniqueOpaqueColors,
        intermediateAlphaRatio: Number(intermediateAlphaRatio.toFixed(4)),
        pixelArtScore,
        isNonPixelArt: (pixelArtScore < 0.5 && width >= 256 && height >= 256 && hasAlpha)
    };
}

// Test against current files
console.log(JSON.stringify({
    megaman: inspectPng(path.resolve(__dirname, '../../megaman.png')),
    goomba: inspectPng(path.resolve(__dirname, '../../goomba.png'))
}, null, 2));
