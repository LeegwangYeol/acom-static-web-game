## 2026-08-26T13:26:38Z
You are test_writer_mt, a test writer subagent for the E2E Testing Track (Milestone MT).
Your working directory is: /Users/user/src/acom/.agents/test_writer_mt
Original request file: /Users/user/src/acom/.agents/ORIGINAL_REQUEST.md
Master project specification: /Users/user/src/acom/PROJECT.md
Survey reports:
- /Users/user/src/acom/.agents/explorer_survey_3/report.md
- /Users/user/src/acom/.agents/explorer_survey_3/handoff.md

Objective:
Build the comprehensive automated testing infrastructure and 4-tier E2E test suite for the ACOM project.
1. Create `TEST_INFRA.md` at project root documenting test philosophy, feature inventory coverage, test runner commands, and tier thresholds per PROJECT.md.
2. Implement automated validation scripts in `tests/`:
   - `tests/validate_assets.js`: Programmatically verifies that >=6 distinct valid PNG files exist in `assets/characters/` (3 allies, 3 enemies), checking PNG magic bytes, dimensions (>=128x128), alpha channel transparency ratio (>15%), non-pixel-art anti-aliased edge count (>100 semi-transparent pixels), color space richness, and pairwise distinct SHA-256 hashes.
   - `tests/validate_dom_network.js`: Headless Chrome script (using Node WebSocket / CDP to Chrome or direct fetch + DOM simulation) that starts server, loads game, dynamically spawns all 6 characters into DOM, and confirms 0 network 404s and 0 console errors during rendering.
   - `tests/validate_layout.js`: Headless Chrome script verifying that unit HTML elements on the isometric grid do not overlap improperly and that UI panels do not clip the grid.
3. Implement 4-tier test suite in `tests/`:
   - `tests/tier1_features.test.js`: Feature coverage tests for each feature (F1-F12) in isolation.
   - `tests/tier2_boundaries.test.js`: Boundary and edge cases (0 HP, AP limits, max range, grid edges, cover edge cases).
   - `tests/tier3_pairwise.test.js`: Pairwise combinations (e.g. cover + range, AP + shooting, multi-unit turns, different class interactions).
   - `tests/tier4_scenarios.test.js`: Realistic multi-turn combat scenarios (full 3v3 squad battle flow to victory/defeat).
4. Implement master test runner `tests/run_all_tests.js` that runs all test suites, reports structured pass/fail results, and creates `.agents/reports/gate_verdict.json`.
5. Update `package.json` to configure `"scripts": { "test": "node tests/run_all_tests.js" }`.
6. Once the test suite is ready and passing infrastructure checks, create `TEST_READY.md` at project root.
