# Project: ACOM Static Client-Side Refactoring (Vercel & Serverless Compatibility)

## Architecture
The application is refactored from a stateful Express client-server architecture into a purely static, client-side web application running directly in the browser or statically hosted on Vercel / GitHub Pages.

```
+---------------------------------------------------------------------------------------------------+
|                                     Client (Browser / DOM / Vercel Static)                         |
|                                                                                                   |
|  +--------------------------+   +-------------------------------+   +--------------------------+  |
|  |     Squad Roster Dock    |   |        Isometric Grid         |   |      Command Console     |  |
|  |     - Ally Cards         |   |   - 10x10 Map Canvas          |   |   - Active Portrait      |  |
|  |     - HP/AP Gauges       |   |   - Grounding Drop Shadows    |   |   - Stat Meters          |  |
|  |     - Status Badges      |   |   - 2D High-Res Sprites       |   |   - Action Buttons       |  |
|  +--------------------------+   |   - Dynamic Y-Depth Sorting   |   +--------------------------+  |
|                                 |   - Visual Combat FX & Recoil |                                 |
|  +--------------------------+   +-------------------------------+   +--------------------------+  |
|  |    Target Diagnostics    |                                       |      Combat Terminal     |  |
|  |    - Live Ballistic %    |                                       |      - Tactical Logs     |  |
|  |    - Cover Breakdown     |                                       |      - Turn Banner FX    |  |
|  +--------------------------+                                       +--------------------------+  |
|                                               ▲                                                   |
|                                               │ Direct In-Memory JavaScript Bindings               |
|                                               ▼                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                  AcomEngine (inside game.js)                                |  |
|  |  - 6 Character Archetype Registry (3 Allies: Assault/Recon/Heavy, 3 Enemies)                |  |
|  |  - Procedural 10x10 Grid Map Generator with Cover Clearance & Spawn Allocation              |  |
|  |  - Action Validation & Dispatcher (move, shoot, end_turn)                                   |  |
|  |  - Line-of-Sight, Cover Defense (+20%/+40%), Distance Falloff & Ballistic Hit Math         |  |
|  |  - Combat Damage Resolution, Criticals & Lethal Death Handling                             |  |
|  |  - Autonomous Enemy AI Turn Engine (Targeting Heuristics, X/Y Navigation, Attack Priority)  |  |
|  |  - Turn Management, Action Point Pool & Victory/Defeat Outcome Evaluator                   |  |
|  |  - Dual Export: window.AcomEngine (Browser) & module.exports (Headless Node.js Tests)      |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | `AcomEngine` Core State & Archetypes | Encapsulate master `gameState`, 6 archetype definitions, constants, and unit factory in `game.js`. | M1 | ORIGINAL_REQUEST §R1 |
| F2 | Procedural Map & Squad Spawner | Implement 10x10 grid procedural cover generation, clear spawn zones, 3v3 default init, and random skirmish init in `AcomEngine`. | M1 | ORIGINAL_REQUEST §R1 |
| F3 | Action Validation & Movement Resolver | Validate move legality (in-bounds, integer coords, mobility, obstacle collision, AP check, occupancy) and apply state mutations in `AcomEngine`. | M1 | ORIGINAL_REQUEST §R1 |
| F4 | Ballistic Combat & Hit Calculator | Calculate cover defense (+20%/+40%), distance penalty (-2%/tile), hit chance clamp [0, 100], RNG roll, damage application, and lethal elimination in `AcomEngine`. | M1 | ORIGINAL_REQUEST §R1 |
| F5 | Autonomous Enemy AI Turn Engine | Implement enemy decision trees, closest player targeting, X-then-Y obstacle navigation, range checking, attack execution, and AP reset in `AcomEngine`. | M1 | ORIGINAL_REQUEST §R1 |
| F6 | Frontend In-Memory Decoupling | Replace all HTTP `fetch()` calls in `game.js` (`/api/init`, `/api/state`, `/api/action`) with direct in-memory `AcomEngine` dispatches. | M2 | ORIGINAL_REQUEST §R1, §R2 |
| F7 | Global Test Hooks & Compatibility Layer | Expose `window.__ACOM_ENGINE__`, `window.__ACOM_GAME__`, `window.gameState`, `window.init`, `window.fetchState`, `window.initRandomGame` for automated test suites. | M2 | ORIGINAL_REQUEST §AC1 |
| F8 | Serverless & Static Verification | Ensure `index.html` runs natively via `file://` or static CDN with 0 console errors, 0 network requests, and complete gameplay functionality. | M2 | ORIGINAL_REQUEST §R2 |
| F9 | Static Headless Test Suite & Runner | Adapt master test runner (`run_all_tests.js`) and all test suites (Tiers 1-4, headless CDP DOM & layout validators) for serverless execution. | MT | ORIGINAL_REQUEST §AC1 |
| F10 | Dual-Mode Headless Verification | Verify both direct `file://` protocol and 0-dependency ephemeral static server loading in Headless Chrome with zero 404s and zero `/api/` requests. | MT / M3 | ORIGINAL_REQUEST §AC1 |
| F11 | 100% E2E Test Suite Pass | Execute all Tiers (1-4), validators, and regressions against the static application with 100% PASS verdict. | M3 | ORIGINAL_REQUEST §AC1 |
| F12 | Adversarial Hardening (Tier 5) | Stress-test static engine with 10,000-iteration fuzzer, empirical CDP keyboard shortcut telemetry, and boundary stress tests. | M3 | ORIGINAL_REQUEST §AC1 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| MT | Static Test Infrastructure Track | Adapt test runners (`tests/run_all_tests.js`, `tests/validate_dom_network.js`, `tests/validate_layout.js`, `tests/tier1-4`) for pure static headless execution without `server.js`. | None | DONE |
| M1 | Client-Side Game State Engine Migration | Port 6 archetypes, 10x10 map generation, 3v3 squad spawning, action validation, cover/hit math, damage resolution, and enemy AI into `AcomEngine` in `game.js`. | None | DONE |
| M2 | Frontend In-Memory Decoupling & Serverless Compatibility | Decouple `game.js` from Express/fetch, wire UI to `AcomEngine`, expose test hooks, and verify zero server dependencies. | M1 | DONE |
| M3 | Final Milestone: 100% E2E Pass & Adversarial Hardening | Execute full static test suite (Tiers 1-4), headless CDP validators, Tier 5 fuzzer, and multi-agent review/adversarial gate. | MT, M2 | DONE |

