# Comprehensive Specification Mining & Test Infrastructure Survey Report

**Agent**: `explorer_survey_3` (Specification Miner & Test Infrastructure Specialist)  
**Target Repository**: `/Users/user/src/acom`  
**Authoritative Reference**: `/Users/user/src/acom/.agents/ORIGINAL_REQUEST.md`  
**Date**: 2026-08-26  

---

## Executive Summary
This survey establishes the complete testing, verification, and acceptance specification for overhauling the XCOM-style web tactical game to a high-resolution 2D illustration aesthetic with 6 distinct characters (3 allies, 3 enemies). We define mathematical and algorithmic metrics for non-pixel-art asset validation, headless DOM/network integrity, isometric layout collision/clipping boundaries, a comprehensive 4-Tier E2E test suite (Feature Coverage, Boundary/Corner Cases, Cross-Feature Combinations, Real-World Scenarios), and zero-dependency headless validation scripts outputting structured JSON for the Gate and Forensic Auditor.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Asset Integrity | High-Res PNG Asset Validator | Algorithmic checker verifying >=6 distinct transparent PNG assets with non-pixel-art illustration characteristics | File paths (`assets/*.png`) | JSON `{ valid, width, height, hasAlpha, sha256, uniqueOpaqueColors, intermediateAlphaRatio, isNonPixelArt }` | Returns `valid: false` with specific reason if corrupt, non-PNG, or missing alpha | Code inspection & PNG parsing probe (`test_asset_validator.js`) |
| 2 | Asset Rendering | Isometric Sprite Scaling & Anchor System | CSS transform / absolute positioning layer placing unit sprites above tile base without visual drift | Cell size (60px), Grid coordinates `(x, y)` | CSS `left`, `top`, `z-index`, `transform: translateZ(...)` | Units misalign if cell size CSS variable differs between root and script | `game.js:120-190`, `style.css:161-205` |
| 3 | Game Server | Multi-Character Roster Spawning | Backend API endpoint supporting custom squad compositions (3 allies, 3 enemies) | `POST /api/init_random` with `{ players: 3, enemies: 3 }` or customized roster payload | Updated `gameState` with 6 unit objects having distinct IDs and stats | 400 Bad Request on invalid counts or full board | `server.js:63-111` |
| 4 | Game Server | Movement & AP Deduction Engine | Manhattan distance path validation within unit mobility range, deducting 1 AP | `POST /api/action` with `{ action: 'move', payload: { actorId, x, y } }` | `gameState` with updated unit coordinates and reduced AP | 400 Bad Request if distance > mobility, cell occupied, cell has cover, or AP = 0 | `server.js:256-269`, `test.js:25-38` |
| 5 | Game Server | Combat Shot & Cover Calculation | Hit chance formula: $\text{Hit} = \text{Aim} - \text{CoverDefense} - (\text{Distance} \times 2)$, roll against 0-100, HP damage | `POST /api/action` with `{ action: 'shoot', payload: { actorId, targetId } }` | `gameState` with updated combat logs, defender HP reduction / defeat | 400 Bad Request if invalid target, dead target, or AP = 0 | `server.js:185-218`, `server.js:270-279` |
| 6 | Game Server | Turn Transition & Enemy AI | Automatic turn switching, AP refill on player turn, greedy AI pathfinding and engagement | `POST /api/action` with `{ action: 'end_turn', payload: {} }` | `gameState` after synchronous enemy AI moves and attacks | Returns current state; triggers defeat/victory log if squad wiped | `server.js:117-183`, `server.js:240-247` |
| 7 | DOM Client | Dynamic Unit DOM Lifecycle | Creates/updates/removes unit DOM nodes with sprite, health bar fill, and selection glow | `gameState.units` array | `#units-layer` DOM tree mutations, CSS transition triggers | Stale unit elements if removal not keyed on `hp <= 0` | `game.js:120-190` |
| 8 | DOM Client | Interactive Action Highlight Grid | Dynamically tags grid cells with `.valid-move` or `.valid-target` based on selected unit AP and reach | User button click (`Move` / `Shoot`), unit state | CSS class application on `.cell` elements in `#grid-container` | Highlights fail to clear if `clearHighlights()` not called on deselection | `game.js:233-267` |
| 9 | DOM Client | Status & Unit Inspection UI | Reflects selected unit HP, Aim, Mobility, AP, and turn banner | `selectedActorId`, `gameState` | DOM updates in `#status-bar` and `#ui-panel` | Shows placeholder text if no unit selected or during enemy turn | `game.js:268-299` |
| 10 | DOM Client | Combat Log Feed | Displays timestamped/styled combat messages (damage, player action, enemy action) | `gameState.logs` array | Scrollable DOM entries in `#combat-log` with color coding | Overflows container if scroll height unmanaged | `game.js:301-319` |
| 11 | Network Integrity | Headless Network Asset Auditing | Monitors all browser HTTP requests to confirm zero 404/500 asset or resource failures | Browser network lifecycle | JSON audit log of requests, response codes, and MIME types | Fails test if any request status >= 400 | Automated CDP / Chrome DevTools Protocol probe |
| 12 | Layout Validation | Isometric Collision & Panel Clipping Checker | Verifies DOM bounding rectangles prevent UI panel overlap and sprite z-index occlusion errors | Rendered page layout (`getBoundingClientRect()`) | JSON report with intersection matrix and z-index ordering validity | Fails test if bounding boxes intersect or panel clips grid | Automated layout analysis probe |

