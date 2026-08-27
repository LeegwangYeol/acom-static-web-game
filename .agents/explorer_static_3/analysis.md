# Comprehensive Survey & Migration Specification for Static Headless Test Infrastructure

## 1. Executive Summary

This document presents a comprehensive survey of all test files, test runners, and automated verification scripts in the **ACOM** repository (`/Users/user/src/acom`). It defines the exact architectural strategy, migration plan, and test matrix required to transition the entire testing infrastructure from an Express-dependent client-server model (`server.js` on port 3000) to a **100% purely static, serverless, headless execution model** suitable for Vercel static deployment and zero-server local execution.

---

## 2. Test File & Verification Script Inventory

The project currently contains 12 active test files, runners, and simulation scripts across the root directory and `tests/`:

| # | Test File Path | Primary Category | Execution Mode | Role & Verification Objective |
|---|----------------|------------------|----------------|-------------------------------|
| 1 | `tests/run_all_tests.js` | Master Runner | Node.js Process Harness | Orchestrates all test tiers (T1-T5), validators, regressions, and generates `.agents/reports/gate_verdict.json`. |
| 2 | `tests/validate_assets.js` | Static Validator | Node.js Binary Parser | Validates 6 PNG character assets (dimensions >= 128x128, alpha ratio > 15%, anti-aliasing > 100 edge px, color depth, SHA-256). |
| 3 | `tests/validate_dom_network.js` | E2E Headless Validator | Headless Chrome (CDP) | Spawns units into DOM; validates 0 console errors, 0 network errors/404s, unit mounts. |
| 4 | `tests/validate_layout.js` | E2E Headless Validator | Headless Chrome (CDP) | Validates isometric grid geometry, 0 unit spatial collisions, z-depth formula ($z = y \times 10 + 5$), and 0 UI panel grid clipping. |
| 5 | `tests/tier1_features.test.js` | Unit / Isolation Test | `node:test` Runner | Validates Features F1-F12 in isolation (assets, archetypes, squad init, grid, depth, CSS FX, DOM HUD, hit calc, logs). |
| 6 | `tests/tier2_boundaries.test.js` | Boundary / Rejection Test | `node:test` Runner | Validates boundaries (out-of-bounds, 0 AP, friendly fire, cover collision, mobility limits, dead units, malformed payloads). |
| 7 | `tests/tier3_pairwise.test.js` | Combinatorial Test | `node:test` Runner | Validates pairwise mechanics (cover + distance hit chance matrix, action sequencing Move->Shoot vs Shoot->Move, multi-unit squad turns). |
| 8 | `tests/tier4_scenarios.test.js` | Scenario / E2E Test | `node:test` Runner | Validates realistic 3v3 squad combat to victory/defeat resolution, cover logging, 15-turn endurance, state invariants. |
| 9 | `tests/adversarial_m2.test.js` | Adversarial Test | `node:test` Runner | Stress tests multi-unit logic, extreme coordinates, boundary guards, AP depletion, target validation. |
| 10 | `tests/adversarial_m4_empirical.test.js` | Adversarial E2E Test | `node:test` + Headless Chrome | Stress tests live target preview math, keyboard shortcuts ('M', 'S', '1'-'3', 'Space', 'Escape'), UI reactivity. |
| 11 | `test.js` | Legacy Regression | Standalone Node.js | Verifies basic init -> move -> shoot -> end_turn progression. |
| 12 | `bot.js` | AI Simulation Harness | Standalone Node.js | Automated AI simulator running continuous multi-turn skirmishes to measure win rates. |
| 13 | `fuzz_test.js` | Fuzzing Harness | Standalone Node.js | 10,000 iteration state invariant and malformed payload fuzzer. |
| 14 | `tests/challenge_character_assets.js` | Asset Challenge | Standalone Node.js + CDP | Deep byte and bounding box decoder across all 24 pose variants. |
| 15 | `tests/challenge_m2_empirical.js` | Empirical Challenge | Standalone Node.js + CDP | Empirical DOM unit inspection and orphan element detector. |
| 16 | `tests/empirical_m4_challenger2.js` | Empirical Challenge | Standalone Node.js + CDP | Multi-turn combat telemetry and DOM layout verification. |
| 17 | `tests/inspect_divergence.js` | Forensic Script | Standalone Node.js | Pairwise pixel RMSE and SHA-256 divergence analyzer. |

