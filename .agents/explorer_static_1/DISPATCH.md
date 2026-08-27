## 2026-08-26T16:30:41Z
You are an Explorer subagent (explorer_static_1) investigating the backend architecture of acom (/Users/user/src/acom).

Working directory: /Users/user/src/acom/.agents/explorer_static_1
Project workspace: /Users/user/src/acom
Task: Survey and catalog all stateful backend logic in server.js to prepare for static client-side migration into game.js.

Instructions:
1. Read /Users/user/src/acom/.agents/ORIGINAL_REQUEST.md and /Users/user/src/acom/PROJECT.md.
2. Carefully inspect /Users/user/src/acom/server.js in full detail.
3. Catalog all components:
   - Game state data structures (gameState, units, grid, cover, turn counters, action logs).
   - Character archetypes and stats registry (Assault, Recon, Heavy, Mutant, Infiltrator, Enforcer).
   - Procedural map generation (grid dimensions, half/full cover placement, spawning coordinates).
   - Squad generation logic (3v3 ally/enemy unit instantiation, stats assignment, unique IDs).
   - Action validation & processing (move, shoot, overwatch, end_turn).
   - Line of sight, distance calculations, cover defense bonus (+20%/+40%), hit chance calculation.
   - Combat damage resolution, critical hits, lethal damage & death handling.
   - Enemy AI turn engine (decision trees, targeting heuristics, movement priority, action execution).
   - Game win/loss evaluation.
   - All REST API endpoints and their input/output payloads.
4. Formulate a clear, structured architecture design for how this logic will be ported into a client-side JavaScript engine (e.g., AcomEngine / GameStateManager) inside game.js.
5. Write your comprehensive analysis report to /Users/user/src/acom/.agents/explorer_static_1/analysis.md and a self-contained handoff to /Users/user/src/acom/.agents/explorer_static_1/handoff.md.
6. Report back via send_message to orchestrator when finished.
