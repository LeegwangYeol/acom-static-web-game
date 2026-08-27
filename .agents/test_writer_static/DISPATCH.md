## 2026-08-27T01:28:13Z
You are the Static Test Writer subagent (test_writer_static) responsible for Milestone MT in /Users/user/src/acom.

Working directory: /Users/user/src/acom/.agents/test_writer_static
Project workspace: /Users/user/src/acom
Task: Adapt the master test runner and all test suites in tests/ for purely static, serverless headless execution.

Instructions:
1. Read /Users/user/src/acom/.agents/ORIGINAL_REQUEST.md, /Users/user/src/acom/PROJECT.md, and /Users/user/src/acom/.agents/explorer_static_3/analysis.md.
2. Adapt all test suites and runners:
   - /Users/user/src/acom/tests/run_all_tests.js: Remove all dependencies on server.js, child_process server spawning, and port 3000 polling loops. Ensure it orchestrates all static test suites and generates .agents/reports/gate_verdict.json.
   - /Users/user/src/acom/tests/validate_dom_network.js: Run Headless Chrome CDP against static index.html (via file:// or 0-dependency ephemeral local static server). Assert: 0 network errors, 0 /api/ requests, 0 console errors, dynamic 3v3 DOM mounting.
   - /Users/user/src/acom/tests/validate_layout.js: Run Headless Chrome CDP against static index.html verifying isometric grid layout, non-overlapping bounding boxes, z-depth sorting (z = y * 10 + 5), and zero UI clipping.
   - /Users/user/src/acom/tests/tier1_features.test.js: Test Features F1-F12 by importing AcomEngine from game.js in-memory without starting server.js.
   - /Users/user/src/acom/tests/tier2_boundaries.test.js: Test boundary and rejection conditions directly against AcomEngine.
   - /Users/user/src/acom/tests/tier3_pairwise.test.js: Test pairwise cross-feature combinations against AcomEngine.
   - /Users/user/src/acom/tests/tier4_scenarios.test.js: Test full 3v3 combat scenarios against AcomEngine.
   - /Users/user/src/acom/tests/adversarial_m4_empirical.test.js: Test interactive keyboard hotkeys and UI in Headless Chrome with static index.html.
   - /Users/user/src/acom/test.js, /Users/user/src/acom/bot.js, /Users/user/src/acom/fuzz_test.js: Adapt for direct in-memory AcomEngine execution.
3. Update /Users/user/src/acom/TEST_INFRA.md and publish /Users/user/src/acom/TEST_READY.md.
4. MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
5. Document your work and verification results in /Users/user/src/acom/.agents/test_writer_static/handoff.md and report back via send_message.