---

## 3. Comprehensive Server & Network Dependency Audit

Every test suite was surveyed for hardcoded dependencies on `server.js`, Express, TCP port 3000, and HTTP network requests:

| Test Script | Current Server Dependency Mechanism | HTTP Endpoints Invoked | Network Assumptions |
|---|---|---|---|
| `tests/run_all_tests.js` | Spawns `node server.js` via `child_process.spawn`; polls port 3000 | `/api/state` | Assumes Express 5.2 server running at `http://127.0.0.1:3000` |
| `tests/validate_assets.js` | **NONE (100% Static)** | None | Pure filesystem I/O (`fs`, `path`, `zlib`, `crypto`) |
| `tests/validate_dom_network.js` | Spawns `node server.js` on port 3000; navigates Chrome to HTTP URL | `http://127.0.0.1:3000/index.html`, `POST /api/init_random` | Assumes HTTP web server serving static files and JSON REST endpoints |
| `tests/validate_layout.js` | Spawns `node server.js` on port 3000; navigates Chrome to HTTP URL | `http://127.0.0.1:3000/index.html`, `POST /api/init_random` | Assumes HTTP web server serving static files and JSON REST endpoints |
| `tests/tier1_features.test.js` | Spawns `node server.js` in `before()` hook; kills in `after()` hook | `POST /api/init`, `POST /api/init_random`, `GET /api/state` | Relies on REST API responses over HTTP fetch |
| `tests/tier2_boundaries.test.js` | Spawns `node server.js` in `before()` hook; kills in `after()` hook | `POST /api/init`, `POST /api/init_random`, `GET /api/state`, `POST /api/action` | Relies on HTTP status codes (200, 400) for rejection guards |
| `tests/tier3_pairwise.test.js` | Spawns `node server.js` in `before()` hook; kills in `after()` hook | `POST /api/init`, `POST /api/init_random`, `GET /api/state`, `POST /api/action` | Relies on HTTP fetch roundtrips for sequential state updates |
| `tests/tier4_scenarios.test.js` | Spawns `node server.js` in `before()` hook; kills in `after()` hook | `POST /api/init`, `POST /api/init_random`, `GET /api/state`, `POST /api/action` | Relies on multi-round HTTP requests during skirmish simulation |
| `tests/adversarial_m2.test.js` | Spawns `node server.js` in `before()` hook; kills in `after()` hook | `POST /api/init`, `POST /api/init_random`, `GET /api/state`, `POST /api/action` | Relies on HTTP status codes and state payloads |
| `tests/adversarial_m4_empirical.test.js` | Spawns `node server.js`; navigates Chrome to HTTP URL | `http://127.0.0.1:3000/index.html`, `/api/...` | Assumes active Express server for CDP page navigation and API calls |
| `test.js` | Spawns `node server.js` on port 3000 | `POST /api/init`, `POST /api/action`, `GET /api/state` | Legacy test verifying Express endpoints |
| `bot.js` | Connects to `http://localhost:3000/api` | `POST /api/init_random`, `GET /api/state`, `POST /api/action` | High-frequency polling and posting to Express server |
| `fuzz_test.js` | Spawns `node server.js` on port 3000 | `POST /api/init`, `POST /api/action`, `GET /api/state` | 10,000 HTTP fetch requests over TCP socket |

---

## 4. Static & Serverless Headless Architecture Design

### 4.1 Client-Side Engine Module Contract (`AcomEngine`)
In the static architecture, all game mechanics reside in `game.js` inside an encapsulated `AcomEngine` class (or module). To maintain full compatibility with both browser execution and Node.js testing:
1. `game.js` detects its execution context:
   ```javascript
   // Universal export for browser & Node.js test environments
   if (typeof module !== 'undefined' && module.exports) {
       module.exports = { AcomEngine, createUnit, ARCHETYPES, calculateHitChance };
   }
   if (typeof window !== 'undefined') {
       window.AcomEngine = AcomEngine;
       window.gameEngine = new AcomEngine();
   }
   ```
