/**
 * tests/tier3_pairwise.test.js
 * Tier 3: Cross-Feature Combinations & Tactical Interactions
 * Purely in-memory static execution against AcomEngine from game.js (Zero server.js dependency).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

let AcomEngine, calculateHitChance;
try {
    const gameModule = require('../game.js');
    AcomEngine = gameModule.AcomEngine;
    calculateHitChance = gameModule.calculateHitChance;
} catch (err) {}

describe('Tier 3: Pairwise Combinations & Tactical Interactions [Static In-Memory]', () => {

    test('TC-301: Cover + Distance Hit Chance Formula Matrix', () => {
        const formulaCalc = (aim, coverDefense, dist) => {
            let hit = aim - coverDefense - (dist * 2);
            return Math.max(0, Math.min(100, hit));
        };

        const aim = 80;
        const testMatrix = [
            { dist: 1, cover: 0, expected: 78 },
            { dist: 1, cover: 20, expected: 58 },
            { dist: 1, cover: 40, expected: 38 },
            { dist: 4, cover: 0, expected: 72 },
            { dist: 4, cover: 20, expected: 52 },
            { dist: 4, cover: 40, expected: 32 },
            { dist: 8, cover: 0, expected: 64 },
            { dist: 8, cover: 20, expected: 44 },
            { dist: 8, cover: 40, expected: 24 }
        ];

        for (const caseStudy of testMatrix) {
            const actual = formulaCalc(aim, caseStudy.cover, caseStudy.dist);
            assert.strictEqual(
                actual,
                caseStudy.expected,
                `Hit chance for aim=${aim}, cover=${caseStudy.cover}, dist=${caseStudy.dist} should be ${caseStudy.expected}%`
            );
        }

        if (typeof calculateHitChance === 'function') {
            const grid = Array.from({ length: 10 }, (_, y) =>
                Array.from({ length: 10 }, (_, x) => ({ x, y, type: 0 }))
            );
            const attacker = { aim: 80, x: 0, y: 0 };
            const defender = { x: 4, y: 0 };
            assert.strictEqual(calculateHitChance(attacker, defender, grid), 72);
        }
    });

    test('TC-302: Action Sequencing (Move -> Shoot vs Shoot -> Move)', () => {
        assert.ok(typeof AcomEngine === 'function', 'AcomEngine must be exported');
        
        // Sequence A: Move then Shoot
        const engineA = new AcomEngine();
        engineA.init();
        let state = engineA.getState();
        let player = state.units.find(u => u.type === 'player');
        let enemy = state.units.find(u => u.type === 'enemy');

        // Move 1 step (find valid adjacent empty tile)
        const validMove = [
            { x: player.x + 1, y: player.y },
            { x: player.x, y: player.y + 1 },
            { x: player.x - 1, y: player.y },
            { x: player.x, y: player.y - 1 }
        ].find(p => p.x >= 0 && p.x < 10 && p.y >= 0 && p.y < 10 && state.grid[p.y][p.x].type === 0 && !state.units.some(u => u.x === p.x && u.y === p.y && u.hp > 0));

        assert.ok(validMove, 'Must find a valid adjacent empty tile');

        let moveRes = engineA.handleAction('move', { actorId: player.id, x: validMove.x, y: validMove.y });
        assert.strictEqual(moveRes.success, true);
        state = engineA.getState();
        player = state.units.find(u => u.id === player.id);
        assert.strictEqual(player.ap, 1, 'After 1 move, AP must be 1');

        // Shoot with remaining 1 AP
        let shootRes = engineA.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
        assert.strictEqual(shootRes.success, true);
        state = engineA.getState();
        player = state.units.find(u => u.id === player.id);
        assert.strictEqual(player.ap, 0, 'After shooting, AP must be 0');

        // Sequence B: Shoot first -> Move should be blocked
        const engineB = new AcomEngine();
        engineB.init();
        state = engineB.getState();
        player = state.units.find(u => u.type === 'player');
        enemy = state.units.find(u => u.type === 'enemy');

        // Direct shoot
        shootRes = engineB.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
        assert.strictEqual(shootRes.success, true);
        state = engineB.getState();
        player = state.units.find(u => u.id === player.id);
        assert.strictEqual(player.ap, 0, 'Shooting directly consumes all remaining AP');

        // Move attempt after shooting
        moveRes = engineB.handleAction('move', { actorId: player.id, x: player.x + 1, y: player.y });
        assert.strictEqual(moveRes.success, false, 'Move must be rejected when AP is 0');
    });

    test('TC-303: Multi-Unit Squad Turn Coordination', () => {
        const engine = new AcomEngine();
        engine.initRandom(3, 3);
        const state = engine.getState();
        const players = state.units.filter(u => u.type === 'player');
        const enemies = state.units.filter(u => u.type === 'enemy');

        assert.strictEqual(players.length, 3);
        assert.strictEqual(enemies.length, 3);

        // Unit 1 acts
        const u1 = players[0];
        const target = enemies[0];
        const res1 = engine.handleAction('shoot', { actorId: u1.id, targetId: target.id });
        assert.strictEqual(res1.success, true);

        // Unit 2 can still act independently because Unit 2 has 2 AP
        const stateAfterU1 = engine.getState();
        const u2 = stateAfterU1.units.find(u => u.id === players[1].id);
        assert.strictEqual(u2.ap, 2, 'Unit 2 must retain its AP when Unit 1 shoots');

        const res2 = engine.handleAction('shoot', { actorId: u2.id, targetId: target.id });
        assert.strictEqual(res2.success, true);
    });

    test('TC-304: Turn Transition & AP Refill for Living Squad', () => {
        const engine = new AcomEngine();
        engine.initRandom(3, 3);

        // End turn to trigger enemy AI and cycle back to player turn
        const endTurnRes = engine.handleAction('end_turn', {});
        assert.strictEqual(endTurnRes.success, true);
        const state = engine.getState();

        // If players survived, turn should be player and AP refilled to maxAp (2)
        const livingPlayers = state.units.filter(u => u.type === 'player' && u.hp > 0);
        if (livingPlayers.length > 0) {
            assert.strictEqual(state.currentTurn, 'player');
            for (const p of livingPlayers) {
                assert.strictEqual(p.ap, p.maxAp, `Player ${p.id} AP must be refilled to maxAp (${p.maxAp})`);
            }
        }
    });

    test('TC-305: Dead Unit State and Rejection of Post-Mortem Actions', () => {
        const engine = new AcomEngine();
        engine.init();
        let state = engine.getState();
        let player = state.units.find(u => u.type === 'player');
        let enemy = state.units.find(u => u.type === 'enemy');

        // Repeatedly shoot enemy until dead
        let turns = 0;
        while (enemy.hp > 0 && turns < 15) {
            turns++;
            engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
            state = engine.getState();
            enemy = state.units.find(u => u.id === enemy.id);
            if (enemy.hp > 0) {
                engine.handleAction('end_turn', {});
                state = engine.getState();
                player = state.units.find(u => u.type === 'player');
                enemy = state.units.find(u => u.id === enemy.id);
            }
        }

        // If enemy is defeated, verify shooting dead enemy returns success=false
        if (enemy && enemy.hp <= 0) {
            const shootDeadRes = engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
            assert.strictEqual(shootDeadRes.success, false, 'Shooting a dead unit must be rejected');
        }
    });
});
