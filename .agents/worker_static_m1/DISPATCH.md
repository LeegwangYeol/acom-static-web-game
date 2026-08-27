## 2026-08-27T01:28:13Z

<USER_REQUEST>
You are the State Engine Worker subagent (worker_static_m1) responsible for Milestone M1 in /Users/user/src/acom.

Working directory: /Users/user/src/acom/.agents/worker_static_m1
Project workspace: /Users/user/src/acom
Task: Migrate the stateful backend engine and game rules from server.js into an in-memory AcomEngine class inside game.js.

Instructions:
1. Read /Users/user/src/acom/.agents/ORIGINAL_REQUEST.md, /Users/user/src/acom/PROJECT.md, and /Users/user/src/acom/.agents/explorer_static_1/analysis.md.
2. In /Users/user/src/acom/game.js, implement the complete client-side AcomEngine class:
   - 6 Character Archetype dictionary (Assault, Recon, Heavy, Mutant, Infiltrator, Enforcer) with identical stats, weapon damages, ranges, mobility, and sprite paths.
   - createUnit(archetypeKey, id, x, y) factory.
   - 10x10 procedural grid map generator with half/full cover placement and spawn clearance coordinates.
   - initGame() (default 3v3 layout: Assault at (1,1), Recon at (0,3), Heavy at (3,0); Mutant at (8,8), Scout at (9,5), Heavy at (5,9)).
   - initRandomGame(playerCount, enemyCount) for procedural skirmishes on random empty tiles.
   - getState() deep-clone snapshot method.
   - handleAction(action, payload) / dispatch(action, payload) dispatcher with complete validation for 'move', 'shoot', and 'end_turn'.
   - calculateCoverDefense(defender) inspecting 4 orthogonal neighbors (40% full, 20% half, 0% none).
   - calculateHitChance(attacker, defender) formula: clamp(Aim - Cover - 2*Dist, 0, 100).
   - executeShot(attacker, defender) damage resolution, lethal removal, and win/loss checking.
   - processEnemyTurn() autonomous enemy AI navigation & attack loop (targeting closest player, X-then-Y heuristic movement, attack execution, AP replenishment for player turn).
   - Ring-buffer logging (max 20 entries).
   - Universal module export:
     if (typeof module !== 'undefined' && module.exports) {
       module.exports = { AcomEngine, createUnit, ARCHETYPES, calculateHitChance };
     }
     if (typeof window !== 'undefined') {
       window.AcomEngine = AcomEngine;
     }
3. Run verification tests to confirm AcomEngine compiles and executes correctly.
4. MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
5. Document your code changes and verification in /Users/user/src/acom/.agents/worker_static_m1/handoff.md and report back via send_message.
</USER_REQUEST>
