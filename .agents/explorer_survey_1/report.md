# Comprehensive Technical Survey & Architecture Report: ACOM

**Date:** 2026-08-26  
**Agent:** explorer_survey_1  
**Target Codebase:** `/Users/user/src/acom`  
**Mission:** Survey existing architecture, analyze rendering, grid, UI, server mechanics, test frameworks, and define the architectural blueprint for upgrading to high-resolution 2D illustration assets with 3 distinct allies, 3 distinct enemies, and a modernized tactical UI.

---

## 1. Executive Summary

The existing ACOM project is a turn-based tactical grid combat prototype built on a hybrid stack:
- **Backend:** Node.js Express server (`server.js`) maintaining state, grid generation, cover defense calculations, hit chance rolls, and enemy AI turns.
- **Frontend:** Vanilla JavaScript (`game.js`), HTML5 (`index.html`), and CSS3 (`style.css`) using CSS 3D perspectives (`perspective: 800px`, `rotateX(20deg)`) for a tilted tactical grid view.
- **Assets:** Currently uses 8-bit pixel art placeholders (`megaman.png`, `goomba.png`) with CSS `image-rendering: pixelated`.
- **Unit Architecture:** Hardcoded single-class logic where all players are identical "Mega Man" units and all enemies are identical "Goomba" units.
- **Test Infrastructure:** Includes deterministic test suite (`test.js`), an autonomous 5-minute bot (`bot.js`), and a 10,000-iteration fuzzer (`fuzz_test.js`).

To satisfy the overhaul requirements (ORIGINAL_REQUEST.md), the system must be systematically upgraded to support:
1. **6 High-Resolution 2D Illustration Assets** (3 distinct allies + 3 distinct enemies, strictly non-pixel-art transparent PNGs).
2. **Multi-Character Class Schema** with distinct tactical archetypes, combat stats, portraits, and skill configurations.
3. **Modernized Sci-Fi Tactical UI / Glassmorphism HUD** (Squad Roster, Unit Card with high-res portrait, dynamic Hit Calculation Preview, animated Phase Banners, Enhanced Combat Log, and Victory/Defeat Modals).
4. **Rendering & Depth Sorting Engine** (Dynamic Z-indexing, smooth high-res CSS rendering, projectile & floating damage animations).
5. **Backend State & API Enhancement** (Backward-compatible multi-unit support, `actorId` resilient resolution, distinct enemy AI behaviors).

---

## 2. Review of Existing Codebase & Components

### 2.1 File Catalog & Roles

| File | Lines | Size (Bytes) | Role & Key Mechanisms |
|---|---|---|---|
| `package.json` | 18 | 310 | Defines project dependencies (`express ^5.2.1`, `cors ^2.8.6`). |
| `server.js` | 293 | 9,622 | Express server (port 3000). Handles `/api/init`, `/api/init_random`, `/api/state`, `/api/action`. Generates 10x10 grid with procedural half/full cover, manages unit stats, executes combat math and enemy AI. |
| `index.html` | 55 | 1,874 | DOM skeleton. Contains `#game-container`, `<header>`, `#map-wrapper` (`#grid-container` + `#units-layer`), and `#ui-panel` (`#unit-info`, `#action-menu`, `#combat-log-container`). |
| `style.css` | 335 | 7,741 | CSS variables, radial background, X-axis 20deg tilt perspective, unit sprite sizing (150% scaled, top -40%), pixelated rendering, basic UI panel boxes. |
| `game.js` | 323 | 11,311 | Frontend game loop, DOM creation/updates for grid and units, action buttons, highlight calculation for move/shoot, API communication. |
| `bot.js` | 163 | 6,584 | Autonomous playtester simulating 5 minutes of multi-unit random matches against backend AI. |
| `test.js` | 76 | 2,635 | Deterministic test suite verifying init, move, shoot, and end_turn. |
| `fuzz_test.js` | 123 | 5,717 | Fuzz testing suite running 10,000 iterations to verify server stability and error handling. |
| `download.py` | 22 | 672 | Python helper script originally used to download 8-bit png assets. |
| `COLLABORATION.md` | 17 | 1,093 | Context & collaboration guidelines between agents. |

### 2.2 Existing Asset Analysis

An inspection of the existing image assets revealed:
- `megaman.png`: 860x751 PNG, 8-bit pixel art graphic.
- `goomba.png`: 860x721 PNG, 8-bit pixel art graphic.
- `megaman.jpg` / `goomba.jpg`: 1024x1024 JPEGs with solid white backgrounds (not transparent).
- `megaman_sprite.png`: Corrupted file containing HTML error page text.

**Finding:** All current graphics are either 8-bit pixel art or non-transparent/corrupted files. All must be replaced with fresh, high-resolution 2D illustrations with alpha transparency.

