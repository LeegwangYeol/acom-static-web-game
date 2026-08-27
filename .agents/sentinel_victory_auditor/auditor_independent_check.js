/**
 * .agents/sentinel_victory_auditor/auditor_independent_check.js
 * Independent Auditor Verification Script by sentinel_victory_auditor
 * Zero shared code with implementation team.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');

const BASE_DIR = path.resolve(__dirname, '../..');
const API_PORT = 3000;
const API_BASE = `http://127.0.0.1:${API_PORT}/api`;

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function ensureServer() {
    try {
        const res = await fetch(`${API_BASE}/state`);
        if (res.ok) return null;
    } catch {}

    const proc = spawn('node', [path.join(BASE_DIR, 'server.js')], {
        cwd: BASE_DIR,
        stdio: 'pipe'
    });

    for (let i = 0; i < 40; i++) {
        await sleep(100);
        try {
            const res = await fetch(`${API_BASE}/state`);
            if (res.ok) return proc;
        } catch {}
    }
    throw new Error('Could not start server');
}

async function postJSON(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return { status: res.status, ok: res.ok, data: await res.json() };
}

async function getJSON(url) {
    const res = await fetch(url);
    return { status: res.status, ok: res.ok, data: await res.json() };
}

async function runAuditorChecks() {
    console.log('===============================================================');
    console.log('  INDEPENDENT VICTORY AUDITOR FORENSIC & BEHAVIORAL VERIFICATION ');
    console.log('===============================================================\n');

    const serverProc = await ensureServer();

    let passedChecks = 0;
    let totalChecks = 0;

    function check(name, fn) {
        totalChecks++;
        try {
            fn();
            console.log(`[PASS] Check ${totalChecks}: ${name}`);
            passedChecks++;
        } catch (err) {
            console.error(`[FAIL] Check ${totalChecks}: ${name}`);
            console.error(`       Error: ${err.message}`);
        }
    }

    async function checkAsync(name, fn) {
        totalChecks++;
        try {
            await fn();
            console.log(`[PASS] Check ${totalChecks}: ${name}`);
            passedChecks++;
        } catch (err) {
            console.error(`[FAIL] Check ${totalChecks}: ${name}`);
            console.error(`       Error: ${err.message}`);
        }
    }

    try {
        // --- CHECK GROUP 1: ASSET INTEGRITY & NON-PIXEL-ART CRITERIA ---
        const requiredAssets = [
            'ally_assault.png',
            'ally_recon.png',
            'ally_heavy.png',
            'enemy_mutant.png',
            'enemy_scout.png',
            'enemy_heavy.png'
        ];

        const hashes = new Set();

        for (const filename of requiredAssets) {
            const fullPath = path.join(BASE_DIR, 'assets/characters', filename);
            check(`Asset Existence: ${filename}`, () => {
                assert(fs.existsSync(fullPath), `Missing asset: ${fullPath}`);
                const stat = fs.statSync(fullPath);
                assert(stat.size > 1024, `Asset too small (${stat.size} bytes)`);
            });

            check(`Asset Magic Bytes & Dimensions: ${filename}`, () => {
                const buf = fs.readFileSync(fullPath);
                assert(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'Not a valid PNG');
                const w = buf.readUInt32BE(16);
                const h = buf.readUInt32BE(20);
                assert(w >= 128 && h >= 128, `Dimension < 128x128 (${w}x${h})`);
                
                const fileHash = crypto.createHash('sha256').update(buf).digest('hex');
                assert(!hashes.has(fileHash), `Duplicate asset hash detected: ${fileHash}`);
                hashes.add(fileHash);
            });

            check(`Asset Transparency & Anti-Aliased Vector/Illustration Quality: ${filename}`, () => {
                const buf = fs.readFileSync(fullPath);
                const w = buf.readUInt32BE(16);
                const h = buf.readUInt32BE(20);
                const colorType = buf.readUInt8(25);

                let offset = 8;
                let idatBuffers = [];
                let palette = [];
                let trns = [];

                while (offset < buf.length) {
                    const len = buf.readUInt32BE(offset);
                    const type = buf.toString('ascii', offset + 4, offset + 8);
                    const data = buf.subarray(offset + 8, offset + 8 + len);
                    if (type === 'IDAT') idatBuffers.push(data);
                    else if (type === 'PLTE') {
                        for (let i = 0; i < data.length; i += 3) palette.push([data[i], data[i+1], data[i+2]]);
                    } else if (type === 'tRNS') {
                        trns = Array.from(data);
                    }
                    offset += 12 + len;
                }

                const uncompressed = zlib.inflateSync(Buffer.concat(idatBuffers));
                let transparent = 0;
                let semiTransparent = 0;
                let opaque = 0;
                const stride = 1 + w;

                for (let y = 0; y < h; y++) {
                    const row = uncompressed.subarray(y * stride + 1, (y + 1) * stride);
                    for (let x = 0; x < w; x++) {
                        const palIdx = row[x];
                        const alpha = trns[palIdx] !== undefined ? trns[palIdx] : 255;
                        if (alpha === 0) transparent++;
                        else if (alpha === 255) opaque++;
                        else semiTransparent++;
                    }
                }

                const total = w * h;
                const transRatio = transparent / total;
                assert(transRatio >= 0.15, `Transparency ratio too low (${(transRatio*100).toFixed(1)}% < 15%)`);
                assert(semiTransparent >= 100, `Anti-aliased edge pixels too low (${semiTransparent} < 100) - indicates hard pixel art`);
            });
        }

        assert.strictEqual(hashes.size, 6, 'Expected exactly 6 distinct asset hashes');

        // --- CHECK GROUP 2: HTTP API & MULTI-UNIT ENGINE ---
        await checkAsync('Server Live Response & Multi-Unit State Initializer (/api/init)', async () => {
            const res = await postJSON(`${API_BASE}/init`, {});
            assert(res.ok, 'Failed to initialize game state');
            const st = res.data;
            assert.strictEqual(st.currentTurn, 'player', 'Initial turn should be player');
            assert(Array.isArray(st.grid) && st.grid.length === 10, 'Grid height should be 10');
            assert(Array.isArray(st.grid[0]) && st.grid[0].length === 10, 'Grid width should be 10');
            assert(Array.isArray(st.units) && st.units.length === 6, `Expected 6 units, got ${st.units.length}`);
            
            const allies = st.units.filter(u => u.type === 'player');
            const enemies = st.units.filter(u => u.type === 'enemy');
            assert.strictEqual(allies.length, 3, 'Expected 3 ally units');
            assert.strictEqual(enemies.length, 3, 'Expected 3 enemy units');

            // Check unit archetypes
            const allyClasses = allies.map(a => a.unitClass).sort();
            assert.deepStrictEqual(allyClasses, ['assault', 'heavy', 'recon'], 'Ally classes mismatch');
        });

        await checkAsync('Dynamic Random Squad Scaling (/api/init_random)', async () => {
            const res = await postJSON(`${API_BASE}/init_random`, { players: 3, enemies: 3 });
            assert(res.ok, 'Failed random init');
            const st = res.data;
            assert.strictEqual(st.units.length, 6, 'Expected 6 units in random squad');
            
            // Ensure no two units spawn on same coordinate
            const occupied = new Set();
            for (const u of st.units) {
                const key = `${u.x},${u.y}`;
                assert(!occupied.has(key), `Spawn collision on tile ${key}`);
                occupied.add(key);
                assert(st.grid[u.y][u.x].type === 0, `Unit spawned on cover tile ${key}`);
            }
        });

        await checkAsync('Tactical Action Engine: Movement & AP Tracking', async () => {
            const initRes = await postJSON(`${API_BASE}/init`, {});
            const st = initRes.data;
            const assault = st.units.find(u => u.archetype === 'ally_assault');
            assert(assault, 'Assault unit not found');
            const startX = assault.x;
            const startY = assault.y;

            // Move assault to (startX + 1, startY)
            const moveRes = await postJSON(`${API_BASE}/action`, {
                action: 'move',
                payload: { actorId: assault.id, x: startX + 1, y: startY }
            });
            assert(moveRes.ok, `Move failed: ${JSON.stringify(moveRes.data)}`);
            const updatedAssault = moveRes.data.units.find(u => u.id === assault.id);
            assert.strictEqual(updatedAssault.x, startX + 1, 'Unit X position did not update');
            assert.strictEqual(updatedAssault.ap, assault.maxAp - 1, 'AP did not decrement by 1');
        });

        await checkAsync('Boundary Rejection: Negative & Out of Bounds Coordinates', async () => {
            const res1 = await postJSON(`${API_BASE}/action`, {
                action: 'move',
                payload: { actorId: 'ally_assault_1', x: -1, y: 1 }
            });
            assert.strictEqual(res1.status, 400, 'Negative coordinate not rejected with 400');

            const res2 = await postJSON(`${API_BASE}/action`, {
                action: 'move',
                payload: { actorId: 'ally_assault_1', x: 10, y: 10 }
            });
            assert.strictEqual(res2.status, 400, 'OOB coordinate not rejected with 400');
        });

        await checkAsync('Tactical Action Engine: Combat Shooting & AP Depletion', async () => {
            const initRes = await postJSON(`${API_BASE}/init`, {});
            const st = initRes.data;
            const assault = st.units.find(u => u.archetype === 'ally_assault');
            const mutant = st.units.find(u => u.archetype === 'enemy_mutant');
            
            // Shoot mutant
            const shootRes = await postJSON(`${API_BASE}/action`, {
                action: 'shoot',
                payload: { actorId: assault.id, targetId: mutant.id }
            });
            assert(shootRes.ok, `Shoot action failed: ${JSON.stringify(shootRes.data)}`);
            const shooter = shootRes.data.units.find(u => u.id === assault.id);
            assert.strictEqual(shooter.ap, 0, 'Shooting should deplete all AP');
        });

        await checkAsync('Turn Transition & Enemy AI Processing (/api/action end_turn)', async () => {
            const endRes = await postJSON(`${API_BASE}/action`, {
                action: 'end_turn',
                payload: {}
            });
            assert(endRes.ok, 'End turn failed');
            const st = endRes.data;
            assert(st.logs.some(l => l.includes('Enemy turn') || l.includes('Player turn started') || l.includes('moved') || l.includes('attacks')), 'Enemy AI logs missing');
        });

        // --- CHECK GROUP 3: CLIENT DOM & CSS STRUCTURAL VALIDATION ---
        check('HTML Structure: Modern Tactical Elements Present', () => {
            const html = fs.readFileSync(path.join(BASE_DIR, 'index.html'), 'utf8');
            const requiredIds = [
                'squad-dock',
                'grid-container',
                'units-layer',
                'ui-panel',
                'unit-info',
                'unit-portrait-img',
                'unit-hp-fill',
                'target-preview-panel',
                'target-preview-idle',
                'target-preview-active',
                'target-portrait-img',
                'combat-log-container',
                'combat-log',
                'turn-banner',
                'mission-modal'
            ];
            for (const id of requiredIds) {
                assert(html.includes(`id="${id}"`), `Missing HTML element id="${id}"`);
            }
        });

        check('CSS Styling: Glassmorphism, Neon Sci-Fi Theme & Sprite Anchoring', () => {
            const css = fs.readFileSync(path.join(BASE_DIR, 'style.css'), 'utf8');
            assert(css.includes('backdrop-filter: blur'), 'Missing backdrop-filter blur');
            assert(css.includes('.unit-shadow'), 'Missing .unit-shadow definition');
            assert(css.includes('bottom: 8px'), 'Missing bottom-center sprite anchor');
            assert(css.includes('image-rendering: auto'), 'Missing image-rendering: auto');
            assert(css.includes('--neon-cyan'), 'Missing --neon-cyan palette definition');
        });

    } finally {
        if (serverProc) {
            serverProc.kill('SIGTERM');
        }
    }

    console.log('\n===============================================================');
    console.log(` AUDITOR INDEPENDENT VERIFICATION SUMMARY: ${passedChecks}/${totalChecks} PASS`);
    console.log('===============================================================\n');

    if (passedChecks !== totalChecks) {
        process.exit(1);
    }
}

runAuditorChecks().catch(err => {
    console.error('Fatal Auditor Script Error:', err);
    process.exit(1);
});