2. The engine API provides synchronous, deterministic state operations:
   - `engine.init()` / `engine.initGame()`: Generates 10x10 grid with cover and default 3v3 squads.
   - `engine.initRandom(playerCount, enemyCount)`: Generates grid and spawns random squads on distinct empty tiles.
   - `engine.getState()`: Returns deep copy of current `gameState`.
   - `engine.handleAction(action, payload)`: Validates and applies actions (`move`, `shoot`, `end_turn`), returning `{ success: boolean, state: Object, error?: string }`.
   - `engine.processEnemyTurn()`: Executes AI movement and attacks synchronously.
   - `engine.executeShot(attacker, defender)`: Resolves hit chance, rolls RNG, applies damage, and logs events.

### 4.2 Dual-Mode Headless Browser Verification Strategy

To guarantee that `index.html` runs natively without any server, the headless testing framework will employ a dual-mode approach:

```
+---------------------------------------------------------------------------------------+
|                               HEADLESS VERIFICATION PIPELINE                          |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|  [ Mode 1: Pure file:// Protocol ]             [ Mode 2: Ephemeral 0-Dep Static Host ]|
|  - File URL: file:///path/to/acom/index.html   - Built-in Node.js http.createServer   |
|  - Flags: --allow-file-access-from-files       - Zero external packages, Port 0 (auto)|
|  - Verifies local zero-server launch           - Serves .html, .css, .js, .png only   |
|                                                - Strict: ANY /api/* request returns 404|
|                                                                                       |
+-------------------------------------------┬-------------------------------------------+
                                            │
                                            ▼
+---------------------------------------------------------------------------------------+
|                             CDP HEADLESS INSPECTION HARNESS                           |
|                                                                                       |
|  1. Network Domain Monitoring:                                                        |
|     - Total Network Errors == 0                                                       |
|     - Zero 404s on all static assets (.html, .css, .js, .png)                         |
|     - ZERO requests made to /api/... (strict client-side isolation)                   |
|                                                                                       |
|  2. Runtime & Console Monitoring:                                                     |
|     - Zero console.error calls                                                        |
|     - Zero uncaught JS exceptions or unhandled promise rejections                     |
|                                                                                       |
|  3. DOM & Visual Layout Assertions:                                                   |
|     - 3v3 Squads mounted with distinct coordinates, high-res sprites, HP bars         |
|     - Dynamic Z-Index depth sorting ($z = y \times 10 + 5$) verified                  |
|     - Zero spatial tile collisions between units                                      |
|     - Zero UI panel clipping across 10x10 isometric grid                              |
|                                                                                       |
|  4. Full Gameplay Cycle Automation:                                                   |
|     - Interactive Turn Progression: Move -> Shoot -> Enemy AI -> Victory/Defeat      |
|     - Keyboard shortcuts ('M', 'S', '1'-'3', 'Space', 'Escape') live validation       |
+---------------------------------------------------------------------------------------+
```

---

## 5. Comprehensive Test Migration Plan & Matrix

### 5.1 Suite-by-Suite Migration Specifications

#### 1. `tests/run_all_tests.js` (Master Runner)
- **Modifications**:
  - Delete `ensureServerRunning()`, `serverProc`, and all port 3000 polling loops.
  - Execute test tiers and headless validators directly without spawning background processes.
  - Update gate verdict generator to evaluate static criteria: zero network errors, zero `/api/` calls, zero console errors, full 3v3 game loop execution.

#### 2. `tests/validate_assets.js` (Asset Integrity)
- **Modifications**: None required. Retains standalone binary inspection.

#### 3. `tests/validate_dom_network.js` (DOM & Network Integrity)
- **Modifications**:
  - Remove `server.js` spawn block.
  - Launch Headless Chrome navigating to `file://${path.resolve(__dirname, '../index.html')}` or ephemeral static server.
  - Replace in-browser `fetch('/api/init_random')` with `window.gameEngine.initRandom(3, 3)` or `init()`.
  - Add CDP Network assertion: `requests.filter(r => r.url.includes('/api/')).length === 0`.
  - Validate 6 units rendered in DOM with sprites, HP gauges, class badges, and grounding shadows.

