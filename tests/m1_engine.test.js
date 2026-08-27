/**
 * tests/m1_engine.test.js
 * Unit Test Suite for Client-Side AcomEngine (Milestone M1)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { AcomEngine, createUnit, ARCHETYPES, calculateHitChance } = require('../game.js');

describe('Milestone M1: AcomEngine In-Memory Core', () => {

    test('M1-1: 6 Character Archetypes Integrity', () => {
        assert.ok(ARCHETYPES, 'ARCHETYPES must be exported');
        const keys = Object.keys(ARCHETYPES);
        assert.strictEqual(keys.length, 6, 'Must contain exactly 6 archetypes');

        const expected = {
            ally_assault: { name: 'Assault Ranger', type: 'player', unitClass: 'assault', hp: 10, maxHp: 10, ap: 2, mobility: 4, aim: 80, weaponDamage: 4, range: 5 },
            ally_recon: { name: 'Recon Scout', type: 'player', unitClass: 'recon', hp: 8, maxHp: 8, ap: 2, mobility: 5, aim: 85, weaponDamage: 3, range: 6 },
            ally_heavy: { name: 'Heavy Juggernaut', type: 'player', unitClass: 'heavy', hp: 14, maxHp: 14, ap: 2, mobility: 3, aim: 70, weaponDamage: 6, range: 4 },
            enemy_mutant: { name: 'Bioweapon Mutant', type: 'enemy', unitClass: 'mutant', hp: 8, maxHp: 8, ap: 2, mobility: 4, aim: 65, weaponDamage: 3, range: 4 },
            enemy_scout: { name: 'Stealth Infiltrator', type: 'enemy', unitClass: 'infiltrator', hp: 6, maxHp: 6, ap: 2, mobility: 5, aim: 75, weaponDamage: 2, range: 5 },
            enemy_heavy: { name: 'Cyber Enforcer', type: 'enemy', unitClass: 'enforcer', hp: 12, maxHp: 12, ap: 2, mobility: 3, aim: 60, weaponDamage: 5, range: 4 }
        };

        for (const [key, exp] of Object.entries(expected)) {
            const arch = ARCHETYPES[key];
            assert.ok(arch, `Archetype ${key} must exist`);
            assert.strictEqual(arch.name, exp.name);
            assert.strictEqual(arch.type, exp.type);
            assert.strictEqual(arch.unitClass, exp.unitClass);
            assert.strictEqual(arch.hp, exp.hp);
            assert.strictEqual(arch.maxHp, exp.maxHp);
            assert.strictEqual(arch.ap, exp.ap);
            assert.strictEqual(arch.mobility, exp.mobility);
            assert.strictEqual(arch.aim, exp.aim);
            assert.strictEqual(arch.weaponDamage, exp.weaponDamage);
            assert.strictEqual(arch.range, exp.range);
            assert.strictEqual(arch.sprite, `assets/characters/${key}.png`);
            assert.strictEqual(arch.portrait, `assets/characters/${key}.png`);
        }
    });

    test('M1-2: createUnit Factory', () => {
        const unit = createUnit('ally_assault', 'test_assault_1', 4, 7);
        assert.strictEqual(unit.id, 'test_assault_1');
        assert.strictEqual(unit.archetype, 'ally_assault');
        assert.strictEqual(unit.name, 'Assault Ranger');
        assert.strictEqual(unit.type, 'player');
        assert.strictEqual(unit.unitClass, 'assault');
        assert.strictEqual(unit.x, 4);
        assert.strictEqual(unit.y, 7);
        assert.strictEqual(unit.hp, 10);
        assert.strictEqual(unit.maxHp, 10);
        assert.strictEqual(unit.ap, 2);
        assert.strictEqual(unit.maxAp, 2);
        assert.strictEqual(unit.mobility, 4);
        assert.strictEqual(unit.aim, 80);
        assert.strictEqual(unit.weaponDamage, 4);
        assert.strictEqual(unit.range, 5);
        assert.strictEqual(unit.isAlive, true);
    });

    test('M1-3: Procedural 10x10 Grid Map & Clearance Zones in initGame()', () => {
        const engine = new AcomEngine();
        const state = engine.getState();

        assert.strictEqual(state.grid.length, 10);
        for (let y = 0; y < 10; y++) {
            assert.strictEqual(state.grid[y].length, 10);
            for (let x = 0; x < 10; x++) {
                const cell = state.grid[y][x];
                assert.strictEqual(cell.x, x);
                assert.strictEqual(cell.y, y);
                assert.ok([0, 1, 2].includes(cell.type), 'Cell type must be 0, 1, or 2');
            }
        }

        // Check clearance positions are 0 (empty)
        const clearPositions = [
            { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 0 },
            { x: 0, y: 3 }, { x: 3, y: 0 },
            { x: 8, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 7 }, { x: 9, y: 8 }, { x: 8, y: 9 },
            { x: 9, y: 5 }, { x: 5, y: 9 }
        ];

        for (const pos of clearPositions) {
            assert.strictEqual(state.grid[pos.y][pos.x].type, 0, `Clearance position (${pos.x}, ${pos.y}) must be empty (0)`);
        }

        // Check 3v3 default unit spawn coordinates
        const assault = state.units.find(u => u.id === 'ally_assault_1');
        const recon = state.units.find(u => u.id === 'ally_recon_1');
        const heavy = state.units.find(u => u.id === 'ally_heavy_1');
        const mutant = state.units.find(u => u.id === 'enemy_mutant_1');
        const scout = state.units.find(u => u.id === 'enemy_scout_1');
        const eheavy = state.units.find(u => u.id === 'enemy_heavy_1');

        assert.ok(assault && assault.x === 1 && assault.y === 1, 'Assault at (1,1)');
        assert.ok(recon && recon.x === 0 && recon.y === 3, 'Recon at (0,3)');
        assert.ok(heavy && heavy.x === 3 && heavy.y === 0, 'Heavy at (3,0)');
        assert.ok(mutant && mutant.x === 8 && mutant.y === 8, 'Mutant at (8,8)');
        assert.ok(scout && scout.x === 9 && scout.y === 5, 'Scout at (9,5)');
        assert.ok(eheavy && eheavy.x === 5 && eheavy.y === 9, 'Enemy Heavy at (5,9)');
        assert.strictEqual(state.currentTurn, 'player');
    });

    test('M1-4: initRandomGame(playerCount, enemyCount)', () => {
        const engine = new AcomEngine();
        engine.initRandomGame(4, 5);
        const state = engine.getState();

        const players = state.units.filter(u => u.type === 'player');
        const enemies = state.units.filter(u => u.type === 'enemy');
        assert.strictEqual(players.length, 4);
        assert.strictEqual(enemies.length, 5);

        // Verify all units spawned on empty tiles
        for (const u of state.units) {
            assert.strictEqual(state.grid[u.y][u.x].type, 0, `Unit ${u.id} must be on empty tile`);
        }
    });

    test('M1-5: Deep-Clone Snapshot Isolation (getState)', () => {
        const engine = new AcomEngine();
        const s1 = engine.getState();
        s1.units[0].hp = 0;
        s1.grid[0][0].type = 2;
        s1.logs.push('MUTATION');

        const s2 = engine.getState();
        assert.notStrictEqual(s2.units[0].hp, 0);
        assert.notStrictEqual(s2.grid[0][0].type, 2);
        assert.strictEqual(s2.logs.includes('MUTATION'), false);
    });

    test('M1-6: Cover Defense Calculation (0%, 20%, 40%)', () => {
        const engine = new AcomEngine();
        engine.gameState.grid = Array.from({ length: 10 }, (_, y) =>
            Array.from({ length: 10 }, (_, x) => ({ x, y, type: 0 }))
        );

        const dummyTarget = { x: 5, y: 5 };

        // No cover
        assert.strictEqual(engine.calculateCoverDefense(dummyTarget), 0);

        // Half cover to north (5, 4)
        engine.gameState.grid[4][5].type = 1;
        assert.strictEqual(engine.calculateCoverDefense(dummyTarget), 20);

        // Full cover to east (6, 5)
        engine.gameState.grid[5][6].type = 2;
        assert.strictEqual(engine.calculateCoverDefense(dummyTarget), 40);
    });

    test('M1-7: Hit Chance Formula Clamp [0, 100]', () => {
        const engine = new AcomEngine();
        engine.gameState.grid = Array.from({ length: 10 }, (_, y) =>
            Array.from({ length: 10 }, (_, x) => ({ x, y, type: 0 }))
        );

        const attacker = { x: 1, y: 1, aim: 80 };
        const defender = { x: 3, y: 1 }; // Dist = 2

        // Base: 80 - 0 (cover) - 2*2 (dist) = 76%
        assert.strictEqual(engine.calculateHitChance(attacker, defender), 76);

        // Add full cover (+40) -> 80 - 40 - 4 = 36%
        engine.gameState.grid[1][4].type = 2;
        assert.strictEqual(engine.calculateHitChance(attacker, defender), 36);

        // Standalone calculateHitChance function check
        const hitStandalone = calculateHitChance(attacker, defender, engine.gameState.grid);
        assert.strictEqual(hitStandalone, 36);

        // Extreme distance clamp to 0
        const farDefender = { x: 9, y: 9 };
        const lowAimAttacker = { x: 0, y: 0, aim: 10 };
        assert.strictEqual(engine.calculateHitChance(lowAimAttacker, farDefender), 0);
    });

    test('M1-8: Action Dispatch Validation (move, shoot, end_turn)', () => {
        const engine = new AcomEngine();
        engine.init();

        // Valid move
        let res = engine.handleAction('move', { actorId: 'ally_assault_1', x: 2, y: 1 });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(engine.getState().units.find(u => u.id === 'ally_assault_1').x, 2);
        assert.strictEqual(engine.getState().units.find(u => u.id === 'ally_assault_1').ap, 1);

        // Invalid move: too far
        res = engine.handleAction('move', { actorId: 'ally_assault_1', x: 9, y: 9 });
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.status, 400);

        // Shoot valid target
        res = engine.handleAction('shoot', { actorId: 'ally_assault_1', targetId: 'enemy_mutant_1' });
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(typeof res.hit, 'boolean');
        assert.strictEqual(engine.getState().units.find(u => u.id === 'ally_assault_1').ap, 0);

        // Shoot with 0 AP
        res = engine.handleAction('shoot', { actorId: 'ally_assault_1', targetId: 'enemy_mutant_1' });
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.status, 400);

        // End turn
        res = engine.handleAction('end_turn', {});
        assert.strictEqual(res.success, true);
        assert.strictEqual(engine.getState().currentTurn, 'player');
    });

    test('M1-9: Enemy AI Heuristics & Navigation', () => {
        const engine = new AcomEngine();
        engine.init();

        // Verify enemies move toward players on end_turn
        const initialEnemyY = engine.getState().units.find(u => u.id === 'enemy_heavy_1').y;
        engine.handleAction('end_turn', {});
        const postEnemy = engine.getState().units.find(u => u.id === 'enemy_heavy_1');
        // Enemy heavy at (5,9) moves towards heavy at (3,0) -> X steps towards 3 or Y steps towards 0
        assert.ok(postEnemy.x < 5 || postEnemy.y < 9, 'Enemy should step toward player');
    });

    test('M1-10: Ring-Buffer Logging Limit (20 max)', () => {
        const engine = new AcomEngine();
        for (let i = 0; i < 50; i++) {
            engine.log(`Log entry #${i}`);
        }
        const logs = engine.getState().logs;
        assert.strictEqual(logs.length, 20);
        assert.strictEqual(logs[19], 'Log entry #49');
        assert.strictEqual(logs[0], 'Log entry #30');
    });
});
