# Handoff Report: Codebase Survey & Architecture Investigation

**Agent:** explorer_survey_1  
**Working Directory:** `/Users/user/src/acom/.agents/explorer_survey_1`  
**Date:** 2026-08-26  
**Type:** Hard Handoff (Investigation Complete)

---

## 1. Observation

1. **Source Code Structure**:
   - `server.js` (293 lines): Express server serving static root and API endpoints (`/api/init`, `/api/init_random`, `/api/state`, `/api/action`).
     - Line 48-58: Spawns only 1 player `megaman_1` and 1 enemy `goomba_1`.
     - Line 93-108: `initRandomGame` spawns generic `megaman_${i}` and `goomba_${i}` with identical stat objects.
     - Line 249-254: Expects `payload.actorId`. When missing, `player` lookup fails (`undefined`), returning 400.
   - `game.js` (323 lines):
     - Line 135: `unitEl.className = \`unit \${unit.type === 'player' ? 'megaman' : 'goomba'}\`;` hardcoded to binary classes.
     - Line 170-172: Coordinates mapped to CSS `left: unit.x * cellSize px` and `top: unit.y * cellSize px`.
     - Line 184-188: Hardcoded `zIndex = 10` or `100` (missing Y-depth sorting).
   - `style.css` (335 lines):
     - Line 84-85: `#map-wrapper` with `perspective: 800px`.
     - Line 95: `#grid-container` with `transform: rotateX(20deg); transform-style: preserve-3d;`.
     - Line 168: `#units-layer` with `transform: rotateX(20deg); transform-style: preserve-3d;`.
     - Line 194: `.unit-sprite` has `image-rendering: pixelated;`, which distorts high-resolution 2D illustrations.
   - `index.html` (55 lines): Basic UI with `#unit-info`, `#action-menu`, `#combat-log-container`.
2. **Existing Image Files**:
   - `megaman.png`: 860x751 PNG (8-bit pixel art).
   - `goomba.png`: 860x721 PNG (8-bit pixel art).
   - `megaman.jpg` & `goomba.jpg`: 1024x1024 JPEGs (solid white backgrounds, not transparent).
   - `megaman_sprite.png`: HTML error text document (corrupted).
3. **Automated Test Results**:
   - Running `node test.js` failed at line 32 (`TypeError: Cannot read properties of undefined (reading 'find')`) because `test.js:29` sent a move payload without `actorId`, triggering a 400 error response from `server.js:253`.

---

## 2. Logic Chain

1. **Observation 1 & 2** show that the current rendering pipeline and data schema are hardcoded for 1 binary ally type (`megaman`) and 1 binary enemy type (`goomba`), using 8-bit pixelated assets and `image-rendering: pixelated`.
2. **Observation 1 (style.css & game.js)** demonstrates that units are placed on a 20-degree tilted grid with 150% sprite scaling and a -40% top offset. To prevent visual clipping when multiple units share columns, dynamic depth sorting (`zIndex = unit.y * 10 + 5`) must replace static Z-indexes.
3. **Observation 3 (test.js failure)** indicates that `server.js` requires `actorId` in `payload`, but `test.js` did not provide it. By adding a fallback (`payload.actorId || defaultPlayerId`), `server.js` becomes fully backward-compatible with existing tests, bots, and new multi-unit squad selections.
4. **Conclusion**: To fulfill the requirements in `ORIGINAL_REQUEST.md`, we must:
   - Procure 6 distinct high-resolution 2D illustration PNG assets with alpha transparency (3 allies, 3 enemies).
   - Expand the data schema in `server.js` and `game.js` to define 6 distinct tactical character classes with unique stats, portraits, and sprites.
   - Overhaul `index.html` and `style.css` into a modern sci-fi tactical HUD (squad bar, unit card, target preview, dynamic phase banners, polished combat terminal, and modal dialogs).
   - Modernize the rendering engine with bilinear smoothing and dynamic Y-depth sorting.

---

## 3. Caveats

- **Network Mode**: The server currently runs locally on port 3000. Static assets can be stored in an `assets/` subfolder and served directly via Express (`express.static('.')`).
- **Asset Sourcing**: The assets must be true 2D illustrations with transparent backgrounds (strictly non-8-bit, non-pixel-art).
- **Scope Limit**: As an explorer subagent, no project source code was modified. All findings and implementation blueprints are documented in `report.md` and `handoff.md`.

---

## 4. Conclusion

The codebase is lightweight, functional, and well-structured for rapid visual and architectural modernization. The exact architectural requirements, data model upgrades, CSS transformations, DOM redesigns, and test fixes have been comprehensively analyzed and documented in `/Users/user/src/acom/.agents/explorer_survey_1/report.md`.

---

## 5. Verification Method

To independently verify these findings:
1. **Source Inspection**: Inspect `server.js` lines 48-58, `game.js` lines 135 & 184, and `style.css` line 194.
2. **Asset Inspection**: Run `file megaman.png goomba.png megaman_sprite.png` to confirm 8-bit / corrupted files.
3. **Test Command**: Run `node server.js` in background and execute `node test.js` to observe the `actorId` payload error.
4. **Report Review**: Read `/Users/user/src/acom/.agents/explorer_survey_1/report.md` for the complete upgrade specification.