---

## Edge Cases

| # | Feature | Input | Observed / Specified Behavior |
|---|---------|-------|-------------------------------|
| 1 | Movement Action | Move to occupied cell (unit already on tile) | Server rejects with `400 Bad Request` (`Invalid move.`); client clears selection without crashing |
| 2 | Movement Action | Move onto Full Cover or Half Cover tile | Server rejects with `400 Bad Request`; only `TILE_EMPTY` tiles are traversable |
| 3 | Movement Action | Move with distance > unit mobility | Server rejects with `400 Bad Request` |
| 4 | Movement Action | Move when unit AP = 0 | Server rejects with `400 Bad Request`; action buttons disabled in UI |
| 5 | Combat Action | Shoot ally unit or self (Friendly Fire) | Target verification fails: server verifies `target.type === 'enemy'`; returns `400 Bad Request` |
| 6 | Combat Action | Shoot already-dead enemy (`hp <= 0`) | Target verification fails (`target.hp > 0`); returns `400 Bad Request` |
| 7 | Combat Action | Shoot when unit AP = 0 | Server rejects with `400 Bad Request` |
| 8 | Turn Management | Rapid action dispatch during CSS animation | Backend is synchronous; state updates cleanly, but client must prevent race condition by locking input during pending request |
| 9 | Unit Defeat | Unit HP drops to 0 or below | Unit element removed from `#units-layer`; auto-select shifts to next available living player unit |
| 10 | Victory Condition | All enemy units reach `hp <= 0` | Server logs `"All Goombas defeated. You Win!"`; UI reflects victory state |
| 11 | Defeat Condition | All player units reach `hp <= 0` | Server logs `"Mega Man team defeated. Game Over."`; UI reflects game over |
| 12 | Asset Inspection | 8-bit sprite with hard transparent edges (e.g. current `megaman.png`) | `intermediateAlphaRatio === 0.0`, `pixelArtScore === 1.0` -> Fails non-pixel-art check |
| 13 | Asset Inspection | High-res 2D illustration with anti-aliased alpha borders | `intermediateAlphaRatio > 0.005`, `uniqueOpaqueColors > 1000` -> Passes non-pixel-art check |
| 14 | Responsive Viewport | Viewport scaled down to 1024x768 | Flexbox column layout centers `#game-container`; panels remain below map without vertical clipping |

---

## Section 1: Detailed Acceptance Criteria Specification

