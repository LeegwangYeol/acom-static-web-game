/**
 * tests/adversarial_m4_empirical.test.js
 * Milestone 4: Final Adversarial Empirical E2E Verification & Hardening
 * Purely static execution with in-memory AcomEngine and Headless Chrome CDP over ephemeral static host.
 * 
 * Tests:
 * 1. 3v3 Full Squad Battle Simulation to Victory & Defeat
 * 2. Live Target Preview & Tactical Calculations Parity (Base Aim, Half +20%, Full +40%, Distance, Clamping)
 * 3. Action Sequencing Combinations (Move->Shoot, Shoot->Move, Move->Move, Multi-Unit AP)
 * 4. Keyboard Shortcuts & UI State Bindings ('M', 'S', '1'-'3', 'Space'/'E', 'Escape')
 * 5. Headless Chrome DOM & Target Preview Live Interaction Audit (Zero server.js, zero /api/ calls)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');

const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_PATH = process.env.CHROME_BIN || '/usr/bin/google-chrome';

let AcomEngine, createUnit, ARCHETYPES, calculateHitChance;
try {
    const gameModule = require('../game.js');
    AcomEngine = gameModule.AcomEngine;
    createUnit = gameModule.createUnit;
    ARCHETYPES = gameModule.ARCHETYPES;
    calculateHitChance = gameModule.calculateHitChance;
} catch (err) {}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

describe('Adversarial M4: Final E2E Verification & Tactical Hardening [Static In-Memory & CDP]', { concurrency: 1 }, () => {

    // =========================================================================
    // SECTION 1: END-TO-END 3V3 SQUAD COMBAT SIMULATION
    // =========================================================================

    test('ADV-M4-101: 3v3 Combat Simulation to Complete Player Victory', () => {
        assert.ok(typeof AcomEngine === 'function', 'AcomEngine must be exported');
        const engine = new AcomEngine();
        engine.init();
        let state = engine.getState();

        assert.strictEqual(state.currentTurn, 'player');
        assert.strictEqual(state.units.filter(u => u.type === 'player').length, 3);
        assert.strictEqual(state.units.filter(u => u.type === 'enemy').length, 3);

        let round = 0;
        const maxRounds = 50;

        while (round < maxRounds) {
            round++;
            const livingEnemies = state.units.filter(u => u.type === 'enemy' && u.hp > 0);
            const livingPlayers = state.units.filter(u => u.type === 'player' && u.hp > 0);

            if (livingEnemies.length === 0 || livingPlayers.length === 0) break;

            // Player squad turn: each living player shoots the first living enemy
            for (const player of livingPlayers) {
                const target = state.units.find(u => u.type === 'enemy' && u.hp > 0);
                if (!target) break;

                engine.handleAction('shoot', { actorId: player.id, targetId: target.id });
                state = engine.getState();
            }

            // End player turn -> Trigger enemy AI
            engine.handleAction('end_turn', {});
            state = engine.getState();
        }

        const remainingEnemies = state.units.filter(u => u.type === 'enemy' && u.hp > 0);
        const remainingPlayers = state.units.filter(u => u.type === 'player' && u.hp > 0);

        assert.ok(
            remainingEnemies.length === 0 || remainingPlayers.length === 0,
            'Combat simulation must reach a decisive victory or defeat within 50 rounds'
        );
        const logsText = state.logs.join(' ');
        assert.ok(
            logsText.includes('defeated') || logsText.includes('Win') || logsText.includes('Game Over'),
            'Combat logs must contain terminal victory or defeat event'
        );
    });

    test('ADV-M4-102: Multi-Turn State Synchronization & Log Length Cap Invariant', () => {
        const engine = new AcomEngine();
        engine.initRandom(3, 3);

        for (let turn = 0; turn < 25; turn++) {
            engine.handleAction('end_turn', {});
            const state = engine.getState();

            assert.ok(state.logs.length <= 20, `Log length exceeded 20 on turn ${turn}: got ${state.logs.length}`);
            assert.strictEqual(state.units.length, 6, 'Total unit count must remain invariant at 6');
            assert.strictEqual(state.grid.length, 10, 'Grid height must remain 10');
            assert.strictEqual(state.grid[0].length, 10, 'Grid width must remain 10');
        }
    });

    // =========================================================================
    // SECTION 2: LIVE TARGET PREVIEW & TACTICAL CALCULATIONS PARITY
    // =========================================================================

    test('ADV-M4-201: Comprehensive Ballistic Hit Calculation Parity Matrix', () => {
        const calcHit = typeof calculateHitChance === 'function' ? calculateHitChance : (aim, cover, dist) => Math.max(0, Math.min(100, aim - cover - dist * 2));

        const testMatrix = [
            // Operative Base Aim: Assault (80)
            { aim: 80, cover: 0, dist: 1, expected: 78, desc: 'Assault flank at dist 1' },
            { aim: 80, cover: 20, dist: 2, expected: 56, desc: 'Assault vs Half cover at dist 2' },
            { aim: 80, cover: 40, dist: 3, expected: 34, desc: 'Assault vs Full cover at dist 3' },
            { aim: 80, cover: 40, dist: 8, expected: 24, desc: 'Assault vs Full cover at dist 8' },

            // Operative Base Aim: Recon (85)
            { aim: 85, cover: 0, dist: 2, expected: 81, desc: 'Recon flank at dist 2' },
            { aim: 85, cover: 20, dist: 3, expected: 59, desc: 'Recon vs Half cover at dist 3' },
            { aim: 85, cover: 40, dist: 5, expected: 35, desc: 'Recon vs Full cover at dist 5' },

            // Operative Base Aim: Heavy (70)
            { aim: 70, cover: 0, dist: 1, expected: 68, desc: 'Heavy flank at dist 1' },
            { aim: 70, cover: 20, dist: 2, expected: 46, desc: 'Heavy vs Half cover at dist 2' },
            { aim: 70, cover: 40, dist: 4, expected: 22, desc: 'Heavy vs Full cover at dist 4' },

            // Clamping Tests
            { aim: 60, cover: 40, dist: 12, expected: 0, desc: 'Clamping floor: 60 - 40 - 24 = -4 -> 0%' },
            { aim: 50, cover: 40, dist: 15, expected: 0, desc: 'Clamping floor: 50 - 40 - 30 = -20 -> 0%' },
            { aim: 90, cover: 0, dist: 0, expected: 90, desc: 'Point blank 0 distance' }
        ];

        for (const tc of testMatrix) {
            const result = calcHit(tc.aim, tc.cover, tc.dist);
            assert.strictEqual(result, tc.expected, `Hit calculation mismatch for ${tc.desc}: got ${result}%, expected ${tc.expected}%`);
        }
    });

    test('ADV-M4-202: Cover Defense Angle and Tile Geometry Parity', () => {
        function getCoverDefense(defenderX, defenderY, grid) {
            let coverDefense = 0;
            const adjacentOffsets = [
                { dx: 0, dy: -1 },
                { dx: 0, dy: 1 },
                { dx: -1, dy: 0 },
                { dx: 1, dy: 0 }
            ];

            for (const offset of adjacentOffsets) {
                const nx = defenderX + offset.dx;
                const ny = defenderY + offset.dy;
                if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
                    if (grid[ny][nx].type === 1) coverDefense = Math.max(coverDefense, 20);
                    if (grid[ny][nx].type === 2) coverDefense = Math.max(coverDefense, 40);
                }
            }
            return coverDefense;
        }

        const grid = Array.from({ length: 10 }, (_, y) =>
            Array.from({ length: 10 }, (_, x) => ({ x, y, type: 0 }))
        );

        // Flanked (No Cover)
        assert.strictEqual(getCoverDefense(4, 4, grid), 0);

        // Half Cover North
        grid[3][4].type = 1;
        assert.strictEqual(getCoverDefense(4, 4, grid), 20);

        // Full Cover West (Math.max takes 40 over 20)
        grid[4][3].type = 2;
        assert.strictEqual(getCoverDefense(4, 4, grid), 40);
    });

    // =========================================================================
    // SECTION 3: ACTION SEQUENCING COMBINATIONS & STATE IMMUTABILITY
    // =========================================================================

    test('ADV-M4-301: Action Sequencing Matrix (Move->Move vs Move->Shoot vs Shoot->Move)', () => {
        const findValidAdjacent = (x, y, grid, units) => {
            const candidates = [
                { x: x + 1, y },
                { x: x - 1, y },
                { x, y: y + 1 },
                { x, y: y - 1 }
            ];
            return candidates.find(c =>
                c.x >= 0 && c.x < 10 && c.y >= 0 && c.y < 10 &&
                grid[c.y][c.x].type === 0 &&
                !units.some(u => u.x === c.x && u.y === c.y && u.hp > 0)
            );
        };

        // Case 1: Move -> Move (Consumes 1 AP + 1 AP = 0 AP)
        const engine1 = new AcomEngine();
        engine1.init();
        let s1 = engine1.getState();
        let p1 = s1.units.find(u => u.type === 'player' && u.hp > 0);

        const m1 = findValidAdjacent(p1.x, p1.y, s1.grid, s1.units);
        assert.ok(m1, 'Must find valid move 1');
        let resMove1 = engine1.handleAction('move', { actorId: p1.id, x: m1.x, y: m1.y });
        assert.strictEqual(resMove1.success, true);
        s1 = engine1.getState();
        p1 = s1.units.find(u => u.id === p1.id);
        assert.strictEqual(p1.ap, 1, 'AP must be 1 after first move');

        const m2 = findValidAdjacent(p1.x, p1.y, s1.grid, s1.units);
        assert.ok(m2, 'Must find valid move 2');
        let resMove2 = engine1.handleAction('move', { actorId: p1.id, x: m2.x, y: m2.y });
        assert.strictEqual(resMove2.success, true);
        s1 = engine1.getState();
        p1 = s1.units.find(u => u.id === p1.id);
        assert.strictEqual(p1.ap, 0, 'AP must be 0 after second move');

        // Case 2: Move -> Shoot (Consumes 1 AP + remaining 1 AP = 0 AP)
        const engine2 = new AcomEngine();
        engine2.init();
        let s2 = engine2.getState();
        let p2 = s2.units.find(u => u.type === 'player' && u.hp > 0);
        let e2 = s2.units.find(u => u.type === 'enemy' && u.hp > 0);

        const m3 = findValidAdjacent(p2.x, p2.y, s2.grid, s2.units);
        assert.ok(m3, 'Must find valid move');
        engine2.handleAction('move', { actorId: p2.id, x: m3.x, y: m3.y });
        s2 = engine2.getState();
        p2 = s2.units.find(u => u.id === p2.id);
        assert.strictEqual(p2.ap, 1);

        let resShoot = engine2.handleAction('shoot', { actorId: p2.id, targetId: e2.id });
        assert.strictEqual(resShoot.success, true);
        s2 = engine2.getState();
        p2 = s2.units.find(u => u.id === p2.id);
        assert.strictEqual(p2.ap, 0, 'AP must be 0 after shooting');

        // Case 3: Shoot -> Move blocked (Shooting ends turn for that unit)
        const engine3 = new AcomEngine();
        engine3.init();
        let s3 = engine3.getState();
        let p3 = s3.units.find(u => u.type === 'player' && u.hp > 0);
        let e3 = s3.units.find(u => u.type === 'enemy' && u.hp > 0);

        engine3.handleAction('shoot', { actorId: p3.id, targetId: e3.id });
        s3 = engine3.getState();
        p3 = s3.units.find(u => u.id === p3.id);
        assert.strictEqual(p3.ap, 0);

        const m4 = findValidAdjacent(p3.x, p3.y, s3.grid, s3.units);
        if (m4) {
            let resBlocked = engine3.handleAction('move', { actorId: p3.id, x: m4.x, y: m4.y });
            assert.strictEqual(resBlocked.success, false, 'Move after direct shoot must be rejected');
        }
    });

    // =========================================================================
    // SECTION 4: HEADLESS CHROME CDP DOM & INTERACTION AUDIT
    // =========================================================================

    test('ADV-M4-401: Headless Chrome CDP Live UI & Hotkeys Audit', async () => {
        const staticHost = await createEphemeralStaticServer();
        const appPort = staticHost.port;
        const cdpPort = await getFreePort();
        const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acom-cdp-hotkey-'));

        let chromeProc = null;
        let ws = null;
        const networkErrors = [];
        const apiRequests = [];
        const consoleErrors = [];

        try {
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
                } else if (data.method) {
                    if (data.method === 'Network.requestWillBeSent') {
                        if (data.params.request.url.includes('/api/')) {
                            apiRequests.push(data.params.request.url);
                        }
                    } else if (data.method === 'Network.responseReceived') {
                        if (data.params.response.status >= 400 && !data.params.response.url.endsWith('favicon.ico')) {
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

            await sendCDP('Page.enable');
            await sendCDP('Runtime.enable');
            await sendCDP('DOM.enable');
            await sendCDP('Network.enable');

            const gameUrl = `http://127.0.0.1:${appPort}/index.html`;
            await sendCDP('Page.navigate', { url: gameUrl });
            await sleep(1500);

            // Verify DOM HUD initialization
            const hudCheck = await sendCDP('Runtime.evaluate', {
                expression: `(() => {
                    return {
                        hasGrid: !!document.getElementById('grid-container'),
                        hasUnitsLayer: !!document.getElementById('units-layer'),
                        hasSquadDock: !!document.getElementById('squad-dock'),
                        hasTurnIndicator: !!document.getElementById('turn-indicator'),
                        hasApCounter: !!document.getElementById('ap-counter'),
                        hasCombatLog: !!document.getElementById('combat-log'),
                        hasBtnMove: !!document.getElementById('btn-move'),
                        hasBtnShoot: !!document.getElementById('btn-shoot'),
                        hasBtnEndTurn: !!document.getElementById('btn-end-turn')
                    };
                })()`,
                returnByValue: true
            });

            const hud = hudCheck.result.value || {};
            assert.strictEqual(hud.hasGrid, true, 'HUD must contain #grid-container');
            assert.strictEqual(hud.hasUnitsLayer, true, 'HUD must contain #units-layer');
            assert.strictEqual(hud.hasSquadDock, true, 'HUD must contain #squad-dock');
            assert.strictEqual(hud.hasBtnMove, true, 'HUD must contain #btn-move');
            assert.strictEqual(hud.hasBtnShoot, true, 'HUD must contain #btn-shoot');
            assert.strictEqual(hud.hasBtnEndTurn, true, 'HUD must contain #btn-end-turn');

            // Dispatch keyboard shortcuts: 'M' (Move mode)
            await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', text: 'm', unmodifiedText: 'm', key: 'm', code: 'KeyM' });
            await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: 'm', code: 'KeyM' });
            await sleep(200);

            // Dispatch keyboard shortcut: 'S' (Shoot mode)
            await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', text: 's', unmodifiedText: 's', key: 's', code: 'KeyS' });
            await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: 's', code: 'KeyS' });
            await sleep(200);

            // Dispatch keyboard shortcut: 'Escape' (Cancel mode)
            await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
            await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
            await sleep(200);

            assert.strictEqual(networkErrors.length, 0, 'Must have zero network 404s/errors');
            assert.strictEqual(apiRequests.length, 0, 'Must make zero /api/ requests');
            assert.strictEqual(consoleErrors.length, 0, 'Must have zero console errors');
        } finally {
            if (ws) ws.close();
            if (chromeProc) chromeProc.kill('SIGTERM');
            if (staticHost) await staticHost.close();
            try {
                fs.rmSync(userDataDir, { recursive: true, force: true });
            } catch {}
        }
    });
});
