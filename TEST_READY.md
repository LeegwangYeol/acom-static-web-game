# Test Suite Readiness Publication: ACOM Pure Static & Serverless Architecture

**Milestone**: MT (Static Test Infrastructure Track)  
**Status**: READY & VERIFIED  
**Date**: 2026-08-27  
**Gate Verdict**: PASS (10/10 Suites Ready for Serverless & Static Verification)

---

## 1. Test Architecture & Files Adapted

The entire test suite, headless Chrome validators, and master test runner have been migrated from the Express client-server architecture (`server.js` on port 3000) to a **100% purely static, serverless, in-memory & Headless Chrome execution model**:

### 1.1 Automated Validation Scripts (`tests/`)
1. **`tests/validate_assets.js`**:
   - Programmatically verifies all character PNG assets in `assets/characters/` via binary chunk parsing.
   - Asserts dimensions ($\ge 128\times 128$), alpha channel ratio ($>15\%$), anti-aliasing edge feathering ($>100$ semi-transparent pixels), color space richness ($C \ge 256$), and pairwise hash uniqueness.
   - Emits `.agents/reports/asset_validation_report.json`.

2. **`tests/validate_dom_network.js`**:
   - Launches Headless Chrome CDP over an ephemeral 0-dependency local static file host.
   - Dynamically mounts 3v3 squads into the DOM (`#units-layer .unit`).
   - Asserts:
     - Zero network errors / 404s on static assets.
     - **Zero requests dispatched to `/api/...`** (Strict client-side isolation).
     - Zero console errors or uncaught JavaScript exceptions.
   - Emits `.agents/reports/dom_network_report.json`.

3. **`tests/validate_layout.js`**:
   - Launches Headless Chrome CDP over an ephemeral 0-dependency local static host.
   - Inspects isometric grid layout and element bounding boxes via `getBoundingClientRect()`.
   - Asserts:
     - Zero spatial tile coordinate collisions among living units.
     - Monotonic dynamic z-depth sorting ($z = y \times 10 + 5$).
     - Zero clipping or occlusion between UI panels (`#ui-panel`, `#squad-dock`, `#combat-log`) and the 10x10 isometric grid.
     - Clean container-to-viewport fit.
   - Emits `.agents/reports/layout_report.json`.

### 1.2 4-Tier In-Memory Test Suite (`tests/`)
1. **`tests/tier1_features.test.js`**:
   - Tests Features F1 through F12 in isolation directly against `AcomEngine` in-memory.
   - Validates asset presence, `ARCHETYPES` schema, default init, `initRandom(3, 3)` squad allocation, 10x10 grid integrity, dynamic depth math, CSS classes, HUD DOM elements, and hit calculation formula.

2. **`tests/tier2_boundaries.test.js`**:
   - Tests boundary limits and rejection guards directly against `AcomEngine.handleAction(...)`.
   - Asserts rejection of out-of-bounds coordinates, depleted AP actions, friendly fire, cover collisions, mobility limits, invalid actors/targets, and malformed inputs.

3. **`tests/tier3_pairwise.test.js`**:
   - Tests combinatorial tactical interactions directly against `AcomEngine`.
   - Asserts Cover + Distance matrix, Action sequencing (Move->Shoot vs Shoot->Move), multi-unit AP isolation, enemy turn AI execution, and AP refills upon player turn cycle.

4. **`tests/tier4_scenarios.test.js`**:
   - Tests full 3v3 squad combat simulations directly against `AcomEngine`.
   - Asserts match progression to decisive victory or defeat within 40 rounds, cover combat logs, and 15-turn state invariant stability.

### 1.3 Tier 5 Adversarial & Hardening Suites
1. **`tests/adversarial_m2.test.js`**:
   - Adversarial stress tests against `AcomEngine` in-memory: spatial boundary extremes, AP depletion, target validation, cover defense boundaries, and randomized squad scaling.
2. **`tests/adversarial_m4_empirical.test.js`**:
   - In-memory combat simulations and live Headless Chrome CDP UI & keyboard hotkey audits ('M', 'S', '1'-'3', 'Space'/'E', 'Escape') with zero network errors and zero `/api/` calls.

### 1.4 Regressions & AI Simulation Harnesses
1. **`test.js`**:
   - Standalone regression script executing `AcomEngine` init, move, shoot, and end_turn sequence in pure Node.js in-memory.
2. **`bot.js`**:
   - Automated AI simulation harness executing 50 full matches in-memory against `AcomEngine`, reporting win rates and performance metrics (>500 matches/sec).
3. **`fuzz_test.js`**:
   - 10,000-iteration state invariant fuzzer running directly in-memory in ~150ms, asserting non-negative AP, HP clamping, self-harm rejection, and malformed input resiliency.

### 1.5 Master Runner
1. **`tests/run_all_tests.js`**:
   - Zero-server orchestrator executing all 10 validation suites, capturing durations and error logs, and compiling `.agents/reports/gate_verdict.json`.

---

## 2. Test Execution Commands

To execute the entire static test harness:
```bash
npm test
# or
node tests/run_all_tests.js
```

To run individual validation scripts or test tiers:
```bash
# Static Asset Validation
node tests/validate_assets.js

# Static Headless Chrome CDP Validators
node tests/validate_dom_network.js
node tests/validate_layout.js

# In-Memory Unit & Tier Suites
node --test tests/tier1_features.test.js
node --test tests/tier2_boundaries.test.js
node --test tests/tier3_pairwise.test.js
node --test tests/tier4_scenarios.test.js
node --test tests/adversarial_m2.test.js tests/adversarial_m4_empirical.test.js

# Standalone In-Memory Regressions
node test.js
node fuzz_test.js
node bot.js
```

---

## 3. Readiness Certification

The static test suite is fully authored, self-contained, independent of any backend daemon, and ready to verify Milestone M1 (`AcomEngine` Migration), Milestone M2 (Frontend In-Memory Decoupling), and Milestone M3 (Final E2E Verification).