### 1.1 Acceptance Criterion 1: Asset Check
- **Requirement Statement**: Programmatic check confirming existence of $\ge 6$ distinct, valid transparent PNG files in project directory that are strictly non-pixel-art.
- **Quantitative Metric Formulation**:
  1. **Quantity**: Exactly or at least 6 files matching `assets/*.png` (e.g., 3 allies: `ally_1.png`, `ally_2.png`, `ally_3.png`; 3 enemies: `enemy_1.png`, `enemy_2.png`, `enemy_3.png`).
  2. **Binary Header & Chunk Integrity**:
     - Magic bytes must match: `[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]`.
     - Valid `IHDR` chunk with Color Type `6` (RGBA Truecolor with alpha) or Color Type `4` (Grayscale with alpha).
     - Non-corrupt `IDAT` stream decompressible via zlib inflate.
  3. **High-Resolution Dimensions**:
     - $\text{Width} \ge 256\text{px}$ and $\text{Height} \ge 256\text{px}$ (recommended: $512\text{px} \times 512\text{px}$ or $800\text{px} \times 800\text{px}$).
     - File size $> 15\text{ KB}$ (guards against 1x1 empty pixel placeholders).
  4. **Strict Non-Pixel-Art Verification**:
     - *Alpha Feathering Ratio ($R_\alpha$)*: Let $N_{\text{nonzero}}$ be the count of pixels with $\alpha > 0$, and $N_{\text{intermediate}}$ be the count of pixels with $0 < \alpha < 255$.
       $$R_\alpha = \frac{N_{\text{intermediate}}}{N_{\text{nonzero}}}$$
       For pixel-art / hard-cutout sprites, $R_\alpha \approx 0.0000$ (binary alpha). For high-resolution 2D illustrations, $R_\alpha \ge 0.005$ (anti-aliased outer silhouettes and smooth transparencies).
     - *Unique Color Space Richness ($C_{\text{unique}}$)*: High-resolution illustrations with soft shading have $C_{\text{unique}} \ge 1,000$ distinct RGB colors, whereas 8-bit/16-bit sprites typically have $\le 256$ colors.
  5. **Uniqueness**:
     - SHA-256 content hashes of all 6 assets must be pairwise distinct ($\text{Hash}_i \ne \text{Hash}_j$ for all $i \ne j$).

### 1.2 Acceptance Criterion 2: DOM & Network Integrity
- **Requirement Statement**: Automated script loads the game, verifies that all 6 characters can be dynamically spawned into the DOM, and confirms zero 404 network errors or console errors during rendering.
- **Verification Criteria**:
  1. **HTTP Status Codes**: All HTTP requests initiated by the browser (HTML, CSS, JS, PNG assets) return status `200 OK` (0 requests with status $\ge 400$, specifically zero `404 Not Found`).
  2. **Console Integrity**:
     - Zero `console.error` calls.
     - Zero `console.warn` calls.
     - Zero uncaught runtime errors (`window.onerror` count = 0).
     - Zero unhandled promise rejections (`unhandledrejection` count = 0).
  3. **DOM Unit Tree Verification**:
     - Exactly 6 elements exist matching selector `#units-layer .unit`.
     - 3 ally unit DOM nodes have ally class (e.g. `.ally`, `.ally-1`, `.ally-2`, `.ally-3`).
     - 3 enemy unit DOM nodes have enemy class (e.g. `.enemy`, `.enemy-1`, `.enemy-2`, `.enemy-3`).
     - Each unit element contains a `.unit-sprite` element with resolved `background-image` or `<img>` source.
     - Each unit element contains a `.unit-hp-bar` with child `.unit-hp-fill` whose width reflects $\frac{\text{hp}}{\text{maxHp}} \times 100\%$.

### 1.3 Acceptance Criterion 3: Layout & Isometric Grid Validation
- **Requirement Statement**: Headless browser script verifies that unit HTML elements do not overlap improperly and that UI panels do not clip the isometric grid.
- **Verification Criteria**:
  1. **Unit Footprint Separation**:
     - For every pair of living units $U_a$ and $U_b$ with grid positions $(x_a, y_a) \ne (x_b, y_b)$, their tile base bounding boxes must satisfy:
       $$\text{IntersectionArea}(B_a, B_b) = 0$$
  2. **Isometric Depth Stacking (Z-Index Integrity)**:
     - For units rendered on the isometric grid, visual depth depends on vertical position $y$. Units with higher $y$ (closer to foreground) must have higher CSS `z-index` than units with lower $y$ (background), preventing sprite clipping during movement.
  3. **UI Panel Boundary Clearance**:
     - Let $R_{\text{grid}}$ be the bounding rectangle of `#map-wrapper` / `#grid-container`.
     - Let $R_{\text{ui}}$ be the bounding rectangle of `#ui-panel`.
     - The vertical separation must satisfy:
       $$R_{\text{ui}}.\text{top} \ge R_{\text{grid}}.\text{bottom} + 10\text{px}$$
     - No UI panel element may overlap, obscure, or clip any playable tile in the 10x10 isometric grid.
  4. **Viewport Fit**:
     - At desktop viewports ($1920\times 1080$, $1440\times 900$, $1280\times 800$), `#game-container` width and height must not exceed viewport dimensions without layout breakdown.

---

## Section 2: Audit of Existing Test Infrastructure & Tools

### 2.1 Existing Scripts Analysis
1. **`server.js`**:
   - Express 5.2.1 application serving static files and exposing `/api/init`, `/api/init_random`, `/api/state`, `/api/action`.
   - Current limitation: `/api/init_random` spawns units with hardcoded names `megaman_${i}` and `goomba_${i}`, lacking support for 3 distinct ally classes and 3 distinct enemy classes with specialized stats/sprites.