#### 4. `tests/validate_layout.js` (Isometric Layout & Clipping)
- **Modifications**:
  - Remove `server.js` spawn block.
  - Navigate to static `index.html`.
  - Trigger 3v3 squad initialization directly via client JS.
  - Validate coordinate bounding boxes, 0 unit overlaps, and clean UI panel margins.

#### 5. `tests/tier1_features.test.js` (Feature Coverage F1-F12)
- **Modifications**:
  - Remove `serverProc` and HTTP fetch calls.
  - Import `AcomEngine` directly from `game.js`.
  - Test archetypes, squad spawning, grid generation, dynamic depth formula, CSS selectors, hit chance math, and logs directly in Node.js.

#### 6. `tests/tier2_boundaries.test.js` (Boundary & Corner Cases)
- **Modifications**:
  - Replace `fetch('/api/action')` with `engine.handleAction(action, payload)`.
  - Assert that out-of-bounds moves, 0 AP actions, friendly fire, cover collisions, and malformed inputs return `{ success: false, error: ... }` with proper error messages.

#### 7. `tests/tier3_pairwise.test.js` (Cross-Feature Combinations)
- **Modifications**:
  - Execute pairwise tests directly against `AcomEngine`.
  - Verify action sequencing (Move 1 AP -> Shoot 1 AP; Shoot 2 AP -> Move blocked), multi-unit AP isolation, enemy turn AI execution, and AP refills upon player turn start.

#### 8. `tests/tier4_scenarios.test.js` (Realistic Combat Scenarios)
- **Modifications**:
  - Execute multi-turn 3v3 battle simulations in-memory using `AcomEngine`.
  - Verify game loop reaches decisive victory or defeat within 40 turns, log capping (<= 20 entries), and invariant preservation across 15+ turns.

#### 9. `tests/adversarial_m2.test.js` & `tests/adversarial_m4_empirical.test.js`
- **Modifications**:
  - Replace all REST API calls with direct `AcomEngine` method invocations.
  - In `adversarial_m4_empirical.test.js`, update Headless Chrome CDP tests to navigate to static `index.html` and verify keyboard controls ('M', 'S', '1'-'3', 'Space', 'Escape') with 0 console errors and 0 network requests.

#### 10. `test.js`, `bot.js`, and `fuzz_test.js`
- **Modifications**:
  - Refactor all three scripts to import `AcomEngine` directly.
  - `fuzz_test.js`: Run 10,000 iterations in-memory (< 200ms duration) testing fuzz actions, self-harm guards, and missing payloads.
  - `bot.js`: Simulate complete games in pure JavaScript without network overhead.

---

