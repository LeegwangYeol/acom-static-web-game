# ACOM Pure Static & Serverless Test Infrastructure

## 1. Testing Philosophy & Static Architecture
The ACOM testing framework has been completely transitioned from an Express-dependent client-server model to a **100% purely static, serverless, headless execution model** designed for zero-server local execution and seamless compatibility with static hosting (Vercel, GitHub Pages).

- **Zero Server Daemon Dependency**: The test infrastructure requires no running `server.js`, no background Express process, and no port 3000 polling loops.
- **Direct In-Memory Game Engine Testing**: Tiers 1–4, boundary tests, pairwise combinations, realistic combat scenarios, legacy regressions, and 10,000-iteration state fuzzers execute directly against `AcomEngine` imported from `game.js` in Node.js.
- **0-Dependency Ephemeral Local Static Host**: For end-to-end Headless Chrome CDP tests, an ephemeral built-in `http.createServer` (Node.js standard library) binds to an OS-assigned ephemeral port (port 0) serving strictly static files (`.html`, `.css`, `.js`, `.png`) and returning 404 on any `/api/` requests.
- **Strict Client-Side Network Isolation**: Automated Chrome DevTools Protocol (CDP) monitors assert that **zero** requests are made to `/api/...` during gameplay, turn execution, or hotkey interactions.
- **Structured Gate Verdict Generation**: The master test runner (`tests/run_all_tests.js`) orchestrates all validation suites and compiles `.agents/reports/gate_verdict.json`.

---

## 2. Feature Inventory & Coverage Matrix

| Feature ID | Feature Name | Primary Test Suite | Verification Method |
|---|---|---|---|
| **F1** | `AcomEngine` Core State & Archetypes | `tests/tier1_features.test.js` | Direct in-memory schema check of `ARCHETYPES`, `createUnit`, and 6 archetype stat blocks. |
| **F2** | Procedural Map & Squad Spawner | `tests/tier1_features.test.js`, `tests/tier4_scenarios.test.js` | In-memory 10x10 procedural cover generation, clear spawn zones, 3v3 squad initialization. |
| **F3** | Action Validation & Movement Resolver | `tests/tier2_boundaries.test.js`, `tests/tier3_pairwise.test.js` | In-memory `handleAction('move', ...)` checking out-of-bounds, obstacle collision, AP deduction, occupancy. |
| **F4** | Ballistic Combat & Hit Calculator | `tests/tier1_features.test.js`, `tests/tier3_pairwise.test.js` | In-memory `calculateHitChance()` verifying cover (+20%/+40%), distance penalty (-2%/tile), clamping [0, 100]. |
| **F5** | Autonomous Enemy AI Turn Engine | `tests/tier3_pairwise.test.js`, `tests/tier4_scenarios.test.js` | In-memory `handleAction('end_turn')` verifying closest targeting, navigation, attack execution, and player AP restore. |
| **F6** | Frontend In-Memory Decoupling | `tests/validate_dom_network.js` | Headless Chrome CDP verification that DOM updates occur with 0 `/api/` HTTP calls. |
| **F7** | Global Test Hooks & Compatibility Layer | `tests/validate_dom_network.js`, `tests/tier1_features.test.js` | Dual module export (`window.AcomEngine` in browser, `module.exports` in Node.js). |
| **F8** | Serverless & Static Verification | `tests/validate_dom_network.js`, `tests/validate_layout.js` | Headless Chrome CDP loading static `index.html` with 0 console errors and 0 404s. |
| **F9** | Static Headless Test Suite & Runner | `tests/run_all_tests.js` | Master runner orchestrating all static suites without server spawning. |
| **F10** | Dual-Mode Headless Verification | `tests/validate_dom_network.js`, `tests/validate_layout.js` | Headless Chrome CDP over ephemeral static host asserting DOM mounting and geometry. |
| **F11** | 100% E2E Test Suite Pass | `tests/run_all_tests.js` | 10/10 test suites executing and producing PASS verdict. |
| **F12** | Adversarial Hardening (Tier 5) | `tests/adversarial_m2.test.js`, `tests/adversarial_m4_empirical.test.js`, `fuzz_test.js` | 10,000 in-memory fuzz iterations, CDP keyboard hotkeys, and stress boundaries. |

---

## 3. Test Suites & Validation Scripts Hierarchy

```
/Users/user/src/acom/
├── tests/
│   ├── run_all_tests.js          # Master Static Runner (Orchestrates all suites, outputs gate_verdict.json)
│   ├── validate_assets.js        # Standalone PNG & Non-Pixel-Art Validator (fs/zlib)
│   ├── validate_dom_network.js   # Headless Chrome CDP DOM Spawner (0 404s, 0 /api/ requests, 0 console errors)
│   ├── validate_layout.js        # Headless Chrome CDP Layout Validator (0 collisions, z-depth, 0 panel clipping)
│   ├── tier1_features.test.js    # Tier 1: Feature Coverage (F1-F12) in-memory against AcomEngine
│   ├── tier2_boundaries.test.js  # Tier 2: Boundary & Corner Cases in-memory against AcomEngine
│   ├── tier3_pairwise.test.js    # Tier 3: Pairwise Combinations & Action Sequencing in-memory against AcomEngine
│   ├── tier4_scenarios.test.js   # Tier 4: Realistic 3v3 Combat Scenarios to Resolution in-memory against AcomEngine
│   ├── adversarial_m2.test.js    # Tier 5: Boundary & Multi-Unit Stress in-memory against AcomEngine
│   └── adversarial_m4_empirical.test.js # Tier 5: Headless Chrome CDP Keyboard Hotkeys & UI State Test
├── test.js                       # Legacy In-Memory Regression Test against AcomEngine
├── bot.js                        # AI Bot Simulator (50 matches in-memory against AcomEngine)
├── fuzz_test.js                  # 10,000-iteration In-Memory State & Robustness Fuzzer
└── .agents/reports/
    ├── asset_validation_report.json
    ├── dom_network_report.json
    ├── layout_report.json
    └── gate_verdict.json
```

---

## 4. Execution Commands

### Run Full Test Suite
```bash
npm test
```
or:
```bash
node tests/run_all_tests.js
```

### Run Individual Test Suites
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

# Regressions & Fuzzer
node test.js
node fuzz_test.js
node bot.js
```

---

## 5. Acceptance Criteria & Gate Verdict Contract

The master runner generates `.agents/reports/gate_verdict.json` conforming to:
```json
{
  "gate": "AC_TACTICAL_WEB_GAME_STATIC",
  "timestamp": "2026-08-27T01:30:00.000Z",
  "executionMode": "pure_static_serverless",
  "verdict": "PASS",
  "summary": {
    "totalSuites": 10,
    "passedSuites": 10,
    "failedSuites": 0,
    "durationMs": 3200
  },
  "acceptanceCriteria": {
    "assetCheck": { "status": "PASS", "assetsFound": 6, "allNonPixelArt": true },
    "domAndNetworkIntegrity": { "status": "PASS", "unitsSpawned": 6, "networkErrors": 0, "apiRequests": 0, "zeroApiRequests": true, "consoleErrors": 0 },
    "layoutValidation": { "status": "PASS", "unitOverlapErrors": 0, "zDepthConforms": true, "gridPanelClippingErrors": 0 }
  },
  "tierResults": {
    "tier1_featureCoverage": "PASS",
    "tier2_boundaryCorner": "PASS",
    "tier3_crossFeature": "PASS",
    "tier4_realWorldScenarios": "PASS",
    "tier5_adversarialEmpirical": "PASS"
  }
}
```