2. **`test.js`**:
   - Basic Node.js assert script testing 4 API calls (`init`, `move`, `shoot`, `end_turn`).
   - Evaluates only 1v1 match, lacks DOM verification, visual validation, or asset integrity checks.
3. **`fuzz_test.js`**:
   - 10,000-iteration random action fuzzer.
   - Robustly validates state machine invariants (`hp <= maxHp`, `ap >= 0`, turn transitions, 400 rejection for invalid moves/self-harm).
   - Excellent for backend regression, but does not test frontend DOM/CSS or multi-unit rosters.
4. **`bot.js`**:
   - 5-minute automated playtest loop testing win rate and pathfinding against `/api/init_random`.
   - Demonstrates server stability under repeated turn cycles.

### 2.2 Available Tooling Matrix
- **Node.js**: v25.8.1 (built-in `fetch`, `WebSocket`, `node:test`, `node:assert`, `zlib`, `crypto`).
- **Installed Chrome Browser**: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (Version 151).
- **Chrome DevTools Protocol (CDP)**: Headless browser automation via WebSocket remote debugging port without third-party npm packages.
- **macOS System Media Utilities**: `/usr/bin/sips`, `/usr/bin/file`, `/usr/bin/mdls`, `/usr/bin/jq`, `/usr/bin/bc`.
- **MCP Servers**: `chrome-devtools-mcp` tools (`click`, `navigate_page`, `take_snapshot`, `list_console_messages`, `list_network_requests`, `lighthouse_audit`).

---

## Section 3: Design of the 4-Tier E2E Test Suite

### Tier 1: Feature Coverage (Core Mechanics & Asset Rendering)
- **TC-101: 6 Character Asset Validation**:
  - Validates 3 ally PNGs (`ally_1.png`, `ally_2.png`, `ally_3.png`) and 3 enemy PNGs (`enemy_1.png`, `enemy_2.png`, `enemy_3.png`).
  - Verifies resolution $\ge 256\times 256$, RGBA color type, alpha feathering ratio $\ge 0.005$, unique colors $\ge 1,000$, pairwise unique SHA-256 hashes.
- **TC-102: Full Squad Game Initialization**:
  - Calls `POST /api/init_squad` or `/api/init_random` with 3 allies and 3 enemies.
  - Verifies server initializes 6 distinct units with correct attributes (`id`, `name`, `type`, `hp`, `maxHp`, `ap`, `mobility`, `aim`, `weaponDamage`).
- **TC-103: Dynamic DOM Spawning & Sprite Binding**:
  - Loads game in headless Chrome.
  - Verifies 6 `.unit` DOM nodes are spawned in `#units-layer`.
  - Verifies each unit has proper CSS classes, background image, and HP bars.
- **TC-104: Movement Execution & AP Cost**:
  - Selects ally, issues move command to valid adjacent tile.
  - Verifies AP drops from 2 to 1, unit DOM `left`/`top` styles animate to destination, cell highlights clear.
- **TC-105: Combat Calculation & Damage Resolution**:
  - Issues shoot command to enemy in line of sight.
  - Verifies combat calculation in combat log (Aim - Cover - Distance), AP set to 0, target HP decremented on hit, damage floating text rendered.
- **TC-106: Enemy Turn AI & AP Reset**:
  - Ends player turn, invokes enemy AI.
  - Verifies enemy units advance and attack, player turn restores with AP reset to `maxAp` (2) for all surviving allies.
- **TC-107: UI Control & Selection State**:
  - Clicking ally unit updates `#unit-info` panel with unit's stats and highlights moveable tiles on grid.

### Tier 2: Boundary & Corner Cases (Stress & Limits)
- **TC-201: Grid Edge & Corner Movements**:
  - Tests unit navigation to `(0,0)`, `(9,0)`, `(0,9)`, `(9,9)`.
  - Confirms boundary clamping prevents moving outside 10x10 grid (e.g. $x < 0$ or $x \ge 10$).
- **TC-202: Zero & Negative AP Action Rejection**:
  - Attempts `move` and `shoot` when AP = 0.
  - Verifies server returns `400 Bad Request`, UI buttons remain disabled.
- **TC-203: Friendly Fire & Self-Targeting Guard**:
  - Attempts `shoot` targeting ally unit or self.
  - Verifies rejection with `400 Bad Request`.
