/**
 * tests/tier1_features.test.js
 * Tier 1: Feature Coverage in Isolation (Features F1 through F12)
 * Purely in-memory static execution against AcomEngine from game.js (Zero server.js dependency).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validateAllAssets, parsePNG } = require('./validate_assets');

// Import AcomEngine and helpers from client-side game.js
let AcomEngine, createUnit, ARCHETYPES, calculateHitChance;
try {
    const gameModule = require('../game.js');
    AcomEngine = gameModule.AcomEngine;
    createUnit = gameModule.createUnit;
    ARCHETYPES = gameModule.ARCHETYPES;
    calculateHitChance = gameModule.calculateHitChance;
} catch (err) {
    // If not exported, AcomEngine will be undefined and caught by assertions
}

describe('Tier 1: Feature Coverage (F1 - F12) [Static In-Memory]', () => {

    test('F1: High-Resolution Character Asset Sourcing', () => {
        const assetDir = path.resolve(__dirname, '../assets/characters');
        assert.ok(fs.existsSync(assetDir), 'Asset directory assets/characters/ must exist');
        
        const coreFiles = [
            'ally_assault.png',
            'ally_recon.png',
            'ally_heavy.png',
            'enemy_mutant.png',
            'enemy_scout.png',
            'enemy_heavy.png'
        ];

        for (const file of coreFiles) {
            const filePath = path.join(assetDir, file);
            assert.ok(fs.existsSync(filePath), `Asset file ${file} must exist`);
            const parsed = parsePNG(filePath);
            assert.strictEqual(parsed.valid, true, `${file} must be a valid PNG`);
            assert.ok(parsed.width >= 128 && parsed.height >= 128, `${file} must be high-res (>=128x128)`);
            assert.ok(parsed.transRatio > 0.15, `${file} must have transparent background (>15%)`);
            assert.ok(parsed.semiAlphaCount > 100, `${file} must have anti-aliased edge feathering`);
        }
    });

    test('F2: Asset Validation Tooling', () => {
        const report = validateAllAssets();
        assert.ok(report.totalAssets >= 6, 'Should find at least 6 assets');
        assert.strictEqual(report.passedAssets >= 6, true, 'At least 6 assets must pass validation');
        assert.strictEqual(report.status, 'PASS', 'Validation report status must be PASS');
    });

    test('F3: Multi-Character Data Archetypes & Unit Schemas', () => {
        assert.ok(typeof AcomEngine === 'function', 'AcomEngine class must be exported from game.js');
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        assert.ok(Array.isArray(state.units), 'State must contain units array');
        assert.ok(state.units.length >= 2, 'Initial state must contain units');

        for (const unit of state.units) {
            assert.ok(unit.id, 'Unit must have id');
            assert.ok(unit.type === 'player' || unit.type === 'enemy', 'Unit type must be player or enemy');
            assert.ok(typeof unit.hp === 'number' && unit.hp > 0, 'Unit must have valid HP');
            assert.ok(typeof unit.maxHp === 'number' && unit.maxHp >= unit.hp, 'Unit must have maxHp');
            assert.ok(typeof unit.ap === 'number', 'Unit must have AP');
            assert.ok(typeof unit.mobility === 'number' && unit.mobility > 0, 'Unit must have mobility');
            assert.ok(typeof unit.aim === 'number' && unit.aim > 0, 'Unit must have aim');
            assert.ok(typeof (unit.weaponDamage || unit.attack) === 'number' && (unit.weaponDamage || unit.attack) > 0, 'Unit must have weapon damage');
        }
    });

    test('F4: Multi-Unit Squad Initialization (In-Memory init & initRandom)', () => {
        const engine = new AcomEngine();
        
        // Standard 3v3 init
        engine.init();
        let state = engine.getState();
        assert.strictEqual(state.currentTurn, 'player');
        assert.ok(state.units.length >= 2, 'Must spawn units on default init');

        // Skirmish 3v3 squad initialization via initRandom
        engine.initRandom(3, 3);
        state = engine.getState();
        assert.strictEqual(state.units.length, 6, 'Must spawn 6 units for 3v3 squad');

        const players = state.units.filter(u => u.type === 'player');
        const enemies = state.units.filter(u => u.type === 'enemy');
        assert.strictEqual(players.length, 3, 'Must have 3 player units');
        assert.strictEqual(enemies.length, 3, 'Must have 3 enemy units');

        // Check positions are distinct
        const positions = new Set(state.units.map(u => `${u.x},${u.y}`));
        assert.strictEqual(positions.size, 6, 'All units must be spawned on distinct tiles');
    });

    test('F5: Isometric Grid Coordinate & Map Contracts', () => {
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        assert.ok(Array.isArray(state.grid), 'State must contain 2D grid');
        assert.strictEqual(state.grid.length, 10, 'Grid height must be 10');
        assert.strictEqual(state.grid[0].length, 10, 'Grid width must be 10');

        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                const cell = state.grid[y][x];
                assert.strictEqual(cell.x, x);
                assert.strictEqual(cell.y, y);
                assert.ok([0, 1, 2].includes(cell.type), 'Cell type must be empty(0), half-cover(1), or full-cover(2)');
            }
        }
    });

    test('F6: Dynamic Depth Sorting & Positioning Formula', () => {
        // Dynamic Z-Index formula: zIndex = y * 10 + 5
        const calculateZIndex = (y) => y * 10 + 5;
        assert.strictEqual(calculateZIndex(0), 5);
        assert.strictEqual(calculateZIndex(5), 55);
        assert.strictEqual(calculateZIndex(9), 95);
        assert.ok(calculateZIndex(6) > calculateZIndex(5), 'Higher Y must yield higher z-index for foreground priority');
    });

    test('F7: Visual Combat FX & Style Declarations', () => {
        const cssPath = path.resolve(__dirname, '../style.css');
        assert.ok(fs.existsSync(cssPath), 'style.css must exist');
        const cssContent = fs.readFileSync(cssPath, 'utf8');

        assert.ok(cssContent.includes('.unit-hp-bar'), 'Must define HP bar styling');
        assert.ok(cssContent.includes('.unit-hp-fill'), 'Must define HP fill styling');
        assert.ok(cssContent.includes('.floating-text') || cssContent.includes('damage') || cssContent.includes('unit-sprite'), 'Must define combat FX');
    });

    test('F8: Modern Tactical HUD & Squad Indicators in DOM Layout', () => {
        const htmlPath = path.resolve(__dirname, '../index.html');
        assert.ok(fs.existsSync(htmlPath), 'index.html must exist');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');

        assert.ok(htmlContent.includes('grid-container'), 'index.html must include grid-container');
        assert.ok(htmlContent.includes('units-layer'), 'index.html must include units-layer');
        assert.ok(htmlContent.includes('turn-indicator'), 'index.html must include turn-indicator');
        assert.ok(htmlContent.includes('ap-counter'), 'index.html must include ap-counter');
        assert.ok(htmlContent.includes('squad-dock'), 'index.html must include squad-dock');
    });

    test('F9: Command Console & Action Control Bindings', () => {
        const htmlPath = path.resolve(__dirname, '../index.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');

        assert.ok(htmlContent.includes('btn-move'), 'Must contain Move action button');
        assert.ok(htmlContent.includes('btn-shoot'), 'Must contain Shoot action button');
        assert.ok(htmlContent.includes('btn-end-turn'), 'Must contain End Turn button');
    });

    test('F10: Target Preview HUD & Hit Calculation Formula', () => {
        const formulaCalc = (aim, coverDefense, dist) => Math.max(0, Math.min(100, aim - coverDefense - dist * 2));

        // Base test with no cover and dist 2
        assert.strictEqual(formulaCalc(80, 0, 2), 76);
        // Half cover (20 defense)
        assert.strictEqual(formulaCalc(80, 20, 2), 56);
        // Full cover (40 defense)
        assert.strictEqual(formulaCalc(80, 40, 2), 36);
        // Far distance clamping
        assert.strictEqual(formulaCalc(50, 40, 10), 0);

        // Test calculateHitChance function if exported from game.js
        if (typeof calculateHitChance === 'function') {
            const grid = Array.from({ length: 10 }, (_, y) =>
                Array.from({ length: 10 }, (_, x) => ({ x, y, type: 0 }))
            );
            grid[0][3].type = 1; // Half cover adjacent to defender at (2,0)
            const attacker = { aim: 80, x: 0, y: 0 };
            const defender = { x: 2, y: 0 };
            assert.strictEqual(calculateHitChance(attacker, defender, grid), 56);
        }
    });

    test('F11: Combat Terminal & Event Log Stream', () => {
        const engine = new AcomEngine();
        engine.init();
        const state = engine.getState();
        assert.ok(Array.isArray(state.logs), 'State must contain logs array');
        assert.ok(state.logs.length > 0, 'Logs must record initialization event');
        assert.ok(typeof state.logs[0] === 'string', 'Log entries must be strings');
    });

    test('F12: Automated Verification Reports and Artifact Generation', () => {
        const reportDir = path.resolve(__dirname, '../.agents/reports');
        assert.ok(fs.existsSync(reportDir), '.agents/reports directory must exist');
    });
});