---

## 3. Deep Dive: Grid, Units, Sprites, and Rendering

### 3.1 Isometric Grid & Coordinate System
- **Grid Layout:** 10x10 2D matrix (`grid[y][x]`).
- **Tile Types:**
  - `0`: `TILE_EMPTY` (Passable, no cover)
  - `1`: `TILE_HALF_COVER` (Blocks movement, +20 Defense to adjacent defenders)
  - `2`: `TILE_FULL_COVER` (Blocks movement, +40 Defense to adjacent defenders)
- **Perspective Setup:**
  - `#map-wrapper` sets `perspective: 800px;` and dimensions `calc(var(--grid-width) * var(--cell-size))` (600px x 600px).
  - `#grid-container` and `#units-layer` both apply `transform: rotateX(20deg); transform-style: preserve-3d;`.
  - This produces a tilted tactical top-down perspective (20-degree pitch).

### 3.2 Unit Position Mapping & DOM Lifecycle
- Units are placed in `#units-layer` (which has `pointer-events: none` to let mouse events pass through to grid cells).
- In `game.js` (lines 170-172):
  ```javascript
  unitEl.style.left = `${unit.x * cellSize}px`;
  unitEl.style.top = `${unit.y * cellSize}px`;
  ```
- CSS transition on `.unit` (`transition: top 0.4s cubic-bezier(...), left 0.4s cubic-bezier(...)`) smoothly interpolates movement when coordinates update.

### 3.3 Sprite Presentation & Scaling
- In `style.css` (lines 184-195):
  ```css
  .unit-sprite {
      width: 150%;
      height: 150%;
      position: relative;
      top: -40%;
      background-size: contain;
      background-position: bottom center;
      background-repeat: no-repeat;
      filter: drop-shadow(3px 3px 2px rgba(0,0,0,0.8));
      z-index: 15;
      image-rendering: pixelated;
  }
  ```
- **Crucial Problem:** `image-rendering: pixelated;` forces nearest-neighbor interpolation. For high-resolution 2D illustration art (e.g. 512x512 or 1024x1024 illustrations), `image-rendering: pixelated` will create severe jagged pixel artifacts. It must be set to `image-rendering: auto;` or `image-rendering: -webkit-optimize-contrast;` with smooth filtering.
- **Depth Sorting Flaw:** Currently, `unitEl.style.zIndex` is hardcoded to `10` (or `100` when selected). Because sprites extend 40% above their tile, a unit at `(y=2)` may visually render on top of or under a unit at `(y=1)` based purely on DOM order. Dynamic depth sorting (`zIndex = unit.y * 10 + 5`) is required.

---

## 4. Deep Dive: UI Layout & Components

### 4.1 Existing UI Limitations

```
+-------------------------------------------------------------+
| HEADER: Mega Man vs Mario | PLAYER TURN | AP: 2             |
+-------------------------------------------------------------+
|                                                             |
|                   [ 10x10 Tilted Grid ]                     |
|                                                             |
+-------------------------------------------------------------+
| UNIT INFO       | ACTION MENU          | COMBAT LOG         |
| Name: MEGAMAN_1 | [ Move (1 AP) ]      | [Log entry 1]      |
| HP: 10/10       | [ Shoot (1 AP) ]     | [Log entry 2]      |
| Aim: 80%        | [ End Turn ]         | [Log entry 3]      |
| Mobility: 4     |                      |                    |
+-------------------------------------------------------------+
```

1. **No Squad Overview:** The player controls multiple units, but the UI only displays the single currently selected unit. There is no squad roster to view ally health or click to switch soldiers.
2. **No Pre-Shot Target Preview:** When a player clicks "Shoot" and hovers/clicks an enemy, there is no HUD showing expected hit chance, cover penalties, or damage estimate. The player only finds out the hit roll after the shot has resolved.
3. **Basic Health Bars:** Units have a simple 6px green/red bar without segments, shields, or armor indicators.
4. **Lack of Visual Feedback:** No visual projectile tracers, laser blasts, melee slashes, or floating combat text triggers in `game.js`.
5. **No Turn Banners or Phase Transitions:** Turns switch abruptly without cinematic transition banners.
6. **No Game Over / Victory Screen:** When all enemies or players die, the game simply prints a text line in the log. There is no modal dialog or replay action.

---

## 5. Architectural Upgrade Blueprint

### 5.1 Character Class Matrix (3 Allies vs 3 Enemies)

To deliver a rich, balanced tactical experience with distinct high-res 2D illustration characters:

