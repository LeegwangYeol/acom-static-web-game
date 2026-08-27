# Handoff Report: Acceptance Criteria, Test Infrastructure & Automated Validation Survey

**Agent**: `explorer_survey_3`  
**Working Directory**: `/Users/user/src/acom/.agents/explorer_survey_3`  
**Date**: 2026-08-26  
**Type**: Hard Handoff (Task Complete)  

---

## 1. Observation

1. **Acceptance Criteria Definition** (`/Users/user/src/acom/.agents/ORIGINAL_REQUEST.md:24-28`):
   ```markdown
   ### Automated Verification
   - [ ] Asset Check: A programmatic check confirms the existence of at least 6 distinct, valid transparent PNG files in the project directory that are strictly non-pixel-art.
   - [ ] DOM & Network Integrity: An automated script loads the game, verifies that all 6 characters can be dynamically spawned into the DOM, and confirms zero 404 network errors or console errors during rendering.
   - [ ] Layout Validation: A headless browser script verifies that unit HTML elements do not overlap improperly and that UI panels do not clip the isometric grid.
   ```

2. **Existing Game Server Implementation** (`/Users/user/src/acom/server.js:48-59`, `63-109`, `221-285`):
   - Express 5.2.1 app running on port 3000.
   - `POST /api/init` spawns 1 player (`megaman_1`) and 1 enemy (`goomba_1`).
   - `POST /api/init_random` accepts `{ players: N, enemies: M }` but hardcodes ID prefixes `megaman_${i}` and `goomba_${i}` with uniform stats.
   - `POST /api/action` processes `move`, `shoot`, and `end_turn` synchronously.

3. **Current Asset State & Pixel Art Characteristics** (`/Users/user/src/acom/style.css:194-204`, tested via `test_asset_validator.js`):
   - `style.css:194`: `image-rendering: pixelated; /* Ensures 8-bit sprites stay crisp */`.
   - `megaman.png`: 860x751, 8-bit RGBA, unique opaque colors: 490, intermediate alpha ratio: `0.0000` (binary alpha, hard pixel edges), `pixelArtScore: 1.0`.
   - `goomba.png`: 860x721, 8-bit RGBA, unique opaque colors: 5, intermediate alpha ratio: `0.0000`, `pixelArtScore: 1.0`.
   - Both existing files fail the high-res 2D illustration criterion.

4. **Existing Test Scripts** (`/Users/user/src/acom/test.js`, `fuzz_test.js`, `bot.js`, `package.json:6-8`):
   - `package.json`: `"scripts": { "test": "echo \"Error: no test specified\" && exit 1" }`.
   - `test.js`: 4 assertion steps (`init`, `move`, `shoot`, `end_turn`) testing 1v1 backend state only.
   - `fuzz_test.js`: 10,000-iteration stress test validating AP bounds, HP bounds, and bad request rejection.
   - `bot.js`: 5-minute automated match simulator tracking win rates.

5. **Runtime Tooling & Environment Capabilities**:
   - Node.js v25.8.1 with native `fetch`, `WebSocket`, `node:test`, `node:assert`, `zlib`, `crypto`.
   - Google Chrome v151 installed at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
   - Direct headless browser automation verified via Chrome DevTools Protocol (CDP) on WebSocket port with zero third-party dependencies.
   - macOS native utilities: `/usr/bin/sips`, `/usr/bin/file`, `/usr/bin/mdls`, `/usr/bin/jq`, `/usr/bin/bc`.

---

## 2. Logic Chain

1. **From Acceptance Criteria to Quantitative Metrics**:
   - The requirement for "strictly non-pixel-art" transparent PNGs requires an objective mathematical differentiator.
   - Observation 3 proves that pixel art exhibits $R_\alpha = 0.0$ (binary alpha step function) and low color space cardinality ($C \le 500$). True high-res 2D illustrations feature anti-aliased alpha boundary feathering ($R_\alpha \ge 0.005$) and rich gradient shading ($C \ge 1,000$).
   - Therefore, an automated asset validator (`validate_assets.js`) using Node `zlib` stream decompression can deterministically verify all 6 assets without external libraries.