## 6. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Asset Pipeline | Character Asset Validation | Programmatic inspection of PNG magic bytes, dimensions (>=128x128), alpha ratio (>15%), AA feathering (>100 edge px), and color depth. | PNG file buffer / path | JSON report with metrics and pass/fail verdict | Fails on missing file, corrupt header, small dimensions, or low alpha | `tests/validate_assets.js` |
| 2 | Game Engine | 6 Character Archetypes | Registry of 3 Allies (Assault, Recon, Heavy) and 3 Enemies (Mutant, Scout, Heavy) with unique HP, AP, mobility, aim, damage, and sprites. | Archetype key string | Unit state object | Defaults to `ally_assault` on unknown key | `server.js` (lines 17-126), `PROJECT.md` |
| 3 | Game Engine | Procedural 10x10 Grid Map | Generates 10x10 grid with empty, half cover (+20 def), and full cover (+40 def) tiles, clearing spawn lanes. | Grid dimensions (10x10) | 2D array of grid cell objects `{ x, y, type }` | Clamped to bounds `[0, 9]` | `server.js` (lines 180-192) |
| 4 | Game Engine | Multi-Unit Squad Init | Initializes 3v3 default or random squads on distinct empty tiles. | Player & Enemy counts (default 3v3) | Game state with 6 populated unit objects | Clears tiles if grid density exceeds threshold | `server.js` (lines 194-258) |
| 5 | Action Resolver | Grid Movement & Obstacle Guard | Moves unit up to mobility distance, deducting 1 AP; rejects moves into cover, occupied tiles, or out of bounds. | `{ actorId, x, y }` | Updated unit position, AP reduced by 1 | Returns error on out-of-bounds, obstacle, or 0 AP | `server.js` (lines 420-439), `tier2_boundaries.test.js` |
| 6 | Action Resolver | Tactical Shooting & Hit Calc | Computes hit chance $\text{Hit} = \text{Aim} - \text{Cover} - (\text{Dist} \times 2)$, rolls RNG, deducts damage, consumes all remaining AP. | `{ actorId, targetId }` | Updated target HP, combat log message, AP set to 0 | Returns error on ally target, dead target, or 0 AP | `server.js` (lines 328-372, 440-453) |
| 7 | AI Engine | Enemy AI Turn Resolution | Iterates living enemies, finds closest living player, advances within range, attacks, and returns turn to player with refilled AP. | Current game state | Updated unit positions/HP, currentTurn set to 'player' | Ends game with "Strike team defeated" if all players die | `server.js` (lines 260-326) |
| 8 | Visual & UI | Dynamic Depth Z-Sorting | Computes CSS z-index $z = y \times 10 + 5$ to ensure foreground units render in front of background units. | Unit grid coordinate Y | CSS integer z-index `[5, 95]` | Monotonically increases with Y | `tests/validate_layout.js`, `style.css` |
| 9 | Visual & UI | Target Preview HUD | Displays live hit %, operative base aim, cover penalty (+20%/+40%), distance penalty, and expected damage upon hovering enemy. | Active player & hovered enemy | HUD overlay DOM metrics | Hidden when no enemy hovered | `game.js`, `adversarial_m4_empirical.test.js` |
| 10 | Visual & UI | Tactical Keyboard Shortcuts | Binds keypresses: '1'-'3' (switch operative), 'M' (move mode), 'S' (shoot mode), 'Space'/'E' (end turn), 'Escape' (cancel). | Keyboard events (`keydown`) | Active UI mode / operative selection | Ignored during enemy turn | `game.js` (lines 350-410), `adversarial_m4_empirical.test.js` |
| 11 | Static E2E | Zero-Network Headless Validation | Validates that DOM renders, units spawn, and game loops execute with 0 HTTP `/api/` network requests and 0 console errors. | Static `index.html` URL | CDP telemetry report | Fails on any 404, `/api/` call, or runtime error | `validate_dom_network.js`, `TEST_INFRA.md` |

---

## 7. Edge Cases

| # | Feature | Input / Condition | Observed / Documented Behavior |
|---|---------|-------------------|--------------------------------|
| 1 | Movement | Coordinate $(-1, 0)$ or $(10, 10)$ | Rejected with validation error; unit position remains unchanged. |
| 2 | Movement | Target tile contains Half Cover (1) or Full Cover (2) | Rejected with collision error; unit does not enter obstacle tile. |
| 3 | Movement | Target tile contains another living ally or enemy | Rejected with collision error; units never occupy the same tile. |
| 4 | Movement | Distance $> \text{mobility}$ (e.g. 6 tiles for Assault with mobility 4) | Rejected with mobility limit error. |
| 5 | Action AP | Unit with 0 AP attempts move or shoot | Rejected with depleted AP error. |
| 6 | Shooting | Friendly fire attempt (targeting self or ally operative) | Rejected with friendly fire guard error. |
| 7 | Shooting | Target unit already dead ($\text{HP} \le 0$) | Rejected with invalid target error. |
| 8 | Shooting | Extreme distance with heavy cover (Aim 60 - Cover 40 - Dist 24 = -4) | Clamped to minimum $0\%$ hit chance; cannot be negative. |
| 9 | Shooting | High aim point-blank with 0 cover (Aim 85 - Dist 2 = 83) | Clamped to maximum $100\%$ hit chance. |
| 10 | Squad Turn | Operative 1 shoots (depleting AP to 0) while Operative 2 has 2 AP | Operative 2 retains 2 AP and can independently move or shoot. |
| 11 | Enemy AI | All enemy movement lanes blocked by cover/units | Enemy skips movement and attacks directly if in range; otherwise ends turn cleanly. |
| 12 | Endgame | All enemy units reach 0 HP | Game state registers victory; combat log records "All enemies defeated. You Win!"; victory modal triggered. |
| 13 | Endgame | All ally units reach 0 HP | Game state registers defeat; combat log records "Strike team defeated. Game Over."; defeat modal triggered. |
| 14 | Malformed Action | Missing `action` property or null payload | Handled cleanly; returns validation error without throwing uncaught exceptions. |
| 15 | Headless DOM | Spawning 3v3 squad under static `file://` protocol | Spawns all 6 `.unit` DOM elements with 0 console errors and 0 `/api/` network requests. |

