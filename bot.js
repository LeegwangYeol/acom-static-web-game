/**
 * bot.js
 * Automated AI Simulation Harness for ACOM.
 * Adapted for purely in-memory static execution against AcomEngine from game.js (Zero server.js dependency).
 */

const assert = require('assert');

let AcomEngine;
try {
    const gameModule = require('./game.js');
    AcomEngine = gameModule.AcomEngine;
} catch (err) {}

const MATCHES_TO_SIMULATE = 50;

function processBotTurn(engine) {
    let state = engine.getState();
    const players = state.units.filter(u => u.type === 'player' && u.hp > 0);

    for (const player of players) {
        while (player.ap > 0) {
            state = engine.getState();
            const p = state.units.find(u => u.id === player.id);
            if (!p || p.hp <= 0 || p.ap <= 0) break;

            const enemies = state.units.filter(u => u.type === 'enemy' && u.hp > 0);
            if (enemies.length === 0) break;

            // Find closest enemy
            let closestEnemy = null;
            let minDistance = Infinity;
            for (let e of enemies) {
                let dist = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestEnemy = e;
                }
            }

            if (!closestEnemy) break;

            const distX = closestEnemy.x - p.x;
            const distY = closestEnemy.y - p.y;
            const dist = Math.abs(distX) + Math.abs(distY);

            if (dist > 3) {
                // Try to move towards closest enemy
                let newX = p.x + (distX !== 0 ? Math.sign(distX) : 0);
                let newY = p.y + (distY !== 0 ? Math.sign(distY) : 0);

                const emptyX = state.grid[p.y] && state.grid[p.y][newX] && state.grid[p.y][newX].type === 0;
                const emptyY = state.grid[newY] && state.grid[newY][p.x] && state.grid[newY][p.x].type === 0;
                const unitAtX = state.units.some(u => u.x === newX && u.y === p.y && u.hp > 0);
                const unitAtY = state.units.some(u => u.x === p.x && u.y === newY && u.hp > 0);

                let targetX = p.x;
                let targetY = p.y;

                if (distX !== 0 && emptyX && !unitAtX) {
                    targetX = newX;
                } else if (distY !== 0 && emptyY && !unitAtY) {
                    targetY = newY;
                }

                if (targetX !== p.x || targetY !== p.y) {
                    const moveRes = engine.handleAction('move', { actorId: p.id, x: targetX, y: targetY });
                    if (!moveRes.success) {
                        // If move rejected, fall back to shoot
                        engine.handleAction('shoot', { actorId: p.id, targetId: closestEnemy.id });
                    }
                } else {
                    engine.handleAction('shoot', { actorId: p.id, targetId: closestEnemy.id });
                }
            } else {
                engine.handleAction('shoot', { actorId: p.id, targetId: closestEnemy.id });
            }
        }
    }

    engine.handleAction('end_turn', {});
}

async function runBot() {
    console.log(`Starting in-memory Bot simulation for ${MATCHES_TO_SIMULATE} matches...`);
    assert.ok(typeof AcomEngine === 'function', 'AcomEngine must be exported from game.js');

    let winCount = 0;
    let lossCount = 0;
    const startTime = Date.now();

    for (let match = 1; match <= MATCHES_TO_SIMULATE; match++) {
        const engine = new AcomEngine();
        const players = 3 + Math.floor(Math.random() * 2);
        const enemies = 3 + Math.floor(Math.random() * 2);
        engine.initRandom(players, enemies);

        let round = 0;
        const maxRounds = 50;

        while (round < maxRounds) {
            round++;
            const state = engine.getState();
            const alivePlayers = state.units.filter(u => u.type === 'player' && u.hp > 0).length;
            const aliveEnemies = state.units.filter(u => u.type === 'enemy' && u.hp > 0).length;

            if (alivePlayers === 0 || aliveEnemies === 0) {
                if (alivePlayers > 0) winCount++;
                else lossCount++;
                break;
            }

            processBotTurn(engine);
        }
    }

    const duration = Date.now() - startTime;
    console.log(`\n=== Bot Simulation Results (${MATCHES_TO_SIMULATE} matches in ${duration}ms) ===`);
    console.log(`Total Matches: ${MATCHES_TO_SIMULATE}`);
    console.log(`Wins: ${winCount} (${((winCount / MATCHES_TO_SIMULATE) * 100).toFixed(1)}%)`);
    console.log(`Losses: ${lossCount} (${((lossCount / MATCHES_TO_SIMULATE) * 100).toFixed(1)}%)`);
    console.log(`Speed: ${(MATCHES_TO_SIMULATE / (duration / 1000)).toFixed(0)} matches/second`);
}

if (require.main === module) {
    runBot().catch(err => {
        console.error("Bot simulation failed:", err);
        process.exit(1);
    });
}

module.exports = { runBot };
