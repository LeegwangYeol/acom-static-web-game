# Hardening Report & Handoff — `worker_harden_m3`

**Target**: In-memory `AcomEngine` in `/Users/user/src/acom/game.js`  
**Date**: 2026-08-27  
**Verdict**: **RESOLVED / PASS** (All 22 Adversarial Tests & 10/10 Master Static Test Suites Passing)

---

## 1. Observation

Direct testing of Challenger 1's adversarial test suite (`tests/adversarial_static_challenger1.js`) prior to the fix reproduced the exact two reported vulnerabilities:

1. **VULN-001 (Fractional Coordinate Acceptance)**:
   - **File & Line**: `/Users/user/src/acom/game.js:467`
   - **Initial Code**:
     ```javascript
     if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
         return { success: false, status: 400, error: "Invalid move." };
     }
     ```
   - **Verbatim Error**:
     ```
     ✗ [Boundaries & Types] Non-Integer Float Coordinates Rejection (e.g. 2.5, 2.99): Float coordinate move to (2.5, 2) must return success=false and be rejected
     true !== false
     ```

2. **VULN-002 (Null Payload Coercion Crash)**:
   - **File & Line**: `/Users/user/src/acom/game.js:437, 452`
   - **Initial Code**:
     ```javascript
     handleAction(action, payload = {}) { ... let actorId = payload.actorId; }
     ```
   - **Verbatim Error**:
     ```
     ✗ [Boundaries & Types] Malformed Actions and Null/Empty Payloads Resiliency: Cannot read properties of null (reading 'actorId')
     ```

---

## 2. Logic Chain

1. **Premise 1 (Discrete Grid Invariant)**: The tactical grid is a discrete integer indexed 10x10 matrix $[0, 9] \times [0, 9]$. Passing floating-point numbers (e.g., $x=2.5$) bypassed the previous `typeof x === 'number'` and `!isNaN(x)` checks, leading to fractional unit position state and `grid[y][x]` returning `undefined`.
2. **Mitigation 1**: Added `!Number.isInteger(x) || !Number.isInteger(y)` checks to the movement validation branch in `game.js:468`. Any non-integer coordinate is rejected with `{ success: false, status: 400, error: 'Invalid move: coordinates must be integers.' }`.
3. **Premise 2 (Crash-Proof API Contract)**: In JavaScript, default parameter assignments (`payload = {}`) only evaluate when the passed parameter is strictly `undefined`. Passing `null` retains `payload = null`, causing `payload.actorId` to throw a `TypeError`.
4. **Mitigation 2**: Added defensive payload normalization at the start of `handleAction`:
   ```javascript
   payload = (payload && typeof payload === 'object') ? payload : {};
   ```
   This ensures that any `null`, `undefined`, or non-object payload safely falls back to an empty object `{}`.
5. **Deduction & Verification**: With both guards in place, malformed payloads and fractional coordinates are safely rejected with `status: 400` and `success: false` without throwing exceptions or corrupting game state.

---

## 3. Caveats

No caveats. All modifications were minimal, strictly confined to input sanitization and validation in `game.js:handleAction`, and verified across all existing test tiers without any functional or behavioral regressions.

---

## 4. Conclusion

- **VULN-001**: Resolved. Non-integer floating point coordinates are rejected cleanly.
- **VULN-002**: Resolved. Null, primitive, and missing payloads are safely normalized to `{}` without runtime exceptions.
- **Master Static Test Suite**: 10/10 test suites passed (Asset Non-Pixel-Art Validator, DOM & Network Integrity, Isometric Layout & Non-Clipping, Tiers 1-5, Legacy Regressions, 10k Fuzzer).
- **Adversarial Harness (Challenger 1)**: 22/22 tests passed (FINAL VERDICT: APPROVE).

---

## 5. Verification Method

To independently verify the fixes:

1. Run Challenger 1's adversarial stress suite:
   ```bash
   node /Users/user/src/acom/tests/adversarial_static_challenger1.js
   ```
   *Expected Output*: `FINAL VERDICT: APPROVE (ALL PASS) - Tests Passed: 22 / 22` (Exit code 0).

2. Run the master test runner:
   ```bash
   node /Users/user/src/acom/tests/run_all_tests.js
   ```
   *Expected Output*: `GATE VERDICT: PASS (10/10 suites passed)` (Exit code 0).
