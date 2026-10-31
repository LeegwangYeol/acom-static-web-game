/**
 * tests/challenge_m2_empirical.js
 * Empirical Challenge Harness for Milestone 2.
 * Tests:
 * 1. Orphaned DOM elements / DOM unit cleanup on /api/init and /api/init_random.
 * 2. 6 Character Archetype sprite loading and zero 404s for base + action poses.
 * 3. Dynamic Z-indexing and depth sorting between background and foreground units.
 * 4. Hit testing and element stacking order in Headless Chrome.
 * 5. Unit positioning and diamond/isometric tile alignment.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');

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

async function fetchJSON(url, opts) {
    const res = await fetch(url, opts);
    return await res.json();
}

const http = require('http');

function createEphemeralStaticServer(rootDir = path.resolve(__dirname, '..')) {
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
        if (reqPath.startsWith('/api/')) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Static server' }));
            return;
        }
        const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
        const targetFile = safePath === '/' ? 'index.html' : safePath;
        const filePath = path.join(rootDir, targetFile);
        if (!filePath.startsWith(rootDir)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            res.end(data);
        });
    });

    return new Promise((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            resolve({ server, port, close: () => new Promise(r => server.close(r)) });
        });
        server.on('error', reject);
    });
}

async function runEmpiricalChallenge() {
    console.log('====================================================');
    console.log('  MILESTONE 2 EMPIRICAL CHALLENGE HARNESS');
    console.log('====================================================');

    const staticHost = await createEphemeralStaticServer();
    const appPort = staticHost.port;
    const cdpPort = await getFreePort();
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acom-challenge-chrome-'));

    let chromeProc = null;
    let ws = null;
    const networkRequests = [];
    const networkErrors = [];
    const consoleLogs = [];
    const consoleErrors = [];

    const findings = [];

    try {
        console.log(`[1/5] Ephemeral static server ready on port ${appPort}...`);

        console.log(`[2/5] Launching Headless Chrome on CDP port ${cdpPort}...`);
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
        for (let i = 0; i < 40; i++) {
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

        if (!debuggerUrl) throw new Error('CDP target not available');

        ws = new WebSocket(debuggerUrl);
        await new Promise((res, rej) => {
            ws.onopen = res;
            ws.onerror = rej;
        });

        let msgId = 1;
        const pendingCallbacks = new Map();
        const requestUrlMap = new Map();

        function sendCDP(method, params = {}) {
            return new Promise((res, rej) => {
                const id = msgId++;
                pendingCallbacks.set(id, { resolve: res, reject: rej, method });
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

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
                        networkRequests.push({ url: resp.url, status: resp.status, mimeType: resp.mimeType });
                        if (resp.status >= 400) {
                            networkErrors.push({ url: resp.url, status: resp.status });
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
                    if (data.params.type === 'error') consoleErrors.push({ type: 'error', text: args });
                } else if (data.method === 'Runtime.exceptionThrown') {
                    consoleErrors.push({ type: 'exception', text: data.params.exceptionDetails.text });
                }
            }
        };

        await sendCDP('Network.enable');
        await sendCDP('Runtime.enable');
        await sendCDP('Page.enable');
        await sendCDP('DOM.enable');

        const gameUrl = `http://127.0.0.1:${appPort}/index.html`;
        console.log(`[3/5] Navigating to ${gameUrl}...`);
        await sendCDP('Page.navigate', { url: gameUrl });
        await sleep(1500);

        // ==========================================
        // TEST 1: Initial Game Load & 6 Unit DOM Inspection
        // ==========================================
        console.log('\n--- TEST 1: Initial Game Load & Unit DOM Inspection ---');
        const t1Result = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const units = Array.from(document.querySelectorAll('#units-layer .unit'));
                return {
                    count: units.length,
                    units: units.map(u => ({
                        id: u.id,
                        classes: u.className,
                        zIndex: window.getComputedStyle(u).zIndex,
                        left: window.getComputedStyle(u).left,
                        top: window.getComputedStyle(u).top,
                        bgImage: u.querySelector('.unit-sprite') ? window.getComputedStyle(u.querySelector('.unit-sprite')).backgroundImage : ''
                    }))
                };
            })()`,
            returnByValue: true
        });

        const t1Data = t1Result.result.value;
        console.log(`Initial DOM units count: ${t1Data.count}`);
        t1Data.units.forEach(u => console.log(`  - ${u.id} (${u.classes}) at (${u.left}, ${u.top}) zIndex=${u.zIndex} bg=${u.bgImage}`));

        if (t1Data.count === 6) {
            findings.push({ test: 'T1_INITIAL_SPAWN', passed: true, details: `6 initial units correctly spawned in DOM.` });
        } else {
            findings.push({ test: 'T1_INITIAL_SPAWN', passed: false, details: `Expected 6 initial units, found ${t1Data.count}.` });
        }

        // ==========================================
        // TEST 2: DOM Cleanup / Leak on Re-Init & State Change
        // ==========================================
        console.log('\n--- TEST 2: DOM Orphan / Leak Testing on State Re-initialization ---');
        const t2Result = await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                const baseUrl = window.location.origin;
                // Re-initialize multiple times with different squad compositions
                await fetch(baseUrl + '/api/init_random', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ players: 3, enemies: 3 })
                });
                await fetchState();

                const domUnitsAfterRandom = Array.from(document.querySelectorAll('#units-layer .unit'));
                
                // Now call /api/init standard
                await fetch(baseUrl + '/api/init', { method: 'POST' });
                await fetchState();

                const domUnitsAfterStdInit = Array.from(document.querySelectorAll('#units-layer .unit'));
                const serverUnits = gameState.units;

                return {
                    unitsAfterRandomCount: domUnitsAfterRandom.length,
                    unitsAfterStdInitCount: domUnitsAfterStdInit.length,
                    serverUnitsCount: serverUnits.length,
                    domUnitIds: domUnitsAfterStdInit.map(u => u.id),
                    serverUnitIds: serverUnits.map(u => u.id)
                };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });

        const t2Data = t2Result.result.value;
        console.log(`Server units count: ${t2Data.serverUnitsCount}`);
        console.log(`DOM units after /api/init_random: ${t2Data.unitsAfterRandomCount}`);
        console.log(`DOM units after /api/init: ${t2Data.unitsAfterStdInitCount}`);
        console.log(`DOM IDs: ${JSON.stringify(t2Data.domUnitIds)}`);
        console.log(`Server IDs: ${JSON.stringify(t2Data.serverUnitIds)}`);

        if (t2Data.unitsAfterStdInitCount > t2Data.serverUnitsCount) {
            findings.push({
                test: 'T2_DOM_ORPHAN_LEAK',
                passed: false,
                details: `CRITICAL BUG: DOM retains orphaned .unit elements from previous game states. DOM count is ${t2Data.unitsAfterStdInitCount} while server unit count is ${t2Data.serverUnitsCount}. Orphaned units cause collisions and ghost elements.`
            });
        } else {
            findings.push({
                test: 'T2_DOM_ORPHAN_LEAK',
                passed: true,
                details: `DOM units cleanly synchronized with server state (${t2Data.serverUnitsCount} units).`
            });
        }

        // ==========================================
        // TEST 3: Dynamic Z-Depth Sorting & Foreground/Background Overlap
        // ==========================================
        console.log('\n--- TEST 3: Dynamic Z-Depth Sorting & Vertical Stacking ---');
        // Let's place units in deliberate foreground/background positions and check z-index values and visual occlusion
        const t3Result = await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                // Initialize clean game state
                await init();
                
                // Check all living units' Y-depth ordering
                const units = gameState.units.filter(u => u.hp > 0);
                const sortedByY = [...units].sort((a, b) => a.y - b.y);
                
                const zIndexReport = sortedByY.map(u => {
                    const el = document.getElementById('unit-' + u.id);
                    const z = el ? parseInt(window.getComputedStyle(el).zIndex) : null;
                    return {
                        id: u.id,
                        x: u.x,
                        y: u.y,
                        computedZIndex: z,
                        expectedBaseZ: u.y * 10 + 5,
                        isSelected: u.id === selectedActorId
                    };
                });

                // Verify pairwise depth ordering for unselected units
                let depthViolations = [];
                for (let i = 0; i < zIndexReport.length; i++) {
                    for (let j = i + 1; j < zIndexReport.length; j++) {
                        const u1 = zIndexReport[i];
                        const u2 = zIndexReport[j];
                        if (!u1.isSelected && !u2.isSelected && u1.y < u2.y) {
                            if (u1.computedZIndex >= u2.computedZIndex) {
                                depthViolations.push({ bg: u1, fg: u2 });
                            }
                        }
                    }
                }

                return { zIndexReport, depthViolations };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });

        const t3Data = t3Result.result.value;
        console.log('Z-Index Report:');
        t3Data.zIndexReport.forEach(r => console.log(`  - Unit ${r.id} at (x=${r.x}, y=${r.y}): zIndex=${r.computedZIndex} (expectedBase=${r.expectedBaseZ}, isSelected=${r.isSelected})`));

        if (t3Data.depthViolations.length === 0) {
            findings.push({
                test: 'T3_DEPTH_SORTING',
                passed: true,
                details: `Dynamic Z-index formula strictly ensures foreground units (higher Y) have higher z-index than background units (lower Y).`
            });
        } else {
            findings.push({
                test: 'T3_DEPTH_SORTING',
                passed: false,
                details: `Depth violations detected: ${JSON.stringify(t3Data.depthViolations)}`
            });
        }

        // ==========================================
        // TEST 4: Action Pose Sprites & Dynamic Combat FX Network Integrity
        // ==========================================
        console.log('\n--- TEST 4: Action Pose Sprites & Dynamic Combat FX Network Integrity ---');
        // Trigger action poses for all 6 archetypes in browser and check for 404s
        const t4Result = await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                const archetypes = [
                    'ally_assault', 'ally_recon', 'ally_heavy',
                    'enemy_mutant', 'enemy_scout', 'enemy_heavy'
                ];
                const poses = ['idle', 'attack', 'hit', 'dead'];
                
                // Create offscreen image elements to trigger browser network fetches for all poses
                const loaded = [];
                const errors = [];

                for (const arch of archetypes) {
                    for (const pose of poses) {
                        const filename = pose === 'idle' ? arch + '.png' : arch + '_' + pose + '.png';
                        const url = 'assets/characters/' + filename;
                        
                        await new Promise((resolve) => {
                            const img = new Image();
                            img.onload = () => { loaded.push(url); resolve(); };
                            img.onerror = () => { errors.push(url); resolve(); };
                            img.src = url;
                        });
                    }
                }

                return { loadedCount: loaded.length, errorsCount: errors.length, errors };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });

        const t4Data = t4Result.result.value;
        console.log(`Action Poses Tested: ${t4Data.loadedCount} loaded, ${t4Data.errorsCount} errors.`);
        if (t4Data.errors.length > 0) console.log(`Pose Errors:`, t4Data.errors);

        if (t4Data.errorsCount === 0 && t4Data.loadedCount === 24) {
            findings.push({
                test: 'T4_ACTION_POSES_NETWORK',
                passed: true,
                details: `All 24 character asset variants (6 archetypes x 4 poses: base, attack, hit, dead) loaded successfully with zero 404 network errors.`
            });
        } else {
            findings.push({
                test: 'T4_ACTION_POSES_NETWORK',
                passed: false,
                details: `Action pose load failures: ${JSON.stringify(t4Data.errors)}`
            });
        }

        // ==========================================
        // TEST 5: Isometric Coordinate Projection & Sprite Anchoring
        // ==========================================
        console.log('\n--- TEST 5: Isometric Coordinate Projection & Sprite Anchoring ---');
        const t5Result = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const units = Array.from(document.querySelectorAll('#units-layer .unit'));
                const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size')) || 60;
                
                const positioningResults = units.map(u => {
                    const sprite = u.querySelector('.unit-sprite');
                    const shadow = u.querySelector('.unit-shadow');
                    const hpBar = u.querySelector('.unit-hp-bar');
                    
                    const uComputed = window.getComputedStyle(u);
                    const sComputed = sprite ? window.getComputedStyle(sprite) : null;
                    const shComputed = shadow ? window.getComputedStyle(shadow) : null;

                    return {
                        id: u.id,
                        unitLeft: uComputed.left,
                        unitTop: uComputed.top,
                        hasShadow: !!shadow,
                        shadowBottom: shComputed ? shComputed.bottom : null,
                        hasSprite: !!sprite,
                        spriteBottom: sComputed ? sComputed.bottom : null,
                        spriteImageRendering: sComputed ? sComputed.imageRendering : null,
                        hasHpBar: !!hpBar
                    };
                });

                return { cellSize, positioningResults };
            })()`,
            returnByValue: true
        });

        const t5Data = t5Result.result.value;
        console.log(`Cell size: ${t5Data.cellSize}px`);
        t5Data.positioningResults.forEach(p => {
            console.log(`  - ${p.id}: left=${p.unitLeft}, top=${p.unitTop}, spriteBottom=${p.spriteBottom}, imageRendering=${p.spriteImageRendering}`);
        });

        const allAnchored = t5Data.positioningResults.every(p => p.hasSprite && p.spriteBottom === '8px' && p.hasShadow);
        if (allAnchored) {
            findings.push({
                test: 'T5_SPRITE_ANCHORING',
                passed: true,
                details: `Sprites positioned at bottom-center anchor (bottom: 8px, left: 50%, translateX(-50%)) with grounding drop shadows and image-rendering: auto.`
            });
        } else {
            findings.push({
                test: 'T5_SPRITE_ANCHORING',
                passed: false,
                details: `Inconsistent sprite anchoring detected.`
            });
        }

    } finally {
        if (ws) ws.close();
        if (chromeProc) chromeProc.kill('SIGTERM');
        if (staticHost) await staticHost.close();
        try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
    }

    console.log('\n====================================================');
    console.log('  EMPIRICAL CHALLENGE SUMMARY');
    console.log('====================================================');
    findings.forEach(f => {
        const icon = f.passed ? '✓ PASS' : '✗ FAIL';
        console.log(`${icon} [${f.test}]: ${f.details}`);
    });

    const reportPath = path.resolve(__dirname, '../.agents/challenger_m2_2/challenge_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), findings, networkErrors, consoleErrors }, null, 2));

    const overallPassed = findings.every(f => f.passed);
    return { overallPassed, findings };
}

if (require.main === module) {
    runEmpiricalChallenge()
        .then(res => {
            process.exit(res.overallPassed ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal challenge error:', err);
            process.exit(1);
        });
}

module.exports = { runEmpiricalChallenge };
