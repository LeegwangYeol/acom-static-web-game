#!/usr/bin/env node
/**
 * Empirical Challenger Test Harness: Character Asset Integrity & Isometric Compatibility
 * challenger_m1_2
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');
const net = require('net');

const ASSETS_DIR = path.resolve(__dirname, '../assets/characters');
const CHROME_PATH = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');

const CHARACTERS = [
  'ally_assault',
  'ally_recon',
  'ally_heavy',
  'enemy_mutant',
  'enemy_scout',
  'enemy_heavy'
];

const POSES = ['', '_attack', '_hit', '_dead'];

const ALL_ASSETS = [];
CHARACTERS.forEach(char => {
  POSES.forEach(pose => {
    ALL_ASSETS.push(`${char}${pose}.png`);
  });
});

function parsePngDeep(buffer) {
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== magic[i]) {
      return { valid: false, error: 'Invalid PNG header magic bytes' };
    }
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);
  const compressionMethod = buffer.readUInt8(26);
  const filterMethod = buffer.readUInt8(27);
  const interlaceMethod = buffer.readUInt8(28);

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
    offset = dataEnd + 4;
  }

  let decompressed;
  try {
    decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  } catch (err) {
    return { valid: false, error: `Decompression error: ${err.message}` };
  }

  const totalPixels = width * height;
  let transparentCount = 0;
  let semiAlphaCount = 0;
  let opaqueCount = 0;
  const uniqueColors = new Set();

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  // Track alpha per pixel for bounding box
  if (colorType === 6) {
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

        if (a === 0) {
          transparentCount++;
        } else {
          if (a === 255) opaqueCount++;
          else semiAlphaCount++;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  } else if (colorType === 3) {
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
        if (alpha === 0) {
          transparentCount++;
        } else {
          if (alpha === 255) opaqueCount++;
          else semiAlphaCount++;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  } else {
    return { valid: false, error: `Unsupported color type: ${colorType}` };
  }

  const transRatio = transparentCount / totalPixels;
  const opaqueRatio = opaqueCount / totalPixels;
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const subjectWidth = maxX >= minX ? (maxX - minX + 1) : 0;
  const subjectHeight = maxY >= minY ? (maxY - minY + 1) : 0;
  const visualCenterX = maxX >= minX ? ((minX + maxX) / 2) : (width / 2);
  const visualCenterOffset = visualCenterX - (width / 2);
  const bottomGap = height - 1 - maxY;

  return {
    valid: true,
    width,
    height,
    aspectRatio: width / height,
    bitDepth,
    colorType,
    totalPixels,
    transparentCount,
    semiAlphaCount,
    opaqueCount,
    transRatio,
    opaqueRatio,
    uniqueColorCount: uniqueColors.size,
    sha256,
    boundingBox: { minX, maxX, minY, maxY, subjectWidth, subjectHeight },
    centering: { visualCenterX, visualCenterOffset, bottomGap }
  };
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBrowserDecodeTest(assetList) {
  const port = await getFreePort();
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/test.html') {
      const imgTags = assetList.map(a => `
        <div class="sprite-test-card" data-asset="${a}">
          <img id="img-${a.replace(/[^a-zA-Z0-9]/g, '_')}" src="/assets/characters/${a}" alt="${a}" />
          <span class="label">${a}</span>
        </div>
      `).join('\n');

      const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Asset Decode Challenge</title>
        <style>
          body { font-family: monospace; background: #111; color: #fff; padding: 20px; }
          .grid { display: flex; flex-wrap: wrap; gap: 10px; }
          .sprite-test-card {
            border: 1px solid #333;
            background: #222;
            width: 96px;
            height: 140px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
            position: relative;
          }
          .sprite-test-card img {
            width: 48px;
            height: 64px;
            object-fit: contain;
            image-rendering: auto;
          }
          .label { font-size: 8px; margin-top: 4px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Asset Rendering & Decode Challenge</h1>
        <div class="grid">
          ${imgTags}
        </div>
        <script>
          window.__TEST_RESULTS = {
            loaded: [],
            errors: [],
            decoded: []
          };
          const assets = ${JSON.stringify(assetList)};
          window.runDecodeChecks = async () => {
            const promises = assets.map(asset => {
              return new Promise(async (resolve) => {
                const img = new Image();
                img.src = '/assets/characters/' + asset;
                img.onload = async () => {
                  try {
                    await img.decode();
                    window.__TEST_RESULTS.decoded.push({
                      asset,
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                      aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(4),
                      complete: img.complete
                    });
                  } catch (decodeErr) {
                    window.__TEST_RESULTS.errors.push({ asset, error: 'decode_failed: ' + decodeErr.message });
                  }
                  window.__TEST_RESULTS.loaded.push(asset);
                  resolve();
                };
                img.onerror = (e) => {
                  window.__TEST_RESULTS.errors.push({ asset, error: 'load_failed' });
                  resolve();
                };
              });
            });
            await Promise.all(promises);
            return window.__TEST_RESULTS;
          };
        </script>
      </body>
      </html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } else if (req.url === '/favicon.ico') {
      res.writeHead(204);
      res.end();
    } else if (req.url.startsWith('/assets/characters/')) {
      const fileName = path.basename(req.url);
      const filePath = path.join(ASSETS_DIR, fileName);
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));

  const cdpPort = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acom-challenger-chrome-'));

  let chromeProc = null;
  let ws = null;
  const network404s = [];
  const consoleErrors = [];

  try {
    chromeProc = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-gpu',
            '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      'about:blank'
    ], { stdio: 'pipe' });

    let debuggerUrl = null;
    for (let i = 0; i < 40; i++) {
      await sleep(100);
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
        const list = await res.json();
        const page = list.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension')) || list.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          debuggerUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }

    if (!debuggerUrl) throw new Error('Chrome CDP connection failed');

    ws = new WebSocket(debuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const callbacks = new Map();
    function sendCDP(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        callbacks.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && callbacks.has(data.id)) {
        const cb = callbacks.get(data.id);
        callbacks.delete(data.id);
        if (data.error) cb.reject(new Error(data.error.message));
        else cb.resolve(data.result);
      } else if (data.method === 'Network.responseReceived') {
        const r = data.params.response;
        if (r.url && !r.url.endsWith('favicon.ico') && r.status >= 400) {
          network404s.push({ url: r.url, status: r.status });
        }
      } else if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
        consoleErrors.push(data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' '));
      } else if (data.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(data.params.exceptionDetails.text);
      }
    };

    await sendCDP('Network.enable');
    await sendCDP('Runtime.enable');
    await sendCDP('Page.enable');

    await sendCDP('Page.navigate', { url: `http://127.0.0.1:${port}/test.html` });
    await sleep(1000);

    const testEval = await sendCDP('Runtime.evaluate', {
      expression: `window.runDecodeChecks()`,
      awaitPromise: true,
      returnByValue: true
    });

    const browserResults = testEval.result.value || {};
    return {
      network404s,
      consoleErrors,
      browserResults
    };
  } finally {
    if (ws) ws.close();
    if (chromeProc) chromeProc.kill('SIGTERM');
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

async function main() {
  console.log('================================================================');
  console.log('  CHALLENGER M1.2: CHARACTER ASSET EMPIRICAL TEST HARNESS');
  console.log('================================================================\n');

  console.log(`Checking ${ALL_ASSETS.length} character assets in ${ASSETS_DIR}...`);

  const assetDetails = {};
  const hashSet = new Set();
  let byteLevelPass = true;

  for (const asset of ALL_ASSETS) {
    const fullPath = path.join(ASSETS_DIR, asset);
    if (!fs.existsSync(fullPath)) {
      console.error(`[CRITICAL] Asset missing: ${asset}`);
      byteLevelPass = false;
      assetDetails[asset] = { exists: false, error: 'File missing' };
      continue;
    }

    const buf = fs.readFileSync(fullPath);
    const parsed = parsePngDeep(buf);
    if (!parsed.valid) {
      console.error(`[CRITICAL] Asset corrupted: ${asset} -> ${parsed.error}`);
      byteLevelPass = false;
      assetDetails[asset] = { exists: true, valid: false, error: parsed.error };
      continue;
    }

    // Check dimensions & aspect ratio
    const is192x256 = parsed.width === 192 && parsed.height === 256;
    const is3x4Ratio = Math.abs(parsed.aspectRatio - (192 / 256)) < 0.0001;
    const hasAntiAliasing = parsed.semiAlphaCount >= 100;
    const hasTransparency = parsed.transRatio >= 0.15;
    const hasSufficientSubject = parsed.opaqueRatio >= 0.10;
    const hasRichColors = parsed.uniqueColorCount >= 50;
    const isHashUnique = !hashSet.has(parsed.sha256);
    hashSet.add(parsed.sha256);

    const assetPass = is192x256 && is3x4Ratio && hasAntiAliasing && hasTransparency && hasSufficientSubject && hasRichColors && isHashUnique;
    if (!assetPass) byteLevelPass = false;

    assetDetails[asset] = {
      exists: true,
      valid: true,
      sizeBytes: buf.length,
      width: parsed.width,
      height: parsed.height,
      aspectRatio: parsed.aspectRatio,
      transRatio: parsed.transRatio,
      opaqueRatio: parsed.opaqueRatio,
      semiAlphaCount: parsed.semiAlphaCount,
      uniqueColors: parsed.uniqueColorCount,
      sha256: parsed.sha256,
      boundingBox: parsed.boundingBox,
      centering: parsed.centering,
      checks: {
        is192x256,
        is3x4Ratio,
        hasAntiAliasing,
        hasTransparency,
        hasSufficientSubject,
        hasRichColors,
        isHashUnique
      },
      passed: assetPass
    };

    console.log(`[${assetPass ? 'PASS' : 'FAIL'}] ${asset.padEnd(26)} | ${parsed.width}x${parsed.height} | AA:${String(parsed.semiAlphaCount).padStart(4)}px | Colors:${String(parsed.uniqueColorCount).padStart(3)} | CenterOffset:${parsed.centering.visualCenterOffset.toFixed(1).padStart(5)}px | BottomGap:${String(parsed.centering.bottomGap).padStart(2)}px`);
  }

  // Cross-pose bounding box & grounding analysis
  console.log('\n--- Cross-Pose Alignment & Isometric Anchoring Analysis ---');
  const archetypeSummary = {};
  for (const char of CHARACTERS) {
    const poses = POSES.map(p => `${char}${p}.png`);
    const poseData = poses.map(p => assetDetails[p]).filter(d => d && d.valid);

    const idle = assetDetails[`${char}.png`];
    const attack = assetDetails[`${char}_attack.png`];
    const hit = assetDetails[`${char}_hit.png`];
    const dead = assetDetails[`${char}_dead.png`];

    // Max horizontal offset deviation across standing poses (idle, attack, hit)
    const standingOffsets = [idle, attack, hit].filter(Boolean).map(p => p.centering.visualCenterOffset);
    const maxOffsetSpread = Math.max(...standingOffsets) - Math.min(...standingOffsets);

    // Max bottom gap deviation across standing poses
    const standingBottomGaps = [idle, attack, hit].filter(Boolean).map(p => p.centering.bottomGap);
    const maxBottomGapSpread = Math.max(...standingBottomGaps) - Math.min(...standingBottomGaps);

    archetypeSummary[char] = {
      standingMaxCenterSpread: maxOffsetSpread,
      standingMaxBottomGapSpread: maxBottomGapSpread,
      idleBottomGap: idle?.centering.bottomGap,
      deadSubjectHeight: dead?.boundingBox.subjectHeight,
      idleSubjectHeight: idle?.boundingBox.subjectHeight
    };

    console.log(`Archetype ${char.padEnd(14)}: Standing Center Spread: ${maxOffsetSpread.toFixed(1)}px | Bottom Gap Spread: ${maxBottomGapSpread}px | Idle BBox: ${idle?.boundingBox.subjectWidth}x${idle?.boundingBox.subjectHeight} (Gap: ${idle?.centering.bottomGap}px)`);
  }

  console.log('\n--- Headless Chrome In-Browser Image Decoding & DOM Validation ---');
  let browserTestResult = null;
  let browserPass = false;
  try {
    browserTestResult = await runBrowserDecodeTest(ALL_ASSETS);
    const { network404s, consoleErrors, browserResults } = browserTestResult;
    const totalLoaded = browserResults.loaded?.length || 0;
    const totalDecoded = browserResults.decoded?.length || 0;
    const decodeErrors = browserResults.errors?.length || 0;

    console.log(`Browser Total Requested: ${ALL_ASSETS.length}`);
    console.log(`Browser Total Loaded:    ${totalLoaded}`);
    console.log(`Browser Total Decoded:   ${totalDecoded}`);
    console.log(`Browser 404 Errors:      ${network404s.length}`);
    console.log(`Browser Console Errors:  ${consoleErrors.length}`);
    console.log(`Browser Decode Failures: ${decodeErrors}`);

    browserPass = (totalLoaded === ALL_ASSETS.length) && (totalDecoded === ALL_ASSETS.length) && (network404s.length === 0) && (consoleErrors.length === 0) && (decodeErrors === 0);
  } catch (err) {
    console.error('Browser Test Harness Error:', err);
    browserPass = false;
  }

  console.log('\n================================================================');
  console.log(`FINAL EMPIRICAL VERDICT: ${byteLevelPass && browserPass ? 'PASS' : 'FAIL'}`);
  console.log('================================================================');

  const fullReport = {
    timestamp: new Date().toISOString(),
    verdict: (byteLevelPass && browserPass) ? 'PASS' : 'FAIL',
    totalAssetsChecked: ALL_ASSETS.length,
    byteLevelPass,
    browserPass,
    assetDetails,
    archetypeSummary,
    browserTestResult
  };

  const outPath = path.resolve(__dirname, '../.agents/challenger_m1_2/empirical_challenge_report.json');
  fs.writeFileSync(outPath, JSON.stringify(fullReport, null, 2));
  console.log(`Full empirical report written to: ${outPath}`);

  process.exit((byteLevelPass && browserPass) ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
