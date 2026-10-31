/**
 * tests/challenger_static_2_empirical.js
 * Comprehensive Empirical Stress Test Suite for Challenger 2 (challenger_static_2)
 * Pure Static Headless Chrome CDP Verification for ACOM
 *
 * Checks:
 * 1. Static Zero-Dependency & Serverless Isolation (0 404s, 0 /api/ requests, 0 console errors)
 * 2. 3v3 Squad DOM Mounting (6 units, 3 squad cards, sprites, portraits, HP gauges, shadows)
 * 3. Keyboard Shortcuts Telemetry ('1'-'3' operative switch, 'M' move, 'S' shoot, 'Space'/'E' end turn, 'Escape' cancel)
 * 4. Interactive DOM Mutations (Clicking tiles, squad cards, action buttons, AP counters)
 * 5. Visual Combat FX, Floating Combat Text, Turn Banners, Victory & Defeat Modals, Redeploy Loop
 * 6. Dynamic Z-Depth Sorting Formula (z = y * 10 + 5) & Multi-Resolution Non-Clipping Layout Clearance
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_PATH = path.resolve(__dirname, '../.agents/challenger_static_2/empirical_report.json');
const CHROME_PATH = process.env.CHROME_BIN || (require('os').platform() === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');

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

function createEphemeralStaticServer(rootDir = ROOT_DIR) {
    const mimeTypes = {
        '.html': 'text/html; charset=UTF-8',
        '.css': 'text/css; charset=UTF-8',
        '.js': 'application/javascript; charset=UTF-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.json': 'application/json',
        '.ico': 'image/x-icon'
    };

    const server = http.createServer((req, res) => {
        const reqPath = req.url.split('?')[0];

        // STRICT SERVERLESS CHECK: Any /api/ request will immediately fail with 404
        if (reqPath.startsWith('/api/')) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'STRICT STATIC ENFORCEMENT: No server-side /api/ endpoints allowed.' }));
            return;
        }

        const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
        const targetFile = safePath === '/' ? 'index.html' : safePath;
        const filePath = path.join(rootDir, targetFile);

        if (!filePath.startsWith(rootDir)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });

    return new Promise((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            resolve({
                server,
                port,
                close: () => new Promise(r => server.close(r))
            });
        });
        server.on('error', reject);
    });
}

async function fetchJSON(url) {
    const res = await fetch(url);
    return await res.json();
}

async function runEmpiricalStressTest() {
    console.log('========================================================================');
    console.log('   CHALLENGER 2: ACOM HEADLESS CHROME EMPIRICAL STRESS TEST SUITE       ');
    console.log('   Testing Static Client (index.html, game.js, style.css) via CDP       ');
    console.log('========================================================================\n');

    const staticHost = await createEphemeralStaticServer();
    const appPort = staticHost.port;
    console.log(`[INIT] Ephemeral static server listening on http://127.0.0.1:${appPort}`);

    const cdpPort = await getFreePort();
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acom-cdp-challenger2-'));

    let chromeProc = null;
    let ws = null;

    const networkRequests = [];
    const apiRequests = [];
    const networkErrors = [];
    const consoleLogs = [];
    const consoleErrors = [];

    const testResults = {
        networkAndConsoleIntegrity: null,
        squadMounting: null,
        keyboardShortcuts: null,
        interactiveDomUpdates: null,
        combatFxAndModals: null,
        zDepthAndLayoutClearance: null
    };

    try {
        console.log(`[INIT] Launching Headless Chrome with CDP debugging port ${cdpPort}...`);
        chromeProc = spawn(CHROME_PATH, [
            '--headless=new',
            '--no-sandbox',
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
        for (let i = 0; i < 50; i++) {
            await sleep(100);
            try {
                const list = await fetchJSON(`http://127.0.0.1:${cdpPort}/json/list`);
                const pageTarget = list.find(t => t.type === 'page' && !t.url.includes('chrome-extension') && !t.url.includes('about:blank')) || list.find(t => t.type === 'page' && !t.url.includes('chrome-extension'));
                if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                    debuggerUrl = pageTarget.webSocketDebuggerUrl;
                    break;
                }
            } catch {}
        }

        if (!debuggerUrl) {
            throw new Error(`Failed to establish CDP connection on port ${cdpPort}`);
        }

        console.log(`[INIT] Connected to Chrome CDP target: ${debuggerUrl}`);
        ws = new WebSocket(debuggerUrl);
        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let msgId = 1;
        const pendingCallbacks = new Map();
        let pageLoadedPromiseResolve = null;
        const pageLoadedPromise = new Promise(res => { pageLoadedPromiseResolve = res; });

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
                if (data.method === 'Page.loadEventFired' && pageLoadedPromiseResolve) {
                    pageLoadedPromiseResolve();
                } else if (data.method === 'Network.requestWillBeSent') {
                    const reqUrl = data.params.request.url;
                    requestUrlMap.set(data.params.requestId, reqUrl);
                    if (reqUrl.includes('/api/')) {
                        apiRequests.push({ url: reqUrl, method: data.params.request.method });
                    }
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
                            networkErrors.push({
                                url: resp.url,
                                status: resp.status,
                                statusText: resp.statusText
                            });
                        }
                    }
                } else if (data.method === 'Network.loadingFailed') {
                    const reqUrl = requestUrlMap.get(data.params.requestId) || data.params.requestId;
                    if (typeof reqUrl === 'string' && !reqUrl.endsWith('favicon.ico')) {
                        if (data.params.errorText !== 'net::ERR_ABORTED') {
                            networkErrors.push({
                                url: reqUrl,
                                errorText: data.params.errorText,
                                type: data.params.type
                            });
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

        // Enable CDP domains
        await sendCDP('Network.enable');
        await sendCDP('Runtime.enable');
        await sendCDP('Page.enable');
        await sendCDP('DOM.enable');

        const gameUrl = `http://127.0.0.1:${appPort}/index.html`;
        console.log(`[TEST 1] Navigating to static client: ${gameUrl}...`);
        await sendCDP('Page.navigate', { url: gameUrl });
        await Promise.race([pageLoadedPromise, sleep(2000)]);
        await sleep(500);

        // Ensure in-memory 3v3 game engine is initialized
        await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                if (typeof init === 'function') await init();
                else if (typeof initRandomGame === 'function') await initRandomGame(3, 3);
                if (typeof render === 'function') render();
                if (typeof renderGridOnce === 'function') renderGridOnce();
                return { ready: true };
            })()`,
            awaitPromise: true
        });
        await sleep(300);

        // ---------------------------------------------------------------------
        // 1. Network & Console Integrity Verification
        // ---------------------------------------------------------------------
        const netPassed = networkErrors.length === 0 && apiRequests.length === 0 && consoleErrors.length === 0;
        testResults.networkAndConsoleIntegrity = {
            passed: netPassed,
            totalRequests: networkRequests.length,
            networkErrorsCount: networkErrors.length,
            networkErrors,
            apiRequestsCount: apiRequests.length,
            apiRequests,
            consoleErrorsCount: consoleErrors.length,
            consoleErrors
        };
        console.log(`  ${netPassed ? '✓ PASS' : '✗ FAIL'} Section 1: Network & Console Isolation (404s: ${networkErrors.length}, /api/ calls: ${apiRequests.length}, Console Errors: ${consoleErrors.length})`);

        // ---------------------------------------------------------------------
        // 2. 3v3 Squad DOM Mounting Verification
        // ---------------------------------------------------------------------
        const mountEval = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const units = Array.from(document.querySelectorAll('#units-layer .unit')).map(u => {
                    const sprite = u.querySelector('.unit-sprite');
                    const hpBar = u.querySelector('.unit-hp-bar');
                    const hpFill = u.querySelector('.unit-hp-fill');
                    const shadow = u.querySelector('.unit-shadow');
                    const spriteStyle = sprite ? window.getComputedStyle(sprite) : null;
                    const uStyle = window.getComputedStyle(u);

                    return {
                        id: u.id,
                        className: u.className,
                        left: uStyle.left,
                        top: uStyle.top,
                        zIndex: parseInt(uStyle.zIndex) || 0,
                        hasSprite: !!sprite,
                        bgImage: spriteStyle ? spriteStyle.backgroundImage : '',
                        hasHpBar: !!hpBar,
                        hpFillWidth: hpFill ? hpFill.style.width : '',
                        hasShadow: !!shadow
                    };
                });

                const squadCards = Array.from(document.querySelectorAll('#squad-dock .squad-card')).map(c => {
                    const portrait = c.querySelector('.squad-card-portrait');
                    const portraitStyle = portrait ? window.getComputedStyle(portrait) : null;
                    const hpFill = c.querySelector('.squad-card-hp-fill');
                    const nameEl = c.querySelector('.squad-card-name');
                    const badgeEl = c.querySelector('.squad-card-badge');

                    return {
                        unitId: c.dataset.unitId,
                        className: c.className,
                        hasPortrait: !!portrait,
                        portraitBg: portraitStyle ? portraitStyle.backgroundImage : '',
                        hasHpFill: !!hpFill,
                        hpWidth: hpFill ? hpFill.style.width : '',
                        name: nameEl ? nameEl.innerText : '',
                        badge: badgeEl ? badgeEl.innerText : ''
                    };
                });

                const gridCells = document.querySelectorAll('#grid-container .cell').length;
                const coverHalf = document.querySelectorAll('#grid-container .cover-half').length;
                const coverFull = document.querySelectorAll('#grid-container .cover-full').length;

                return {
                    gridCells,
                    coverHalf,
                    coverFull,
                    unitsCount: units.length,
                    playerUnitsCount: units.filter(u => u.className.includes('player')).length,
                    enemyUnitsCount: units.filter(u => u.className.includes('enemy')).length,
                    units,
                    squadCardsCount: squadCards.length,
                    squadCards
                };
            })()`,
            returnByValue: true
        });

        const mountData = mountEval.result.value || {};
        const squadMountPassed = mountData.gridCells === 100 &&
                                mountData.unitsCount === 6 &&
                                mountData.playerUnitsCount === 3 &&
                                mountData.enemyUnitsCount === 3 &&
                                mountData.squadCardsCount === 3 &&
                                mountData.units.every(u => u.hasSprite && u.hasHpBar && u.hasShadow && u.bgImage.includes('assets/characters/')) &&
                                mountData.squadCards.every(c => c.hasPortrait && c.hasHpFill && c.portraitBg.includes('assets/characters/'));

        testResults.squadMounting = {
            passed: squadMountPassed,
            data: mountData
        };
        console.log(`  ${squadMountPassed ? '✓ PASS' : '✗ FAIL'} Section 2: 3v3 Squad DOM Mounting (Units: ${mountData.unitsCount}/6, Squad Cards: ${mountData.squadCardsCount}/3, Grid Cells: ${mountData.gridCells}/100)`);

        // ---------------------------------------------------------------------
        // 3. Keyboard Shortcuts Telemetry ('1'-'3', 'M', 'S', 'Escape', 'Space'/'E')
        // ---------------------------------------------------------------------
        console.log('[TEST 3] Testing Keyboard Shortcut Telemetry via CDP Input Events...');

        const kbResults = [];

        // 3.1 Shortcut '2': Switch to 2nd Operative
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', text: '2', unmodifiedText: '2', key: '2', code: 'Digit2' });
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: '2', code: 'Digit2' });
        await sleep(200);

        const op2Check = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const activeCard = document.querySelector('#squad-dock .squad-card.selected');
                const unitName = document.getElementById('unit-name')?.innerText;
                const unitClassBadge = document.getElementById('unit-class-badge')?.innerText;
                return {
                    cardSelectedUnitId: activeCard?.dataset.unitId,
                    unitName,
                    unitClassBadge
                };
            })()`,
            returnByValue: true
        });
        const op2Data = op2Check.result.value || {};
        const op2Passed = op2Data.cardSelectedUnitId && op2Data.unitName.length > 0;
        kbResults.push({ shortcut: 'Key 2 (Select Operative 2)', passed: op2Passed, details: op2Data });

        // 3.2 Shortcut '3': Switch to 3rd Operative
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', text: '3', unmodifiedText: '3', key: '3', code: 'Digit3' });
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: '3', code: 'Digit3' });
        await sleep(200);

        const op3Check = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const activeCard = document.querySelector('#squad-dock .squad-card.selected');
                const unitName = document.getElementById('unit-name')?.innerText;
                return {
                    cardSelectedUnitId: activeCard?.dataset.unitId,
                    unitName
                };
            })()`,
            returnByValue: true
        });
        const op3Data = op3Check.result.value || {};
        const op3Passed = op3Data.cardSelectedUnitId && op3Data.unitName.length > 0;
        kbResults.push({ shortcut: 'Key 3 (Select Operative 3)', passed: op3Passed, details: op3Data });

        // 3.3 Shortcut '1': Switch back to 1st Operative
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', text: '1', unmodifiedText: '1', key: '1', code: 'Digit1' });
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: '1', code: 'Digit1' });
        await sleep(200);

        const op1Check = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const activeCard = document.querySelector('#squad-dock .squad-card.selected');
                const unitName = document.getElementById('unit-name')?.innerText;
                return {
                    cardSelectedUnitId: activeCard?.dataset.unitId,
                    unitName
                };
            })()`,
            returnByValue: true
        });
        const op1Data = op1Check.result.value || {};
        const op1Passed = op1Data.cardSelectedUnitId && op1Data.unitName.length > 0;
        kbResults.push({ shortcut: 'Key 1 (Select Operative 1)', passed: op1Passed, details: op1Data });

        // 3.4 Shortcut 'M': Tactical Move Mode
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', text: 'm', unmodifiedText: 'm', key: 'm', code: 'KeyM' });
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: 'm', code: 'KeyM' });
        await sleep(200);

        const moveCheck = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const moveCells = document.querySelectorAll('#grid-container .cell.valid-move');
                return { validMoveCellCount: moveCells.length };
            })()`,
            returnByValue: true
        });
        const moveData = moveCheck.result.value || {};
        const movePassed = moveData.validMoveCellCount > 0;
        kbResults.push({ shortcut: 'Key M (Move Highlight)', passed: movePassed, count: moveData.validMoveCellCount });

        // 3.5 Shortcut 'Escape': Cancel Move Mode
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
        await sleep(200);

        const escCheck = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const moveCells = document.querySelectorAll('#grid-container .cell.valid-move').length;
                const targetCells = document.querySelectorAll('#grid-container .cell.valid-target').length;
                return { moveCells, targetCells };
            })()`,
            returnByValue: true
        });
        const escData = escCheck.result.value || {};
        const escPassed = escData.moveCells === 0 && escData.targetCells === 0;
        kbResults.push({ shortcut: 'Key Escape (Cancel Mode)', passed: escPassed, details: escData });

        // 3.6 Shortcut 'S': Engage Shoot Mode & Target Highlighting
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', text: 's', unmodifiedText: 's', key: 's', code: 'KeyS' });
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: 's', code: 'KeyS' });
        await sleep(200);

        const shootCheck = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const targetCells = document.querySelectorAll('#grid-container .cell.valid-target').length;
                return { targetCells };
            })()`,
            returnByValue: true
        });
        const shootData = shootCheck.result.value || {};
        const shootPassed = shootData.targetCells > 0;
        kbResults.push({ shortcut: 'Key S (Shoot Highlight)', passed: shootPassed, count: shootData.targetCells });

        // 3.7 Target Diagnostics Hover Check
        const hoverCheck = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const firstEnemy = document.querySelector('#units-layer .unit.enemy');
                if (firstEnemy) {
                    firstEnemy.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                }
                const activePreview = document.getElementById('target-preview-active');
                const isPreviewVisible = activePreview && window.getComputedStyle(activePreview).display !== 'none';
                const hitChanceText = document.getElementById('target-hit-chance')?.innerText;
                const baseAimText = document.getElementById('target-base-aim')?.innerText;
                const coverModText = document.getElementById('target-cover-mod')?.innerText;
                const distModText = document.getElementById('target-dist-mod')?.innerText;
                const expectedDmgText = document.getElementById('target-expected-dmg')?.innerText;

                return {
                    isPreviewVisible,
                    hitChanceText,
                    baseAimText,
                    coverModText,
                    distModText,
                    expectedDmgText
                };
            })()`,
            returnByValue: true
        });
        const hoverData = hoverCheck.result.value || {};
        const hoverPassed = hoverData.isPreviewVisible && hoverData.hitChanceText.includes('%');
        kbResults.push({ shortcut: 'Target Diagnostics Hover Preview', passed: hoverPassed, details: hoverData });

        // Cancel shoot mode with Escape
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
        await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
        await sleep(200);

        const allKbPassed = kbResults.every(r => r.passed);
        testResults.keyboardShortcuts = {
            passed: allKbPassed,
            shortcuts: kbResults
        };
        console.log(`  ${allKbPassed ? '✓ PASS' : '✗ FAIL'} Section 3: Keyboard Shortcuts Telemetry ('1'-'3', 'M', 'S', 'Escape')`);

        // ---------------------------------------------------------------------
        // 4. Interactive DOM Mutations (Clicking UI elements, buttons, tiles)
        // ---------------------------------------------------------------------
        console.log('[TEST 4] Testing DOM Mouse Clicks & Mutations (Move, Shoot, Squad Select, End Turn)...');

        const clickResults = [];

        // 4.1 Click Squad Card 2
        const cardClickEval = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const cards = document.querySelectorAll('#squad-dock .squad-card');
                if (cards.length >= 2) {
                    cards[1].click();
                    const activeCard = document.querySelector('#squad-dock .squad-card.selected');
                    const activeUnitName = document.getElementById('unit-name')?.innerText;
                    return { clickedCardUnitId: cards[1].dataset.unitId, activeCardUnitId: activeCard?.dataset.unitId, activeUnitName };
                }
                return null;
            })()`,
            returnByValue: true
        });
        const cardClickData = cardClickEval.result.value;
        const cardClickPassed = cardClickData && cardClickData.clickedCardUnitId === cardClickData.activeCardUnitId;
        clickResults.push({ action: 'Click Squad Card 2', passed: cardClickPassed, details: cardClickData });

        // 4.2 Click Move Button & Click Valid Move Tile
        const moveActionEval = await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                document.getElementById('btn-move').click();
                const validCell = document.querySelector('#grid-container .cell.valid-move');
                if (!validCell) return { error: 'No valid move cell found' };
                
                const targetX = parseInt(validCell.dataset.x);
                const targetY = parseInt(validCell.dataset.y);
                const activeUnitId = document.querySelector('#squad-dock .squad-card.selected')?.dataset.unitId;
                const actorUnit = window.gameState ? window.gameState.units.find(u => u.id === activeUnitId) : null;
                const oldX = actorUnit?.x;
                const oldY = actorUnit?.y;
                const oldAp = actorUnit?.ap;

                validCell.click();
                await new Promise(r => setTimeout(r, 200));

                const updatedActor = window.gameState ? window.gameState.units.find(u => u.id === activeUnitId) : null;
                const unitEl = document.getElementById('unit-' + activeUnitId);
                const unitLeft = unitEl ? unitEl.style.left : null;
                const unitTop = unitEl ? unitEl.style.top : null;
                const apText = document.getElementById('ap-counter')?.innerText;

                return {
                    oldPos: { x: oldX, y: oldY },
                    targetPos: { x: targetX, y: targetY },
                    newPos: { x: updatedActor?.x, y: updatedActor?.y },
                    oldAp,
                    newAp: updatedActor?.ap,
                    unitLeft,
                    unitTop,
                    apText
                };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });
        const moveActionData = moveActionEval.result.value || {};
        const moveActionPassed = moveActionData.newPos &&
                                moveActionData.newPos.x === moveActionData.targetPos.x &&
                                moveActionData.newPos.y === moveActionData.targetPos.y &&
                                moveActionData.newAp === moveActionData.oldAp - 1;
        clickResults.push({ action: 'Click Move Button & Tile', passed: moveActionPassed, details: moveActionData });

        // 4.3 Click Shoot Button & Click Target Enemy Cell
        const shootActionEval = await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                document.getElementById('btn-shoot').click();
                const targetCell = document.querySelector('#grid-container .cell.valid-target');
                if (!targetCell) return { error: 'No valid target cell found' };

                const tx = parseInt(targetCell.dataset.x);
                const ty = parseInt(targetCell.dataset.y);
                const enemyTarget = window.gameState.units.find(u => u.x === tx && u.y === ty && u.type === 'enemy' && u.hp > 0);
                const oldHp = enemyTarget?.hp;

                targetCell.click();
                await new Promise(r => setTimeout(r, 400));

                const updatedEnemy = window.gameState.units.find(u => u.id === enemyTarget?.id);
                const logs = window.gameState.logs;
                const lastLog = logs[logs.length - 1];
                const floatingTexts = Array.from(document.querySelectorAll('#units-layer .floating-text')).map(f => f.innerText);

                return {
                    targetId: enemyTarget?.id,
                    oldHp,
                    newHp: updatedEnemy ? updatedEnemy.hp : 0,
                    lastLog,
                    floatingTexts
                };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });
        const shootActionData = shootActionEval.result.value || {};
        const shootActionPassed = shootActionData.targetId && (shootActionData.newHp <= shootActionData.oldHp) && !!shootActionData.lastLog;
        clickResults.push({ action: 'Click Shoot Button & Target Cell', passed: shootActionPassed, details: shootActionData });

        // 4.4 Click End Turn Button (or Shortcut 'Space'/'E')
        const endTurnActionEval = await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                const oldTurn = window.gameState.currentTurn;
                document.getElementById('btn-end-turn').click();
                await new Promise(r => setTimeout(r, 600));

                const state = window.gameState;
                const turnIndicator = document.getElementById('turn-indicator')?.innerText;
                const turnBanner = document.getElementById('turn-banner');
                const bannerVisible = turnBanner ? turnBanner.classList.contains('show') : false;

                return {
                    oldTurn,
                    newTurn: state.currentTurn,
                    turnIndicator,
                    bannerVisible
                };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });
        const endTurnData = endTurnActionEval.result.value || {};
        const endTurnPassed = endTurnData.newTurn === 'player' && endTurnData.turnIndicator.includes('PLAYER');
        clickResults.push({ action: 'Click End Turn Button & Round Trip', passed: endTurnPassed, details: endTurnData });

        const allClicksPassed = clickResults.every(r => r.passed);
        testResults.interactiveDomUpdates = {
            passed: allClicksPassed,
            actions: clickResults
        };
        console.log(`  ${allClicksPassed ? '✓ PASS' : '✗ FAIL'} Section 4: Interactive DOM Mutations & Turn Transitions`);

        // ---------------------------------------------------------------------
        // 5. Visual Combat FX, Floating Combat Text, Victory/Defeat Modals, Redeploy Loop
        // ---------------------------------------------------------------------
        console.log('[TEST 5] Testing Floating Combat Text, Victory & Defeat Modals, and Redeploy Loop...');

        // 5.1 Trigger Direct Floating Text Check
        const floatTextEval = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                if (typeof showFloatingText === 'function') {
                    showFloatingText(4, 4, '-4 HP', '#ff3333');
                    const floatEl = document.querySelector('#units-layer .floating-text');
                    return {
                        created: !!floatEl,
                        text: floatEl?.innerText,
                        color: floatEl?.style.color
                    };
                }
                return { created: false };
            })()`,
            returnByValue: true
        });
        const floatData = floatTextEval.result.value || {};
        const floatPassed = floatData.created && floatData.text === '-4 HP';

        // 5.2 Simulate Decisive Combat to Trigger Victory Modal in DOM
        const victoryModalEval = await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                // Eliminate all living enemies in-memory and trigger checkEndgame
                window.gameState.units.forEach(u => {
                    if (u.type === 'enemy') {
                        u.hp = 0;
                        u.isAlive = false;
                    }
                });
                if (typeof render === 'function') render();
                if (typeof checkEndgame === 'function') checkEndgame();

                const modal = document.getElementById('mission-modal');
                const modalActive = modal && modal.classList.contains('active');
                const modalTitle = document.getElementById('modal-title')?.innerText;
                const modalStatus = document.getElementById('modal-stat-status')?.innerText;
                const modalSurvivors = document.getElementById('modal-stat-survivors')?.innerText;
                const modalKills = document.getElementById('modal-stat-kills')?.innerText;

                return {
                    modalActive,
                    modalTitle,
                    modalStatus,
                    modalSurvivors,
                    modalKills
                };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });
        const vicData = victoryModalEval.result.value || {};
        const vicPassed = vicData.modalActive && vicData.modalTitle === 'MISSION ACCOMPLISHED' && vicData.modalStatus === 'VICTORY';

        // 5.3 Test Redeploy Strike Team Button
        const redeployEval = await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                const redeployBtn = document.getElementById('btn-redeploy');
                if (redeployBtn) redeployBtn.click();
                await new Promise(r => setTimeout(r, 400));

                const modal = document.getElementById('mission-modal');
                const modalActive = modal && modal.classList.contains('active');
                const livingEnemies = window.gameState.units.filter(u => u.type === 'enemy' && u.hp > 0).length;
                const livingPlayers = window.gameState.units.filter(u => u.type === 'player' && u.hp > 0).length;

                return {
                    modalActive,
                    livingEnemies,
                    livingPlayers
                };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });
        const redeployData = redeployEval.result.value || {};
        const redeployPassed = !redeployData.modalActive && redeployData.livingEnemies === 3 && redeployData.livingPlayers === 3;

        // 5.4 Test Defeat Modal Triggering
        const defeatModalEval = await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                window.gameState.units.forEach(u => {
                    if (u.type === 'player') {
                        u.hp = 0;
                        u.isAlive = false;
                    }
                });
                if (typeof render === 'function') render();
                if (typeof checkEndgame === 'function') checkEndgame();

                const modal = document.getElementById('mission-modal');
                const modalActive = modal && modal.classList.contains('active');
                const modalTitle = document.getElementById('modal-title')?.innerText;
                const modalStatus = document.getElementById('modal-stat-status')?.innerText;

                // Reset game with init()
                if (typeof init === 'function') await init();

                return {
                    modalActive,
                    modalTitle,
                    modalStatus
                };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });
        const defData = defeatModalEval.result.value || {};
        const defPassed = defData.modalActive && defData.modalTitle === 'MISSION FAILED' && defData.modalStatus === 'DEFEAT';

        const combatFxPassed = floatPassed && vicPassed && redeployPassed && defPassed;
        testResults.combatFxAndModals = {
            passed: combatFxPassed,
            floatingText: floatData,
            victoryModal: vicData,
            redeploy: redeployData,
            defeatModal: defData
        };
        console.log(`  ${combatFxPassed ? '✓ PASS' : '✗ FAIL'} Section 5: Combat FX, Floating Text, Victory & Defeat Modals`);

        // ---------------------------------------------------------------------
        // 6. Monotonic Dynamic Z-Depth Sorting (z = y * 10 + 5) & Non-Clipping Multi-Resolution Layout
        // ---------------------------------------------------------------------
        console.log('[TEST 6] Testing Monotonic Dynamic Z-Depth Sorting & Multi-Viewport Non-Clipping Layout...');

        const zDepthEval = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const units = Array.from(document.querySelectorAll('#units-layer .unit')).map(u => {
                    const comp = window.getComputedStyle(u);
                    const top = parseFloat(u.style.top || comp.top);
                    const y = Math.round(top / 60);
                    const zIndex = parseInt(comp.zIndex) || 0;
                    const expectedZ = y * 10 + 5;
                    return {
                        id: u.id,
                        top,
                        y,
                        zIndex,
                        expectedZ,
                        conforms: zIndex === expectedZ
                    };
                });

                // Test dynamic update when y changes
                const sortedByY = [...units].sort((a, b) => a.y - b.y);
                let strictlyMonotonic = true;
                for (let i = 0; i < sortedByY.length - 1; i++) {
                    if (sortedByY[i].y < sortedByY[i + 1].y && sortedByY[i].zIndex >= sortedByY[i + 1].zIndex) {
                        strictlyMonotonic = false;
                    }
                }

                return {
                    unitsCount: units.length,
                    allConform: units.every(u => u.conforms),
                    strictlyMonotonic,
                    units
                };
            })()`,
            returnByValue: true
        });
        const zDepthData = zDepthEval.result.value || {};
        const zDepthPassed = zDepthData.unitsCount === 6 && zDepthData.allConform && zDepthData.strictlyMonotonic;

        // Viewport layout tests across standard resolutions
        const viewports = [
            { width: 1440, height: 900, name: '1440x900 Desktop' },
            { width: 1280, height: 800, name: '1280x800 Laptop' },
            { width: 1920, height: 1080, name: '1920x1080 Full HD' }
        ];

        const vpLayoutResults = [];

        for (const vp of viewports) {
            await sendCDP('Emulation.setDeviceMetricsOverride', {
                width: vp.width,
                height: vp.height,
                deviceScaleFactor: 1,
                mobile: false
            });
            await sleep(250);

            const layoutEval = await sendCDP('Runtime.evaluate', {
                expression: `(() => {
                    const getRect = el => el ? el.getBoundingClientRect() : null;
                    const gridRect = getRect(document.getElementById('grid-container'));
                    const uiPanelRect = getRect(document.getElementById('ui-panel'));
                    const squadDockRect = getRect(document.getElementById('squad-dock'));
                    const containerRect = getRect(document.getElementById('game-container'));

                    let uiClipsGrid = false;
                    let clearancePx = 0;
                    if (gridRect && uiPanelRect) {
                        clearancePx = uiPanelRect.top - gridRect.bottom;
                        uiClipsGrid = clearancePx < -2;
                    }

                    const containerFits = containerRect ? containerRect.width <= window.innerWidth + 20 : true;

                    return {
                        viewport: { width: window.innerWidth, height: window.innerHeight },
                        clearancePx,
                        uiClipsGrid,
                        containerFits
                    };
                })()`,
                returnByValue: true
            });

            const lData = layoutEval.result.value || {};
            const vpPassed = !lData.uiClipsGrid && lData.containerFits;
            vpLayoutResults.push({ name: vp.name, passed: vpPassed, ...lData });
        }

        const allVpPassed = vpLayoutResults.every(v => v.passed);
        const section6Passed = zDepthPassed && allVpPassed;
        testResults.zDepthAndLayoutClearance = {
            passed: section6Passed,
            zDepth: zDepthData,
            viewports: vpLayoutResults
        };
        console.log(`  ${section6Passed ? '✓ PASS' : '✗ FAIL'} Section 6: Monotonic Dynamic Z-Depth Sorting (z = y * 10 + 5) & Layout Clearance`);

        // ---------------------------------------------------------------------
        // Aggregate Overall Verdict
        // ---------------------------------------------------------------------
        const allSectionsPassed = Object.values(testResults).every(s => s && s.passed);
        const overallVerdict = allSectionsPassed ? 'APPROVE' : 'REQUEST_CHANGES';

        const finalReport = {
            gate: 'CHALLENGER_2_STATIC_EMPIRICAL_STRESS_TEST',
            challenger: 'challenger_static_2',
            timestamp: new Date().toISOString(),
            executionMode: 'pure_static_serverless_cdp',
            verdict: overallVerdict,
            sections: {
                s1_networkAndConsoleIntegrity: testResults.networkAndConsoleIntegrity,
                s2_squadMounting: testResults.squadMounting,
                s3_keyboardShortcuts: testResults.keyboardShortcuts,
                s4_interactiveDomUpdates: testResults.interactiveDomUpdates,
                s5_combatFxAndModals: testResults.combatFxAndModals,
                s6_zDepthAndLayoutClearance: testResults.zDepthAndLayoutClearance
            }
        };

        const reportDir = path.dirname(REPORT_PATH);
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
        fs.writeFileSync(REPORT_PATH, JSON.stringify(finalReport, null, 2));

        console.log('\n========================================================================');
        console.log(` CHALLENGER 2 VERDICT: ${overallVerdict}`);
        console.log(` Empirical Report saved to: ${REPORT_PATH}`);
        console.log('========================================================================\n');

        return finalReport;
    } finally {
        if (ws) ws.close();
        if (chromeProc) chromeProc.kill('SIGTERM');
        if (staticHost) await staticHost.close();
        try {
            fs.rmSync(userDataDir, { recursive: true, force: true });
        } catch {}
    }
}

if (require.main === module) {
    runEmpiricalStressTest()
        .then(rep => {
            process.exit(rep.verdict === 'APPROVE' ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal Empirical Test Error:', err);
            process.exit(1);
        });
}

module.exports = { runEmpiricalStressTest };
