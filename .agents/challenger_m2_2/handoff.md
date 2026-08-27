# Empirical Challenge Report: Milestone 2 (challenger_m2_2)

## 1. Observation
- **Headless Chrome Validation Scripts**:
  - Executed `node tests/validate_assets.js`: Passed with 100% success (all 6 base character PNGs verified for dimensions $\ge 192\times 256$, alpha ratio $>60\%$, anti-aliased edges $>700$ px, color depth $\ge 249$ colors, unique SHA-256 hashes).
  - Executed `node tests/validate_dom_network.js`: Passed with 0 HTTP 404 network errors and 0 console errors/exceptions.
  - Executed `node tests/validate_layout.js`: Passed on clean initial run (0 duplicate tile collisions, no panel clipping, fits viewport). However, in multi-round and re-initialization scenarios, duplicate tile collisions were observed (`Duplicate Tile Collisions: 2`, `pos: 0px,180px` and `pos: 180px,0px`).
- **Archetype & Action Pose Network Verification**:
  - Tested all 24 character asset variants (6 archetypes $\times$ 4 poses: `idle`, `attack`, `hit`, `dead`) in Headless Chrome via CDP in `tests/challenge_m2_empirical.js` (`T4_ACTION_POSES_NETWORK`). All 24 assets loaded with 0 HTTP 404 network errors and 0 console exceptions.
- **Dynamic Z-Depth Sorting (`baseZIndex = unit.y * 10 + 5`)**:
  - Inspected computed z-index across all 10 grid rows in Headless Chrome:
    - $y=0 \rightarrow z=5$
    - $y=1 \rightarrow z=15$
    - $y=3 \rightarrow z=35$
    - $y=5 \rightarrow z=55$
    - $y=8 \rightarrow z=85$
    - $y=9 \rightarrow z=95$
    - Selected unit at $y=3 \rightarrow z=135$ (elevated by $+100$).
  - Pairwise verification between background ($y_1$) and foreground ($y_2 > y_1$) unselected units showed 0 depth violations: foreground units strictly layer on top of background units.
- **Sprite Anchoring & Grounding Shadows**:
  - Confirmed CSS positioning: `bottom: 8px`, `left: 50%`, `transform: translateX(-50%)`, `image-rendering: auto`.
  - Grounding drop shadows (`.unit-shadow`) rendered at `bottom: 4px` with radial-gradient opacity.
- **DOM Unit Lifecycle Flaw Identified**:
  - In `game.js` line 192 (`renderUnits()`), the rendering function creates elements `document.getElementById('unit-' + unit.id)` for units currently in `gameState.units`. However, it never cleans up or prunes DOM `.unit` elements from `#units-layer` when a game is re-initialized (`/api/init` or `/api/init_random`) or when unit IDs change (e.g. from `ally_recon_1` to `ally_recon_2`).
  - As observed in `tests/challenge_m2_empirical.js` (`T2_DOM_ORPHAN_LEAK`), after `/api/init_random`, the DOM contained 10 `.unit` elements while the server state contained only 6 units. The 4 orphaned units remained fixed at their initial coordinates (`(0px, 180px)`, `(180px, 0px)`, `(540px, 300px)`, `(300px, 540px)`).

## 2. Logic Chain
1. **Visual Depth & Sprite Rendering Integrity**: The dynamic z-index formula ($z = y \times 10 + 5$) reliably maps row coordinates to monotonically increasing integer z-indices, ensuring foreground units visually occlude background units on diamond tiles. Sprites anchor cleanly to tile centers with grounding drop shadows.
2. **Network Asset Integrity**: All 6 character archetypes and their corresponding combat action poses (`_attack`, `_hit`, `_dead`) exist as valid transparent PNG files and load cleanly in the browser without 404s.
3. **DOM Orphan Leak Mechanism**: Because `ui.unitsLayer` is never cleared on game re-initialization and `renderUnits()` only iterates over `gameState.units`, DOM nodes belonging to previous games persist as ghost elements. When a newly generated unit randomly spawns on a tile previously occupied by an orphaned unit, `tests/validate_layout.js` detects two `.unit` elements with identical `left` and `top` CSS values, causing intermittent layout test failures.

## 3. Caveats
- This review is strictly empirical and non-destructive (no production application source code was modified).
- The DOM element accumulation bug occurs upon game re-initialization / new round generation (`/api/init_random`, `init()`, `fetchState()`). In a single static match from initial page load without re-initialization, the 6 units render without collision.
- The UI overhaul components (Squad Roster Dock, Target Preview HUD, Combat Log polish) are scheduled for Milestone 3.

## 4. Conclusion
- **Isometric Grid & Sprite Positioning**: PASS. Sprites scale cleanly with high resolution, smooth filtering, bottom-center alignment, and grounding shadows.
- **Dynamic Z-Indexing**: PASS. Z-sorting correctly places foreground units ahead of background units.
- **Network Integrity**: PASS. 24/24 character assets load with zero 404 errors.
- **DOM Unit Lifecycle Bug Found**: ACTION REQUIRED FOR WORKER. `game.js` must synchronize `#units-layer` DOM children by removing elements whose IDs no longer exist in `gameState.units` (or resetting `ui.unitsLayer.innerHTML = ''` inside `init()` / `renderGridOnce()`) to eliminate ghost units and prevent intermittent collision failures.

## 5. Verification Method
1. Run master validation scripts:
   ```bash
   node tests/validate_assets.js
   node tests/validate_dom_network.js
   node tests/validate_layout.js
   ```
2. Run empirical challenge harness:
   ```bash
   node tests/challenge_m2_empirical.js
   ```
3. Run test tiers:
   ```bash
   node --test tests/tier1_features.test.js
   node --test tests/tier2_boundaries.test.js
   node --test tests/tier3_pairwise.test.js
   node --test tests/tier4_scenarios.test.js
   ```
4. Run legacy and fuzz tests:
   ```bash
   node test.js
   node fuzz_test.js
   ```
