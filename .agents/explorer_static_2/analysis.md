# Frontend Architecture Analysis & In-Memory Decoupling Specification
**Project**: ACOM (Tactical Warfare | Sci-Fi Turn-Based Combat)  
**Workspace**: `/Users/user/src/acom`  
**Author**: Explorer Subagent (`explorer_static_2`)  
**Date**: 2026-08-27  

---

## 1. Executive Summary

This report delivers a complete architectural catalog of all frontend logic in `game.js`, `index.html`, and `style.css` at `/Users/user/src/acom`. It establishes the comprehensive decoupling blueprint for migrating from the current stateful Node.js/Express architecture (`server.js`) to a 100% static, client-side application that can be hosted on static platforms (e.g. Vercel, GitHub Pages) or opened directly as `index.html` via `file:///` with zero server runtime dependencies.

### Core Architectural Findings
1. **Network Layer Footprint**: `game.js` currently communicates with `http://localhost:3000/api` through three HTTP endpoints: `POST /api/init`, `GET /api/state`, and `POST /api/action` (with additional testing suite usage of `POST /api/init_random`).
2. **State & Rendering Decoupling**: Visual rendering in `game.js` is cleanly decoupled from state generation. Functions like `render()`, `renderUnits()`, `renderSquadDock()`, and `renderTargetPreview()` consume a standard `gameState` object format.
3. **In-Memory Engine Viability**: All game logic currently residing in `server.js` (archetype dictionary, procedural 10x10 map generation, cover mechanics, line-of-sight/hit probability formulas, movement validation, AP management, and enemy AI heuristics) can be encapsulated inside an in-memory `AcomEngine` class inside `game.js`.
4. **Zero Visual Regression Guarantee**: The proposed in-memory adapter preserves all animations (shooting recoil, damage flashes, floating combat text, turn transition banners, death fades, pose switching) with identical timing and visual fidelity.

---

## 2. REST API & Network Dependency Catalog

The table below catalogs all HTTP network dependencies currently present in `game.js` and the test runner:

| Endpoint | Method | Trigger in `game.js` | Request Payload | Response Schema | Error Handling / Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/init` | `POST` | `init()` (Line 74) | Empty body | Full `gameState` object (3v3 default layout) | Network failure throws `TypeError` in `fetchJSON` |
| `/api/state` | `GET` | `fetchState()` (Line 62) | None | Current `gameState` snapshot | Throws error if server unreachable |
| `/api/action` | `POST` | `sendAction(action, payload)` (Line 173) | `{ action: 'move'\|'shoot'\|'end_turn', payload: { ...payload, actorId } }` | Updated `gameState` snapshot | 400 Bad Request if illegal action/actor |
| `/api/init_random` | `POST` | Automated E2E test suites (`validate_dom_network.js`, etc.) | `{ players: 3, enemies: 3 }` | Randomized `gameState` with custom squad counts | Used in automated headless tests |

### Detailed Request / Response Schemas

#### 1. `gameState` Object Schema
```typescript
interface GameState {
  grid: GridCell[][];          // 10x10 array of { x: number, y: number, type: 0|1|2 }
  units: Unit[];              // Array of player and enemy units (typically 6 for 3v3)
  currentTurn: 'player' | 'enemy';
  logs: string[];             // Max 20 historical combat/system log entries
}

interface GridCell {
  x: number;                  // Column (0-9)
  y: number;                  // Row (0-9)
  type: 0 | 1 | 2;            // 0: Empty, 1: Half Cover (+20%), 2: Full Cover (+40%)
}

