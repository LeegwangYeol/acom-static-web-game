const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT_DIR = path.resolve(__dirname, '../..');

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
    return new Promise(r => setTimeout(r, ms));
}

async function fetchJSON(url) {
    const res = await fetch(url);
    return await res.json();
}

function createEphemeralServer() {
    const mimeTypes = {
        '.html': 'text/html; charset=UTF-8',
        '.css': 'text/css; charset=UTF-8',
        '.js': 'application/javascript; charset=UTF-8',
        '.png': 'image/png',
        '.json': 'application/json'
    };

    const server = http.createServer((req, res) => {
        const reqPath = req.url.split('?')[0];
        if (reqPath.startsWith('/api/')) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '404 - No backend API allowed' }));
            return;
        }
        const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
        const target = safePath === '/' ? 'index.html' : safePath;
        const filePath = path.join(ROOT_DIR, target);

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
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
        srv => srv.on('error', reject);
    });
}

async function runAdversarialStress() {
    console.log('=== Adversarial Live Match & UI Stress Test in Headless Chrome ===');
    const staticHost = await createEphemeralServer();
    const cdpPort = await getFreePort();
    const userDataDir = path.join('/tmp', `chrome-adv-stress-${Date.now()}`);

    const chromeArgs = [
        '--headless=new',
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${userDataDir}`,
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        `http://127.0.0.1:${staticHost.port}/index.html`
    ];

    const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore' });

    try {
        let targets = null;
        for (let i = 0; i < 30; i++) {
            await sleep(200);
            try {
                targets = await fetchJSON(`http://127.0.0.1:${cdpPort}/json/list`);
                if (targets && targets.length > 0) break;
            } catch (e) {}
        }

        const pageTarget = targets.find(t => t.type === 'page') || targets[0];
        const wsUrl = pageTarget.webSocketDebuggerUrl;

        const WsClient = globalThis.WebSocket || require('ws');
        const ws = new WsClient(wsUrl);

        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let msgId = 1;
        const pendingCallbacks = new Map();
        const networkRequests = [];
        const networkErrors = [];
        const consoleMessages = [];
        const exceptions = [];

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.id && pendingCallbacks.has(data.id)) {
                const cb = pendingCallbacks.get(data.id);
                pendingCallbacks.delete(data.id);
                if (data.error) cb.reject(data.error);
                else cb.resolve(data.result);
            }

            if (data.method === 'Network.requestWillBeSent') {
                networkRequests.push(data.params.request.url);
            }
            if (data.method === 'Network.loadingFailed') {
                networkErrors.push(data.params);
            }
            if (data.method === 'Runtime.consoleAPICalled') {
                consoleMessages.push(data.params);
            }
            if (data.method === 'Runtime.exceptionThrown') {
                exceptions.push(data.params);
            }
        };

        function sendCommand(method, params = {}) {
            return new Promise((resolve, reject) => {
                const id = msgId++;
                pendingCallbacks.set(id, { resolve, reject });
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        await sendCommand('Page.enable');
        await sendCommand('DOM.enable');
        await sendCommand('Runtime.enable');
        await sendCommand('Network.enable');

        await sleep(1000);

        // Run full combat simulation across 20 rounds of gameplay directly through UI functions
        const matchResult = await sendCommand('Runtime.evaluate', {
            expression: `(async () => {
                let turns = 0;
                let actionsExecuted = 0;

                while (turns < 25) {
                    turns++;
                    const state = window.gameState;
                    if (!state) break;

                    const livingEnemies = state.units.filter(u => u.type === 'enemy' && u.hp > 0);
                    const livingPlayers = state.units.filter(u => u.type === 'player' && u.hp > 0);

                    if (livingEnemies.length === 0 || livingPlayers.length === 0) {
                        break;
                    }

                    // For each player unit with AP
                    for (const player of livingPlayers) {
                        if (player.hp <= 0 || player.ap <= 0) continue;

                        // Try shooting an enemy in range
                        const target = livingEnemies.find(e => {
                            const d = Math.abs(e.x - player.x) + Math.abs(e.y - player.y);
                            return d <= player.range;
                        });

                        if (target) {
                            await window.sendAction('shoot', { actorId: player.id, targetId: target.id });
                            actionsExecuted++;
                        } else {
                            // Move towards closest enemy
                            const closest = livingEnemies.reduce((prev, curr) => {
                                const d1 = Math.abs(prev.x - player.x) + Math.abs(prev.y - player.y);
                                const d2 = Math.abs(curr.x - player.x) + Math.abs(curr.y - player.y);
                                return d1 < d2 ? prev : curr;
                            }, livingEnemies[0]);

                            const dx = Math.sign(closest.x - player.x);
                            const dy = Math.sign(closest.y - player.y);
                            const nx = player.x + dx;
                            const ny = player.y + dy;

                            // Check valid tile
                            const cell = state.grid[ny] && state.grid[ny][nx];
                            const occ = state.units.some(u => u.x === nx && u.y === ny && u.hp > 0);
                            if (cell && cell.type === 0 && !occ) {
                                await window.sendAction('move', { actorId: player.id, x: nx, y: ny });
                                actionsExecuted++;
                            }
                        }
                    }

                    // End turn to allow enemy AI to execute
                    await window.sendAction('end_turn', {});
                    actionsExecuted++;
                    await new Promise(r => setTimeout(r, 50));
                }

                const finalState = window.gameState;
                const modalVisible = document.getElementById('mission-modal')?.classList.contains('active') ||
                                     document.getElementById('mission-modal')?.style.display !== 'none';

                return {
                    turns,
                    actionsExecuted,
                    finalTurn: finalState?.currentTurn,
                    alivePlayers: finalState?.units.filter(u => u.type === 'player' && u.hp > 0).length,
                    aliveEnemies: finalState?.units.filter(u => u.type === 'enemy' && u.hp > 0).length,
                    modalVisible,
                    logsCount: finalState?.logs.length
                };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });

        console.log('Full Match Simulation Result:', matchResult.result.value);

        await sleep(500);

        const apiCalls = networkRequests.filter(url => url.includes('/api/'));
        const errorLogs = consoleMessages.filter(m => m.type === 'error');

        console.log('\n--- Telemetry ---');
        console.log('Total Requests Tracked:', networkRequests.length);
        console.log('Total /api/ Requests:', apiCalls.length);
        console.log('Total Network Errors (404/Failed):', networkErrors.length);
        console.log('Total Console Errors:', errorLogs.length);
        console.log('Total Exceptions:', exceptions.length);

        if (apiCalls.length === 0 && networkErrors.length === 0 && errorLogs.length === 0 && exceptions.length === 0) {
            console.log('✓ PASS: Adversarial full match stress completed flawlessly.');
        } else {
            console.error('✗ FAIL: Errors detected during match execution.');
            process.exit(1);
        }

    } finally {
        chromeProc.kill('SIGKILL');
        await staticHost.close();
        try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
    }
}

runAdversarialStress().catch(err => {
    console.error('Adversarial stress test failed:', err);
    process.exit(1);
});
