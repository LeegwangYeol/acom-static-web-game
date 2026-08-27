/**
 * tests/challenger_static_2_file_protocol.js
 * Empirical Verification of Direct file:// Protocol Execution in Headless Chrome
 * Proves 100% Zero-Server Local File Functionality for ACOM
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');

const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const INDEX_HTML_FILE_URL = `file://${path.join(ROOT_DIR, 'index.html')}`;

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

async function fetchJSON(url) {
    const res = await fetch(url);
    return await res.json();
}

async function runFileProtocolTest() {
    console.log('=== ACOM file:// Protocol Direct Local Execution Verification ===');
    console.log(`Target File URL: ${INDEX_HTML_FILE_URL}`);

    const cdpPort = await getFreePort();
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acom-cdp-file-proto-'));

    let chromeProc = null;
    let ws = null;

    const networkErrors = [];
    const consoleErrors = [];
    const apiCalls = [];

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
            '--allow-file-access-from-files',
            '--window-size=1440,900',
            'about:blank'
        ], { stdio: 'pipe' });

        let debuggerUrl = null;
        for (let i = 0; i < 40; i++) {
            await sleep(100);
            try {
                const list = await fetchJSON(`http://127.0.0.1:${cdpPort}/json/list`);
                const pageTarget = list.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension')) || list[0];
                if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                    debuggerUrl = pageTarget.webSocketDebuggerUrl;
                    break;
                }
            } catch {}
        }

        if (!debuggerUrl) throw new Error('CDP target unreachable');

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

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.id && pendingCallbacks.has(data.id)) {
                const cb = pendingCallbacks.get(data.id);
                pendingCallbacks.delete(data.id);
                if (data.error) cb.reject(new Error(data.error.message));
                else cb.resolve(data.result);
            } else if (data.method) {
                if (data.method === 'Network.requestWillBeSent') {
                    if (data.params.request.url.includes('/api/')) {
                        apiCalls.push(data.params.request.url);
                    }
                } else if (data.method === 'Network.responseReceived') {
                    if (data.params.response.status >= 400) {
                        networkErrors.push(data.params.response.url);
                    }
                } else if (data.method === 'Runtime.consoleAPICalled') {
                    if (data.params.type === 'error') {
                        consoleErrors.push(data.params.args.map(a => a.value || JSON.stringify(a)).join(' '));
                    }
                } else if (data.method === 'Runtime.exceptionThrown') {
                    consoleErrors.push(data.params.exceptionDetails.text);
                }
            }
        };

        await sendCDP('Network.enable');
        await sendCDP('Runtime.enable');
        await sendCDP('Page.enable');
        await sendCDP('DOM.enable');

        await sendCDP('Page.navigate', { url: INDEX_HTML_FILE_URL });
        await sleep(1500);

        const checkEval = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const units = document.querySelectorAll('#units-layer .unit');
                const squadCards = document.querySelectorAll('#squad-dock .squad-card');
                const gridCells = document.querySelectorAll('#grid-container .cell');
                const isEngineLoaded = !!window.gameEngine;
                return {
                    unitsCount: units.length,
                    squadCardsCount: squadCards.length,
                    gridCellsCount: gridCells.length,
                    isEngineLoaded
                };
            })()`,
            returnByValue: true
        });

        const state = checkEval.result.value || {};
        console.log(`file:// Units: ${state.unitsCount}/6, Cards: ${state.squadCardsCount}/3, Grid: ${state.gridCellsCount}/100, EngineLoaded: ${state.isEngineLoaded}`);
        console.log(`file:// Network Errors: ${networkErrors.length}, API Calls: ${apiCalls.length}, Console Errors: ${consoleErrors.length}`);

        const passed = state.unitsCount === 6 &&
                       state.squadCardsCount === 3 &&
                       state.gridCellsCount === 100 &&
                       state.isEngineLoaded &&
                       networkErrors.length === 0 &&
                       apiCalls.length === 0 &&
                       consoleErrors.length === 0;

        if (passed) {
            console.log('✓ PASS: Direct file:// protocol verified in Headless Chrome with 0 server dependency.');
        } else {
            console.error('✗ FAIL: Direct file:// protocol verification failed.');
        }

        return { passed, state, networkErrors, apiCalls, consoleErrors };
    } finally {
        if (ws) ws.close();
        if (chromeProc) chromeProc.kill('SIGTERM');
        try {
            fs.rmSync(userDataDir, { recursive: true, force: true });
        } catch {}
    }
}

if (require.main === module) {
    runFileProtocolTest()
        .then(r => process.exit(r.passed ? 0 : 1))
        .catch(err => {
            console.error('Fatal file:// test error:', err);
            process.exit(1);
        });
}

module.exports = { runFileProtocolTest };
