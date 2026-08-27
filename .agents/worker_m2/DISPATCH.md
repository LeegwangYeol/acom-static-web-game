## 2026-08-26T13:33:45Z
Scope & Tasks:
1. Update `server.js`:
   - Define and register the 6 distinct character archetypes (3 Allies: Assault Ranger `ally_assault`, Recon Scout `ally_recon`, Heavy Juggernaut `ally_heavy`; 3 Enemies: Bioweapon Mutant `enemy_mutant`, Stealth Infiltrator `enemy_scout`, Cyber Enforcer `enemy_heavy`) with unique HP, AP, attack, weapon range, hit chance, portrait (`assets/characters/ally_assault.png`, etc.), and sprite paths.
   - Update `/api/init` and `/api/init_random` to spawn full 3v3 squads.
   - Ensure backward-compatible `actorId` defaulting (if `payload.actorId` is not provided, default to active player unit so legacy single-unit tests/bots don't 400).
   - Add explicit boundary validation: `if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return res.status(400).json({ error: "Invalid move." });`
2. Update `game.js`:
   - Support rendering all 6 unit archetypes dynamically based on server unit object data.
   - Upgrade isometric sprite positioning: anchor to bottom-center of diamond tiles (`bottom: 8px; left: 50%; transform: translateX(-50%)`).
   - Implement dynamic Y-depth sorting: compute `unitEl.style.zIndex = (unit.y * 10 + 5)` so foreground units naturally occlude background units without clipping.
   - Support action pose states (`_attack`, `_hit`, `_dead` action poses from `assets/characters/`).
   - Add grounding radial-gradient drop shadows (`.unit-shadow`) under each unit.
   - Implement visual combat animations (shooting recoil, damage flash, death fading, turn transition effects).
3. Update `style.css`:
   - Change `image-rendering: pixelated` to `auto` to ensure high-resolution 2D illustrations remain smooth and unpixelated.
   - Add CSS classes for all 6 unit types, `.unit-shadow` grounding drop shadow, unit selection rings, and animation keyframes (`shoot-recoil`, `damage-flash`, `death-fade`).
4. Verification:
   - Run `npm test` (`node tests/run_all_tests.js`) and confirm that all 9 test suites pass with 100% success.
   - Test `node test.js` and `node fuzz_test.js` to ensure zero regressions.
