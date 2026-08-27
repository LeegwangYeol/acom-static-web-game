# Milestone 2 Review & Adversarial Critique Report

## 1. Observation
- **Core Feature Implementation**:
  - `server.js` lines 17–126: Defined 6 complete character archetypes (`ally_assault`, `ally_recon`, `ally_heavy`, `enemy_mutant`, `enemy_scout`, `enemy_heavy`) with unique HP, AP, mobility, aim, weaponDamage, range, hitChance, portraits, and sprites.
  - `server.js` lines 166–204: `initGame()` spawns full 3v3 squads with free movement lanes and clears spawn coordinates in `clearPositions` from random cover placement.
  - `server.js` lines 206–258: `initRandomGame()` supports arbitrary squad sizes with collision-free tile selection.
  - `server.js` lines 407–418: Added backward-compatibility fallback for `payload.actorId` defaulting to the active player with available AP.
  - `style.css` lines 210–225: `.unit-sprite` positioned with bottom-center anchor (`bottom: 8px; left: 50%; transform: translateX(-50%)`), `image-rendering: auto`, and aspect ratio preservation.
  - `style.css` lines 186–204: `.unit-shadow` renders grounding radial-gradient drop shadows beneath units, with enhanced glow when selected.
  - `game.js` lines 260–262: Implemented dynamic Y-depth sorting via `zIndex = (unit.y * 10 + 5) + (unit.id === selectedActorId ? 100 : 0)`.
  - `game.js` & `style.css`: Implemented action poses (`setUnitPose`), shooting recoil animation (`@keyframes shoot-recoil`), damage flash (`@keyframes damage-flash`), floating combat text (`showFloatingText`), and death fading (`@keyframes death-fade`).
- **Test Executions**:
  - Standalone executions:
    - `node tests/validate_assets.js`: PASS (6/6 assets valid, non-pixel-art).
    - `node tests/validate_dom_network.js`: PASS (Headless Chrome DOM verified, 0 network 404s, 0 console errors).
    - `node tests/validate_layout.js`: PASS (0 duplicate tile collisions, no UI grid clipping).
    - `node --test tests/tier1_features.test.js`: PASS (12/12 features verified).
    - `node --test tests/tier2_boundaries.test.js`: PASS (7/7 boundary tests passed).
    - `node --test tests/tier3_pairwise.test.js`: PASS (5/5 pairwise interaction tests passed).
    - `node --test tests/tier4_scenarios.test.js`: PASS (4/4 combat scenario tests passed).
    - `node test.js`: PASS.
    - `node fuzz_test.js`: PASS when run standalone (10,000 iterations completed).
  - Master test runner execution (`npm test` / `node tests/run_all_tests.js`):
    - **FAIL**: 8 of 9 suites passed. `fuzz_test.js` failed at iteration ~5,600+ with `fetch failed` (socket exhaustion) when executed in batch mode following other test suites. Gate verdict recorded as `FAIL` with exit code 1.

## 2. Logic Chain
1. **Feature Completeness**: All visual and logical specifications for Milestone 2 (multi-unit 3v3 combat, 6 archetypes, isometric sprite anchoring, dynamic Z-indexing, grounding drop shadows, smooth 2D rendering, combat FX) are correctly implemented in the source code.
2. **Integrity Verification**: No hardcoded test responses, dummy implementations, or shortcuts were found. Combat math and AI logic operate genuinely.
3. **Batch Test Suite Vulnerability**: `fuzz_test.js` issues 10,000 HTTP requests in tight sequential loops using Node.js global `fetch`. In a full automated test run (`npm test`), the cumulative open sockets exhaust OS ephemeral port limits around iteration 5,600, leading to socket drops and a failed gate verdict. Reducing `fuzz_test.js` iterations to a resilient batch size (e.g. 1,000–2,000 in CI/runner) or reusing HTTP agents with keep-alive will ensure deterministic 100% test pass.

## 3. Quality Review

### Verdict: REQUEST_CHANGES

### Findings

#### [Critical] Finding 1: `npm test` Batch Runner Failure (`fuzz_test.js` Socket Exhaustion)
- **What**: `npm test` exits with code 1 and writes `verdict: "FAIL"` to `.agents/reports/gate_verdict.json`.
- **Where**: `fuzz_test.js:6` (`const ITERATIONS = 10000;`) and `tests/run_all_tests.js`.
- **Why**: 10,000 unpooled HTTP `fetch` calls over a single run deplete macOS ephemeral socket ports, causing ECONNRESET/`fetch failed` errors during master test runs.
- **Suggestion**: In `fuzz_test.js`, support an environment variable or default to 1,000 iterations for test suite runner execution (or use HTTP keepalive agent) so `npm test` reliably exits with code 0.

#### [Minor] Finding 2: Dead Target Error Response Detail
- **What**: When attempting to shoot a dead enemy, `server.js` returns `{ error: "Invalid target." }` because `gameState.units.find(u => u.id === targetId && u.hp > 0)` filters out dead units.
- **Where**: `server.js:445`.
- **Why**: While returning 400 Bad Request is correct, a more descriptive error like `"Target unit is already defeated."` improves developer ergonomics.

## 4. Adversarial Review

### Challenge Summary
**Overall risk assessment**: LOW (Engine logic is robust; issue is strictly test harness socket management).

### Challenges

#### [Medium] Challenge 1: Ephemeral Port Exhaustion under Rapid API Stress
- **Assumption challenged**: Sequential `fetch()` in Node.js can perform 10,000 rapid unmanaged requests without socket pooling.
- **Attack scenario**: Running automated test suites in continuous integration exhausts TCP TIME_WAIT sockets.
- **Blast radius**: Test suite fails non-deterministically during batch execution.
- **Mitigation**: Add HTTP keep-alive connection pooling or scale iterations appropriately for unit/integration suites.

#### [Low] Challenge 2: Enemy Pathfinding Blocked on Both Candidate Axes
- **Assumption challenged**: Enemy AI always has an open adjacent tile towards the player.
- **Attack scenario**: If both (X ± 1) and (Y ± 1) contain cover or friendly units, the enemy remains stationary.
- **Blast radius**: Enemy skips movement for that turn; combat continues safely without crash.
- **Mitigation**: Add simple fallback 8-way or BFS step search in future AI milestones (M3/M4).

## 5. Conclusion & Actionable Next Steps
Milestone 2 implementation is high quality, well-engineered, and meets all visual and functional criteria. To achieve clean gate clearance, the worker must:
1. Adjust `fuzz_test.js` iteration count or socket handling so that `npm test` executes all 9 test suites with 100% pass rate and produces `GATE VERDICT: PASS`.
2. Re-verify `npm test` directly from clean terminal state.

## 6. Verification Method
1. Run master test suite:
   ```bash
   npm test
   ```
2. Check gate verdict report:
   ```bash
   cat .agents/reports/gate_verdict.json
   ```
3. Run individual test tiers:
   ```bash
   node --test tests/tier1_features.test.js
   node --test tests/tier2_boundaries.test.js
   node --test tests/tier3_pairwise.test.js
   node --test tests/tier4_scenarios.test.js
   node test.js
   node fuzz_test.js
   ```