2. **From DOM/Network Criteria to Headless Automation**:
   - Observation 1 requires zero 404 network errors, zero console errors, and dynamic 6-character DOM spawning.
   - Observation 5 confirms that macOS Chrome 151 can be spawned headlessly and controlled via CDP over built-in Node `WebSocket`.
   - Therefore, `validate_dom_network.js` can intercept CDP `Network.responseReceived` and `Console.messageAdded` events while evaluating `#units-layer .unit` count in real time.

3. **From Layout Criteria to Isometric Collision Math**:
   - Observation 1 requires unit HTML elements to not overlap improperly and UI panels not to clip the isometric grid.
   - `game.js:120-190` places units via `left`/`top` CSS transforms on a 10x10 isometric grid.
   - Bounding client rectangle arithmetic (`getBoundingClientRect()`) allows `validate_layout.js` to assert that:
     * Discrete unit base footprints have zero intersection area.
     * `#ui-panel.top >= #map-wrapper.bottom + 10px`.
     * Foreground units maintain higher CSS `z-index` than background units.

4. **From Fragmented Tests to 4-Tier Test Architecture & Gate Runner**:
   - Existing `test.js` and `fuzz_test.js` (Observation 4) cover only backend API logic.
   - Integrating all unit, regression, fuzz, asset, DOM, and layout checks under `tests/run_all_tests.js` mapped to `npm test` provides a single authoritative entry point producing `.agents/reports/gate_verdict.json` for Gate and Forensic Auditor sign-off.

---

## 3. Caveats

- **Network Port Selection in Test Environment**: If default port 3000 is occupied, test scripts should dynamically select an ephemeral port (e.g. 3001 or random available port) when spinning up the game server during headless CI runs.
- **Headless Chrome GPU Acceleration on macOS**: When running headless Chrome on macOS, flags `--headless=new`, `--disable-gpu`, `--no-sandbox`, and `--user-data-dir=/tmp/chrome-test-...` must be provided to ensure clean background process shutdown.
- **No Source Code Modifications Made**: Per agent constraints and global rules, this subagent acted strictly as a specification miner and did not modify any source code in `/Users/user/src/acom`. All script designs and prototypes are stored in `.agents/explorer_survey_3/` and detailed in `report.md`.

---

## 4. Conclusion

The specification survey for acceptance criteria, testing infrastructure, and automated validation methods is complete.
1. **Acceptance Criteria**: Formulated into exact mathematical, network, DOM, and layout metrics.
2. **Existing Test Suite**: Audited with clear upgrade path from 1v1 backend checks to full 3v3 multi-character squad verification.
3. **E2E Test Suite (Tiers 1-4)**: Fully architected covering Feature Coverage, Boundary & Corner Cases, Cross-Feature Combinations, and Real-World Scenarios.
4. **Validation Scripts & Gate Runner**: Fully designed (`validate_assets.js`, `validate_dom_network.js`, `validate_layout.js`, `run_all_tests.js`) outputting structured JSON schemas (`gate_verdict.json`).

---

## 5. Verification Method

To independently verify the findings and prototypes:

1. **Verify Asset Validator Prototype**:
   ```bash
   node /Users/user/src/acom/.agents/explorer_survey_3/test_asset_validator.js
   ```
   *Expected Result*: Analyzes `megaman.png` and `goomba.png`, correctly reporting `pixelArtScore: 1` and `isNonPixelArt: false`.

2. **Verify Chrome Headless & CDP Connectivity**:
   ```bash
   node -e '
   const { spawn } = require("child_process");
   const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--remote-debugging-port=9333", "--no-first-run", "--user-data-dir=/tmp/test-p"]);
   setTimeout(async () => {
     try {
       const res = await fetch("http://127.0.0.1:9333/json/version");
       const data = await res.json();
       console.log("Chrome CDP Available:", data.Browser);
     } finally { proc.kill(); }
   }, 1000);'
   ```
   *Expected Result*: Logs `Chrome CDP Available: Chrome/151.0.7922.174`.

3. **Inspect Specification Report**:
   ```bash
   cat /Users/user/src/acom/.agents/explorer_survey_3/report.md
   ```