interface Unit {
  id: string;                 // e.g. "ally_assault_1", "enemy_mutant_1"
  archetype: string;          // e.g. "ally_assault", "enemy_mutant"
  name: string;               // e.g. "Assault Ranger", "Bioweapon Mutant"
  type: 'player' | 'enemy';
  unitClass: 'assault' | 'recon' | 'heavy' | 'mutant' | 'infiltrator' | 'enforcer';
  portrait: string;           // "assets/characters/ally_assault.png"
  sprite: string;             // "assets/characters/ally_assault.png"
  x: number;                  // Grid X (0-9)
  y: number;                  // Grid Y (0-9)
  hp: number;                 // Current health
  maxHp: number;              // Maximum health
  ap: number;                 // Current action points (0-2)
  maxAp: number;              // Maximum action points (2)
  mobility: number;           // Move radius in Manhattan distance (3-5)
  aim: number;                // Base ballistic aim accuracy (60-85)
  weaponDamage: number;       // Base damage per hit (2-6)
  attack?: number;            // Alias for weaponDamage
  range: number;              // Max engagement range (4-6)
  hitChance?: number;         // Normalized base hit chance
  isAlive: boolean;           // True if hp > 0
}
```

#### 2. `action` Request Payloads
- **Move Action**:
  ```json
  {
    "action": "move",
    "payload": {
      "actorId": "ally_assault_1",
      "x": 2,
      "y": 1
    }
  }
  ```
- **Shoot Action**:
  ```json
  {
    "action": "shoot",
    "payload": {
      "actorId": "ally_assault_1",
      "targetId": "enemy_mutant_1"
    }
  }
  ```
- **End Turn Action**:
  ```json
  {
    "action": "end_turn",
    "payload": {
      "actorId": "ally_assault_1"
    }
  }
  ```

---

## 3. State Caching & Variable Lifecycle in `game.js`

### Global Variables
| Variable | Type | Purpose | Lifecycle / Mutation Rules |
| :--- | :--- | :--- | :--- |
| `gameState` | `Object \| null` | Master client-side copy of game state. | Set on init or updated after every action. Consumed by all render routines. |
| `selectedAction` | `'move' \| 'shoot' \| null` | Active tactical input mode. | Set when clicking Move/Shoot buttons or pressing hotkeys `M`/`S`. Cleared on action execution, Escape, or unit re-selection. |
| `selectedActorId` | `string \| null` | ID of the currently selected player operative. | Set via `autoSelectActor()`, clicking a squad card, clicking a player sprite, or pressing `1-9`. Cleared during enemy phase. |
| `hoveredTargetId` | `string \| null` | ID of enemy currently hovered on grid/sprite. | Set on `mouseenter` of enemy cell/unit; cleared on `mouseleave`. Used by `renderTargetPreview()`. |
| `lastTurn` | `'player' \| 'enemy' \| null` | Tracks turn transitions. | Compared against `gameState.currentTurn` to trigger `showTurnBanner()`. |
| `ui` | `Object` | Cached DOM element references. | Initialized once on script evaluation (contains 36 key element references). |

### UI Element Cache (`ui`)
`ui` maps key DOM elements by ID for instant access:
- **Header**: `turnIndicator`, `apCounter`
- **Battlefield**: `gridContainer`, `unitsLayer`, `squadDock`
- **Active Unit Console**: `unitName`, `unitHp`, `unitHpFill`, `unitAim`, `unitMobility`, `unitDamage`, `unitRange`, `unitClassBadge`, `unitPortraitImg`, `btnMove`, `btnShoot`, `btnEndTurn`
- **Target Diagnostics**: `targetPreviewIdle`, `targetPreviewActive`, `targetPortraitImg`, `targetName`, `targetHpText`, `targetHpFill`, `targetCoverBadge`, `targetHitChance`, `targetBaseAim`, `targetCoverMod`, `targetDistMod`, `targetExpectedDmg`, `targetClassBadge`
- **Combat Terminal**: `combatLog`
- **Overlays / Modals**: `turnBanner`, `turnBannerText`, `missionModal`, `modalTitle`, `modalSubtitle`, `modalStatStatus`, `modalStatSurvivors`, `modalStatKills`, `btnRedeploy`

---

## 4. DOM Rendering Pipeline & UI Layout

The game battlefield uses an isometric perspective viewport (`perspective: 850px; transform: rotateX(20deg); transform-style: preserve-3d;`).

```
+-------------------------------------------------------------------------------+
| #game-container (Max 1180px, Glassmorphism, Neon Cyan Border)                |
|                                                                               |
|  [Header: Title Crest | Tactical Phase | Action Pool]                        |
|                                                                               |
|  [#squad-dock: Horizontal Scrollable Roster of Ally Unit Cards]               |
|                                                                               |
|  [#map-wrapper: 600px x 600px 3D Isometric Viewport]                          |
|   ├── #grid-container (10x10 .cell Grid, .cover-half, .cover-full)            |
|   └── #units-layer (Absolute Layer: .unit, .unit-shadow, .unit-sprite, HP)    |
|                                                                               |
|  [#ui-panel: 3-Column Tactical HUD Layout]                                    |
|   ├── #unit-info (Active Operative Console + Action Menu [M][S][SPACE])       |
|   ├── #target-preview-panel (Live Ballistic Hit % & Cover Diagnostics)       |
|   └── #combat-log-container (Live Terminal Feed with Event Badges)            |
+-------------------------------------------------------------------------------+
```

### Key Rendering Subsystems

#### 1. Grid & Obstacle Initialization (`renderGridOnce()`)
- Clears `#grid-container` and dynamically reads `GRID_WIDTH` and `GRID_HEIGHT` from `gameState.grid`.
- Sets root CSS variables `--grid-width` and `--grid-height`.
- Generates 100 `.cell` elements with `dataset.x` and `dataset.y`.
- Injects 3D cover meshes: `.cover-half` (height: 45%) and `.cover-full` (height: 85%).
- Attaches mouse listeners (`click`, `mouseenter`, `mouseleave`) to each cell.

#### 2. Unit Layer Synchronization (`renderUnits()`)
- **Stale DOM Pruning**: Identifies existing `.unit` elements whose IDs no longer exist in `gameState.units` and removes them.
- **Dynamic Entity Creation**:
  - Container: `.unit.${unit.type}.${archClass}.${unitClass}`
  - Shadow: `.unit-shadow` (Radial gradient with ellipse `rgba(0,0,0,0.8)` or glowing cyan when selected).
  - Sprite: `.unit-sprite` with `backgroundImage = url(unit.sprite)`, anchored bottom-center (`bottom: 8px; left: 50%; transform: translateX(-50%)`).
  - Health Bar: `.unit-hp-bar` with `.unit-hp-fill` scaled from 0% to 100%.
- **Coordinate Transformation**:
  - `left = unit.x * cellSize + 'px'`
  - `top = unit.y * cellSize + 'px'`
  - CSS smooth transition: `transition: top 0.4s cubic-bezier(...), left 0.4s cubic-bezier(...)`.
- **Dynamic Depth Sorting Formula**:
  $$\text{baseZIndex} = y \times 10 + 5$$
  $$\text{zIndex} = \begin{cases} \text{baseZIndex} + 100 & \text{if unit is selected} \\ \text{baseZIndex} & \text{otherwise} \end{cases}$$
  This prevents foreground sprites from being improperly occluded by background tiles or units.
- **Death Handling**:
  - When `unit.hp <= 0`, applies `.death-fade` animation, sets pose to `'dead'`, and removes DOM node after 800ms.

---

## 5. HUD Component Controllers & Interactive Subsystems

### 1. Squad Roster Dock (`renderSquadDock()`)
- Iterates over all player units (`u.type === 'player'`).
- Renders rich operative card:
  - Unit portrait (`squad-card-portrait`)
  - Operative name & class badge (`squad-card-badge`)
  - Mini health gauge (`squad-card-hp-fill`)
  - Health ratio (`X/Y HP`) and Action Points (`AP: X/Y` or `K.I.A.` if dead).
- States: `.selected` (active operative highlighted in cyan gradient) and `.defeated` (grayscale, disabled).
- Interaction: Clicking an alive squad card selects the operative immediately.

### 2. Operative Console (`updateUI()`)
- Displays large active portrait with cyan border and glow.
- Updates unit name, current HP bar and numerical ratio, class badge, Aim (%), Mobility, Weapon Damage, Range.
- Updates global Action Pool counter (`#ap-counter`).
- Action Button state bindings:
  - **Tactical Move (`#btn-move`)**: Enabled when `player.ap > 0` and `turn === 'player'`.
  - **Engage Target (`#btn-shoot`)**: Enabled when `player.ap > 0` and `turn === 'player'`.
  - **Pass Turn (`#btn-end-turn`)**: Enabled when `turn === 'player'`.
  - Standby state: When no operative selected or during enemy turn, all buttons are disabled.

### 3. Interactive Target Diagnostics Preview (`renderTargetPreview()`)
- **Idle State (`#target-preview-idle`)**: Renders spinning radar sweep animation with crosshair when no target is hovered or selected.
- **Active State (`#target-preview-active`)**:
  - Displays target enemy portrait, name, class badge, mini HP bar.
  - **Live Ballistic Hit Calculation**:
    1. Examines 4 adjacent orthogonal tiles around target ($x \pm 1, y \pm 1$):
       - If `TILE_HALF_COVER` present $\rightarrow \text{coverDefense} = \max(\text{coverDefense}, 20)$
       - If `TILE_FULL_COVER` present $\rightarrow \text{coverDefense} = \max(\text{coverDefense}, 40)$
    2. Computes Manhattan distance: $\text{dist} = |x_1 - x_2| + |y_1 - y_2|$
    3. Calculates estimated hit chance:
       $$\text{hitChance} = \max(0, \min(100, \text{aim} - \text{coverDefense} - (\text{dist} \times 2)))$$
    4. Displays breakdowns: Base Aim, Cover Defense modifier, Distance penalty ($-2\text{x}\%$ with tile count), Expected Damage with `[LETHAL]` badge in neon crimson if damage exceeds target HP.
    5. Displays Cover Badge: `FULL COVER (+40%)`, `HALF COVER (+20%)`, or `NO COVER (FLANKED)`.

### 4. Combat Terminal Feed (`renderLogs()`)
- Displays the last 20 combat events in reverse chronological order.
- Automatically regex-parses event content to apply military tactical tags:
  - `[MOVE]` (`.tag-move`) for unit relocations.
  - `[HIT]` (`.tag-hit`, `.damage`) for successful attacks.
  - `[MISS]` (`.tag-miss`) for deflected shots.
  - `[KILL]` (`.tag-kill`) for eliminated operatives/threats.
  - `[PHASE]` (`.tag-phase`) for turn switches.
  - `[CALC]` (`.tag-calc`) for hit formula breakdowns.
  - `[SYS]` (`.tag-sys`) for system status.
- Borders are color-coded: cyan left border (`.player-action`) for ally actions, crimson left border (`.enemy-action`) for hostile actions.

### 5. Fullscreen Turn Transition Banner (`showTurnBanner(turn)`)
- Triggers on turn handoff (`player` $\leftrightarrow$ `enemy`).
- Slides in with animated glitch overlay, displaying `PLAYER PHASE` in neon cyan or `ALIEN ACTIVITY` in neon crimson.
- Automatically auto-dismisses after 1200ms.

### 6. Mission Outcome Modal (`checkEndgame()`)
- Evaluates victory condition: all enemies defeated (`aliveEnemies === 0 && totalEnemies > 0`).
- Evaluates defeat condition: all allies lost (`alivePlayers === 0 && totalPlayers > 0`).
- Displays victory/defeat card with outcome banner, survivor stats (`X / Y`), enemy kill count (`X / Y`), and a `REDEPLOY STRIKE TEAM` button that triggers a fresh game initialization.

---

## 6. User Input & Hotkey Handling Matrix

| Key / Control | Event Target | Condition | Action Executed |
| :--- | :--- | :--- | :--- |
| `M` or `m` | `window` keydown / `#btn-move` | `player.ap > 0 && turn === 'player'` | Sets `selectedAction = 'move'`, invokes `highlightMovableCells()` |
| `S` or `s` | `window` keydown / `#btn-shoot` | `player.ap > 0 && turn === 'player'` | Sets `selectedAction = 'shoot'`, invokes `highlightTargetableCells()` |
| `Space` or `E` / `e` | `window` keydown / `#btn-end-turn` | `turn === 'player'` | Dispatches `end_turn` action |
| `1` - `9` | `window` keydown | Alive player unit at index | Quick-selects player operative $N$, clears highlights, renders UI |
| `Escape` | `window` keydown | Any time | Cancels `selectedAction`, clears cell highlights |
| `Enter` or `Space` | `window` keydown | When `#mission-modal` is active | Triggers `init()` to redeploy squad |
| Click on `.cell` | Grid Cell DOM | `turn === 'player'` | Handles `move` to cell or `shoot` target at cell coordinates |
| Click on `.unit.player` | Unit DOM | `turn === 'player'` | Selects player operative |
| Click on `.unit.enemy` | Unit DOM | `turn === 'player'` | If shooting, attacks enemy; otherwise targets enemy in Diagnostics HUD |
| Click on `.squad-card` | Squad Card DOM | `turn === 'player' && hp > 0` | Selects clicked ally operative |
| Click on `#btn-redeploy`| Modal Button | Any time | Triggers `init()` |

---

## 7. Visual FX, Animations & Pose Mechanics

1. **Shooting Recoil**:
   - Class: `.shoot-recoil` applied to attacker `.unit` for 450ms.
   - Pose: Invokes `setUnitPose(actor.id, 'attack', 500)`.
   - CSS Keyframes: `@keyframes shoot-recoil` kicks sprite upwards 7px with scale 1.08 and cyan brightness flash.
2. **Damage Flash**:
   - Class: `.damage-flash` applied to target `.unit` for 500ms.
   - Pose: Invokes `setUnitPose(target.id, 'hit', 500)`.
   - CSS Keyframes: `@keyframes damage-flash` spikes brightness to 2.5, contrast to 2.0 with crimson glow and horizontal shake.
3. **Floating Combat Text**:
   - `showFloatingText(x, y, text, color)` injects `.floating-text` at pixel coords.
   - Text: `"-X HP"` in `#ff3333` on hit; `"MISS"` in `#88bbff` on miss.
   - Keyframes: `@keyframes floatUp` moves text 35px upwards with 1.4x scale and fade-out over 1000ms.
4. **Tile Range Shaders**:
   - `.valid-move`: Green diagonal stripe overlay (`@keyframes pulse-move`) pulsing border and inner glow on reachable empty tiles.
   - `.valid-target`: Crimson diagonal stripe overlay (`@keyframes pulse-target`) pulsing border on hostile tiles.
5. **Death Dissolve**:
   - Class: `.death-fade` with `@keyframes death-fade` (800ms duration) fades opacity to 0, shrinks scale to 0.8, and applies full grayscale.

---

## 8. Global Test Hooks & Testing Surface Catalog

To allow automated headless test suites, bot scripts, and developer debugging to inspect and drive the game without network dependencies or HTTP servers, the following surface must be exposed on `window`:

```javascript
// Formal Global Test Surface
window.__ACOM_ENGINE__ = acomEngine;  // Dedicated engine instance
window.__ACOM_GAME__ = {
  get state() { return gameState; },
  init: initGame,
  initRandom: initRandomGame,
  sendAction: sendAction,
  getSelectedUnit: getSelectedUnit,
  render: render
};

// Legacy Backward-Compatible Top-Level Properties
window.gameState = gameState;
window.init = init;
window.fetchState = async () => { render(); return gameState; };
```

This guarantees 100% compatibility with all existing validation scripts (`validate_dom_network.js`, `validate_layout.js`, `tier1_features.test.js`, etc.) while eliminating server requirements.

---

## 9. In-Memory Engine Architecture & Server Decoupling Strategy

### Migration Design: The Pure Client `AcomEngine`

All backend logic from `server.js` will be cleanly consolidated into an `AcomEngine` module / class within `game.js`.

```
+-------------------------------------------------------------------------------+
|                                game.js Architecture                           |
|                                                                               |
|  +-------------------------------------------------------------------------+  |
|  |                           AcomEngine                                    |  |
|  |  - ARCHETYPES Registry (3 Allies: Assault/Recon/Heavy, 3 Enemies)       |  |
|  |  - Procedural 10x10 Map Generator (Clear spawn zones, cover generation)|  |
|  |  - Squad Spawner (initGame, initRandomGame)                             |  |
|  |  - Action Validator & Dispatcher (move, shoot, end_turn)                |  |
|  |  - Ballistic Hit & Cover Resolver (executeShot, coverDefense, damage)  |  |
|  |  - AI Enemy Turn Controller (processEnemyTurn, pathfinding, attacking)  |  |
|  |  - Combat Log Buffer (Max 20 entries)                                   |  |
|  +-------------------------------------------------------------------------+  |
|                                       │ State Mutations                       |
|                                       ▼                                       |
|  +-------------------------------------------------------------------------+  |
|  |                          UI / View Controller                           |  |
|  |  - DOM Event Listeners & Global Hotkeys                                 |  |
|  |  - Viewport Renderers (renderSquadDock, renderUnits, renderGridOnce)    |  |
|  |  - HUD Updaters (updateUI, renderTargetPreview, renderLogs)             |  |
|  |  - Visual FX & Animations (recoil, damage flash, floaters, banners)     |  |
|  |  - Endgame Modal Controller (checkEndgame, redeploy)                    |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
```

### Detailed Component Logic Migration

1. **Archetypes Registry**:
   Embed the 6 archetypes (`ally_assault`, `ally_recon`, `ally_heavy`, `enemy_mutant`, `enemy_scout`, `enemy_heavy`) with identical statistics, weapon damages, mobility ratings, aim values, and sprite paths into `game.js`.
2. **Squad Initialization**:
   - `initGame()`: Spawns default 3v3 squads at predefined clear coordinates (Assault at (1,1), Recon at (0,3), Heavy at (3,0); Mutant at (8,8), Scout at (9,5), Heavy at (5,9)).
   - `initRandomGame(playerCount, enemyCount)`: Spawns customizable squad sizes on random empty tiles.
3. **Action Processing**:
   - Replaces `fetchJSON(`${API_BASE}/action`)` with direct call to `acomEngine.dispatch(action, payload)`.
   - `dispatch()` validates legality (valid coordinates, mobility constraints, AP balance, target alive/enemy checks), updates state, and returns state synchronously or via Promise.
4. **Enemy Turn Execution**:
   - When `end_turn` is dispatched or player runs out of AP, `processEnemyTurn()` iterates over living enemies, computes Manhattan vector toward closest living player, advances position, executes ballistic shot if in range, and hands initiative back to the player with refreshed APs.
5. **Zero Network Calls**:
   - Remove `const API_BASE = ...`.
   - Replace `fetchJSON` calls with local engine operations.

---

## 10. Step-by-Step Implementation Plan for Implementer

1. **Step 1: Embed `ARCHETYPES` and State Management in `game.js`**:
   - Copy `ARCHETYPES` and `createUnit` helper from `server.js` to `game.js`.
   - Implement `initGame()` and `initRandomGame(playerCount, enemyCount)` inside `game.js`.
2. **Step 2: Implement Combat & Action Validation Rules**:
   - Implement `executeShot(attacker, defender)` with identical cover and distance penalty formulas.
   - Implement `processEnemyTurn()` for automated enemy AI behavior.
   - Implement `executeAction(action, payload)` with comprehensive input validation and error returning.
3. **Step 3: Update `sendAction()` and `init()` in `game.js`**:
   - Replace `fetchJSON(`${API_BASE}/init`)` with `initGame()` and local state assignment.
   - Replace `fetchJSON(`${API_BASE}/action`)` with `executeAction(action, payload)`.
   - Preserve all existing animation triggers (`shoot-recoil`, `damage-flash`, `showFloatingText`, `setUnitPose`, `showTurnBanner`).
4. **Step 4: Expose Global Test Hooks on `window`**:
   - Expose `window.__ACOM_ENGINE__`, `window.__ACOM_GAME__`, `window.gameState`, `window.init`, `window.fetchState`, `window.initRandomGame`.
5. **Step 5: Verify Static File Execution**:
   - Open `index.html` via `file:///` or headless browser without `server.js` running.
   - Verify game initializes, renders all 6 characters, responds to movement/shooting, runs enemy AI turns, and displays endgame modals with zero console errors or network 404s.

---

## 11. Conclusion

The frontend codebase is well-structured, modular, and ideally suited for serverless, static hosting. By encapsulating the game logic into an in-memory client engine within `game.js`, the game will achieve 100% decoupling from Node.js/Express, allowing seamless deployment on Vercel or any static web host while maintaining complete fidelity of gameplay, visuals, and animations.
