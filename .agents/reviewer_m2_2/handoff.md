# Milestone 2 Reviewer & Adversarial Critic Report (reviewer_m2_2)

## 1. Observation
- **Review Targets**: Inspected `server.js`, `game.js`, `style.css`, `index.html`, and test suites `tests/tier1_features.test.js`, `tests/tier2_boundaries.test.js`, `tests/tier3_pairwise.test.js`, `tests/tier4_scenarios.test.js`, `test.js`, `fuzz_test.js`, and `tests/run_all_tests.js`.
- **Backward-Compatible `actorId` Defaulting**:
  - In `server.js` (lines 407–413):
    ```javascript
    let actorId = payload.actorId;
    if (!actorId) {
        const activePlayer = gameState.units.find(u => u.type === 'player' && u.hp > 0 && u.ap > 0)
            || gameState.units.find(u => u.type === 'player' && u.hp > 0);
        if (activePlayer) actorId = activePlayer.id;
    }
    ```
  - Confirmed: Legacy single-unit API callers, bots, and fuzz tests omitting `actorId` default to the first active/living player unit with remaining AP without throwing 400 Bad Request.
- **Strict Grid Boundary Checks**:
  - In `server.js` (lines 422–427):
    ```javascript
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
        return res.status(400).json({ error: "Invalid move." });
    }
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
        return res.status(400).json({ error: "Invalid move." });
    }
    ```
  - Confirmed: Out-of-bounds coordinates (e.g. `(99,99)`, `(-50,-50)`, `(15,y)`, `(x,15)`), non-numeric values, and collision with obstacles/units are strictly rejected with HTTP 400.
- **Action Pose State Handling**:
  - In `game.js` (lines 66–87):
    ```javascript
    function setUnitPose(unitId, pose, durationMs = 600) {
        const sprite = document.getElementById(`sprite-${unitId}`);
        const unit = gameState ? gameState.units.find(u => u.id === unitId) : null;
        if (!sprite || !unit) return;

        const archetype = unit.archetype || (unit.type === 'player' ? 'ally_assault' : 'enemy_mutant');
        let imgUrl = `assets/characters/${archetype}.png`;
        if (pose && pose !== 'idle') {
            imgUrl = `assets/characters/${archetype}_${pose}.png`;
        }
        sprite.style.backgroundImage = `url('${imgUrl}')`;
        ...
    ```
  - Confirmed: Action poses for `_attack.png`, `_hit.png`, `_dead.png` across all 6 archetypes exist in `assets/characters/`, are dynamically attached on shooting/damage/death events, and revert after durationMs.
- **Test Suite Execution**:
  - `node --test tests/tier1_features.test.js`: 12/12 passed (100%).
  - `node --test tests/tier2_boundaries.test.js`: 7/7 passed (100%).
  - `node --test tests/tier3_pairwise.test.js`: 5/5 passed (100%).
  - `node --test tests/tier4_scenarios.test.js`: 4/4 passed (100%).
  - `node test.js`: 4/4 legacy API tests passed.
  - `node fuzz_test.js`: 10,000 randomized state iterations passed with 0 crashes / 0 regressions.
  - Master Runner `node tests/run_all_tests.js`: 9/9 test suites passed (`GATE VERDICT: PASS` in `.agents/reports/gate_verdict.json`).
- **Integrity Assessment**:
  - Verified no hardcoded test responses or expected values in `server.js` or `game.js`.
  - Verified genuine game mechanics: dynamic Manhattan distance calculation, cover mitigation (+20%/+40%), aim formulas, dynamic depth sorting (`zIndex = y * 10 + 5`), and enemy AI pathfinding.
  - Verified 0 integrity violations.

## 2. Logic Chain
1. **API Backward Compatibility**: The fallback in `server.js` inspecting `gameState.units` for active players with AP allows legacy calls to succeed while giving new multi-unit callers full explicit targeting control.
2. **Boundary and Collision Integrity**: The multi-tiered guard (type validation -> coordinate bounds check -> distance/mobility check -> unit occupancy check -> cover tile collision check -> AP sufficiency check) guarantees the game server state cannot be corrupted by malformed requests or boundary overflows.
3. **Action Pose Visual Loop**: Binding `setUnitPose` to action dispatches and response handlers in `game.js` paired with CSS keyframe recoil/flash/fade animations ensures visual feedback occurs in tandem with backend state mutations.
4. **Adversarial Concurrency Discovery**: Running tests in parallel on the same stateful server port causes state mutation collisions (e.g. background fuzz testing modifying unit AP while scenario tests execute). When executed sequentially via `run_all_tests.js` or with clean server isolation, all 9 test suites pass with 100% reliability.

## 3. Caveats
- The backend Express server maintains in-memory global state (`gameState`). When running multi-tier or fuzz test suites concurrently in parallel processes against port 3000, tests will interfere with each other's active turn state. Tests should always be executed sequentially via `tests/run_all_tests.js` or individually with port isolation.
- No other caveats; all requirements and acceptance criteria for Milestone 2 are met.

## 4. Conclusion
**Verdict**: **APPROVE**

Milestone 2 multi-unit architecture, 6 character archetypes, isometric bottom-center sprite anchoring, dynamic depth sorting, action pose state management, boundary guards, and backward compatibility are fully implemented and verified. All 4 test tiers and regression suites pass with 100% success rate.

## 5. Verification Method
Execute the following verification commands from workspace root:
```bash
# 1. Run all 4 test tiers individually
node --test tests/tier1_features.test.js
node --test tests/tier2_boundaries.test.js
node --test tests/tier3_pairwise.test.js
node --test tests/tier4_scenarios.test.js

# 2. Run legacy and fuzz tests
node test.js
node fuzz_test.js

# 3. Run master E2E runner (9 suites)
npm test

# 4. Check generated gate verdict report
cat .agents/reports/gate_verdict.json
```