- **TC-204: Cover & Unit Obstacle Collision**:
  - Attempts `move` onto tile with Half Cover, Full Cover, or occupied by another unit.
  - Verifies rejection with `400 Bad Request`.
- **TC-205: Maximum Squad Density on Small Map**:
  - Spawns max capacity squads; ensures pathfinding does not lock into infinite loop when surrounding tiles are blocked.
- **TC-206: Malformed / Invalid Action Payloads**:
  - Dispatches `{ action: 'move', payload: { x: -5, y: 'abc' } }` or missing payload.
  - Verifies clean `400 Bad Request` without server unhandled exception or 500 error.

### Tier 3: Cross-Feature Combinations & State Transitions
- **TC-301: Action Sequencing (Move-Shoot vs Shoot-Move)**:
  - Validates: Move (1 AP) $\rightarrow$ Shoot (1 AP) is allowed.
  - Validates: Shoot (costs remaining AP) $\rightarrow$ Move is blocked.
- **TC-302: Multi-Unit Tactical Coordination**:
  - Moves Ally 1 to flank cover $\rightarrow$ switches selection to Ally 2 $\rightarrow$ Ally 2 shoots $\rightarrow$ switches back to Ally 1 $\rightarrow$ Ally 1 shoots $\rightarrow$ End turn.
- **TC-303: Cover Defense Calculation**:
  - Tests shot against target adjacent to Half Cover (20% defense penalty) vs Full Cover (40% defense penalty) vs Open Ground (0% defense penalty).
- **TC-304: Unit Elimination & DOM Cleanup**:
  - Reduces enemy unit HP to 0.
  - Verifies unit DOM node `#unit-${id}` is removed cleanly, combat log outputs defeat message, and game does not attempt to select dead units.
- **TC-305: Victory & Defeat State Transitions**:
  - Eliminates all 3 enemies $\rightarrow$ verifies victory banner and disabling of combat actions.
  - Eliminates all 3 allies $\rightarrow$ verifies game over banner.

### Tier 4: Real-World Application Scenarios (E2E User Journeys)
- **TC-401: Complete 3v3 Tactical Skirmish**:
  - Plays automated full match from initialization to victory condition.
  - Validates turn cycles, logs, animations, and clean termination.
- **TC-402: Headless Visual Regression & Layout Integrity**:
  - Verifies DOM layout across standard desktop viewports ($1920\times 1080$, $1440\times 900$, $1280\times 800$).
  - Asserts zero overlap between `#ui-panel` and `#grid-container`.
- **TC-403: Network & Zero-Error Console Benchmark**:
  - 100% clean network requests (0 failures, 0 404s).
  - 100% clean console logs (0 errors, 0 warnings).

---

## Section 4: Automated Validation Scripts Architecture

We specify three dedicated validation scripts and an integrated test runner:

### 4.1 Script 1: `validate_assets.js`
- **Location**: `tests/validate_assets.js`
- **Purpose**: Programmatically verifies all 6 character PNG assets against strict non-pixel-art illustration criteria.
- **Implementation Design**:
  * Scans `assets/` or project root for designated 3 ally and 3 enemy PNGs.
  * Reads PNG headers, decompressing IDAT chunks via Node `zlib`.
  * Computes dimensions, bit depth, alpha channel, intermediate alpha ratio ($R_\alpha$), unique opaque colors ($C_{\text{unique}}$), and SHA-256 hashes.
  * Asserts:
    - Count $\ge 6$
    - $W \ge 256$, $H \ge 256$
    - $\text{hasAlpha} == \text{true}$
    - $R_\alpha \ge 0.005$
    - $C_{\text{unique}} \ge 1000$
    - 6 unique SHA-256 hashes
  * Outputs structured JSON report to `.agents/reports/asset_validation_report.json`.

### 4.2 Script 2: `validate_dom_network.js`
- **Location**: `tests/validate_dom_network.js`
- **Purpose**: Headless browser verification of dynamic 6-character DOM spawning, zero 404 network errors, and zero console errors.
- **Implementation Design**:
  * Starts Chrome headlessly with `--remote-debugging-port`.
  * Enables CDP `Network`, `Page`, `Runtime`, and `Console` domains.
  * Tracks every HTTP request: asserts `response.status === 200` (zero 404/500/403).
  * Tracks every console entry: asserts zero `error` or `warn` level messages.
  * Navigates to `http://localhost:3000`, waits for game initialization.
  * Queries DOM for `#units-layer .unit`: asserts `units.length === 6`.
  * Verifies each unit has valid sprite background image, bounding box, and HP bar.
  * Outputs structured JSON report to `.agents/reports/dom_network_report.json`.

