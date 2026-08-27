## 2026-08-27T01:30:50Z
You are the Frontend Decoupling Worker subagent (worker_static_m2) responsible for Milestone M2 in /Users/user/src/acom.

Working directory: /Users/user/src/acom/.agents/worker_static_m2
Project workspace: /Users/user/src/acom
Task: Decouple game.js from HTTP fetch calls and server.js, wire the UI directly to AcomEngine, expose global test hooks, and verify purely static browser execution.

Instructions:
1. Read /Users/user/src/acom/.agents/ORIGINAL_REQUEST.md, /Users/user/src/acom/PROJECT.md, /Users/user/src/acom/.agents/explorer_static_2/analysis.md, and /Users/user/src/acom/.agents/worker_static_m1/handoff.md.
2. In /Users/user/src/acom/game.js:
   - Instantiate the client-side game engine (e.g., const gameEngine = new AcomEngine()).
   - Eliminate all HTTP fetch calls (API_BASE, fetchJSON, /api/init, /api/state, /api/action).
   - In init(): call gameEngine.initGame() directly, set client-side gameState, and invoke renderGridOnce() & render().
   - In initRandomGame(playerCount, enemyCount): call gameEngine.initRandom(playerCount, enemyCount) directly and render.
   - In sendAction(action, payload): call gameEngine.handleAction(action, payload) directly, apply state updates, trigger animations (recoil on attacker, damage flash & floating text on defender, pose switching), update logs, handle enemy turn banner & execution, and invoke checkEndgame().
   - Expose the global test surface on window for backward compatibility with automated test scripts:
     window.__ACOM_ENGINE__ = gameEngine;
     window.__ACOM_GAME__ = {
       get state() { return gameState; },
       init: init,
       initRandom: initRandomGame,
       sendAction: sendAction,
       getSelectedUnit: getSelectedUnit,
       render: render
     };
     window.gameState = gameState;
     window.init = init;
     window.initRandomGame = initRandomGame;
     window.fetchState = async () => { render(); return gameState; };
     window.sendAction = sendAction;
3. In /Users/user/src/acom/package.json:
   - Ensure scripts and dependencies reflect a static, serverless architecture.
4. Verify by running static checks (e.g. node -c game.js) and testing game initialization and action dispatches without any running server.
5. MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
6. Document your changes and verification in /Users/user/src/acom/.agents/worker_static_m2/handoff.md and report back via send_message.
