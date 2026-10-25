/**
 * tests/validate_layout.js
 * Purely Static Headless Chrome Validation Script for ACOM Project.
 * Verifies isometric grid layout, unit spatial separation, dynamic z-depth sorting,
 * and UI panel non-clipping without relying on server.js.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_PATH = path.resolve(__dirname, '../.agents/reports/layout_report.json');
const CHROME_PATH = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');

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

async function runLayoutValidation() {
    console.log('=== ACOM Isometric Layout & Non-Clipping Validation (Purely Static) ===');

    const staticHost = await createEphemeralStaticServer();
    const appPort = staticHost.port;
    console.log(`Ephemeral static host ready on port ${appPort}.`);

    const cdpPort = await getFreePort();
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acom-layout-chrome-'));

    let chromeProc = null;
    let ws = null;

    try {
        console.log(`Launching Headless Chrome on CDP port ${cdpPort}...`);
        chromeProc = spawn(CHROME_PATH, [
            '--headless=new',
            `--remote-debugging-port=${cdpPort}`,
            `--user-data-dir=${userDataDir}`,
            '--disable-gpu',
            '--no-sandbox',
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
                const pageTarget = list.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension')) || list.find(t => t.type === 'page') || list[0];
                if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                    debuggerUrl = pageTarget.webSocketDebuggerUrl;
                    break;
                }
            } catch {}
        }

        if (!debuggerUrl) {
            throw new Error(`Failed to connect to Chrome CDP on port ${cdpPort}`);
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

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.id && pendingCallbacks.has(data.id)) {
                const cb = pendingCallbacks.get(data.id);
                pendingCallbacks.delete(data.id);
                if (data.error) cb.reject(new Error(data.error.message));
                else cb.resolve(data.result);
            }
        };

        await sendCDP('Page.enable');
        await sendCDP('Runtime.enable');
        await sendCDP('DOM.enable');

        const gameUrl = `http://127.0.0.1:${appPort}/index.html`;
        console.log(`Navigating to static game URL: ${gameUrl}...`);
        await sendCDP('Page.navigate', { url: gameUrl });

        await sleep(1500);

        // Trigger in-memory 3v3 squad initialization on client side
        await sendCDP('Runtime.evaluate', {
            expression: `(async () => {
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
            })()`,
            awaitPromise: true
        });

        await sleep(600);

        // Analyze layout and geometry
        const layoutEval = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const getRect = (el) => {
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return {
                        left: r.left,
                        top: r.top,
                        right: r.right,
                        bottom: r.bottom,
                        width: r.width,
                        height: r.height
                    };
                };

                const gameContainer = document.getElementById('game-container');
                const mapWrapper = document.getElementById('map-wrapper');
                const gridContainer = document.getElementById('grid-container');
                const uiPanel = document.getElementById('ui-panel');
                const squadDock = document.getElementById('squad-dock') || document.querySelector('.squad-dock');
                const unitsLayer = document.getElementById('units-layer');

                const units = Array.from(document.querySelectorAll('#units-layer .unit')).map(u => {
                    const computed = window.getComputedStyle(u);
                    return {
                        id: u.id,
                        className: u.className,
                        leftStyle: u.style.left,
                        topStyle: u.style.top,
                        zIndex: parseInt(computed.zIndex) || 0,
                        rect: getRect(u)
                    };
                });

                // Pairwise unit position check (must be on distinct tiles)
                const duplicatePositions = [];
                for (let i = 0; i < units.length; i++) {
                    for (let j = i + 1; j < units.length; j++) {
                        const u1 = units[i];
                        const u2 = units[j];
                        if (u1.leftStyle && u2.leftStyle && u1.leftStyle === u2.leftStyle && u1.topStyle === u2.topStyle) {
                            duplicatePositions.push({ unit1: u1.id, unit2: u2.id, pos: u1.leftStyle + ',' + u1.topStyle });
                        }
                    }
                }

                // Check dynamic z-depth sorting formula (z = y * 10 + 5)
                let zDepthConforms = units.length > 0;
                for (const u of units) {
                    const y = Math.round(parseFloat(u.topStyle) / 60);
                    const baseZ = u.zIndex >= 100 ? u.zIndex - 100 : u.zIndex;
                    const expectedBaseZ = y * 10 + 5;
                    if (baseZ !== expectedBaseZ) {
                        zDepthConforms = false;
                    }
                }

                const containerRect = getRect(gameContainer);
                const mapRect = getRect(mapWrapper);
                const gridRect = getRect(gridContainer);
                const uiPanelRect = getRect(uiPanel);
                const dockRect = getRect(squadDock);

                // Check panel clipping into grid
                let uiClipsGrid = false;
                let clippingDetails = null;

                if (gridRect && uiPanelRect) {
                    const verticalOverlap = !(uiPanelRect.top >= gridRect.bottom - 5 || gridRect.top >= uiPanelRect.bottom - 5);
                    const horizontalOverlap = !(uiPanelRect.left >= gridRect.right || gridRect.left >= uiPanelRect.right);
                    if (verticalOverlap && horizontalOverlap) {
                        uiClipsGrid = true;
                        clippingDetails = { uiPanelRect, gridRect };
                    }
                }

                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const containerFits = containerRect ? (containerRect.width <= viewportWidth + 20) : true;

                return {
                    viewport: { width: viewportWidth, height: viewportHeight },
                    containerRect,
                    mapRect,
                    gridRect,
                    uiPanelRect,
                    dockRect,
                    unitsCount: units.length,
                    units,
                    duplicatePositions,
                    zDepthConforms,
                    uiClipsGrid,
                    clippingDetails,
                    containerFits
                };
            })()`,
            returnByValue: true
        });

        const layout = layoutEval.result.value || {};
        console.log(`Layout Units Evaluated: ${layout.unitsCount}`);
        console.log(`Duplicate Tile Collisions: ${layout.duplicatePositions.length}`);
        console.log(`Z-Depth Sorting Conforms: ${layout.zDepthConforms}`);
        console.log(`UI Clips Grid: ${layout.uiClipsGrid}`);
        console.log(`Container Fits Viewport: ${layout.containerFits}`);

        const passed = layout.unitsCount >= 2 &&
                       layout.duplicatePositions.length === 0 &&
                       layout.zDepthConforms &&
                       !layout.uiClipsGrid &&
                       layout.containerFits;

        const report = {
            timestamp: new Date().toISOString(),
            gameUrl,
            mode: 'static_serverless',
            status: passed ? 'PASS' : 'FAIL',
            summary: {
                unitsCount: layout.unitsCount,
                duplicateCollisionsCount: layout.duplicatePositions.length,
                zDepthConforms: layout.zDepthConforms,
                uiClipsGrid: layout.uiClipsGrid,
                containerFits: layout.containerFits
            },
            geometry: {
                viewport: layout.viewport,
                container: layout.containerRect,
                grid: layout.gridRect,
                uiPanel: layout.uiPanelRect,
                squadDock: layout.dockRect
            },
            units: layout.units,
            collisions: layout.duplicatePositions,
            clippingDetails: layout.clippingDetails
        };

        const reportDir = path.dirname(REPORT_PATH);
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
        fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

        if (passed) {
            console.log('✓ Isometric Layout validation PASSED (No unit collisions, z-depth verified, clean panel clearance).');
        } else {
            console.error('✗ Isometric Layout validation FAILED.');
            if (layout.duplicatePositions.length > 0) console.error('  Unit Collisions:', layout.duplicatePositions);
            if (!layout.zDepthConforms) console.error('  Z-Depth sorting failed monotonicity check.');
            if (layout.uiClipsGrid) console.error('  UI Panel Clips Grid:', layout.clippingDetails);
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
    runLayoutValidation()
        .then(report => {
            process.exit(report.status === 'PASS' ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal Layout Validation Error:', err);
            process.exit(1);
        });
}

module.exports = { runLayoutValidation };
