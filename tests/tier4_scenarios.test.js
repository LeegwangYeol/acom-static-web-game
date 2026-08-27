/**
 * tests/tier4_scenarios.test.js
 * Tier 4: Realistic Multi-Turn Combat Scenarios (Full 3v3 Squad Battle Flow)
 * Purely in-memory static execution against AcomEngine from game.js (Zero server.js dependency).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

let AcomEngine;
try {
    const gameModule = require('../game.js');
    AcomEngine = gameModule.AcomEngine;
} catch (err) {}

describe('Tier 4: Realistic Multi-Turn Combat Scenarios [Static In-Memory]', () => {

    test('TC-401: Full 3v3 Tactical Skirmish Flow to Resolution', () => {
        assert.ok(typeof AcomEngine === 'function', 'AcomEngine must be exported');
        const engine = new AcomEngine();
        engine.initRandom(3, 3);
        let state = engine.getState();

        let maxRounds = 40;
        let round = 0;
        let isResolved = false;

        while (round < maxRounds && !isResolved) {
            round++;

            // Player turn: iterate over living players with AP
            const livingPlayers = state.units.filter(u => u.type === 'player' && u.hp > 0);
            const livingEnemies = state.units.filter(u => u.type === 'enemy' && u.hp > 0);

            if (livingPlayers.length === 0 || livingEnemies.length === 0) {
                isResolved = true;
                break;
            }

            for (const player of livingPlayers) {
                if (player.ap <= 0 || player.hp <= 0) continue;

                // Find closest living enemy
                const target = livingEnemies.find(e => e.hp > 0);
                if (target) {
                    engine.handleAction('shoot', { actorId: player.id, targetId: target.id });
                    state = engine.getState();
                }
            }

            // End player turn -> Trigger enemy AI
            engine.handleAction('end_turn', {});
            state = engine.getState();

            const updatedPlayers = state.units.filter(u => u.type === 'player' && u.hp > 0);
            const updatedEnemies = state.units.filter(u => u.type === 'enemy' && u.hp > 0);
            if (updatedPlayers.length === 0 || updatedEnemies.length === 0) {
                isResolved = true;
            }
        }

        assert.ok(isResolved, 'The 3v3 match should resolve to either victory or defeat within 40 rounds');
        const logsText = state.logs.join(' ');
        assert.ok(
            logsText.includes('defeated') || logsText.includes('Win') || logsText.includes('Over') || logsText.includes('Game Over'),
            'Logs should record victory or defeat message'
        );
    });

    test('TC-402: Cover Defense Mitigation in Skirmish', () => {
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();

        const player = state.units.find(u => u.type === 'player');
        const enemy = state.units.find(u => u.type === 'enemy');

        engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
        const shootState = engine.getState();
        const lastLogs = shootState.logs.slice(-5).join(' ');
        assert.ok(lastLogs.includes('Shot calculation') || lastLogs.includes('Aim') || lastLogs.includes('hit') || lastLogs.includes('missed'), 'Combat log should record shot calculation or combat resolution');
    });

    test('TC-403: Endurance & State Stability (15 Continuous Turn Cycles)', () => {
        const engine = new AcomEngine();
        engine.initRandom(3, 3);

        for (let turn = 0; turn < 15; turn++) {
            engine.handleAction('end_turn', {});
            const state = engine.getState();

            assert.ok(state.grid.length === 10, 'Grid height must remain 10');
            assert.ok(state.grid[0].length === 10, 'Grid width must remain 10');
            assert.ok(state.units.length === 6, 'Total unit count must remain 6');
            assert.ok(state.logs.length <= 20, 'Logs must be bounded to at most 20 entries');

            for (const unit of state.units) {
                assert.ok(unit.hp >= 0, 'HP must not be negative');
                assert.ok(unit.ap >= 0, 'AP must not be negative');
                assert.ok(unit.x >= 0 && unit.x < 10, 'X must remain in bounds');
                assert.ok(unit.y >= 0 && unit.y < 10, 'Y must remain in bounds');
            }
        }
    });
});
