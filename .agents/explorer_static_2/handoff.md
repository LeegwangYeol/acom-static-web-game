# Handoff Report: Frontend Client Architecture & Server Decoupling Plan

**Agent**: `explorer_static_2`  
**Working Directory**: `/Users/user/src/acom/.agents/explorer_static_2`  
**Target Milestone**: static_frontend_investigation / serverless_decoupling  
**Status**: Task Complete (Hard Handoff)  
**Date**: 2026-08-27  

---

## 1. Observation

Direct code observations from inspecting `/Users/user/src/acom/game.js`, `/Users/user/src/acom/index.html`, `/Users/user/src/acom/style.css`, and `/Users/user/src/acom/server.js`:

1. **Network API Footprint in `game.js`**:
   - `game.js:54`: `const API_BASE = 'http://localhost:3000/api';`
   - `game.js:56-59`: `async function fetchJSON(url, options = {})` uses standard `fetch()`.
   - `game.js:61-65`: `fetchState()` calls `GET ${API_BASE}/state`.
   - `game.js:67-81`: `init()` calls `POST ${API_BASE}/init`.
   - `game.js:157-210`: `sendAction(action, payload)` calls `POST ${API_BASE}/action` with `{ action, payload: { ...payload, actorId: selectedActorId } }`.
   - Test suites (`tests/validate_dom_network.js`, `tests/validate_layout.js`, `tests/tier1_features.test.js`) additionally call `POST ${API_BASE}/init_random` with `{ players: 3, enemies: 3 }`.

2. **Client State Variables & Lifecycles in `game.js`**:
   - `game.js:5`: `let gameState = null;`
   - `game.js:6`: `let selectedAction = null;` ('move', 'shoot', null)
   - `game.js:7`: `let selectedActorId = null;` (ID of active player unit)
   - `game.js:8`: `let hoveredTargetId = null;` (ID of focused/hovered enemy)
   - `game.js:9`: `let lastTurn = null;` (Tracks turn transitions for `showTurnBanner`)
   - `game.js:11-52`: `const ui = { ... }` caches 36 DOM element pointers.

3. **DOM Rendering Routines in `game.js`**:
   - `game.js:249-256`: `render()` coordinates 5 sub-renderers: `renderSquadDock()`, `renderUnits()`, `updateUI()`, `renderTargetPreview()`, `renderLogs()`.
   - `game.js:306-354`: `renderGridOnce()` builds 10x10 grid with `.cover-half` and `.cover-full` overlays, setting CSS `--grid-width` and `--grid-height`.
   - `game.js:356-469`: `renderUnits()` removes stale DOM nodes, instantiates `.unit` elements with `.unit-shadow`, `.unit-sprite`, and `.unit-hp-bar`, calculates coordinates (`left = x * cellSize`, `top = y * cellSize`), applies dynamic Z-sorting (`zIndex = y * 10 + 5`), and handles death fading (`.death-fade`).
   - `game.js:258-304`: `renderSquadDock()` builds dynamic roster cards with miniature health meters, class badges, and status labels (`K.I.A.` / `AP: X/Y`).

4. **HUD Component Controllers in `game.js`**:
   - `game.js:599-646`: `updateUI()` updates Operative Console portraits, Aim/Mobility/Damage/Range meters, and Action button disabled states (`#btn-move`, `#btn-shoot`, `#btn-end-turn`).
   - `game.js:648-730`: `renderTargetPreview()` renders idle radar sweep or active target diagnostics with live cover (+20%/+40%), distance penalty (-2%/tile), expected damage, and hit chance formulas.
   - `game.js:732-766`: `renderLogs()` parses logs into military tag badges (`[MOVE]`, `[HIT]`, `[MISS]`, `[KILL]`, `[PHASE]`, `[CALC]`, `[SYS]`).
   - `game.js:100-116`: `showTurnBanner(turn)` displays animated fullscreen turn transition banners.
   - `game.js:212-246`: `checkEndgame()` displays Victory/Defeat dialog overlays.

5. **User Input & Visual FX Mechanics**:
   - `game.js:472-544`: `setupEventListeners()` maps button clicks and keyboard shortcuts (`M`, `S`, `Space`, `E`, `1-9`, `Escape`, `Enter`).
   - `game.js:119-140`: `setUnitPose(unitId, pose, durationMs)` temporarily swaps sprites for `attack`, `hit`, and `dead` poses.
   - `game.js:143-155`: `showFloatingText(x, y, text, color)` renders floating damage numbers (`-X HP`) and miss indicators (`MISS`).
   - `game.js:160-168`: Attacker shooting recoil animation (`.shoot-recoil`).
   - `game.js:185-202`: Defender damage flash animation (`.damage-flash`).

