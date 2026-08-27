/**
 * tests/adversarial_static_challenger1.js
 * Adversarial & Empirical Challenge Harness 1 (challenger_static_1).
 * 
 * Comprehensive Stress Testing Suite against in-memory AcomEngine in game.js:
 * 1. Extreme Boundary Coordinates, Out-of-Bounds, Non-Integer (Floats), NaN, Null, Malformed Payloads.
 * 2. AP Depletion Edge Cases, Zero-AP Action Rejection, Multi-Action Sequence & Turn Lifecycle.
 * 3. Cover Defense Calculations at All Angles (N/S/E/W/Diagonals), Multi-Cover Resolution & Distance Attenuation.
 * 4. Friendly Fire Guards, Self-Targeting Rejection, Dead Unit Targeting Rejection, Non-Existent Entities.
 * 5. Autonomous Enemy AI Navigation Obstacles, Trapped Units, Extreme Geometry & Zero-Survivor Resilience.
 * 6. 10,000-Iteration Invariant-Preserving Randomized Fuzzing Harness with Strict Per-Step Verification.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { AcomEngine, createUnit, ARCHETYPES, calculateHitChance } = require('../game.js');

const REPORT_OUTPUT_PATH = path.resolve(__dirname, '../.agents/reports/challenger_static_1_report.json');

// Ensure reports directory exists
const reportsDir = path.dirname(REPORT_OUTPUT_PATH);
if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
}

const testResults = {
    suite: 'Adversarial & Empirical Challenge Harness 1 (challenger_static_1)',
    timestamp: new Date().toISOString(),
    testsPassed: 0,
    testsFailed: 0,
    categories: {},
    fuzzStats: {},
    vulnerabilities: [],
    failures: []
};

function runTest(category, name, fn) {
    if (!testResults.categories[category]) {
        testResults.categories[category] = { passed: 0, failed: 0, tests: [] };
    }
    try {
        fn();
        testResults.testsPassed++;
        testResults.categories[category].passed++;
        testResults.categories[category].tests.push({ name, status: 'PASS' });
        console.log(`  ✓ [${category}] ${name}`);
    } catch (err) {
        testResults.testsFailed++;
        testResults.categories[category].failed++;
        testResults.categories[category].tests.push({ name, status: 'FAIL', error: err.message });
        testResults.failures.push({ category, name, error: err.message, stack: err.stack });
        console.error(`  ✗ [${category}] ${name}: ${err.message}`);
    }
}

console.log('================================================================');
console.log('  CHALLENGER 1: ADVERSARIAL & EMPIRICAL STRESS TEST HARNESS     ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// CATEGORY 1: Extreme Boundary Coordinates, Out-of-Bounds & Type Coercion
// -----------------------------------------------------------------------------
console.log('▶ Running Category 1: Extreme Boundaries & Corrupted Inputs...');

runTest('Boundaries & Types', 'Valid Boundary Movement (Corners & Free Edges)', () => {
    const engine = new AcomEngine();
    engine.init();
    // Clear grid and relocate other units so (0,0) and (0,2) are completely clear
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            engine.gameState.grid[y][x].type = engine.TILE_EMPTY;
        }
    }
    // Remove other units for clean isolated spatial test
    const player = engine.gameState.units.find(u => u.type === 'player');
    engine.gameState.units = [player];
    player.x = 0;
    player.y = 0;
    player.ap = 2;
    player.mobility = 4;

    // Move along edge (0, 0) -> (0, 2)
    let res = engine.handleAction('move', { actorId: player.id, x: 0, y: 2 });
    assert.strictEqual(res.success, true, 'Moving along valid boundary edge (0,2) must succeed');
    assert.strictEqual(player.x, 0);
    assert.strictEqual(player.y, 2);
    assert.strictEqual(player.ap, 1);

    // Move back to corner (0, 2) -> (0, 0)
    res = engine.handleAction('move', { actorId: player.id, x: 0, y: 0 });
    assert.strictEqual(res.success, true, 'Moving back to corner (0,0) must succeed');
    assert.strictEqual(player.x, 0);
    assert.strictEqual(player.y, 0);
    assert.strictEqual(player.ap, 0);
});

runTest('Boundaries & Types', 'Out-of-Bounds Movement Rejection (Negative & >9)', () => {
    const engine = new AcomEngine();
    engine.init();
    const player = engine.gameState.units.find(u => u.type === 'player');
    player.x = 0;
    player.y = 0;
    player.ap = 2;

    const badCoords = [
        { x: -1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: -1 },
        { x: 10, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 },
        { x: -999, y: 5 }, { x: 5, y: 999 }, { x: 100, y: 100 },
        { x: -Infinity, y: 0 }, { x: 0, y: Infinity }
    ];

    for (const c of badCoords) {
        const res = engine.handleAction('move', { actorId: player.id, x: c.x, y: c.y });
        assert.strictEqual(res.success, false, `Move to (${c.x}, ${c.y}) must be rejected`);
        assert.strictEqual(res.status, 400);
        assert.strictEqual(player.x, 0, 'Player coordinate x must not mutate on rejected move');
        assert.strictEqual(player.y, 0, 'Player coordinate y must not mutate on rejected move');
        assert.strictEqual(player.ap, 2, 'Player AP must not decrement on rejected move');
    }
});

runTest('Boundaries & Types', 'Non-Integer Float Coordinates Rejection (e.g. 2.5, 2.99)', () => {
    const engine = new AcomEngine();
    engine.init();
    const player = engine.gameState.units.find(u => u.type === 'player');
    player.x = 2;
    player.y = 2;
    player.ap = 2;

    const floatCoords = [
        { x: 2.5, y: 2 },
        { x: 2, y: 2.99 },
        { x: 1.1, y: 1.9 }
    ];

    for (const c of floatCoords) {
        const res = engine.handleAction('move', { actorId: player.id, x: c.x, y: c.y });
        assert.strictEqual(res.success, false, `Float coordinate move to (${c.x}, ${c.y}) must return success=false and be rejected`);
        assert.strictEqual(player.x, 2, 'Player x must not accept non-integer coordinate');
        assert.strictEqual(player.y, 2, 'Player y must not accept non-integer coordinate');
    }
});

runTest('Boundaries & Types', 'NaN, Null, Undefined, String & Object Coordinates', () => {
    const engine = new AcomEngine();
    engine.init();
    const player = engine.gameState.units.find(u => u.type === 'player');
    player.x = 2;
    player.y = 2;
    player.ap = 2;

    const corruptedCoords = [
        { x: NaN, y: 2 }, { x: 2, y: NaN }, { x: NaN, y: NaN },
        { x: null, y: 2 }, { x: 2, y: null }, { x: null, y: null },
        { x: undefined, y: 2 }, { x: 2, y: undefined },
        { x: '2', y: '3' }, { x: 'abc', y: 2 },
        { x: {}, y: [] }, { x: true, y: false }
    ];

    for (const c of corruptedCoords) {
        const res = engine.handleAction('move', { actorId: player.id, x: c.x, y: c.y });
        assert.strictEqual(res.success, false, `Move with x=${c.x}, y=${c.y} must return success=false`);
        assert.strictEqual(res.status, 400);
        assert.strictEqual(player.x, 2);
        assert.strictEqual(player.y, 2);
        assert.strictEqual(player.ap, 2);
    }
});

runTest('Boundaries & Types', 'Malformed Actions and Null/Empty Payloads Resiliency', () => {
    const engine = new AcomEngine();
    engine.init();

    // Null / undefined / invalid action strings
    const invalidActions = [null, undefined, '', 'teleport', 'fly', 'hack', 123, {}, []];
    for (const act of invalidActions) {
        const res = engine.handleAction(act, {});
        assert.strictEqual(res.success, false, `Invalid action "${act}" must fail`);
        assert.strictEqual(res.status, 400);
    }

    // Null payload must return { success: false, status: 400 } without throwing unhandled TypeError
    const resMoveNull = engine.handleAction('move', null);
    assert.strictEqual(resMoveNull.success, false, 'handleAction("move", null) must return success=false');
    assert.strictEqual(resMoveNull.status, 400);

    const resShootNull = engine.handleAction('shoot', null);
    assert.strictEqual(resShootNull.success, false, 'handleAction("shoot", null) must return success=false');
    assert.strictEqual(resShootNull.status, 400);
});

// -----------------------------------------------------------------------------
// CATEGORY 2: AP Depletion, Multi-Action Sequences & Turn Lifecycle
// -----------------------------------------------------------------------------
console.log('\n▶ Running Category 2: AP Depletion & Turn Lifecycle...');

runTest('AP & Turn Lifecycle', 'Strict AP Consumption on Move (1 AP each)', () => {
    const engine = new AcomEngine();
    engine.init();
    // Clear obstacles
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            engine.gameState.grid[y][x].type = engine.TILE_EMPTY;
        }
    }
    const player = engine.gameState.units.find(u => u.type === 'player');
    // Isolate unit
    engine.gameState.units = [player];
    player.x = 1;
    player.y = 1;
    player.ap = 2;

    // First Move: AP 2 -> 1
    let res = engine.handleAction('move', { actorId: player.id, x: 2, y: 1 });
    assert.strictEqual(res.success, true);
    assert.strictEqual(player.ap, 1);
    assert.strictEqual(player.x, 2);

    // Second Move: AP 1 -> 0
    res = engine.handleAction('move', { actorId: player.id, x: 3, y: 1 });
    assert.strictEqual(res.success, true);
    assert.strictEqual(player.ap, 0);
    assert.strictEqual(player.x, 3);

    // Third Move with 0 AP: Must fail
    res = engine.handleAction('move', { actorId: player.id, x: 4, y: 1 });
    assert.strictEqual(res.success, false, 'Movement with 0 AP must be rejected');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(player.ap, 0);
    assert.strictEqual(player.x, 3, 'Position must remain unchanged');
});

runTest('AP & Turn Lifecycle', 'Strict AP Consumption on Shoot (Full AP Depletion)', () => {
    const engine = new AcomEngine();
    engine.init();
    const player = engine.gameState.units.find(u => u.type === 'player');
    const enemy = engine.gameState.units.find(u => u.type === 'enemy');
    player.ap = 2;

    // Shoot consumes ALL remaining AP
    const res = engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
    assert.strictEqual(res.success, true);
    assert.strictEqual(player.ap, 0, 'Shooting must deplete AP to 0');

    // Attempt second shoot with 0 AP
    const res2 = engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
    assert.strictEqual(res2.success, false, 'Shooting with 0 AP must be rejected');
    assert.strictEqual(res2.status, 400);

    // Attempt move with 0 AP
    const res3 = engine.handleAction('move', { actorId: player.id, x: player.x + 1, y: player.y });
    assert.strictEqual(res3.success, false, 'Moving after shooting (0 AP) must be rejected');
});

runTest('AP & Turn Lifecycle', 'Move then Shoot Sequence (AP 2 -> 1 -> 0)', () => {
    const engine = new AcomEngine();
    engine.init();
    // Clear path
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            engine.gameState.grid[y][x].type = engine.TILE_EMPTY;
        }
    }
    const player = engine.gameState.units.find(u => u.type === 'player');
    const enemy = engine.gameState.units.find(u => u.type === 'enemy');
    player.x = 2;
    player.y = 2;
    player.ap = 2;

    // Move: 2 -> 1 AP
    let res = engine.handleAction('move', { actorId: player.id, x: 3, y: 2 });
    assert.strictEqual(res.success, true);
    assert.strictEqual(player.ap, 1);

    // Shoot with 1 AP: 1 -> 0 AP
    res = engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
    assert.strictEqual(res.success, true);
    assert.strictEqual(player.ap, 0);

    // Attempt subsequent action: Must fail
    res = engine.handleAction('move', { actorId: player.id, x: 4, y: 2 });
    assert.strictEqual(res.success, false);
});

runTest('AP & Turn Lifecycle', 'End Turn AP Restoration and Turn Transition', () => {
    const engine = new AcomEngine();
    engine.init();
    const players = engine.gameState.units.filter(u => u.type === 'player');
    players.forEach(p => p.ap = 0);

    // End turn triggers enemy AI turn and resets player AP at start of new turn
    const res = engine.handleAction('end_turn', {});
    assert.strictEqual(res.success, true);

    const state = engine.getState();
    const livingPlayers = state.units.filter(u => u.type === 'player' && u.hp > 0);
    if (livingPlayers.length > 0) {
        assert.strictEqual(state.currentTurn, 'player');
        for (const p of livingPlayers) {
            assert.strictEqual(p.ap, p.maxAp, `Living player ${p.id} must have max AP restored (${p.maxAp})`);
        }
    }
});

// -----------------------------------------------------------------------------
// CATEGORY 3: Cover Defense Geometry & Calculations
// -----------------------------------------------------------------------------
console.log('\n▶ Running Category 3: Cover Defense Geometry & Ballistic Math...');

runTest('Cover Defense', 'Cover Defense Orthogonal Directions (N, S, E, W)', () => {
    const engine = new AcomEngine();
    engine.init();
    
    // Clear entire grid
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            engine.gameState.grid[y][x].type = engine.TILE_EMPTY;
        }
    }

    const defender = { x: 5, y: 5, hp: 10 };

    // 1. Open terrain (no cover)
    assert.strictEqual(engine.calculateCoverDefense(defender), 0, 'Open terrain cover must be 0');

    // 2. North Half Cover (x=5, y=4) -> grid[4][5]
    engine.gameState.grid[4][5].type = engine.TILE_HALF_COVER;
    assert.strictEqual(engine.calculateCoverDefense(defender), 20, 'North half cover must yield 20 defense');
    engine.gameState.grid[4][5].type = engine.TILE_EMPTY;

    // 3. South Full Cover (x=5, y=6) -> grid[6][5]
    engine.gameState.grid[6][5].type = engine.TILE_FULL_COVER;
    assert.strictEqual(engine.calculateCoverDefense(defender), 40, 'South full cover must yield 40 defense');
    engine.gameState.grid[6][5].type = engine.TILE_EMPTY;

    // 4. West Half Cover (x=4, y=5) -> grid[5][4]
    engine.gameState.grid[5][4].type = engine.TILE_HALF_COVER;
    assert.strictEqual(engine.calculateCoverDefense(defender), 20, 'West half cover must yield 20 defense');
    engine.gameState.grid[5][4].type = engine.TILE_EMPTY;

    // 5. East Full Cover (x=6, y=5) -> grid[5][6]
    engine.gameState.grid[5][6].type = engine.TILE_FULL_COVER;
    assert.strictEqual(engine.calculateCoverDefense(defender), 40, 'East full cover must yield 40 defense');
    engine.gameState.grid[5][6].type = engine.TILE_EMPTY;
});

runTest('Cover Defense', 'Multi-Cover Maximum Resolution (Half + Full = 40)', () => {
    const engine = new AcomEngine();
    engine.init();
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            engine.gameState.grid[y][x].type = engine.TILE_EMPTY;
        }
    }

    const defender = { x: 5, y: 5 };
    engine.gameState.grid[4][5].type = engine.TILE_HALF_COVER; // North: 20
    engine.gameState.grid[6][5].type = engine.TILE_FULL_COVER; // South: 40
    engine.gameState.grid[5][4].type = engine.TILE_HALF_COVER; // West: 20

    // Should take the maximum cover value (40)
    assert.strictEqual(engine.calculateCoverDefense(defender), 40, 'Combined Half and Full cover must resolve to 40');
});

runTest('Cover Defense', 'Diagonal-Only Cover yields 0 Defense', () => {
    const engine = new AcomEngine();
    engine.init();
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            engine.gameState.grid[y][x].type = engine.TILE_EMPTY;
        }
    }

    const defender = { x: 5, y: 5 };
    // Place Full Cover on all 4 diagonals: NW (4,4), NE (6,4), SW (4,6), SE (6,6)
    engine.gameState.grid[4][4].type = engine.TILE_FULL_COVER;
    engine.gameState.grid[4][6].type = engine.TILE_FULL_COVER;
    engine.gameState.grid[6][4].type = engine.TILE_FULL_COVER;
    engine.gameState.grid[6][6].type = engine.TILE_FULL_COVER;

    // Diagonal cover should NOT provide orthogonal cover defense
    assert.strictEqual(engine.calculateCoverDefense(defender), 0, 'Diagonal-only cover must yield 0 cover defense');
});

runTest('Cover Defense', 'Boundary Edge Defense Calculations (Corner / Edge Units)', () => {
    const engine = new AcomEngine();
    engine.init();
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            engine.gameState.grid[y][x].type = engine.TILE_EMPTY;
        }
    }

    // Corner unit at (0, 0): adjacent are East (1, 0) -> grid[0][1] and South (0, 1) -> grid[1][0]
    const cornerDefender = { x: 0, y: 0 };
    engine.gameState.grid[0][1].type = engine.TILE_FULL_COVER;
    assert.strictEqual(engine.calculateCoverDefense(cornerDefender), 40, 'Corner unit adjacent to Full Cover must get 40 defense without index error');

    // Corner unit at (9, 9): adjacent are West (8, 9) -> grid[9][8] and North (9, 8) -> grid[8][9]
    const cornerDefender2 = { x: 9, y: 9 };
    engine.gameState.grid[9][8].type = engine.TILE_HALF_COVER;
    assert.strictEqual(engine.calculateCoverDefense(cornerDefender2), 20, 'Bottom-right corner unit must get 20 defense');
});

runTest('Cover Defense', 'Ballistic Hit Chance Clamping [0, 100] across All Distances & Archetypes', () => {
    const engine = new AcomEngine();
    engine.init();
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            engine.gameState.grid[y][x].type = engine.TILE_EMPTY;
        }
    }

    // 1. Extreme Close Range (Aim 85, Dist 0, Cover 0) -> 85%
    let hit = engine.calculateHitChance({ aim: 85, x: 0, y: 0 }, { x: 0, y: 0 });
    assert.strictEqual(hit, 85);

    // 2. Defender at (0, 1), Full Cover at South (0, 2) -> grid[2][0]
    // Attacker at (0, 0) -> Dist = 1
    // Aim 80, Dist 1 (-2), Cover 40 (-40) -> 80 - 40 - 2 = 38%
    engine.gameState.grid[2][0].type = engine.TILE_FULL_COVER;
    hit = engine.calculateHitChance({ aim: 80, x: 0, y: 0 }, { x: 0, y: 1 });
    assert.strictEqual(hit, 38, 'Aim 80 with Full Cover (40) and Dist 1 (-2) must equal 38%');
    engine.gameState.grid[2][0].type = engine.TILE_EMPTY;

    // 3. Extreme Distance & Cover (Aim 60, Dist 18, Cover 40) -> 60 - 40 - 36 = -16 -> Clamped to 0%
    engine.gameState.grid[8][9].type = engine.TILE_FULL_COVER;
    hit = engine.calculateHitChance({ aim: 60, x: 0, y: 0 }, { x: 9, y: 9 });
    assert.strictEqual(hit, 0, 'Negative hit chance must clamp to 0');

    // 4. Over 100% Aim (Aim 150, Dist 0, Cover 0) -> Clamped to 100%
    hit = engine.calculateHitChance({ aim: 150, x: 0, y: 0 }, { x: 0, y: 0 });
    assert.strictEqual(hit, 100, 'Over 100 aim must clamp to 100');

    // 5. Direct Overloaded Function: calculateHitChance(aim, coverDefense, dist)
    assert.strictEqual(calculateHitChance(80, 20, 5), 50); // 80 - 20 - 10 = 50
    assert.strictEqual(calculateHitChance(100, 0, 0), 100);
    assert.strictEqual(calculateHitChance(50, 40, 10), 0); // 50 - 40 - 20 = -10 -> 0
});

// -----------------------------------------------------------------------------
// CATEGORY 4: Friendly Fire, Dead Target & Self-Targeting Guards
// -----------------------------------------------------------------------------
console.log('\n▶ Running Category 4: Friendly Fire & Target Guards...');

runTest('Target Guards', 'Friendly Fire Rejection (Ally cannot target Ally)', () => {
    const engine = new AcomEngine();
    engine.init();
    const players = engine.gameState.units.filter(u => u.type === 'player');
    assert.ok(players.length >= 2, 'Need at least 2 player units');

    const attacker = players[0];
    const victim = players[1];
    const initialHp = victim.hp;

    const res = engine.handleAction('shoot', { actorId: attacker.id, targetId: victim.id });
    assert.strictEqual(res.success, false, 'Shooting friendly unit must be rejected');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(victim.hp, initialHp, 'Friendly victim must take 0 damage');
    assert.strictEqual(attacker.ap, 2, 'Attacker AP must not be deducted on rejected friendly shot');
});

runTest('Target Guards', 'Self-Targeting Rejection (Unit cannot shoot itself)', () => {
    const engine = new AcomEngine();
    engine.init();
    const player = engine.gameState.units.find(u => u.type === 'player');
    const initialHp = player.hp;

    const res = engine.handleAction('shoot', { actorId: player.id, targetId: player.id });
    assert.strictEqual(res.success, false, 'Self-shooting must be rejected');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(player.hp, initialHp);
    assert.strictEqual(player.ap, 2);
});

runTest('Target Guards', 'Dead Target Rejection (Cannot shoot dead enemy)', () => {
    const engine = new AcomEngine();
    engine.init();
    const player = engine.gameState.units.find(u => u.type === 'player');
    const enemy = engine.gameState.units.find(u => u.type === 'enemy');
    
    // Kill enemy
    enemy.hp = 0;
    enemy.isAlive = false;

    const res = engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
    assert.strictEqual(res.success, false, 'Shooting dead enemy must be rejected');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(player.ap, 2);
});

runTest('Target Guards', 'Dead Actor Action Rejection (Dead player cannot move or shoot)', () => {
    const engine = new AcomEngine();
    engine.init();
    const player = engine.gameState.units.find(u => u.type === 'player');
    const enemy = engine.gameState.units.find(u => u.type === 'enemy');

    player.hp = 0;
    player.isAlive = false;

    let res = engine.handleAction('move', { actorId: player.id, x: player.x + 1, y: player.y });
    assert.strictEqual(res.success, false, 'Dead player cannot move');

    res = engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
    assert.strictEqual(res.success, false, 'Dead player cannot shoot');
});

// -----------------------------------------------------------------------------
// CATEGORY 5: Autonomous Enemy AI Edge Cases & Navigation
// -----------------------------------------------------------------------------
console.log('\n▶ Running Category 5: Autonomous Enemy AI Edge Cases & Navigation...');

runTest('Enemy AI', 'AI Navigation with Direct X-Obstruction (Bypasses via Y)', () => {
    const engine = new AcomEngine();
    engine.init();
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            engine.gameState.grid[y][x].type = engine.TILE_EMPTY;
        }
    }

    const enemy = engine.gameState.units.find(u => u.type === 'enemy');
    const player = engine.gameState.units.find(u => u.type === 'player');
    enemy.x = 5;
    enemy.y = 5;
    player.x = 2;
    player.y = 3;

    // Block X-direction step (4, 5) with Full Cover -> grid[5][4]
    engine.gameState.grid[5][4].type = engine.TILE_FULL_COVER;

    // Execute enemy turn
    engine.gameState.currentTurn = 'enemy';
    engine.processEnemyTurn();

    // Enemy should have navigated or stayed on valid empty tile, NOT stepped on (4, 5)
    assert.ok(enemy.x !== 4 || enemy.y !== 5, 'Enemy must not step onto Full Cover obstacle');
    const tileOccupied = engine.gameState.grid[enemy.y][enemy.x];
    assert.strictEqual(tileOccupied.type, engine.TILE_EMPTY, 'Enemy must end turn on empty tile');
});

runTest('Enemy AI', 'Trapped / Fully Blocked Units AI Behavior (No Crash / No Illegal Move)', () => {
    const engine = new AcomEngine();
    engine.init();
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            engine.gameState.grid[y][x].type = engine.TILE_EMPTY;
        }
    }

    const enemy = engine.gameState.units.find(u => u.type === 'enemy');
    const player = engine.gameState.units.find(u => u.type === 'player');
    enemy.x = 5;
    enemy.y = 5;
    player.x = 1;
    player.y = 1;

    // Completely surround enemy with full cover: North(5,4), South(5,6), West(4,5), East(6,5)
    engine.gameState.grid[4][5].type = engine.TILE_FULL_COVER;
    engine.gameState.grid[6][5].type = engine.TILE_FULL_COVER;
    engine.gameState.grid[5][4].type = engine.TILE_FULL_COVER;
    engine.gameState.grid[5][6].type = engine.TILE_FULL_COVER;

    engine.gameState.currentTurn = 'enemy';
    engine.processEnemyTurn();

    // Enemy should remain at (5, 5) without crashing
    assert.strictEqual(enemy.x, 5, 'Surrounded enemy x must remain 5');
    assert.strictEqual(enemy.y, 5, 'Surrounded enemy y must remain 5');
});

runTest('Enemy AI', 'Zero Living Players / Zero Living Enemies Graceful Handling', () => {
    const engine = new AcomEngine();
    engine.init();

    // All players dead
    engine.gameState.units.filter(u => u.type === 'player').forEach(u => {
        u.hp = 0;
        u.isAlive = false;
    });

    // Calling processEnemyTurn should not throw
    assert.doesNotThrow(() => {
        engine.processEnemyTurn();
    }, 'processEnemyTurn with all players dead must not throw');

    // All enemies dead
    engine.init();
    engine.gameState.units.filter(u => u.type === 'enemy').forEach(u => {
        u.hp = 0;
        u.isAlive = false;
    });

    assert.doesNotThrow(() => {
        engine.processEnemyTurn();
    }, 'processEnemyTurn with all enemies dead must not throw');
});

// -----------------------------------------------------------------------------
// CATEGORY 6: 10,000-Iteration Invariant-Preserving Randomized Fuzzing Harness
// -----------------------------------------------------------------------------
console.log('\n▶ Running Category 6: 10,000-Iteration Randomized Fuzzing Harness...');

runTest('Fuzzing & Invariants', '10,000 Action Invariant Stress Harness', () => {
    const FUZZ_ACTIONS = 10000;
    const engine = new AcomEngine();
    engine.init();

    let moveCount = 0;
    let shootCount = 0;
    let endTurnCount = 0;
    let invalidActionCount = 0;
    let matchesCompleted = 0;

    const startTime = Date.now();

    for (let i = 0; i < FUZZ_ACTIONS; i++) {
        let state = engine.getState();
        const livingPlayers = state.units.filter(u => u.type === 'player' && u.hp > 0);
        const livingEnemies = state.units.filter(u => u.type === 'enemy' && u.hp > 0);

        if (livingPlayers.length === 0 || livingEnemies.length === 0) {
            matchesCompleted++;
            const pCount = Math.floor(Math.random() * 3) + 1; // 1 to 3
            const eCount = Math.floor(Math.random() * 3) + 1;
            engine.initRandom(pCount, eCount);
            state = engine.getState();
        }

        const currentPlayers = state.units.filter(u => u.type === 'player' && u.hp > 0);
        const currentEnemies = state.units.filter(u => u.type === 'enemy' && u.hp > 0);

        const actor = currentPlayers[Math.floor(Math.random() * currentPlayers.length)] || null;
        const target = currentEnemies[Math.floor(Math.random() * currentEnemies.length)] || null;

        const actionRoll = Math.random();

        if (actionRoll < 0.35 && actor) {
            // Random Move (Valid or Out-of-bounds or Obstacle)
            moveCount++;
            const dx = Math.floor(Math.random() * 11) - 5;
            const dy = Math.floor(Math.random() * 11) - 5;
            const targetX = actor.x + dx;
            const targetY = actor.y + dy;

            const res = engine.handleAction('move', { actorId: actor.id, x: targetX, y: targetY });
            assert.strictEqual(typeof res.success, 'boolean', 'Move result success must be boolean');
        } else if (actionRoll < 0.65 && actor && target) {
            // Random Shoot
            shootCount++;
            const res = engine.handleAction('shoot', { actorId: actor.id, targetId: target.id });
            assert.strictEqual(typeof res.success, 'boolean', 'Shoot result success must be boolean');
        } else if (actionRoll < 0.85) {
            // End Turn
            endTurnCount++;
            const res = engine.handleAction('end_turn', {});
            assert.strictEqual(typeof res.success, 'boolean', 'End turn result success must be boolean');
        } else {
            // Adversarial & Malformed Actions
            invalidActionCount++;
            const malformedRoll = Math.random();
            if (malformedRoll < 0.2) {
                // Shoot Friendly
                if (currentPlayers.length > 1) {
                    const allyTarget = currentPlayers.find(p => p.id !== actor.id) || actor;
                    const res = engine.handleAction('shoot', { actorId: actor.id, targetId: allyTarget.id });
                    assert.strictEqual(res.success, false, 'Friendly shoot must fail in fuzzer');
                }
            } else if (malformedRoll < 0.4) {
                // Non-existent Actor
                const res = engine.handleAction('move', { actorId: 'phantom_id_999', x: 5, y: 5 });
                assert.strictEqual(res.success, false, 'Phantom actor move must fail');
            } else if (malformedRoll < 0.6) {
                // Extreme Coordinates
                const res = engine.handleAction('move', { actorId: actor ? actor.id : 'none', x: 99999, y: -99999 });
                assert.strictEqual(res.success, false, 'Extreme coords move must fail');
            } else if (malformedRoll < 0.8) {
                // Corrupted NaN/Object payloads
                const res = engine.handleAction('move', { actorId: actor ? actor.id : 'none', x: NaN, y: {} });
                assert.strictEqual(res.success, false, 'Corrupted payload must fail');
            } else {
                // Garbage action name
                const res = engine.handleAction('__invalid_action__', {});
                assert.strictEqual(res.success, false, 'Garbage action name must fail');
            }
        }

        // =====================================================================
        // STRICT PER-ITERATION INVARIANT VALIDATION
        // =====================================================================
        const postState = engine.getState();

        // 1. Grid structure integrity
        assert.strictEqual(postState.grid.length, 10, `Grid must have 10 rows (iter ${i})`);
        for (let y = 0; y < 10; y++) {
            assert.strictEqual(postState.grid[y].length, 10, `Grid row ${y} must have 10 columns (iter ${i})`);
            for (let x = 0; x < 10; x++) {
                const t = postState.grid[y][x].type;
                assert.ok(t === 0 || t === 1 || t === 2, `Tile (${x}, ${y}) has invalid type ${t} (iter ${i})`);
            }
        }

        // 2. Unit bounds, coordinates, and health invariants
        const occupiedCoords = new Map();
        for (const u of postState.units) {
            // HP Invariants
            assert.ok(u.hp >= 0, `Unit ${u.id} has negative HP: ${u.hp} (iter ${i})`);
            assert.ok(u.hp <= u.maxHp, `Unit ${u.id} HP (${u.hp}) > maxHp (${u.maxHp}) (iter ${i})`);
            if (u.hp === 0) {
                assert.strictEqual(u.isAlive, false, `Unit ${u.id} has 0 HP but isAlive is true (iter ${i})`);
            }

            // AP Invariants
            assert.ok(u.ap >= 0, `Unit ${u.id} has negative AP: ${u.ap} (iter ${i})`);
            assert.ok(u.ap <= u.maxAp, `Unit ${u.id} AP (${u.ap}) > maxAp (${u.maxAp}) (iter ${i})`);

            // Spatial Invariants (Living units only)
            if (u.hp > 0) {
                assert.ok(u.x >= 0 && u.x < 10, `Unit ${u.id} x out of bounds: ${u.x} (iter ${i})`);
                assert.ok(u.y >= 0 && u.y < 10, `Unit ${u.id} y out of bounds: ${u.y} (iter ${i})`);

                // No living unit on cover obstacle
                const tile = postState.grid[u.y][u.x];
                assert.strictEqual(tile.type, 0, `Living unit ${u.id} is standing on cover tile (${u.x}, ${u.y}) type ${tile.type} (iter ${i})`);

                // No two living units share coordinates
                const key = `${u.x},${u.y}`;
                assert.ok(!occupiedCoords.has(key), `Coordinate collision at (${key}) between ${occupiedCoords.get(key)} and ${u.id} (iter ${i})`);
                occupiedCoords.set(key, u.id);
            }
        }

        // 3. Log buffer clamp
        assert.ok(postState.logs.length <= 20, `Log buffer exceeded 20 entries: ${postState.logs.length} (iter ${i})`);
    }

    const elapsed = Date.now() - startTime;
    testResults.fuzzStats = {
        totalActions: FUZZ_ACTIONS,
        elapsedMs: elapsed,
        opsPerSec: Math.round((FUZZ_ACTIONS / (elapsed / 1000))),
        moveActions: moveCount,
        shootActions: shootCount,
        endTurnActions: endTurnCount,
        invalidActions: invalidActionCount,
        matchesCompleted
    };

    console.log(`    Fuzzing Stats: ${FUZZ_ACTIONS} actions in ${elapsed}ms (~${testResults.fuzzStats.opsPerSec} ops/sec)`);
    console.log(`    [Moves: ${moveCount}, Shoots: ${shootCount}, EndTurns: ${endTurnCount}, Invalids: ${invalidActionCount}, Skirmishes: ${matchesCompleted}]`);
});

// -----------------------------------------------------------------------------
// SUMMARY & REPORT OUTPUT
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  FINAL VERDICT: ${testResults.testsFailed === 0 ? 'APPROVE (ALL PASS)' : 'REQUEST_CHANGES (FAILURES DETECTED)'}`);
console.log(`  Tests Passed: ${testResults.testsPassed} / ${testResults.testsPassed + testResults.testsFailed}`);
console.log('================================================================\n');

testResults.verdict = testResults.testsFailed === 0 ? 'APPROVE' : 'REQUEST_CHANGES';
fs.writeFileSync(REPORT_OUTPUT_PATH, JSON.stringify(testResults, null, 2), 'utf-8');
console.log(`Detailed JSON report written to: ${REPORT_OUTPUT_PATH}`);

if (testResults.testsFailed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
