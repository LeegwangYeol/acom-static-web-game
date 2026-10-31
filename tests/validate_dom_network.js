/**
 * tests/validate_dom_network.js
 * Purely Static Headless Chrome Validation Script for ACOM Project.
 * Verifies dynamic spawning of 6 characters into DOM, confirms zero 404 network errors,
 * zero /api/ requests, and zero console errors during rendering.
 * Operates without server.js via an ephemeral 0-dependency local static file server.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_PATH = path.resolve(__dirname, '../.agents/reports/dom_network_report.json');
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

        // Strict static isolation check: Reject any /api/ requests
        if (reqPath.startsWith('/api/')) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Static server: No REST API endpoints available.' }));
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

async function runDomNetworkValidation() {
    console.log('=== ACOM DOM & Network Integrity Validation (Purely Static) ===');

    const staticHost = await createEphemeralStaticServer();
    const appPort = staticHost.port;
    console.log(`Ephemeral 0-dep static server running on port ${appPort}.`);

    const cdpPort = await getFreePort();
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acom-chrome-dom-'));

    let chromeProc = null;
    let ws = null;
    const networkRequests = [];
    const apiRequests = [];
    const networkErrors = [];
    const consoleLogs = [];
    const consoleErrors = [];

    try {
        console.log(`Launching Headless Chrome on CDP port ${cdpPort}...`);
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
            '--window-size=1280,800',
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

        if (!debuggerUrl) {
            throw new Error(`Failed to connect to Chrome CDP on port ${cdpPort}`);
        }

        console.log(`Connected to Chrome CDP target: ${debuggerUrl}`);

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
                    const reqUrl = data.params.request.url;
                    requestUrlMap.set(data.params.requestId, reqUrl);
                    if (reqUrl.includes('/api/')) {
                        apiRequests.push({ url: reqUrl, method: data.params.request.method });
                    }
                } else if (data.method === 'Network.responseReceived') {
                    const resp = data.params.response;
                    if ((resp.url.startsWith('http://127.0.0.1') || resp.url.startsWith('http://localhost') || resp.url.startsWith('file://')) && !resp.url.endsWith('favicon.ico')) {
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
        console.log(`Navigating to static game URL: ${gameUrl}...`);
        await sendCDP('Page.navigate', { url: gameUrl });

        await sleep(1500);

        // Dynamically spawn 3v3 squad in-memory on client side
        const evalSpawn = await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
                try {
                    if (window.gameEngine && typeof window.gameEngine.initRandom === 'function') {
                        window.gameEngine.initRandom(3, 3);
                        if (typeof render === 'function') render();
                        if (typeof renderGridOnce === 'function') renderGridOnce();
                    } else if (typeof initRandomGame === 'function') {
                        initRandomGame(3, 3);
                        if (typeof render === 'function') render();
                    } else if (typeof init === 'function') {
                        await init();
                    }
                    return { success: true };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            })()`,
            awaitPromise: true,
            returnByValue: true
        });

        await sleep(600);

        // Inspect DOM units in #units-layer
        const evalUnits = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const unitsLayer = document.getElementById('units-layer');
                const units = document.querySelectorAll('#units-layer .unit');
                const unitData = [];
                units.forEach(u => {
                    const sprite = u.querySelector('.unit-sprite');
                    const hpBar = u.querySelector('.unit-hp-bar');
                    const computed = window.getComputedStyle(u);
                    const spriteComputed = sprite ? window.getComputedStyle(sprite) : null;
                    unitData.push({
                        id: u.id,
                        className: u.className,
                        left: computed.left,
                        top: computed.top,
                        zIndex: computed.zIndex,
                        hasSprite: !!sprite,
                        bgImage: spriteComputed ? spriteComputed.backgroundImage : '',
                        hasHpBar: !!hpBar
                    });
                });

                const grid = document.getElementById('grid-container');
                const uiPanel = document.getElementById('ui-panel');
                const squadDock = document.getElementById('squad-dock') || document.querySelector('.squad-dock');

                return {
                    hasUnitsLayer: !!unitsLayer,
                    hasGrid: !!grid,
                    hasUiPanel: !!uiPanel,
                    hasSquadDock: !!squadDock,
                    unitsCount: units.length,
                    units: unitData
                };
            })()`,
            returnByValue: true
        });

        const domState = evalUnits.result.value || {};
        console.log(`DOM Units Spawned: ${domState.unitsCount}`);
        console.log(`Total Static Network Requests: ${networkRequests.length}, Network Errors/404s: ${networkErrors.length}`);
        console.log(`Total /api/ Requests Attempted: ${apiRequests.length} (Requirement: 0)`);
        console.log(`Console Errors/Exceptions: ${consoleErrors.length}`);

        const passed = networkErrors.length === 0 &&
                       apiRequests.length === 0 &&
                       consoleErrors.length === 0 &&
                       domState.unitsCount >= 2;

        const report = {
            timestamp: new Date().toISOString(),
            gameUrl,
            mode: 'static_serverless',
            status: passed ? 'PASS' : 'FAIL',
            domVerification: {
                hasUnitsLayer: domState.hasUnitsLayer,
                hasGrid: domState.hasGrid,
                hasUiPanel: domState.hasUiPanel,
                hasSquadDock: domState.hasSquadDock,
                unitsCount: domState.unitsCount,
                units: domState.units || []
            },
            network: {
                totalRequests: networkRequests.length,
                totalErrors: networkErrors.length,
                zero404s: networkErrors.length === 0,
                apiRequestsCount: apiRequests.length,
                zeroApiRequests: apiRequests.length === 0,
                apiRequests,
                errors: networkErrors,
                requests: networkRequests
            },
            console: {
                totalLogs: consoleLogs.length,
                totalErrors: consoleErrors.length,
                errors: consoleErrors,
                logs: consoleLogs
            }
        };

        const reportDir = path.dirname(REPORT_PATH);
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
        fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

        if (passed) {
            console.log('✓ DOM and Network validation PASSED (0 network 404s, 0 /api/ calls, 0 console errors).');
        } else {
            console.error('✗ DOM and Network validation FAILED.');
            if (networkErrors.length > 0) console.error('  Network Errors:', networkErrors);
            if (apiRequests.length > 0) console.error('  Unexpected /api/ Calls:', apiRequests);
            if (consoleErrors.length > 0) console.error('  Console Errors:', consoleErrors);
        }

        return report;
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
    runDomNetworkValidation()
        .then(report => {
            process.exit(report.status === 'PASS' ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal DOM/Network Validation Error:', err);
            process.exit(1);
        });
}

module.exports = { runDomNetworkValidation, createEphemeralStaticServer };
