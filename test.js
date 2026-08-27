/**
 * test.js
 * Legacy Regression Verification Script.
 * Adapted for purely in-memory static execution against AcomEngine from game.js (Zero server.js dependency).
 */

const assert = require('assert');

let AcomEngine;
try {
    const gameModule = require('./game.js');
    AcomEngine = gameModule.AcomEngine;
} catch (err) {}

async function runTests() {
    console.log("Starting In-Memory Static Engine Regression Tests...");

    assert.ok(typeof AcomEngine === 'function', 'AcomEngine class must be exported from game.js');
    const engine = new AcomEngine();

    // 1. Initialize Game
    engine.init();
    let state = engine.getState();
    assert.strictEqual(state.currentTurn, 'player');
    assert.ok(state.units.length >= 2, 'Must have spawned units');
    
    let player = state.units.find(u => u.type === 'player');
    assert.strictEqual(player.ap, 2);
    
    console.log("✓ Initialization test passed.");

    // 2. Move Action (find valid adjacent empty tile)
    const validMove = [
        { x: player.x + 1, y: player.y },
        { x: player.x, y: player.y + 1 },
        { x: player.x - 1, y: player.y },
        { x: player.x, y: player.y - 1 }
    ].find(p => p.x >= 0 && p.x < 10 && p.y >= 0 && p.y < 10 && state.grid[p.y][p.x].type === 0 && !state.units.some(u => u.x === p.x && u.y === p.y && u.hp > 0));

    assert.ok(validMove, 'Must find a valid adjacent empty tile');

    const moveRes = engine.handleAction('move', { actorId: player.id, x: validMove.x, y: validMove.y });
    assert.strictEqual(moveRes.success, true, 'Move action must succeed');
    
    state = engine.getState();
    player = state.units.find(u => u.id === player.id);
    assert.strictEqual(player.x, validMove.x);
    assert.strictEqual(player.y, validMove.y);
    assert.strictEqual(player.ap, 1);
    
    console.log("✓ Move action test passed.");

    // 3. Shoot Action
    const enemy = state.units.find(u => u.type === 'enemy');
    const shootRes = engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
    assert.strictEqual(shootRes.success, true, 'Shoot action must succeed');
    
    state = engine.getState();
    player = state.units.find(u => u.id === player.id);
    assert.strictEqual(player.ap, 0, 'Shooting must deplete AP to 0');
    
    console.log("✓ Shoot action test passed.");

    // 4. End Turn Action (triggers enemy turn & refills AP)
    const endTurnRes = engine.handleAction('end_turn', {});
    assert.strictEqual(endTurnRes.success, true, 'End turn must succeed');
    
    state = engine.getState();
    if (state.units.filter(u => u.type === 'player' && u.hp > 0).length > 0) {
        assert.strictEqual(state.currentTurn, 'player');
        player = state.units.find(u => u.id === player.id);
        if (player && player.hp > 0) {
            assert.strictEqual(player.ap, player.maxAp);
        }
    }
    
    console.log("✓ End turn (Enemy AI) test passed.");
    console.log("All legacy regression tests passed cleanly in-memory!");
}

if (require.main === module) {
    runTests().catch(err => {
        console.error("Test failed:", err);
        process.exit(1);
    });
}

module.exports = { runTests };