### 4.3 Script 3: `validate_layout.js`
- **Location**: `tests/validate_layout.js`
- **Purpose**: Verifies isometric grid layout, unit spatial separation, and UI panel non-clipping.
- **Implementation Design**:
  * Evaluates `getBoundingClientRect()` on `#map-wrapper`, `#grid-container`, `#ui-panel`, `#unit-info`, `#action-menu`, `#combat-log-container`, and all `.unit` elements.
  * Calculates pairwise intersection areas of unit base footprints.
  * Asserts `uiPanelRect.top >= mapWrapperRect.bottom + 10`.
  * Asserts all panel bounding boxes are fully contained within `#game-container`.
  * Verifies isometric depth stacking ($z\text{-index}$ order).
  * Outputs structured JSON report to `.agents/reports/layout_report.json`.

### 4.4 Integrated Test Runner: `run_all_tests.js`
- **Location**: `tests/run_all_tests.js` (aliased to `npm test`)
- **Execution Workflow**:
  1. Spawns Express game server on dedicated test port (e.g. 3001).
  2. Runs `validate_assets.js`.
  3. Runs backend API unit & regression tests (`test.js`).
  4. Runs headless `validate_dom_network.js`.
  5. Runs headless `validate_layout.js`.
  6. Runs backend fuzz test (`fuzz_test.js`).
  7. Consolidates all sub-reports into a single unified Gate Verdict report: `.agents/reports/gate_verdict.json`.
  8. Exits with code `0` on 100% pass, or code `1` on any failure.

---

## Section 5: Structured JSON Output Schemas for Gate & Forensic Auditor

### 5.1 Gate Verdict Schema (`.agents/reports/gate_verdict.json`)
```json
{
  "gate": "AC_TACTICAL_WEB_GAME",
  "timestamp": "2026-08-26T22:25:00.000Z",
  "verdict": "PASS",
  "summary": {
    "totalTests": 24,
    "passed": 24,
    "failed": 0,
    "durationMs": 4250
  },
  "acceptanceCriteria": {
    "assetCheck": {
      "status": "PASS",
      "assetsFound": 6,
      "allTransparent": true,
      "allHighRes": true,
      "allNonPixelArt": true,
      "reportRef": ".agents/reports/asset_validation_report.json"
    },
    "domAndNetworkIntegrity": {
      "status": "PASS",
      "unitsSpawned": 6,
      "networkErrors": 0,
      "consoleErrors": 0,
      "reportRef": ".agents/reports/dom_network_report.json"
    },
    "layoutValidation": {
      "status": "PASS",
      "unitOverlapErrors": 0,
      "gridPanelClippingErrors": 0,
      "reportRef": ".agents/reports/layout_report.json"
    }
  },
  "tierResults": {
    "tier1_featureCoverage": "PASS",
    "tier2_boundaryCorner": "PASS",
    "tier3_crossFeature": "PASS",
    "tier4_realWorldScenarios": "PASS"
  }
}
```

---

## Section 6: Key Recommendations for Implementation Team
1. **Asset Roster Architecture**:
   - Organize assets cleanly into `assets/characters/`:
     * Allies: `ally_scout.png`, `ally_heavy.png`, `ally_sniper.png` (or `megaman.png`, `roll.png`, `protoman.png`).
     * Enemies: `enemy_goomba.png`, `enemy_koopa.png`, `enemy_bowser.png`.
   - Update `style.css` to replace `image-rendering: pixelated;` with `image-rendering: auto;` or `image-rendering: -webkit-optimize-contrast;` so high-res illustration assets remain smooth.
2. **Server Roster Extension**:
   - Update `server.js` to define character archetypes with distinct stats and sprite bindings rather than generic `megaman_${i}` and `goomba_${i}`.
3. **Automated Test Infrastructure**:
   - Place all validation scripts in `tests/` directory:
     * `tests/validate_assets.js`
     * `tests/validate_dom_network.js`
     * `tests/validate_layout.js`
     * `tests/run_all_tests.js`
   - Update `package.json` scripts: `"test": "node tests/run_all_tests.js"`.
4. **Layout & CSS Polish**:
   - Add modern CSS styling (glassmorphism panels, glowing action buttons, smooth health transitions, floating combat numbers).
   - Ensure `#map-wrapper` margin and `#ui-panel` flex layout maintain strict vertical spacing without grid clipping.