#### Allies (Player Squad)
| Character / Class | Archetype | Stats (HP / AP / Mob / Aim / Dmg / Range) | Tactical Specialty |
|---|---|---|---|
| **Mega Man (Buster Commando)** | Rapid Scout / Versatile | HP: 10, AP: 2, Mob: 5, Aim: 85%, Dmg: 4, Rng: 8 | Balanced frontline scout with high mobility and reliable plasma fire. |
| **Proto Man (Vanguard Shield)** | Heavy Armored Tank | HP: 14, AP: 2, Mob: 3, Aim: 75%, Dmg: 5, Rng: 6 | High durability, fortified shield providing innate cover defense. |
| **Zero (Cyber Infiltrator)** | Precision Sniper / Operative | HP: 8, AP: 2, Mob: 4, Aim: 95%, Dmg: 6, Rng: 10 | High precision single-target burst damage and long-range threat. |

#### Enemies (Alien / Invader Squad)
| Character / Class | Archetype | Stats (HP / AP / Mob / Aim / Dmg / Range) | Tactical Specialty |
|---|---|---|---|
| **Goomba (Swarm Infantry)** | Fast Grunt | HP: 6, AP: 2, Mob: 4, Aim: 65%, Dmg: 3, Rng: 4 | Fast swarming infantry that rushes player positions. |
| **Koopa Troopa (Armored Bruiser)** | Shell Tank | HP: 12, AP: 2, Mob: 3, Aim: 70%, Dmg: 4, Rng: 6 | Durable armored fighter with shell protection. |
| **Hammer Bro (Heavy Demolisher)** | Artillery Demolisher | HP: 8, AP: 2, Mob: 3, Aim: 80%, Dmg: 5, Rng: 8 | Heavy ranged bombardment that deals heavy damage. |

### 5.2 Data Model Enhancement (`server.js` & `game.js`)

```typescript
interface Unit {
    id: string;              // e.g. 'ally_buster', 'ally_vanguard', 'ally_sniper'
    classKey: string;        // 'buster' | 'vanguard' | 'sniper' | 'grunt' | 'tank' | 'artillery'
    name: string;            // 'Mega Man (Buster)', 'Proto Man (Vanguard)', etc.
    type: 'player' | 'enemy';
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    ap: number;
    maxAp: number;
    mobility: number;
    aim: number;
    weaponDamage: number;
    weaponRange: number;
    sprite: string;          // e.g. 'assets/units/ally_buster.png'
    portrait: string;        // e.g. 'assets/portraits/ally_buster.png'
}
```

### 5.3 Modernized Tactical UI / DOM Structure

```html
<div id="game-container">
    <!-- TOP TACTICAL HUD -->
    <header class="tactical-header">
        <div class="header-left">
            <h1 class="game-logo"><span class="logo-accent">ACOM</span> // TACTICAL OVERWATCH</h1>
            <div class="mission-info">OPERATION: METALLIC RESISTANCE</div>
        </div>
        <div class="header-center">
            <div id="turn-banner-pill" class="phase-pill player-phase">
                <span class="phase-pulse"></span>
                <span id="turn-indicator">PLAYER PHASE</span>
            </div>
            <div id="round-counter">ROUND 01</div>
        </div>
        <div class="header-right">
            <div id="ap-display" class="ap-badge">
                <span class="ap-label">ACTIVE AP</span>
                <div id="ap-pips" class="ap-pips">
                    <span class="pip active"></span>
                    <span class="pip active"></span>
                </div>
            </div>
        </div>
    </header>

    <!-- SQUAD ROSTER DOCK -->
    <div id="squad-roster" class="squad-roster">
        <!-- 3 Ally Quick-Select Cards with mini-portraits and HP bars -->
    </div>

    <!-- MAIN BATTLEFIELD -->
    <div id="map-wrapper" class="tactical-map">
        <div id="grid-container"></div>
        <div id="fx-layer"></div>
        <div id="units-layer"></div>
    </div>

    <!-- TARGET PREVIEW HUD OVERLAY -->
    <div id="target-preview-panel" class="target-preview hidden">
        <!-- Target Name, Hit %, Cover Modifier, Expected Damage -->
    </div>

    <!-- BOTTOM COMMAND CONSOLE -->
    <div id="ui-panel" class="command-console">
        <!-- Unit Card with High-Res Portrait & Detailed Stats -->
        <div class="panel-box unit-card" id="unit-info">
            <div class="unit-portrait-container">
                <img id="unit-portrait" class="unit-portrait-img" src="" alt="Unit Portrait">
                <span id="unit-class-tag" class="class-badge">COMMANDO</span>
            </div>
            <div class="unit-stats-container">
                <h3 id="unit-name">UNIT NAME</h3>
                <div class="stat-bar-group">
                    <div class="stat-label-row">
                        <span>HEALTH</span>
                        <span id="unit-hp-text">10/10</span>
                    </div>
                    <div class="hp-track"><div id="unit-hp-fill" class="hp-fill"></div></div>
                </div>
                <div class="stat-grid">
                    <div class="stat-node"><span class="stat-lbl">AIM</span><span id="unit-aim" class="stat-val">85%</span></div>
                    <div class="stat-node"><span class="stat-lbl">MOBILITY</span><span id="unit-mobility" class="stat-val">5</span></div>
                    <div class="stat-node"><span class="stat-lbl">DAMAGE</span><span id="unit-damage" class="stat-val">4</span></div>
                    <div class="stat-node"><span class="stat-lbl">RANGE</span><span id="unit-range" class="stat-val">8</span></div>
                </div>
            </div>
        </div>

        <!-- Action Command Buttons -->
        <div class="panel-box action-console" id="action-menu">
            <h3>TACTICAL ACTIONS</h3>
            <div class="action-grid">
                <button id="btn-move" class="action-btn move-btn">
                    <span class="btn-icon">⚡</span>
                    <span class="btn-text">MOVE <small>(1 AP)</small></span>
                </button>
                <button id="btn-shoot" class="action-btn shoot-btn">
                    <span class="btn-icon">🎯</span>
                    <span class="btn-text">FIRE BUSTER <small>(1 AP)</small></span>
                </button>
                <button id="btn-end-turn" class="action-btn end-turn-btn">
                    <span class="btn-icon">⏳</span>
                    <span class="btn-text">END TURN</span>
                </button>
            </div>
        </div>

        <!-- Combat & Tactical Log -->
        <div class="panel-box combat-terminal" id="combat-log-container">
            <div class="terminal-header">
                <h3>TACTICAL LOG</h3>
                <span class="terminal-live-badge">LIVE</span>
            </div>
            <div id="combat-log" class="terminal-feed"></div>
        </div>
    </div>

    <!-- VICTORY / DEFEAT MODAL OVERLAY -->
    <div id="game-modal" class="modal-overlay hidden">
        <div class="modal-card">
            <h2 id="modal-title">MISSION ACCOMPLISHED</h2>
            <p id="modal-message">All hostile entities eliminated.</p>
            <button id="btn-restart" class="action-btn modal-btn">REDEPLOY SQUAD</button>
        </div>
    </div>
</div>
```

