# Adversarial Empirical Challenge Report — Challenger 1 (`challenger_static_1`)

**Target**: In-memory `AcomEngine` in `/Users/user/src/acom/game.js`  
**Date**: 2026-08-27  
**Verdict**: **REQUEST_CHANGES**  
**Overall Risk Assessment**: **MEDIUM**

---

## 1. Observation

Empirical testing was conducted by creating and executing `/Users/user/src/acom/tests/adversarial_static_challenger1.js`. The suite ran 22 focused adversarial tests covering 6 core stress dimensions and executed a 10,000-iteration randomized fuzzer.

Command executed:
```bash
node tests/adversarial_static_challenger1.js
```

Summary Results:
- **Total Tests**: 22
- **Passed**: 20
- **Failed**: 2
- **Fuzzer Performance**: 10,000 operations completed in 1,358ms (~7,364 ops/sec) with zero state corruptions or invariant violations.

### Directly Observed Failures & Code Snippets

#### Observation 1: Acceptance of Floating-Point Non-Integer Coordinates (`VULN-001`)
- **File & Line**: `/Users/user/src/acom/game.js:467`
- **Code**:
  ```javascript
  if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
      return { success: false, status: 400, error: "Invalid move." };
  }
  ```
- **Test Command**:
  ```bash
  node -e "const { AcomEngine } = require('./game.js'); const e = new AcomEngine(); console.log(e.handleAction('move', { actorId: 'ally_assault_1', x: 2.5, y: 1 }));"
  ```
- **Result**:
  ```json
  {
    "success": true,
    "status": 200,
    "state": { ... },
    "message": "Assault Ranger moved. (-1 AP)"
  }
  ```
  Unit `ally_assault_1` has its coordinates mutated to `x = 2.5, y = 1` and loses 1 AP.
- **Verbatim Error in Test Harness**:
  ```
  ✗ [Boundaries & Types] Non-Integer Float Coordinates Rejection (e.g. 2.5, 2.99): Float coordinate move to (2.5, 2) must return success=false and be rejected
  true !== false
  ```

#### Observation 2: Unhandled `TypeError` Crash on `null` Payload (`VULN-002`)
- **File & Line**: `/Users/user/src/acom/game.js:437, 452`
- **Code**:
  ```javascript
  handleAction(action, payload = {}) {
      if (!action) {
          return { success: false, status: 400, error: "Action is required." };
      }
      ...
      let actorId = payload.actorId; // <--- Throws TypeError when payload === null
  ```
- **Test Command**:
  ```bash
  node -e "const { AcomEngine } = require('./game.js'); const e = new AcomEngine(); e.handleAction('move', null);"
  ```
- **Verbatim Error**:
  ```
  TypeError: Cannot read properties of null (reading 'actorId')
      at AcomEngine.handleAction (/Users/user/src/acom/game.js:452:27)
  ```

---

## 2. Logic Chain

1. **Premise 1 (Discrete Grid Specification)**: The game operates on a discrete 10x10 tile grid where valid tile coordinates must be integers in the range $[0, 9]$. `grid[y][x]` is an array of arrays indexed by non-negative integers.
2. **Observation 1 $\rightarrow$ Inference**: In JavaScript, `typeof 2.5 === 'number'` and `!isNaN(2.5)` evaluate to true. Because `game.js:467` does not test `Number.isInteger(x)` or `Number.isInteger(y)`, float coordinates pass validation. Array indexing `grid[1][2.5]` returns `undefined`, which evaluates as falsy for cover/unit collision checks, allowing the unit to move onto fractional coordinate `(2.5, 1)`.
3. **Premise 2 (API & In-Memory Robustness Contract)**: `handleAction` must safely validate all malformed inputs and return `{ success: false, status: 400, error: ... }` rather than throwing uncaught exceptions that crash callers.
4. **Observation 2 $\rightarrow$ Inference**: In JavaScript default parameters, `payload = {}` is only assigned when the argument is `undefined`. When a caller explicitly supplies `null` (e.g., `handleAction('move', null)`), `payload` remains `null`. Dereferencing `payload.actorId` at line 452 unconditionally throws a runtime `TypeError`.
5. **Conclusion**: While all combat rules, cover geometry, AP depletion limits, AI navigation heuristics, and 10,000 random actions preserved core game invariants, `AcomEngine` has two boundary validation flaws that allow coordinate corruption and unhandled process crashes on malformed payloads.

---

## 3. Caveats

- **Scope limitation**: Testing was focused strictly on the in-memory JavaScript engine `AcomEngine` in `game.js` and standalone Node test harnesses. Visual Canvas/DOM rendering was evaluated in related test suites (`validate_dom_network.js`, `validate_layout.js`).
- **No implementation edits**: In accordance with challenger constraints (Review-only), no code modifications were applied to `game.js`.

---

## 4. Conclusion & Actionable Mitigations

### Verdict: **REQUEST_CHANGES**

To achieve 100% robustness and pass all adversarial gates, the following two minimal fixes should be applied to `game.js`:

### Recommended Fixes in `game.js`

1. **Fix `VULN-002` (Null Payload Normalization)** at `game.js:437`:
   ```javascript
   handleAction(action, rawPayload) {
       const payload = (rawPayload && typeof rawPayload === 'object') ? rawPayload : {};
       if (!action) {
           return { success: false, status: 400, error: "Action is required." };
       }
   ```

2. **Fix `VULN-001` (Integer Coordinate Enforcement)** at `game.js:467`:
   ```javascript
   if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y) || !Number.isInteger(x) || !Number.isInteger(y)) {
       return { success: false, status: 400, error: "Invalid move." };
   }
   ```

---

## 5. Verification Method

To independently execute and verify the empirical challenge harness:

1. Run the challenger test suite:
   ```bash
   node /Users/user/src/acom/tests/adversarial_static_challenger1.js
   ```
2. Verify that 20/22 tests pass, and observe the 2 isolated failure points.
3. Review detailed JSON telemetry at `/Users/user/src/acom/.agents/reports/challenger_static_1_report.json`.
4. Invalidation condition: Once the 2 proposed validations are applied to `game.js`, `node tests/adversarial_static_challenger1.js` will output `APPROVE (22/22 PASS)` and exit with code 0.
