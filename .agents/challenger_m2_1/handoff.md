# Milestone 2 Empirical Adversarial Challenge Report

## 1. Observation
- **Adversarial Test Suite Authored**: Created `tests/adversarial_m2.test.js` comprising 16 empirical stress test cases across 4 major dimensions:
  1. **Spatial & Boundary Stress**: Negative coordinates (`x: -1`, `y: -1`, `x: -999999`), upper boundaries (`x: 10`, `y: 10`, `x: 999999`), malformed coordinates (strings, `NaN`, `null`, `undefined`, `Infinity`), unit collisions (ally-on-ally, ally-on-enemy, self-tile moves), cover obstacle collisions, mobility limits, and procedural spawn disjointness over 10 consecutive seeds.
  2. **Multi-Unit & AP Engine Stress**: Independent AP tracking across 3v3 units, consecutive move AP depletion (2 AP -> 1 AP -> 0 AP -> HTTP 400 rejection), invalid/ghost actor IDs, enemy actor impersonation during player turn, friendly fire and self-shooting rejection, and dead unit target rejection.
  3. **Combat Engine & Mathematical Bounds**: Hit probability floor (0%) and ceiling (100%) clamping under extreme distance/cover penalties, cover defense calculation (half cover = 20, full cover = 40, multi-cover `Math.max` resolution = 40), corner-tile boundary safety, and HP clamping at 0 with `isAlive=false` consistency.
  4. **Archetype & Asset Invariant Verification**: Verified all 6 archetypes (`ally_assault`, `ally_recon`, `ally_heavy`, `enemy_mutant`, `enemy_scout`, `enemy_heavy`) have required stats, valid transparent PNG files on disk, and tested arbitrary squad scale invariants (1v1, 2v2, 3v3, 4v4).
- **Adversarial Test Execution**: Executed `node --test tests/adversarial_m2.test.js`:
  ```
  ✔ ADV-101: Boundary Edge & Negative Coordinates Rejection (27.5ms)
  ✔ ADV-102: Malformed & Non-Numeric Coordinate Rejection (7.1ms)
  ✔ ADV-103: Unit-on-Unit Collision Prevention (Ally, Enemy & Self) (3.6ms)
  ✔ ADV-104: Obstacle & Cover Collision Prevention (4.5ms)
  ✔ ADV-105: Mobility Limit Enforcement across all Ally Archetypes (3.3ms)
  ✔ ADV-106: Procedural Squad Spawn Disjointness & Cover Clearance (8.7ms)
  ✔ ADV-201: Multi-Unit Independent AP Tracking & Full Depletion (6.8ms)
  ✔ ADV-202: Consecutive Move AP Depletion (2 AP -> 1 AP -> 0 AP -> Rejection) (9.6ms)
  ✔ ADV-203: Invalid Actor ID Guards & Impersonation Defense (12.3ms)
  ✔ ADV-204: Friendly Fire, Self-Targeting & Ghost Target Defense (9.5ms)
  ✔ ADV-205: Dead Unit State Consistency & Rejection of Post-Mortem Actions (48.9ms)
  ✔ ADV-301: Hit Chance Clamping Floor and Ceiling Matrix (0.3ms)
  ✔ ADV-302: Cover Defense Calculation Boundaries & Multiple Cover Resolution (0.7ms)
  ✔ ADV-303: HP Clamping to Zero & Lethal Damage Integrity (17.2ms)
  ✔ ADV-401: All 6 Character Archetypes Spec & Asset Integrity (4.5ms)
  ✔ ADV-402: Randomized Squad Scaling & Large Skirmish Invariant (57.7ms)
  ℹ tests 16, pass 16, fail 0 (100% PASS)
  ```
- **Master Test Runner Execution**: Integrated Tier 5 into `tests/run_all_tests.js` and executed `npm test` (`node tests/run_all_tests.js`):
  ```
  ▶ Running: Asset Non-Pixel-Art Validator... ✓ PASS (135ms)
  ▶ Running: DOM & Network Integrity (Headless)... ✓ PASS (5307ms)
  ▶ Running: Isometric Layout & Non-Clipping (Headless)... ✓ PASS (4960ms)
  ▶ Running: Tier 1: Feature Coverage (F1-F12)... ✓ PASS (608ms)
  ▶ Running: Tier 2: Boundary & Corner Cases... ✓ PASS (312ms)
  ▶ Running: Tier 3: Pairwise Combinations... ✓ PASS (292ms)
  ▶ Running: Tier 4: Realistic Combat Scenarios... ✓ PASS (445ms)
  ▶ Running: Tier 5: Adversarial Empirical Challenge... ✓ PASS (306ms)
  ▶ Running: Legacy API Regression Tests... ✓ PASS (217ms)
  ▶ Running: Backend State Fuzz Tests... ✓ PASS (3662ms)
  ====================================================
   GATE VERDICT: PASS (10/10 suites passed in 16648ms)
  ====================================================
  ```
- **Gate Verdict Report**: Updated `.agents/reports/gate_verdict.json` with 10 passed suites, 0 failed suites, overall verdict `PASS`.

## 2. Logic Chain
1. **Boundary & Input Hardening**: In `server.js` (lines 420-438), explicit numerical type guards (`typeof x !== 'number'`, `isNaN`), range bounds (`x < 0 || x >= 10 || y < 0 || y >= 10`), cover obstacle checking (`cellIsCover`), and collision checking (`cellHasUnit`) reliably reject all invalid, malformed, or colliding movement requests with HTTP 400.
2. **Actor & Target Integrity**: `server.js` validates that only active player units during player turns can execute commands. Explicit unknown actors, enemy actors, or dead actors return HTTP 400. Falsy/omitted `actorId` properly defaults to the active player for backward compatibility. Self-targeting, friendly fire, ghost targets, and shooting dead units are all rejected with HTTP 400 (lines 440-452).
3. **AP & Turn Flow Soundness**: Each unit tracks its own `ap` counter. Actions consume AP (move: -1 AP, shoot: sets AP to 0). Once AP is 0, subsequent actions fail with HTTP 400 without affecting other squad members.
4. **Combat Mathematics Stability**: The combat resolver clamps hit chances within `[0, 100]` regardless of extreme penalties or bonuses. Lethal damage clamps defender HP to 0 and updates `isAlive: false`. Adjacent cover calculations use `Math.max` and clamp coordinate lookups within `[0, 9]`, preventing array boundary exceptions on corner tiles.

## 3. Caveats
- The backend state is held in-memory in `server.js` (global `gameState`), which requires sequential test execution to prevent cross-test state pollution. All test suites in `tests/run_all_tests.js` run sequentially.
- Visual animations and action poses are triggered via CSS keyframes and DOM classes in `game.js`, which are validated through headless Chrome scripts (`validate_dom_network.js`, `validate_layout.js`).

## 4. Conclusion
Milestone 2 implementation is **ROBUST AND EMPIRICALLY VERIFIED**.
All 16 adversarial challenge tests pass with 100% reliability. All boundary conditions, multi-unit AP mechanics, friendly fire guards, dead unit protections, and combat resolution calculations operate correctly without unhandled exceptions or state corruptions.
**Verdict**: **PASS (APPROVED FOR MILESTONE 3)**.

## 5. Verification Method
1. Run Tier 5 Adversarial Test Suite directly:
   ```bash
   node --test tests/adversarial_m2.test.js
   ```
2. Run Master E2E Test Runner across all 10 suites:
   ```bash
   node tests/run_all_tests.js
   ```
3. Inspect the gate verdict report:
   ```bash
   cat .agents/reports/gate_verdict.json
   ```
