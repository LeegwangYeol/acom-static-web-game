/**
 * fuzz_test.js
 * In-Memory State & Robustness Fuzzing Harness for ACOM.
 * Executes 10,000 randomized state actions against AcomEngine in-memory (Zero server.js dependency).
 */

const assert = require('assert');

let AcomEngine;
try {
    const gameModule = require('./game.js');
    AcomEngine = gameModule.AcomEngine;
} catch (err) {}

const ITERATIONS = 10000;

async function runFuzzTest() {
    console.log(`Starting Pure In-Memory Fuzz Test for ${ITERATIONS} iterations...`);
    assert.ok(typeof AcomEngine === 'function', 'AcomEngine class must be exported from game.js');

    const startTime = Date.now();
    let errors = [];
    const engine = new AcomEngine();
    engine.init();

    for (let i = 0; i < ITERATIONS; i++) {
        try {
            let state = engine.getState();
            const livingPlayers = state.units.filter(u => u.type === 'player' && u.hp > 0);
            const livingEnemies = state.units.filter(u => u.type === 'enemy' && u.hp > 0);

            if (livingPlayers.length === 0 || livingEnemies.length === 0) {
                // Skirmish over, re-initialize new match
                engine.initRandom(3, 3);
                continue;
            }

            const player = livingPlayers[0];
            const enemy = livingEnemies[0];

            if (state.currentTurn !== 'player') {
                errors.push(`Turn is stuck on ${state.currentTurn} at iteration ${i}`);
                break;
            }

            const actionRoll = Math.random();

            if (actionRoll < 0.4 && player.ap > 0) {
                // Random move
                const newX = player.x + Math.floor(Math.random() * 9) - 4;
                const newY = player.y + Math.floor(Math.random() * 9) - 4;
                
                // Exercise engine move validation with valid and invalid bounds
                const moveRes = engine.handleAction('move', { actorId: player.id, x: newX, y: newY });
                assert.strictEqual(typeof moveRes.success, 'boolean', 'handleAction(move) must return boolean success');
            } else if (actionRoll < 0.7 && player.ap > 0) {
                // Random shoot
                const shootRes = engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
                assert.strictEqual(typeof shootRes.success, 'boolean', 'handleAction(shoot) must return boolean success');
            } else if (actionRoll < 0.85) {
                // End turn
                const endRes = engine.handleAction('end_turn', {});
                assert.strictEqual(typeof endRes.success, 'boolean', 'handleAction(end_turn) must return boolean success');
            } else if (actionRoll < 0.95) {
                // Regression Test 1: Self-harm guard (must return success: false)
                const selfHarmRes = engine.handleAction('shoot', { actorId: player.id, targetId: player.id });
                if (selfHarmRes.success === true) {
                    errors.push(`Regression Failed: Self-harm allowed at iteration ${i}`);
                }
            } else {
                // Regression Test 2: Malformed payload / missing action
                const malformedRes = engine.handleAction(null, {});
                if (malformedRes.success === true) {
                    errors.push(`Regression Failed: Null action succeeded at iteration ${i}`);
                }
            }

            // Post-action sanity checks
            state = engine.getState();
            for (const u of state.units) {
                if (u.hp > u.maxHp) errors.push(`Unit ${u.id} HP (${u.hp}) exceeded maxHp (${u.maxHp})`);
                if (u.ap < 0) errors.push(`Unit ${u.id} AP (${u.ap}) is negative`);
                if (u.hp <= 0 && u.isAlive) errors.push(`Unit ${u.id} has 0 HP but isAlive is true`);
            }

        } catch (err) {
            errors.push(`Exception at iteration ${i}: ${err.message}`);
        }
    }

    const duration = Date.now() - startTime;

    if (errors.length > 0) {
        console.error(`Fuzz test found ${errors.length} issues:`);
        const uniqueErrors = [...new Set(errors)];
        uniqueErrors.slice(0, 10).forEach(e => console.error("-", e));
        process.exit(1);
    } else {
        console.log(`✓ In-Memory Fuzz test completed successfully (${ITERATIONS} iterations in ${duration}ms, ${(ITERATIONS / (duration / 1000)).toFixed(0)} ops/sec).`);
        console.log("✓ State invariants preserved: HP bounds, non-negative AP, self-harm guards, malformed input resiliency.");
    }
}

if (require.main === module) {
    runFuzzTest().catch(err => {
        console.error("Fuzz test fatal error:", err);
        process.exit(1);
    });
}

module.exports = { runFuzzTest };