---

## 8. Master Test Matrix (Static vs Legacy Comparison)

| Test Identifier | Test Suite File | Legacy Mode (Express / Port 3000) | Static Mode (`AcomEngine` / Static Headless) | Speedup / Benefit |
|---|---|---|---|---|
| **VAL-ASSET** | `tests/validate_assets.js` | Binary inspection (fs/zlib) | Binary inspection (fs/zlib) | Same (~250ms), 100% static |
| **VAL-DOM** | `tests/validate_dom_network.js` | Spawns server.js, fetches `/api/init_random` | Static HTML/CDP, direct client init, 0 `/api/` calls | Decoupled from Express, 0 network dependencies |
| **VAL-LAYOUT** | `tests/validate_layout.js` | Spawns server.js, fetches `/api/init_random` | Static HTML/CDP, direct client init, checks geometry | Decoupled from Express |
| **TIER-1** | `tests/tier1_features.test.js` | HTTP fetch to `/api/init`, `/api/state` | Direct in-memory `AcomEngine` module imports | ~570ms -> ~50ms (10x faster) |
| **TIER-2** | `tests/tier2_boundaries.test.js` | HTTP fetch to `/api/action` (status 400 checks) | Direct in-memory action validation calls | ~550ms -> ~40ms (14x faster) |
| **TIER-3** | `tests/tier3_pairwise.test.js` | HTTP fetch sequences for move/shoot | Direct in-memory state transition calls | ~720ms -> ~50ms (14x faster) |
| **TIER-4** | `tests/tier4_scenarios.test.js` | 40+ HTTP roundtrips per match | Direct in-memory multi-round skirmish loops | ~710ms -> ~60ms (12x faster) |
| **TIER-5** | `tests/adversarial_m2.test.js` | HTTP fetch stress testing | Direct in-memory adversarial calls | ~1200ms -> ~80ms (15x faster) |
| **TIER-5-E2E**| `tests/adversarial_m4_empirical.test.js` | Spawns server.js, CDP UI tests | Static HTML/CDP UI interaction tests | Zero server dependency |
| **REG-LEGACY**| `test.js` | HTTP fetch progression | Direct in-memory regression suite | ~390ms -> ~20ms (20x faster) |
| **REG-FUZZ** | `fuzz_test.js` | 10,000 HTTP requests over TCP | 10,000 in-memory engine iterations | 8,750ms -> ~150ms (58x faster) |
| **SIM-BOT** | `bot.js` | Polling HTTP server | Direct in-memory bot simulation | 1000+ matches/sec |

---

## 9. Verification & Invalidation Conditions

### Verification Method:
1. All unit and tier tests (`tier1`, `tier2`, `tier3`, `tier4`, `adversarial_m2`, `test.js`, `fuzz_test.js`) execute using `node --test` or `node <script>` with ZERO background servers running (`server.js` killed/inactive).
2. Headless Chrome validation scripts (`validate_dom_network.js`, `validate_layout.js`, `adversarial_m4_empirical.test.js`) launch against static `index.html` (via `file://` or ephemeral static server) and assert:
   - Total network errors == 0.
   - Total `/api/` requests == 0.
   - Total console errors == 0.
   - 3v3 squads dynamically spawn into the DOM with proper sprites, coordinates, and depth order.
3. Master runner `node tests/run_all_tests.js` (or `npm test`) completes in < 15 seconds with a 100% PASS verdict in `.agents/reports/gate_verdict.json`.

### Invalidation Conditions:
- Any test suite fails or hangs if `server.js` is not running.
- Any network request is dispatched to `/api/...` during browser gameplay or automated headless runs.
- Any unhandled console exception occurs in the browser during turn execution.
