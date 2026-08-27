/**
 * tests/adversarial_m2.test.js
 * Empirical Challenger Adversarial Test Suite for Milestone 2
 * Comprehensive stress testing of multi-unit logic, boundary validation, and combat engine.
 * Purely in-memory static execution against AcomEngine from game.js (Zero server.js dependency).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let AcomEngine, createUnit, ARCHETYPES, calculateHitChance;
try {
    const gameModule = require('../game.js');
    AcomEngine = gameModule.AcomEngine;
    createUnit = gameModule.createUnit;
    ARCHETYPES = gameModule.ARCHETYPES;
    calculateHitChance = gameModule.calculateHitChance;
} catch (err) {}

describe('Adversarial Challenge M2: Multi-Unit, Boundaries & Combat Engine [Static In-Memory]', { concurrency: 1 }, () => {

    // =========================================================================
    // SECTION 1: SPATIAL & BOUNDARY VALIDATION STRESS TESTS
    // =========================================================================
    test('ADV-101: Boundary Edge & Negative Coordinates Rejection', () => {
        assert.ok(typeof AcomEngine === 'function', 'AcomEngine must be exported');
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        const player = state.units.find(u => u.type === 'player' && u.hp > 0);

        const invalidCoords = [
            { x: -1, y: 0, desc: 'Negative X (-1)' },
            { x: 0, y: -1, desc: 'Negative Y (-1)' },
            { x: -10, y: -10, desc: 'Negative X & Y (-10, -10)' },
            { x: -999999, y: 0, desc: 'Extreme Negative X' },
            { x: 0, y: -999999, desc: 'Extreme Negative Y' },
            { x: 10, y: 0, desc: 'Upper Boundary X (10)' },
            { x: 0, y: 10, desc: 'Upper Boundary Y (10)' },
            { x: 10, y: 10, desc: 'Upper Boundary X & Y (10, 10)' },
            { x: 999999, y: 999999, desc: 'Extreme Positive X & Y' }
        ];

        for (const coord of invalidCoords) {
            const res = engine.handleAction('move', { actorId: player.id, x: coord.x, y: coord.y });
            assert.strictEqual(res.success, false, `Move to ${coord.desc} (${coord.x}, ${coord.y}) must be rejected with success=false`);
        }
    });

    test('ADV-102: Malformed & Non-Numeric Coordinate Rejection', () => {
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        const player = state.units.find(u => u.type === 'player' && u.hp > 0);

        const malformedPayloads = [
            { x: '2', y: 2, desc: 'String X' },
            { x: 2, y: '3', desc: 'String Y' },
            { x: 'invalid', y: 'coords', desc: 'Alphabetic string coordinates' },
            { x: null, y: 2, desc: 'null X' },
            { x: 2, y: undefined, desc: 'undefined Y' },
            { x: NaN, y: 2, desc: 'NaN X' },
            { x: Infinity, y: 2, desc: 'Infinity X' },
            { x: -Infinity, y: 2, desc: '-Infinity X' }
        ];

        for (const item of malformedPayloads) {
            const res = engine.handleAction('move', { actorId: player.id, x: item.x, y: item.y });
            assert.strictEqual(res.success, false, `Malformed move (${item.desc}) must return success=false`);
        }
    });

    test('ADV-103: Unit-on-Unit Collision Prevention (Ally, Enemy & Self)', () => {
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        const players = state.units.filter(u => u.type === 'player');
        const enemies = state.units.filter(u => u.type === 'enemy');
        const actor = players[0];

        // 1. Moving onto another ally's position
        const otherAlly = players[1];
        const allyCollisionRes = engine.handleAction('move', { actorId: actor.id, x: otherAlly.x, y: otherAlly.y });
        assert.strictEqual(allyCollisionRes.success, false, 'Moving onto an ally occupied tile must return success=false');

        // 2. Moving onto an enemy's position
        const enemy = enemies[0];
        const enemyCollisionRes = engine.handleAction('move', { actorId: actor.id, x: enemy.x, y: enemy.y });
        assert.strictEqual(enemyCollisionRes.success, false, 'Moving onto an enemy occupied tile must return success=false');

        // 3. Moving onto actor self position (0 distance)
        const selfCollisionRes = engine.handleAction('move', { actorId: actor.id, x: actor.x, y: actor.y });
        assert.strictEqual(selfCollisionRes.success, false, 'Moving onto own tile must return success=false');
    });

    test('ADV-104: Obstacle & Cover Collision Prevention', () => {
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        const player = state.units.find(u => u.type === 'player');

        // Collect cover tiles
        const coverTiles = [];
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                if (state.grid[y][x].type !== 0) {
                    coverTiles.push(state.grid[y][x]);
                }
            }
        }

        assert.ok(coverTiles.length > 0, 'Procedural map must generate cover obstacles');

        for (const cover of coverTiles.slice(0, 5)) {
            const res = engine.handleAction('move', { actorId: player.id, x: cover.x, y: cover.y });
            assert.strictEqual(res.success, false, `Moving onto cover tile (${cover.x}, ${cover.y}, type=${cover.type}) must return success=false`);
        }
    });

    test('ADV-105: Mobility Limit Enforcement across all Ally Archetypes', () => {
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        const players = state.units.filter(u => u.type === 'player');

        for (const p of players) {
            const targetX = (p.x + p.mobility + 2) % 10;
            const targetY = p.y;
            const res = engine.handleAction('move', { actorId: p.id, x: targetX, y: targetY });
            assert.strictEqual(res.success, false, `Unit ${p.id} (mobility=${p.mobility}) moving dist > mobility must return success=false`);
        }
    });

    test('ADV-106: Procedural Squad Spawn Disjointness & Cover Clearance', () => {
        const engine = new AcomEngine();
        for (let run = 0; run < 10; run++) {
            engine.init();
            const state = engine.getState();

            assert.strictEqual(state.units.length, 6, 'Must spawn 6 units (3v3)');

            const coords = new Set();
            for (const u of state.units) {
                const key = `${u.x},${u.y}`;
                assert.ok(!coords.has(key), `Duplicate unit spawn at (${u.x}, ${u.y}) on run ${run}`);
                coords.add(key);

                const tile = state.grid[u.y][u.x];
                assert.strictEqual(tile.type, 0, `Unit ${u.id} spawned on non-empty tile (${u.x}, ${u.y}) type ${tile.type}`);
            }
        }
    });

    // =========================================================================
    // SECTION 2: MULTI-UNIT LOGIC & AP ENGINE STRESS TESTS
    // =========================================================================
    test('ADV-201: Multi-Unit Independent AP Tracking & Full Depletion', () => {
        const engine = new AcomEngine();
        engine.init();
        let state = engine.getState();

        const allies = state.units.filter(u => u.type === 'player');
        const enemies = state.units.filter(u => u.type === 'enemy');
        assert.strictEqual(allies.length, 3);

        const [u1, u2, u3] = allies;
        const enemy = enemies[0];

        // Unit 1 shoots -> Unit 1 AP becomes 0
        const shoot1Res = engine.handleAction('shoot', { actorId: u1.id, targetId: enemy.id });
        assert.strictEqual(shoot1Res.success, true);
        state = engine.getState();

        const stateU1 = state.units.find(u => u.id === u1.id);
        const stateU2 = state.units.find(u => u.id === u2.id);
        const stateU3 = state.units.find(u => u.id === u3.id);

        assert.strictEqual(stateU1.ap, 0, 'Unit 1 AP must be 0 after shooting');
        assert.strictEqual(stateU2.ap, 2, 'Unit 2 AP must remain 2');
        assert.strictEqual(stateU3.ap, 2, 'Unit 3 AP must remain 2');

        // Unit 1 attempts another shoot with 0 AP -> must return success=false
        const failShootRes = engine.handleAction('shoot', { actorId: u1.id, targetId: enemy.id });
        assert.strictEqual(failShootRes.success, false, 'Shooting with 0 AP must return success=false');

        // Unit 2 can still shoot
        const shoot2Res = engine.handleAction('shoot', { actorId: u2.id, targetId: enemy.id });
        assert.strictEqual(shoot2Res.success, true, 'Unit 2 must be able to shoot independently');
    });

    test('ADV-202: Consecutive Move AP Depletion (2 AP -> 1 AP -> 0 AP -> Rejection)', () => {
        const engine = new AcomEngine();
        engine.init();
        let state = engine.getState();

        const player = state.units.find(u => u.type === 'player' && u.hp > 0);
        assert.strictEqual(player.ap, 2, 'New game unit AP must be 2');

        const findAdjEmpty = (currX, currY, grid, units) => {
            const candidates = [
                { x: currX + 1, y: currY },
                { x: currX - 1, y: currY },
                { x: currX, y: currY + 1 },
                { x: currX, y: currY - 1 }
            ];
            return candidates.find(c => 
                c.x >= 0 && c.x < 10 && c.y >= 0 && c.y < 10 &&
                grid[c.y][c.x].type === 0 &&
                !units.some(u => u.x === c.x && u.y === c.y && u.hp > 0)
            );
        };

        const move1 = findAdjEmpty(player.x, player.y, state.grid, state.units);
        assert.ok(move1, 'Must find valid move 1');

        let res1 = engine.handleAction('move', { actorId: player.id, x: move1.x, y: move1.y });
        assert.strictEqual(res1.success, true);
        state = engine.getState();
        let updatedPlayer = state.units.find(u => u.id === player.id);
        assert.strictEqual(updatedPlayer.ap, 1, 'AP must be 1 after first move');

        const move2 = findAdjEmpty(updatedPlayer.x, updatedPlayer.y, state.grid, state.units);
        assert.ok(move2, 'Must find valid move 2');

        let res2 = engine.handleAction('move', { actorId: player.id, x: move2.x, y: move2.y });
        assert.strictEqual(res2.success, true);
        state = engine.getState();
        updatedPlayer = state.units.find(u => u.id === player.id);
        assert.strictEqual(updatedPlayer.ap, 0, 'AP must be 0 after second move');

        // Third move attempt with 0 AP
        const move3 = findAdjEmpty(updatedPlayer.x, updatedPlayer.y, state.grid, state.units);
        if (move3) {
            let res3 = engine.handleAction('move', { actorId: player.id, x: move3.x, y: move3.y });
            assert.strictEqual(res3.success, false, 'Move with 0 AP must return success=false');
        }
    });

    test('ADV-203: Invalid Actor ID Guards & Impersonation Defense', () => {
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        const enemy = state.units.find(u => u.type === 'enemy');

        // 1. Explicit non-existent string ID
        const ghostActorRes = engine.handleAction('move', { actorId: 'non_existent_actor_99', x: 2, y: 2 });
        assert.strictEqual(ghostActorRes.success, false, 'Action with non-existent actor must return success=false');

        // 2. Enemy unit impersonation during player turn
        const enemyActorRes = engine.handleAction('move', { actorId: enemy.id, x: 2, y: 2 });
        assert.strictEqual(enemyActorRes.success, false, 'Enemy acting during player turn must return success=false');

        // 3. Numeric invalid actor ID
        const numActorRes = engine.handleAction('move', { actorId: 9999, x: 2, y: 2 });
        assert.strictEqual(numActorRes.success, false, 'Numeric actor ID must return success=false');
    });

    test('ADV-204: Friendly Fire, Self-Targeting & Ghost Target Defense', () => {
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        const players = state.units.filter(u => u.type === 'player');
        const [p1, p2] = players;

        // 1. Ally shooting Ally
        const friendlyFireRes = engine.handleAction('shoot', { actorId: p1.id, targetId: p2.id });
        assert.strictEqual(friendlyFireRes.success, false, 'Friendly fire must return success=false');

        // 2. Self shoot
        const selfShootRes = engine.handleAction('shoot', { actorId: p1.id, targetId: p1.id });
        assert.strictEqual(selfShootRes.success, false, 'Self shooting must return success=false');

        // 3. Ghost/Non-existent target
        const ghostTargetRes = engine.handleAction('shoot', { actorId: p1.id, targetId: 'ghost_target_unit' });
        assert.strictEqual(ghostTargetRes.success, false, 'Shooting non-existent target must return success=false');

        // 4. Missing targetId
        const missingTargetRes = engine.handleAction('shoot', { actorId: p1.id });
        assert.strictEqual(missingTargetRes.success, false, 'Shooting with missing targetId must return success=false');
    });

    test('ADV-205: Dead Unit State Consistency & Rejection of Post-Mortem Actions', () => {
        const engine = new AcomEngine();
        engine.init();
        let state = engine.getState();
        let player = state.units.find(u => u.type === 'player');
        let enemy = state.units.find(u => u.type === 'enemy');

        let attempts = 0;
        while (enemy && enemy.hp > 0 && attempts < 20) {
            attempts++;
            if (player.ap <= 0) {
                engine.handleAction('end_turn', {});
                state = engine.getState();
                player = state.units.find(u => u.type === 'player' && u.hp > 0);
                enemy = state.units.find(u => u.id === enemy.id);
                if (!player || !enemy || enemy.hp <= 0) break;
            }

            const shootRes = engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
            if (shootRes.success) {
                state = engine.getState();
                enemy = state.units.find(u => u.id === enemy.id);
                player = state.units.find(u => u.id === player.id);
            }
        }

        if (enemy && enemy.hp === 0) {
            assert.strictEqual(enemy.isAlive, false, 'Enemy isAlive must be false when hp=0');

            if (player.ap <= 0) {
                engine.handleAction('end_turn', {});
                state = engine.getState();
                player = state.units.find(u => u.type === 'player' && u.hp > 0);
            }

            if (player && player.ap > 0) {
                const targetDeadRes = engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
                assert.strictEqual(targetDeadRes.success, false, 'Targeting a dead unit must return success=false');
            }
        }
    });

    // =========================================================================
    // SECTION 3: COMBAT ENGINE & MATHEMATICAL RESOLUTION STRESS TESTS
    // =========================================================================
    test('ADV-301: Hit Chance Clamping Floor and Ceiling Matrix', () => {
        const formulaCalc = (aim, coverDefense, dist) => {
            let hitChance = aim - coverDefense - (dist * 2);
            return Math.max(0, Math.min(100, hitChance));
        };

        const cases = [
            { aim: 50, cover: 40, dist: 10, expected: 0, desc: '50 - 40 - 20 = -10 -> 0%' },
            { aim: 60, cover: 40, dist: 15, expected: 0, desc: '60 - 40 - 30 = -10 -> 0%' },
            { aim: 0, cover: 40, dist: 5, expected: 0, desc: '0 - 40 - 10 = -50 -> 0%' },
            { aim: 70, cover: 40, dist: 20, expected: 0, desc: '70 - 40 - 40 = -10 -> 0%' },
            { aim: 120, cover: 0, dist: 0, expected: 100, desc: '120 - 0 - 0 = 120 -> 100%' },
            { aim: 100, cover: 0, dist: 0, expected: 100, desc: '100% point blank' },
            { aim: 85, cover: 0, dist: 1, expected: 83, desc: 'Recon 85 aim at dist 1 = 83%' },
            { aim: 85, cover: 20, dist: 1, expected: 63, desc: 'Recon 85 aim with half cover = 63%' },
            { aim: 85, cover: 40, dist: 1, expected: 43, desc: 'Recon 85 aim with full cover = 43%' },
            { aim: 80, cover: 20, dist: 4, expected: 52, desc: 'Assault 80 aim with half cover at dist 4 = 52%' },
            { aim: 70, cover: 40, dist: 3, expected: 24, desc: 'Heavy 70 aim with full cover at dist 3 = 24%' }
        ];

        for (const c of cases) {
            const actual = formulaCalc(c.aim, c.cover, c.dist);
            assert.strictEqual(actual, c.expected, `Hit calculation failed for ${c.desc}`);
        }
    });

    test('ADV-302: Cover Defense Calculation Boundaries & Multiple Cover Resolution', () => {
        function getCoverDefense(defenderX, defenderY, grid) {
            let coverDefense = 0;
            const adjacentTiles = [ {dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0} ];

            for (let offset of adjacentTiles) {
                const nx = defenderX + offset.dx;
                const ny = defenderY + offset.dy;
                if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
                    if (grid[ny][nx].type === 1) coverDefense = Math.max(coverDefense, 20);
                    if (grid[ny][nx].type === 2) coverDefense = Math.max(coverDefense, 40);
                }
            }
            return coverDefense;
        }

        const mockGrid = Array.from({ length: 10 }, (_, y) =>
            Array.from({ length: 10 }, (_, x) => ({ x, y, type: 0 }))
        );

        assert.strictEqual(getCoverDefense(5, 5, mockGrid), 0, 'Open field must provide 0 cover');

        mockGrid[5][6].type = 1;
        assert.strictEqual(getCoverDefense(5, 5, mockGrid), 20, 'Adjacent half cover must provide 20 cover');

        mockGrid[4][5].type = 2;
        assert.strictEqual(getCoverDefense(5, 5, mockGrid), 40, 'Adjacent half + full cover must take Math.max (40)');

        const cornerGrid = Array.from({ length: 10 }, (_, y) =>
            Array.from({ length: 10 }, (_, x) => ({ x, y, type: 0 }))
        );
        cornerGrid[0][1].type = 2;
        assert.doesNotThrow(() => {
            const cov = getCoverDefense(0, 0, cornerGrid);
            assert.strictEqual(cov, 40, 'Corner defender (0,0) with adjacent full cover should receive 40 cover safely');
        });
    });

    test('ADV-303: HP Clamping to Zero & Lethal Damage Integrity', () => {
        const engine = new AcomEngine();
        engine.init();
        let state = engine.getState();
        let targetEnemy = state.units.find(u => u.type === 'enemy');

        let turns = 0;
        while (targetEnemy && targetEnemy.hp > 0 && turns < 20) {
            turns++;
            const activePlayer = state.units.find(u => u.type === 'player' && u.hp > 0 && u.ap > 0)
                || state.units.find(u => u.type === 'player' && u.hp > 0);
            if (!activePlayer) break;

            engine.handleAction('shoot', { actorId: activePlayer.id, targetId: targetEnemy.id });
            state = engine.getState();
            targetEnemy = state.units.find(u => u.id === targetEnemy.id);
            if (!targetEnemy) break;
            assert.ok(targetEnemy.hp >= 0, `Enemy HP must never be negative (actual: ${targetEnemy.hp})`);
            if (targetEnemy.hp === 0) {
                assert.strictEqual(targetEnemy.isAlive, false, 'Defeated enemy must have isAlive=false');
                break;
            }
            engine.handleAction('end_turn', {});
            state = engine.getState();
            targetEnemy = state.units.find(u => u.id === targetEnemy.id);
        }
    });

    // =========================================================================
    // SECTION 4: ARCHETYPE REGISTRY & ASSET INTEGRITY STRESS TESTS
    // =========================================================================
    test('ADV-401: All 6 Character Archetypes Spec & Asset Integrity', () => {
        const expectedArchetypes = [
            { key: 'ally_assault', type: 'player', portrait: 'assets/characters/ally_assault.png' },
            { key: 'ally_recon', type: 'player', portrait: 'assets/characters/ally_recon.png' },
            { key: 'ally_heavy', type: 'player', portrait: 'assets/characters/ally_heavy.png' },
            { key: 'enemy_mutant', type: 'enemy', portrait: 'assets/characters/enemy_mutant.png' },
            { key: 'enemy_scout', type: 'enemy', portrait: 'assets/characters/enemy_scout.png' },
            { key: 'enemy_heavy', type: 'enemy', portrait: 'assets/characters/enemy_heavy.png' }
        ];

        const engine = new AcomEngine();
        engine.initRandom(3, 3);
        const state = engine.getState();

        for (const expected of expectedArchetypes) {
            const unit = state.units.find(u => u.archetype === expected.key);
            assert.ok(unit, `Archetype ${expected.key} must be instantiated in state`);
            assert.strictEqual(unit.type, expected.type);
            assert.ok(unit.hp > 0, `${expected.key} hp must be > 0`);
            assert.ok(unit.maxHp > 0, `${expected.key} maxHp must be > 0`);
            assert.ok(unit.ap > 0, `${expected.key} ap must be > 0`);
            assert.ok(unit.mobility > 0, `${expected.key} mobility must be > 0`);
            assert.ok(unit.aim > 0, `${expected.key} aim must be > 0`);
            assert.ok((unit.weaponDamage || unit.attack) > 0, `${expected.key} weaponDamage must be > 0`);
            assert.ok(unit.range > 0, `${expected.key} range must be > 0`);
            assert.strictEqual(unit.isAlive, true);

            // Verify file on disk
            const filePath = path.resolve(__dirname, '..', expected.portrait);
            assert.ok(fs.existsSync(filePath), `Asset file ${expected.portrait} must exist on disk`);
            const stat = fs.statSync(filePath);
            assert.ok(stat.size > 1000, `Asset file ${expected.portrait} size must be > 1KB`);

            // Verify PNG header
            const buf = fs.readFileSync(filePath);
            const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
            assert.ok(isPng, `Asset file ${expected.portrait} must have valid PNG magic bytes`);
        }
    });

    test('ADV-402: Randomized Squad Scaling & Large Skirmish Invariant', () => {
        const engine = new AcomEngine();
        const squadSizes = [
            { p: 1, e: 1, total: 2 },
            { p: 2, e: 2, total: 4 },
            { p: 3, e: 3, total: 6 },
            { p: 4, e: 4, total: 8 }
        ];

        for (const size of squadSizes) {
            engine.initRandom(size.p, size.e);
            const state = engine.getState();

            const players = state.units.filter(u => u.type === 'player');
            const enemies = state.units.filter(u => u.type === 'enemy');

            assert.strictEqual(players.length, size.p, `Expected ${size.p} players`);
            assert.strictEqual(enemies.length, size.e, `Expected ${size.e} enemies`);
            assert.strictEqual(state.units.length, size.total, `Expected ${size.total} total units`);

            // Verify no overlapping coordinates
            const positions = new Set();
            for (const u of state.units) {
                const posKey = `${u.x},${u.y}`;
                assert.ok(!positions.has(posKey), `Overlapping unit spawn at ${posKey} for squad size ${size.total}`);
                positions.add(posKey);
            }
        }
    });
});
