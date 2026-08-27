## 2026-08-26T13:46:18Z
You are worker_m3, an implementation worker subagent for Milestone 3 (Massive Tactical UI Overhaul).
Your working directory is: /Users/user/src/acom/.agents/worker_m3
Original request file: /Users/user/src/acom/.agents/ORIGINAL_REQUEST.md
Master project specification: /Users/user/src/acom/PROJECT.md
Test infrastructure specification: /Users/user/src/acom/TEST_INFRA.md
Test readiness publication: /Users/user/src/acom/TEST_READY.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Tasks:
Redesign and upgrade the game UI in `index.html`, `style.css`, and `game.js` to a polished, high-resolution 2D sci-fi tactical HUD matching the 2D illustration aesthetic:
1. **Squad Roster Dock**:
   - Create a tactical squad dock displaying quick-select ally cards for all 3 player units (`ally_assault`, `ally_recon`, `ally_heavy`).
   - Each card displays character miniature portrait, class name, current HP bar / Max HP, and AP gauge.
   - Clicking an ally card sets that unit as the active actor (`selectedActorId`).
2. **Command Console**:
   - Modernize the active unit command console with:
     - Large active character portrait (`assets/characters/ally_assault.png`, etc.).
     - Class badge, Name, HP bar, AP pips/meters.
     - Weapon stats: Attack Damage, Range, Aim/Hit chance.
     - Stylized neon-accented action buttons (Move [M], Shoot [S], End Turn [Space/E]).
3. **Interactive Target Preview HUD**:
   - Floating/docked tactical preview when hovering over or selecting an enemy target.
   - Displays target portrait, target class name, live calculated Hit Chance %, cover status (Half Cover +20%, Full Cover +40%, Flanked/No Cover), and expected damage before firing.
4. **Combat Terminal & Turn Banners**:
   - Cyberpunk/military sci-fi themed combat log terminal with colored badge tags ([MOVE], [HIT], [MISS], [CRIT], [DEFEAT]).
   - Full-screen animated turn transition banners (`PLAYER PHASE` in cyan/blue, `ENEMY PHASE` in crimson/red).
   - Victory and Defeat end-of-mission modal dialogs with restart / re-deploy buttons.
5. **DOM Lifecycle & Layout Collision Prevention**:
   - In `game.js`, ensure `init()` / squad re-initialization clears stale `.unit` elements from `#units-layer` so orphaned DOM nodes never accumulate.
   - In `style.css`, ensure layout geometry maintains strict vertical clearance (`#ui-panel` / bottom dock positioned cleanly below the isometric grid container: `#ui-panel.top >= #grid-container.bottom + 10px`) so UI panels never clip or occlude the isometric map.
6. **Visual Polish & Styling**:
   - Glassmorphism dark theme (`backdrop-filter: blur()`, semi-transparent slate/navy panels, glowing cyan and amber borders).
   - High-resolution font rendering, smooth transitions, pulsing selection indicators on the map, and hover tooltips.
7. **Verification**:
   - Run `npm test` (`node tests/run_all_tests.js`) and confirm all 10 test suites pass with 100% success rate.
   - Verify `node tests/validate_dom_network.js` (0 404s, 0 console errors) and `node tests/validate_layout.js` (0 unit collisions, zero UI panel clipping).