6. **Server Logic in `server.js`**:
   - `server.js:17-126`: 6 character archetypes (`ARCHETYPES`).
   - `server.js:128-152`: `createUnit(archetypeKey, id, x, y)`.
   - `server.js:166-204`: `initGame()` generating 10x10 map and 3v3 squad positions.
   - `server.js:206-258`: `initRandomGame(playerCount, enemyCount)`.
   - `server.js:260-326`: `processEnemyTurn()` (AI turn pathfinding and shooting).
   - `server.js:328-372`: `executeShot(attacker, defender)`.
   - `server.js:390-458`: `/api/action` endpoint action validation and dispatch.

---

## 2. Logic Chain

1. **State Independence**: In `game.js`, `render()` and all sub-rendering functions operate purely on a single global `gameState` JavaScript object. The rendering logic never makes network assumptions; it merely reflects the properties inside `gameState` (grid, units, currentTurn, logs).
2. **Deterministic Mechanics**: All game rules in `server.js` (`executeShot`, `processEnemyTurn`, `createUnit`, `initGame`, `initRandomGame`, `executeAction`) are written in plain JavaScript with no native C/C++ or external database dependencies.
3. **Seamless Migration**: Therefore, moving `ARCHETYPES`, `createUnit`, `initGame`, `initRandomGame`, `executeShot`, and `processEnemyTurn` directly into `game.js` allows `sendAction` and `init` to invoke the game engine in-memory synchronously or with identical async promise signatures.
4. **Zero Visual & Behavioral Regression**: Because the underlying data model, animation timings (`shoot-recoil` 450ms, `damage-flash` 500ms, `floating-text` 1000ms, `turn-banner` 1200ms, `death-fade` 800ms), and DOM structures remain strictly unchanged, there will be zero regression in user experience or visual quality.
5. **Static Compatibility**: Eliminating `fetch()` and `http://localhost:3000` enables `index.html` to run entirely client-side when opened directly in a browser or deployed to static hosts like Vercel.

---

## 3. Caveats

1. **Headless Test Adaptations**: Existing test scripts (`tests/tier1_features.test.js`, `tests/validate_dom_network.js`, etc.) currently spawn `server.js` and call HTTP endpoints. The testing suite will need to be updated to load `index.html` directly or invoke the in-memory engine hooks.
2. **Global Test Hooks Requirement**: In order for automated headless scripts (via Chrome DevTools Protocol or DOM evaluation) to inspect the game state without HTTP routes, `game.js` must expose explicit global properties (`window.__ACOM_ENGINE__`, `window.gameState`, `window.initGame`, `window.initRandomGame`, `window.fetchState`).

---

## 4. Conclusion

The frontend client architecture is fully mapped and cataloged in `/Users/user/src/acom/.agents/explorer_static_2/analysis.md`. The path to complete server decoupling is clean, high-confidence, and risk-free:
1. Embed the 6 character archetypes, procedural map generation, action validation, combat hit calculations, and enemy AI heuristics from `server.js` into an in-memory `AcomEngine` module within `game.js`.
2. Replace HTTP `fetch()` calls in `init()`, `fetchState()`, and `sendAction()` with direct in-memory engine method invocations.
3. Expose standard test hooks on `window`.
4. Decouple static preview so `index.html` runs seamlessly anywhere without Node.js.

---

## 5. Verification Method

Once implemented, the static decoupling can be independently verified via:

1. **Headless File Execution**:
   - Open `index.html` directly via headless Chrome or static server (`python3 -m http.server 8080` / `file:///Users/user/src/acom/index.html`).
   - Confirm zero 404 network errors and zero console errors.
2. **DOM Spawning & Roster Verification**:
   - Verify that 3 ally cards render in `#squad-dock`, 6 units spawn with high-res sprites and shadows in `#units-layer`, and 100 cells render in `#grid-container`.
3. **Gameplay Action Execution**:
   - Execute a move action $\rightarrow$ verify unit coordinates update, AP decrements, and `.log-entry` appears in Combat Terminal.
   - Execute a shoot action $\rightarrow$ verify recoil animation, damage flash, floating text, and HP meter updates.
   - Pass turn $\rightarrow$ verify `ALIEN ACTIVITY` banner appears, enemy AI executes movement and attacks, and initiative returns to player with refreshed AP.
4. **Endgame Trigger Verification**:
   - Defeat all enemies $\rightarrow$ verify Mission Accomplished victory modal appears.
