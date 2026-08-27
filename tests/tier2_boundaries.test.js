/**
 * tests/tier2_boundaries.test.js
 * Tier 2: Boundary & Corner Cases (Stress, Limits, and Rejection Guards)
 * Purely in-memory static execution against AcomEngine from game.js (Zero server.js dependency).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

let AcomEngine;
try {
    const gameModule = require('../game.js');
    AcomEngine = gameModule.AcomEngine;
} catch (err) {}

describe('Tier 2: Boundary & Corner Cases [Static In-Memory]', () => {

    test('TC-201: Out-of-Bounds Movement Rejection', () => {
        assert.ok(typeof AcomEngine === 'function', 'AcomEngine must be exported');
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        const player = state.units.find(u => u.type === 'player');

        const outOfBoundsCoords = [
            { x: 99, y: 99 },
            { x: -50, y: -50 },
            { x: 15, y: player.y },
            { x: player.x, y: 15 },
            { x: -1, y: 0 },
            { x: 0, y: -1 },
            { x: 10, y: 0 },
            { x: 0, y: 10 }
        ];

        for (const coord of outOfBoundsCoords) {
            const res = engine.handleAction('move', { actorId: player.id, x: coord.x, y: coord.y });
            assert.strictEqual(res.success, false, `Move to out-of-bounds (${coord.x}, ${coord.y}) must be rejected with success=false`);
        }
    });

    test('TC-202: Zero and Depleted AP Action Rejection', () => {
        const engine = new AcomEngine();
        engine.init();
        let state = engine.getState();
        const player = state.units.find(u => u.type === 'player');
        const enemy = state.units.find(u => u.type === 'enemy');

        // Deplete AP by shooting
        const shootRes = engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
        assert.strictEqual(shootRes.success, true, 'Initial shoot must succeed');

        state = engine.getState();
        const playerAfterShoot = state.units.find(u => u.id === player.id);
        assert.strictEqual(playerAfterShoot.ap, 0, 'AP must be 0 after shooting');

        // Attempt move with 0 AP
        const moveRes = engine.handleAction('move', { actorId: player.id, x: player.x + 1, y: player.y });
        assert.strictEqual(moveRes.success, false, 'Move with 0 AP must return success=false');

        // Attempt second shoot with 0 AP
        const shootAgainRes = engine.handleAction('shoot', { actorId: player.id, targetId: enemy.id });
        assert.strictEqual(shootAgainRes.success, false, 'Shoot with 0 AP must return success=false');
    });

    test('TC-203: Friendly Fire & Self-Targeting Guard', () => {
        const engine = new AcomEngine();
        engine.initRandom(3, 3);
        const state = engine.getState();
        const players = state.units.filter(u => u.type === 'player');
        assert.ok(players.length >= 2, 'Need at least 2 players');

        const actor = players[0];
        const friendlyTarget = players[1];

        // Self shoot attempt
        const selfShootRes = engine.handleAction('shoot', { actorId: actor.id, targetId: actor.id });
        assert.strictEqual(selfShootRes.success, false, 'Shooting self must be rejected');

        // Friendly shoot attempt
        const friendlyShootRes = engine.handleAction('shoot', { actorId: actor.id, targetId: friendlyTarget.id });
        assert.strictEqual(friendlyShootRes.success, false, 'Shooting ally unit must be rejected');
    });

    test('TC-204: Cover and Tile Obstacle Collision Guard', () => {
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        const player = state.units.find(u => u.type === 'player');

        // Find cover tiles
        const coverTiles = [];
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                if (state.grid[y][x].type > 0) {
                    coverTiles.push({ x, y });
                }
            }
        }

        if (coverTiles.length > 0) {
            const cover = coverTiles[0];
            const moveRes = engine.handleAction('move', { actorId: player.id, x: cover.x, y: cover.y });
            assert.strictEqual(moveRes.success, false, 'Moving onto a cover tile must be rejected');
        }
    });

    test('TC-205: Mobility Limit Enforcement', () => {
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        const player = state.units.find(u => u.type === 'player');

        // Attempt move beyond mobility (e.g. dist = mobility + 3)
        const targetX = Math.min(9, player.x + player.mobility + 3);
        const targetY = player.y;

        const moveRes = engine.handleAction('move', { actorId: player.id, x: targetX, y: targetY });
        assert.strictEqual(moveRes.success, false, 'Moving farther than mobility must be rejected');
    });

    test('TC-206: Non-Existent Actor and Invalid Target Guard', () => {
        const engine = new AcomEngine();
        engine.init();

        // Non-existent actor
        const fakeActorRes = engine.handleAction('move', { actorId: 'ghost_unit_99', x: 2, y: 2 });
        assert.strictEqual(fakeActorRes.success, false, 'Action by non-existent actor must return success=false');

        // Non-existent target
        const state = engine.getState();
        const player = state.units.find(u => u.type === 'player');

        const fakeTargetRes = engine.handleAction('shoot', { actorId: player.id, targetId: 'non_existent_enemy' });
        assert.strictEqual(fakeTargetRes.success, false, 'Shooting non-existent target must return success=false');
    });

    test('TC-207: Malformed and Invalid Payloads Resiliency', () => {
        const engine = new AcomEngine();
        engine.init();

        // Missing action
        let res = engine.handleAction(null, {});
        assert.strictEqual(res.success, false);

        // Unknown action name
        res = engine.handleAction('teleport', {});
        assert.strictEqual(res.success, false);

        // Corrupted coordinates
        const player = engine.getState().units.find(u => u.type === 'player');
        res = engine.handleAction('move', { actorId: player.id, x: 'abc', y: null });
        assert.strictEqual(res.success, false);

        res = engine.handleAction('move', { actorId: player.id, x: NaN, y: 2 });
        assert.strictEqual(res.success, false);

        // Ensure engine is still alive and operational
        const state = engine.getState();
        assert.ok(state && Array.isArray(state.units), 'Engine must remain functional after malformed requests');
    });
});
