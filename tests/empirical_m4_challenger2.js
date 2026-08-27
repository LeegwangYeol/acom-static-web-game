/**
 * tests/empirical_m4_challenger2.js
 * Empirical Challenge Harness for Milestone 4 (Final E2E Verification & Hardening).
 *
 * Programmatically and empirically verifies:
 * 1. Asset Non-Pixel-Art Verification (Magic bytes, dimensions, alpha ratio, anti-aliasing, color depth, hash uniqueness)
 * 2. DOM & Dynamic Spawning Integrity via Headless Chrome (0 404s, 0 console errors, 6 units in DOM, interactive combat UI)
 * 3. Isometric Layout Non-Overlap & Non-Clipping Validation (Multi-resolution viewport tests, panel clearances, spatial disjointness)
 * 4. Combat State Machine Invariants (AP/HP clamping, coordinate uniqueness, cover obstacle disjointness)
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');
const { spawn } = require('child_process');
const zlib = require('zlib');
const crypto = require('crypto');

const REPORT_PATH = path.resolve(__dirname, '../.agents/reports/empirical_m4_challenge_report.json');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ASSETS_DIR = path.resolve(__dirname, '../assets/characters');
const APP_PORT = 3000;
const API_BASE = `http://127.0.0.1:${APP_PORT}/api`;

function getFreePort() {
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

// ---------------------------------------------------------
// 1. Asset Parser & Oracle
// ---------------------------------------------------------
function parsePng(buffer) {
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

    const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
    const totalPixels = width * height;
    let transparentCount = 0;
    let semiAlphaCount = 0;
    let opaqueCount = 0;
    const uniqueColors = new Set();

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

                if (a === 0) transparentCount++;
                else if (a === 255) opaqueCount++;
                else semiAlphaCount++;
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

function verifyAssets() {
    console.log('\n[CHALLENGE 1] Executing High-Res Non-Pixel-Art Asset Validation...');
    const REQUIRED_ASSETS = [
        'ally_assault.png',
        'ally_recon.png',
        'ally_heavy.png',
        'enemy_mutant.png',
        'enemy_scout.png',
        'enemy_heavy.png'
    ];

    const results = {};
    const seenHashes = new Set();
    let allPassed = true;

    for (const filename of REQUIRED_ASSETS) {
        const filePath = path.join(ASSETS_DIR, filename);
        if (!fs.existsSync(filePath)) {
            results[filename] = { passed: false, error: 'File missing' };
            allPassed = false;
            continue;
        }

        const buf = fs.readFileSync(filePath);
        const parsed = parsePng(buf);

        if (!parsed.valid) {
            results[filename] = { passed: false, error: parsed.error };
            allPassed = false;
            continue;
        }

        const failures = [];
        if (parsed.width < 128 || parsed.height < 128) {
            failures.push(`Resolution ${parsed.width}x${parsed.height} < 128x128`);
        }
        if (parsed.transRatio < 0.15) {
            failures.push(`Transparency ratio ${(parsed.transRatio * 100).toFixed(1)}% < 15%`);
        }
        if (parsed.opaqueRatio < 0.10) {
            failures.push(`Opaque ratio ${(parsed.opaqueRatio * 100).toFixed(1)}% < 10%`);
        }
        if (parsed.semiAlphaCount < 100) {
            failures.push(`Anti-aliasing pixels ${parsed.semiAlphaCount} < 100 (possible pixel art)`);
        }
        if (parsed.uniqueColorCount < 50) {
            failures.push(`Color count ${parsed.uniqueColorCount} < 50 (possible 8-bit palette)`);
        }
        if (seenHashes.has(parsed.sha256)) {
            failures.push(`Duplicate SHA-256 hash: ${parsed.sha256}`);
        }
        seenHashes.add(parsed.sha256);

        const passed = failures.length === 0;
        if (!passed) allPassed = false;

        results[filename] = {
            passed,
            width: parsed.width,
            height: parsed.height,
            transRatio: Number(parsed.transRatio.toFixed(4)),
            opaqueRatio: Number(parsed.opaqueRatio.toFixed(4)),
            semiAlphaCount: parsed.semiAlphaCount,
            uniqueColorCount: parsed.uniqueColorCount,
            sha256: parsed.sha256,
            failures: failures.length > 0 ? failures : undefined
        };

        console.log(`  ${passed ? '✓' : '✗'} ${filename.padEnd(18)} : ${parsed.width}x${parsed.height}, ${(parsed.transRatio * 100).toFixed(1)}% alpha, ${parsed.semiAlphaCount} AA px, ${parsed.uniqueColorCount} colors, sha: ${parsed.sha256.substring(0, 10)}...`);
    }

    return {
        status: allPassed ? 'PASS' : 'FAIL',
        totalAssets: REQUIRED_ASSETS.length,
        passedAssets: Object.values(results).filter(r => r.passed).length,
        results
    };
}

// ---------------------------------------------------------
// 2. Headless Chrome DOM, Network & Layout Verification
// ---------------------------------------------------------
async function ensureServerRunning() {
    try {
        const res = await fetch(`${API_BASE}/state`);
        if (res.ok) {
            console.log(`  Active game server detected on port ${APP_PORT}.`);
            return null;
        }
    } catch {}

    console.log(`  Launching background game server on port ${APP_PORT}...`);
    const serverProc = spawn('node', [path.resolve(__dirname, '../server.js')], {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'pipe'
    });

    for (let i = 0; i < 40; i++) {
        await sleep(100);
        try {
            const res = await fetch(`${API_BASE}/state`);
            if (res.ok) {
                console.log('  Game server is ready.');
                return serverProc;
            }
        } catch {}
    }
    throw new Error(`Failed to start game server on port ${APP_PORT}`);
}

async function verifyHeadlessChrome() {
    console.log('\n[CHALLENGE 2 & 3] Launching Headless Chrome for DOM, Network & Multi-Viewport Layout Integrity...');
    const serverProc = await ensureServerRunning();

    const cdpPort = await getFreePort();
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acom-empirical-chrome-'));

    let chromeProc = null;
    let ws = null;

    const networkRequests = [];
    const networkErrors = [];
    const consoleLogs = [];
    const consoleErrors = [];

    try {
        chromeProc = spawn(CHROME_PATH, [
            '--headless=new',
            `--remote-debugging-port=${cdpPort}`,
            `--user-data-dir=${userDataDir}`,
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions',
            '--disable-background-networking',
            '--window-size=1440,900',
            'about:blank'
        ], { stdio: 'pipe' });

        let debuggerUrl = null;
        for (let i = 0; i < 40; i++) {
            await sleep(100);
            try {
                const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
                const list = await res.json();
                const pageTarget = list.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension')) || list[0];
                if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                    debuggerUrl = pageTarget.webSocketDebuggerUrl;
                    break;
                }
            } catch {}
        }

        if (!debuggerUrl) {
            throw new Error(`Failed to obtain Chrome CDP WebSocket on port ${cdpPort}`);
        }

        ws = new WebSocket(debuggerUrl);
        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let msgId = 1;
        const pendingCallbacks = new Map();
        function sendCDP(method, params = {}) {
            return new Promise((resolve, reject) => {
                const id = msgId++;
                pendingCallbacks.set(id, { resolve, reject, method });
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        const requestUrlMap = new Map();

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.id && pendingCallbacks.has(data.id)) {
                const cb = pendingCallbacks.get(data.id);
                pendingCallbacks.delete(data.id);
                if (data.error) cb.reject(new Error(data.error.message));
                else cb.resolve(data.result);
            } else if (data.method) {
                if (data.method === 'Network.requestWillBeSent') {
                    requestUrlMap.set(data.params.requestId, data.params.request.url);
                } else if (data.method === 'Network.responseReceived') {
                    const resp = data.params.response;
                    if ((resp.url.startsWith('http://127.0.0.1') || resp.url.startsWith('http://localhost')) && !resp.url.endsWith('favicon.ico')) {
                        networkRequests.push({
                            url: resp.url,
                            status: resp.status,
                            statusText: resp.statusText,
                            mimeType: resp.mimeType
                        });
                        if (resp.status >= 400) {
                            networkErrors.push({ url: resp.url, status: resp.status, statusText: resp.statusText });
                        }
                    }
                } else if (data.method === 'Network.loadingFailed') {
                    const reqUrl = requestUrlMap.get(data.params.requestId) || data.params.requestId;
                    if (typeof reqUrl === 'string' && (reqUrl.startsWith('http://127.0.0.1') || reqUrl.startsWith('http://localhost')) && !reqUrl.endsWith('favicon.ico')) {
                        if (data.params.errorText !== 'net::ERR_ABORTED') {
                            networkErrors.push({ url: reqUrl, errorText: data.params.errorText });
                        }
                    }
                } else if (data.method === 'Runtime.consoleAPICalled') {
                    const args = data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
                    consoleLogs.push({ type: data.params.type, text: args });
                    if (data.params.type === 'error') {
                        consoleErrors.push({ type: 'error', text: args });
                    }
                } else if (data.method === 'Runtime.exceptionThrown') {
                    const text = data.params.exceptionDetails.text + (data.params.exceptionDetails.exception?.description ? ': ' + data.params.exceptionDetails.exception.description : '');
                    consoleErrors.push({ type: 'exception', text });
                }
            }
        };

        await sendCDP('Network.enable');
        await sendCDP('Runtime.enable');
        await sendCDP('Page.enable');
        await sendCDP('DOM.enable');

        const gameUrl = `http://127.0.0.1:${APP_PORT}/index.html`;
        console.log(`  Navigating to ${gameUrl}...`);
        await sendCDP('Page.navigate', { url: gameUrl });
        await sleep(1500);

        // Dynamically spawn 3v3 squad
        console.log('  Triggering 3v3 squad spawn via /api/init_random...');
        const evalSpawn = await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                const baseUrl = window.location.origin;
                await fetch(baseUrl + '/api/init_random', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ players: 3, enemies: 3 })
                });
                if (typeof fetchState === 'function') await fetchState();
                else if (typeof init === 'function') await init();
                return { success: true };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });

        await sleep(800);

        // Inspect DOM Elements
        const domInspection = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const getRect = el => {
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
                };

                const grid = document.getElementById('grid-container');
                const unitsLayer = document.getElementById('units-layer');
                const squadDock = document.getElementById('squad-dock');
                const unitInfo = document.getElementById('unit-info');
                const targetPreview = document.getElementById('target-preview-panel');
                const combatLog = document.getElementById('combat-log-container');
                const uiPanel = document.getElementById('ui-panel');
                const gameContainer = document.getElementById('game-container');

                const units = Array.from(document.querySelectorAll('#units-layer .unit')).map(u => {
                    const sprite = u.querySelector('.unit-sprite');
                    const hpBar = u.querySelector('.unit-hp-bar');
                    const shadow = u.querySelector('.unit-shadow');
                    const comp = window.getComputedStyle(u);
                    const spriteComp = sprite ? window.getComputedStyle(sprite) : null;
                    return {
                        id: u.id,
                        className: u.className,
                        leftStyle: u.style.left,
                        topStyle: u.style.top,
                        zIndex: parseInt(comp.zIndex) || 0,
                        hasSprite: !!sprite,
                        bgImage: spriteComp ? spriteComp.backgroundImage : '',
                        hasHpBar: !!hpBar,
                        hasShadow: !!shadow,
                        rect: getRect(u)
                    };
                });

                const squadCards = Array.from(document.querySelectorAll('#squad-dock .squad-card')).map(c => ({
                    unitId: c.dataset.unitId,
                    className: c.className,
                    hasPortrait: !!c.querySelector('.squad-card-portrait'),
                    hasHpBar: !!c.querySelector('.squad-card-hp-bar')
                }));

                const cells = document.querySelectorAll('#grid-container .cell').length;

                return {
                    cellsCount: cells,
                    unitsCount: units.length,
                    units,
                    squadCardsCount: squadCards.length,
                    squadCards,
                    rects: {
                        gameContainer: getRect(gameContainer),
                        grid: getRect(grid),
                        uiPanel: getRect(uiPanel),
                        squadDock: getRect(squadDock),
                        unitInfo: getRect(unitInfo),
                        targetPreview: getRect(targetPreview),
                        combatLog: getRect(combatLog)
                    }
                };
            })()`,
            returnByValue: true
        });

        const dom = domInspection.result.value || {};
        console.log(`  DOM Grid Cells: ${dom.cellsCount}, Spawned Units in DOM: ${dom.unitsCount}, Squad Cards: ${dom.squadCardsCount}`);

        // Check Multi-Viewport Layout Integrity
        const viewports = [
            { width: 1440, height: 900, name: 'Standard Desktop (1440x900)' },
            { width: 1280, height: 800, name: 'Compact Laptop (1280x800)' },
            { width: 1920, height: 1080, name: 'Widescreen Full HD (1920x1080)' }
        ];

        const layoutResults = [];

        for (const vp of viewports) {
            await sendCDP('Emulation.setDeviceMetricsOverride', {
                width: vp.width,
                height: vp.height,
                deviceScaleFactor: 1,
                mobile: false
            });
            await sleep(300);

            const vpLayoutEval = await sendCDP('Runtime.evaluate', {
                expression: `(() => {
                    const getRect = el => {
                        if (!el) return null;
                        const r = el.getBoundingClientRect();
                        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
                    };

                    const gameContainer = document.getElementById('game-container');
                    const gridContainer = document.getElementById('grid-container');
                    const uiPanel = document.getElementById('ui-panel');
                    const squadDock = document.getElementById('squad-dock');

                    const containerRect = getRect(gameContainer);
                    const gridRect = getRect(gridContainer);
                    const uiPanelRect = getRect(uiPanel);
                    const dockRect = getRect(squadDock);

                    const units = Array.from(document.querySelectorAll('#units-layer .unit')).map(u => ({
                        id: u.id,
                        leftStyle: u.style.left,
                        topStyle: u.style.top,
                        zIndex: parseInt(window.getComputedStyle(u).zIndex) || 0,
                        rect: getRect(u)
                    }));

                    // Unit collision detection (pair collisions on identical styles)
                    const duplicateCollisions = [];
                    for (let i = 0; i < units.length; i++) {
                        for (let j = i + 1; j < units.length; j++) {
                            if (units[i].leftStyle === units[j].leftStyle && units[i].topStyle === units[j].topStyle) {
                                duplicateCollisions.push({ u1: units[i].id, u2: units[j].id, pos: units[i].leftStyle });
                            }
                        }
                    }

                    // Vertical clearance between grid bottom and UI panel top
                    let verticalClearance = null;
                    let uiClipsGrid = false;
                    if (gridRect && uiPanelRect) {
                        verticalClearance = uiPanelRect.top - gridRect.bottom;
                        uiClipsGrid = verticalClearance < -2; // Overlap by more than 2px is clipping
                    }

                    const viewportWidth = window.innerWidth;
                    const containerFits = containerRect ? containerRect.width <= viewportWidth + 20 : true;

                    return {
                        viewport: { width: window.innerWidth, height: window.innerHeight },
                        containerRect,
                        gridRect,
                        uiPanelRect,
                        verticalClearance,
                        uiClipsGrid,
                        containerFits,
                        duplicateCollisions
                    };
                })()`,
                returnByValue: true
            });

            const vpl = vpLayoutEval.result.value;
            const passed = !vpl.uiClipsGrid && vpl.duplicateCollisions.length === 0 && vpl.containerFits;
            layoutResults.push({
                name: vp.name,
                passed,
                ...vpl
            });

            console.log(`  ${passed ? '✓' : '✗'} Viewport [${vp.name}] : Clearance=${vpl.verticalClearance?.toFixed(1)}px, GridClip=${vpl.uiClipsGrid}, Collisions=${vpl.duplicateCollisions.length}, ContainerFits=${vpl.containerFits}`);
        }

        // Test Interactive UI Operations in DOM
        console.log('  Testing interactive DOM UI events (hotkeys, selection, live preview HUD)...');
        const interactionEval = await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                const results = [];
                
                // 1. Select squad card 2
                const cards = document.querySelectorAll('#squad-dock .squad-card');
                if (cards.length >= 2) {
                    cards[1].click();
                    const activeUnitName = document.getElementById('unit-name')?.innerText;
                    results.push({ test: 'squad_card_selection', passed: !!activeUnitName });
                }

                // 2. Trigger Move Highlight
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
                const movableCells = document.querySelectorAll('#grid-container .cell.valid-move').length;
                results.push({ test: 'move_highlight', passed: movableCells > 0, count: movableCells });

                // 3. Trigger Shoot Highlight & Target Preview
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
                const targetableCells = document.querySelectorAll('#grid-container .cell.valid-target').length;
                const targetPreviewActive = document.getElementById('target-preview-active');
                const isPreviewVisible = targetPreviewActive && window.getComputedStyle(targetPreviewActive).display !== 'none';
                results.push({ test: 'shoot_preview', passed: targetableCells > 0, isPreviewVisible });

                // Reset selection with Escape
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

                return results;
            })()`,
            awaitPromise: true,
            returnByValue: true
        });

        const interactions = interactionEval.result.value || [];
        interactions.forEach(i => {
            console.log(`  ${i.passed ? '✓' : '✗'} DOM Interactive [${i.test}] : passed=${i.passed}`);
        });

        const domPassed = dom.cellsCount === 100 && dom.unitsCount === 6 && dom.squadCardsCount === 3;
        const networkPassed = networkErrors.length === 0;
        const consolePassed = consoleErrors.length === 0;
        const layoutPassed = layoutResults.every(l => l.passed);

        return {
            status: (domPassed && networkPassed && consolePassed && layoutPassed) ? 'PASS' : 'FAIL',
            domCheck: {
                status: domPassed ? 'PASS' : 'FAIL',
                cellsCount: dom.cellsCount,
                unitsCount: dom.unitsCount,
                squadCardsCount: dom.squadCardsCount,
                units: dom.units,
                interactions
            },
            networkCheck: {
                status: networkPassed ? 'PASS' : 'FAIL',
                totalRequests: networkRequests.length,
                totalErrors: networkErrors.length,
                errors: networkErrors
            },
            consoleCheck: {
                status: consolePassed ? 'PASS' : 'FAIL',
                totalLogs: consoleLogs.length,
                totalErrors: consoleErrors.length,
                errors: consoleErrors
            },
            layoutCheck: {
                status: layoutPassed ? 'PASS' : 'FAIL',
                viewports: layoutResults
            }
        };
    } finally {
        if (ws) ws.close();
        if (chromeProc) chromeProc.kill('SIGTERM');
        if (serverProc) serverProc.kill('SIGTERM');
        try {
            fs.rmSync(userDataDir, { recursive: true, force: true });
        } catch {}
    }
}

// ---------------------------------------------------------
// 3. Combat Engine Invariant Stress Oracle
// ---------------------------------------------------------
async function verifyCombatInvariants() {
    console.log('\n[CHALLENGE 4] Executing Tactical Engine & State Invariant Stress Test...');
    const serverProc = await ensureServerRunning();

    try {
        const initRes = await fetch(`${API_BASE}/init_random`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ players: 3, enemies: 3 })
        });
        let state = await initRes.json();

        let invariantsHeld = true;
        const violations = [];

        function checkInvariants(currentState, roundIdx, stage) {
            const livingUnits = currentState.units.filter(u => u.hp > 0);
            
            // Invariant 1: Position Disjointness
            const posSet = new Set();
            for (const u of livingUnits) {
                const key = `${u.x},${u.y}`;
                if (posSet.has(key)) {
                    violations.push(`Round ${roundIdx} (${stage}): Duplicate position ${key} for unit ${u.id}`);
                    invariantsHeld = false;
                }
                posSet.add(key);
            }

            // Invariant 2: Cover Clearance
            for (const u of livingUnits) {
                const cell = currentState.grid[u.y] && currentState.grid[u.y][u.x];
                if (cell && cell.type !== 0) {
                    violations.push(`Round ${roundIdx} (${stage}): Unit ${u.id} is positioned inside cover tile (${u.x}, ${u.y}) type=${cell.type}`);
                    invariantsHeld = false;
                }
            }

            // Invariant 3: HP and AP bounds
            for (const u of currentState.units) {
                if (u.hp < 0 || u.hp > u.maxHp) {
                    violations.push(`Round ${roundIdx} (${stage}): Unit ${u.id} HP out of bounds (${u.hp}/${u.maxHp})`);
                    invariantsHeld = false;
                }
                if (u.ap < 0 || u.ap > u.maxAp) {
                    violations.push(`Round ${roundIdx} (${stage}): Unit ${u.id} AP out of bounds (${u.ap}/${u.maxAp})`);
                    invariantsHeld = false;
                }
                if (u.hp === 0 && u.isAlive === true) {
                    violations.push(`Round ${roundIdx} (${stage}): Unit ${u.id} is alive with 0 HP`);
                    invariantsHeld = false;
                }
            }
        }

        checkInvariants(state, 0, 'initial');

        for (let round = 1; round <= 8; round++) {
            const players = state.units.filter(u => u.type === 'player' && u.hp > 0 && u.ap > 0);
            const enemies = state.units.filter(u => u.type === 'enemy' && u.hp > 0);

            if (players.length === 0 || enemies.length === 0) break;

            for (const p of players) {
                if (p.hp <= 0 || p.ap <= 0) continue;
                const target = enemies.find(e => e.hp > 0);
                if (target) {
                    const shootRes = await fetch(`${API_BASE}/action`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'shoot', payload: { actorId: p.id, targetId: target.id } })
                    });
                    if (shootRes.ok) {
                        state = await shootRes.json();
                        checkInvariants(state, round, `player_shoot_${p.id}`);
                    }
                }
            }

            const endTurnRes = await fetch(`${API_BASE}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'end_turn', payload: {} })
            });
            if (endTurnRes.ok) {
                state = await endTurnRes.json();
                checkInvariants(state, round, 'enemy_turn');
            }
        }

        console.log(`  ${invariantsHeld ? '✓' : '✗'} Combat State Invariants: Violations=${violations.length}`);
        return {
            status: invariantsHeld ? 'PASS' : 'FAIL',
            violations
        };
    } finally {
        if (serverProc) serverProc.kill('SIGTERM');
    }
}

// ---------------------------------------------------------
// Master Execution
// ---------------------------------------------------------
async function runEmpiricalChallenge() {
    console.log('================================================================');
    console.log('       ACOM EMPIRICAL CHALLENGER M4 HARNESS (2 of 2)            ');
    console.log('================================================================');

    const assetResults = verifyAssets();
    const headlessResults = await verifyHeadlessChrome();
    const invariantResults = await verifyCombatInvariants();

    const overallPassed = assetResults.status === 'PASS' &&
                          headlessResults.status === 'PASS' &&
                          invariantResults.status === 'PASS';

    const fullReport = {
        timestamp: new Date().toISOString(),
        milestone: 'M4',
        challenger: 'challenger_m4_2',
        overallVerdict: overallPassed ? 'PASS' : 'FAIL',
        acceptanceCriteria: {
            ac1_assetCheck: assetResults,
            ac2_domAndNetworkIntegrity: {
                status: headlessResults.status,
                dom: headlessResults.domCheck,
                network: headlessResults.networkCheck,
                console: headlessResults.consoleCheck
            },
            ac3_layoutValidation: headlessResults.layoutCheck,
            ac4_combatEngineInvariants: invariantResults
        }
    };

    const reportDir = path.dirname(REPORT_PATH);
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(fullReport, null, 2));

    console.log('\n================================================================');
    console.log(` EMPIRICAL VERDICT: ${fullReport.overallVerdict}`);
    console.log(` Detailed Report Written to: ${REPORT_PATH}`);
    console.log('================================================================\n');

    return fullReport;
}

if (require.main === module) {
    runEmpiricalChallenge()
        .then(rep => {
            process.exit(rep.overallVerdict === 'PASS' ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal Challenge Execution Error:', err);
            process.exit(1);
        });
}

module.exports = { runEmpiricalChallenge };