## Interface Contracts

### `AcomEngine` Client-Side API (`game.js`)

#### Class Signature
```javascript
class AcomEngine {
  constructor();
  init();                                         // Default 3v3 squad initialization
  initRandom(playerCount = 3, enemyCount = 3);    // Custom squad size skirmish initialization
  getState();                                     // Deep clone snapshot of current gameState
  handleAction(action, payload);                  // Dispatch action ('move' | 'shoot' | 'end_turn')
  calculateCoverDefense(defender);                // Returns 0, 20, or 40
  calculateHitChance(attacker, defender);         // Returns clamped integer [0, 100]
  executeShot(attacker, defender);                // Damage, lethal check, win/loss check
  processEnemyTurn();                             // Autonomous enemy AI navigation & attack loop
}
```

#### Universal Module Export Contract
```javascript
// Browser & Node.js Universal Compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AcomEngine, createUnit, ARCHETYPES, calculateHitChance };
}
if (typeof window !== 'undefined') {
  window.AcomEngine = AcomEngine;
  window.gameEngine = new AcomEngine();
}
```

## Code Layout
```
/Users/user/src/acom/
├── assets/
│   └── characters/
│       ├── ally_assault.png      # High-res 2D illustration (Ally Assault Ranger)
│       ├── ally_recon.png        # High-res 2D illustration (Ally Recon Scout)
│       ├── ally_heavy.png        # High-res 2D illustration (Ally Heavy Juggernaut)
│       ├── enemy_mutant.png      # High-res 2D illustration (Enemy Bioweapon Mutant)
│       ├── enemy_scout.png       # High-res 2D illustration (Enemy Stealth Infiltrator)
│       └── enemy_heavy.png       # High-res 2D illustration (Enemy Cyber Enforcer)
├── index.html                    # Static tactical HUD HTML (Runs directly in browser / Vercel)
├── style.css                     # Sci-fi tactical stylesheet, isometric rendering, UI themes
├── game.js                       # Consolidated client-side engine (AcomEngine) & HUD View Controller
├── package.json                  # Scripts: "test": "node tests/run_all_tests.js"
├── tests/
│   ├── run_all_tests.js          # Master static test runner (Zero background server requirement)
│   ├── validate_assets.js        # Programmatic PNG and non-pixel-art integrity check
│   ├── validate_dom_network.js   # Headless Chrome DOM spawn & 0 network / 0 /api/ call validator
│   ├── validate_layout.js        # Headless Chrome isometric layout & panel non-clipping check
│   ├── tier1_features.test.js    # Tier 1 In-Memory Feature Coverage test suite
│   ├── tier2_boundaries.test.js  # Tier 2 Boundary & Rejection test suite
│   ├── tier3_pairwise.test.js    # Tier 3 Cross-Feature Combination test suite
│   ├── tier4_scenarios.test.js   # Tier 4 Real-World Multi-Turn Combat Scenario test suite
│   ├── adversarial_static_challenger1.js # Tier 5 Adversarial Math & Boundary Harness (22/22 PASS)
│   └── adversarial_m4_empirical.test.js # Tier 5 Headless CDP Keyboard & UI Stress test suite
└── .agents/                      # Orchestrator metadata, plans, and reports
```