---

## 6. Technical Bottlenecks & Remediation Plan

### 6.1 Server API Backward Compatibility & Test Fix
- **Problem Observed:** In `test.js:29`, the request payload for `action: 'move'` passes `{ x: 2, y: 1 }` without explicitly providing `actorId`. In `server.js:249`, `const { actorId } = payload;` causes `player` to be undefined, returning HTTP 400 and breaking `test.js`.
- **Solution:** In `server.js`, provide robust actor fallback:
  ```javascript
  const actorId = payload.actorId || gameState.units.find(u => u.type === 'player' && u.hp > 0 && u.ap > 0)?.id;
  ```
  This guarantees that legacy tests, fuzz tests, and multi-unit squad interactions all succeed seamlessly.

### 6.2 High-Resolution Asset Rendering & Performance
- **Image Artifacts Prevention:** Ensure CSS styles for `.unit-sprite` drop `image-rendering: pixelated` in favor of standard high-DPI bilinear filtering.
- **Z-Index Sorting:** Implement dynamic Z-index updates:
  ```javascript
  unitEl.style.zIndex = (unit.y * 10) + (unit.id === selectedActorId ? 100 : 5);
  ```
- **Asset Dimensions & Placement:** Standardize all 6 high-res character assets to square bounding boxes with anchor points centered at the bottom of the character's feet.

### 6.3 Action Animations & FX
- Add a lightweight `#fx-layer` on top of the grid to draw:
  - Energy laser tracer / projectile lines from `(x1, y1)` to `(x2, y2)`.
  - Hit flash effects and dynamic floating damage popups (`-4 DMG`, `CRITICAL!`, `MISS!`).
  - Screen shake on heavy impact.

---

## 7. Verification Strategy & Acceptance Matrix

1. **Asset Integrity Check:**
   - Verify 6 PNG files exist in the project asset directory.
   - Verify image dimensions, RGBA transparency, and non-pixel-art style.
2. **Automated Server Tests:**
   - Execute `node test.js` to ensure 100% pass on initialization, movement, firing, and turn cycle.
   - Execute `node fuzz_test.js` to verify zero 500 errors over 10,000 iterations.
   - Execute `node bot.js` to confirm automated multi-match gameplay with balanced win rates.
3. **Headless Browser & DOM Verification:**
   - Automated script to verify that all 6 characters load without 404 network errors or console errors.
   - Layout inspection verifying no element clipping, overlapping, or perspective distortions.
