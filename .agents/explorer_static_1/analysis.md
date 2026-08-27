# Comprehensive Survey and Catalog of Backend Stateful Logic (`server.js`)
**Author**: `explorer_static_1` (Explorer Subagent)  
**Target Workspace**: `/Users/user/src/acom`  
**Purpose**: Complete architectural catalog of all stateful backend logic in `server.js` to prepare for static client-side migration into `game.js`.

---

## 1. Executive Summary & Overview
The current ACOM game architecture runs on a Node.js/Express backend (`server.js`) that maintains the authoritative game state (`gameState`), manages turn resolution, executes combat math and enemy AI heuristics, and exposes four REST API endpoints (`/api/init`, `/api/init_random`, `/api/state`, `/api/action`). The frontend (`game.js`) operates as a visual rendering client that communicates via asynchronous HTTP `fetch` requests.

To enable **pure static client-side execution** (compatible with Vercel, GitHub Pages, or direct `file://` opening of `index.html`), all stateful mechanisms, validation routines, procedural generators, combat calculators, and AI heuristics must be encapsulated in a client-side JavaScript engine module (e.g., `AcomEngine`) within `game.js`.

---

## 2. Component Catalog of `server.js`

### 2.1 Game State Data Structures
The backend maintains a single global object `gameState` and associated grid/tile constants:

```javascript
// Constants (server.js lines 10-14)
const GRID_WIDTH = 10;
const GRID_HEIGHT = 10;
const TILE_EMPTY = 0;
const TILE_HALF_COVER = 1;
const TILE_FULL_COVER = 2;

// Master Game State Object (server.js lines 154-159)
let gameState = {
    grid: [],           // 2D Array: grid[y][x] = { x, y, type }
    units: [],          // Array of Unit objects (allies and enemies)
    currentTurn: 'player', // 'player' | 'enemy'
    logs: []            // Array of strings, capped at 20 entries
};
```

#### Ring-Buffer Action Logging
```javascript
// server.js lines 161-164
function log(msg) {
    gameState.logs.push(msg);
    if (gameState.logs.length > 20) gameState.logs.shift(); // FIFO: keeps latest 20
}
```

---

### 2.2 Character Archetypes and Stats Registry
The archetype registry defines 6 tactical classes (3 Allies and 3 Enemies) with complete combat, mobility, and visual asset metadata (`server.js` lines 17-126):

| Archetype Key | Unit Name | Alignment (`type`) | Class (`unitClass`) | HP (Max) | AP (Max) | Mobility | Aim (%) | Dmg / Atk | Range | Base Hit | Asset Path (Portrait & Sprite) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `ally_assault` | Assault Ranger | `player` | `assault` | 10 | 2 | 4 | 80% | 4 | 5 | 0.85 | `assets/characters/ally_assault.png` |
| `ally_recon` | Recon Scout | `player` | `recon` | 8 | 2 | 5 | 85% | 3 | 6 | 0.85 | `assets/characters/ally_recon.png` |
| `ally_heavy` | Heavy Juggernaut | `player` | `heavy` | 14 | 2 | 3 | 70% | 6 | 4 | 0.70 | `assets/characters/ally_heavy.png` |
| `enemy_mutant` | Bioweapon Mutant | `enemy` | `mutant` | 8 | 2 | 4 | 65% | 3 | 4 | 0.65 | `assets/characters/enemy_mutant.png` |
| `enemy_scout` | Stealth Infiltrator | `enemy` | `infiltrator` | 6 | 2 | 5 | 75% | 2 | 5 | 0.75 | `assets/characters/enemy_scout.png` |
| `enemy_heavy` | Cyber Enforcer | `enemy` | `enforcer` | 12 | 2 | 3 | 60% | 5 | 4 | 0.60 | `assets/characters/enemy_heavy.png` |

#### Unit Instantiation Factory (`createUnit`)
```javascript
// server.js lines 128-152
function createUnit(archetypeKey, id, x, y) {
    const proto = ARCHETYPES[archetypeKey] || ARCHETYPES.ally_assault;
    return {
        id,
        archetype: proto.archetype,
        name: proto.name,
        type: proto.type,
        unitClass: proto.unitClass,
        portrait: proto.portrait,
        sprite: proto.sprite,
        x,
        y,
        hp: proto.hp,
        maxHp: proto.maxHp,
        ap: proto.ap,
        maxAp: proto.maxAp,
        mobility: proto.mobility,
        aim: proto.aim,
        weaponDamage: proto.weaponDamage,
        attack: proto.attack,
        range: proto.range,
        hitChance: proto.hitChance,
        isAlive: true
    };
}
```

---

### 2.3 Procedural Map Generation & Clearance Rules

The map is an orthogonal 10x10 isometric grid with two generation modes:

#### 1. Standard Campaign Generation (`initGame`, lines 166-204)
- **Spawn & Movement Clearance Coordinates**:
  ```javascript
  const clearPositions = [
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 0 },
      { x: 0, y: 3 }, { x: 3, y: 0 },
      { x: 8, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 7 }, { x: 9, y: 8 }, { x: 8, y: 9 },
      { x: 9, y: 5 }, { x: 5, y: 9 }
  ];
  ```
- **Cover Distribution (for cells outside `clearPositions`)**:
  - `Math.random() < 0.15` $\rightarrow$ `TILE_HALF_COVER` (`1`)
  - Else if `Math.random() < 0.1` $\rightarrow$ `TILE_FULL_COVER` (`2`)
  - Else $\rightarrow$ `TILE_EMPTY` (`0`)
- **Deterministic 3v3 Spawn Coordinates**:
  - `ally_assault_1` @ `(1, 1)`
  - `ally_recon_1` @ `(0, 3)`
  - `ally_heavy_1` @ `(3, 0)`
  - `enemy_mutant_1` @ `(8, 8)`
  - `enemy_scout_1` @ `(9, 5)`
  - `enemy_heavy_1` @ `(5, 9)`
- **Initial Log Message**: `"Tactical operation initialized. Player turn."`

#### 2. Random Skirmish Generation (`initRandomGame`, lines 206-258)
- Accepts `(playerCount = 3, enemyCount = 3)` parameters.
- Generates 10x10 grid with identical random cover distribution across the entire map.
- Spawns units on random empty tiles using `getRandomEmptyTile()` with a 500-attempt fallback that forcefully clears a tile if congested.
- Round-robin assigns archetypes from `['ally_assault', 'ally_recon', 'ally_heavy']` and `['enemy_mutant', 'enemy_scout', 'enemy_heavy']`.
- **Initial Log Message**: `Random Squad Skirmish initialized: ${playerCount} Allies vs ${enemyCount} Enemies.`

---

### 2.4 Action Validation & Processing Engine (`/api/action`)
The action handler processes three action types with strict state and boundary validation:

#### 1. Actor Resolution & Fallback (`server.js` lines 407-418)
- If `payload.actorId` is provided, select unit with that ID.
- Fallback for legacy / headless callers: selects first alive player with `ap > 0`, or first alive player.
- **Rejection Guard**: If `gameState.currentTurn !== 'player'` OR player unit does not exist OR `player.hp <= 0` $\rightarrow$ Reject with HTTP `400` (`{ error: "Not player turn or invalid actor." }`).

#### 2. Move Action (`action === 'move'`, lines 420-439)
- **Validation Rules**:
  1. `typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)`
  2. In-bounds: `0 <= x < 10` and `0 <= y < 10`
  3. AP check: `player.ap > 0`
  4. Manhattan Distance: $Dist = |player.x - x| + |player.y - y| \le player.mobility$
  5. Cell not occupied: No living unit (`hp > 0`) on `(x, y)`
  6. Cell not blocked by cover: `grid[y][x].type === TILE_EMPTY`
- **State Mutation**:
  - `player.x = x`
  - `player.y = y`
  - `player.ap -= 1`
  - Log: `${player.name || player.id} moved. (-1 AP)`
- **Failure**: Returns HTTP `400` (`{ error: "Invalid move." }`).

#### 3. Shoot Action (`action === 'shoot'`, lines 440-452)
- **Validation Rules**:
  1. `payload.targetId` is provided
  2. Target unit exists, is alive (`hp > 0`), and has `type === 'enemy'`
  3. `player.ap > 0`
- **State Mutation**:
  - Executes combat calculation: `executeShot(player, target)`
  - Action Point depletion: `player.ap = 0` (firing consumes all remaining AP and finishes the unit's turn)
- **Failure**: Returns HTTP `400` (`{ error: "Invalid target." }`).

#### 4. End Turn Action (`action === 'end_turn'`, lines 398-405)
- Depletes all living player units' AP: `alivePlayers.forEach(p => p.ap = 0)`
- Updates turn phase: `gameState.currentTurn = 'enemy'`
- Log: `"Enemy turn started."`
- Executes enemy AI: `processEnemyTurn()`
- Returns mutated `gameState`.

---

### 2.5 Line of Sight, Cover Defense & Hit Chance Calculation
Implemented in `executeShot(attacker, defender)` (`server.js` lines 328-372):

#### Mathematical Formula
$$\text{HitChance} = \text{clamp}_{[0, 100]}\Big(\text{Attacker.Aim} - \text{CoverDefense} - (2 \times \text{ManhattanDistance})\Big)$$

Where:
- $\text{ManhattanDistance} = |\text{Attacker.x} - \text{Defender.x}| + |\text{Attacker.y} - \text{Defender.y}|$
- $\text{CoverDefense}$ is calculated by inspecting the 4 orthogonal neighboring tiles around the defender:
  $$\{(0, -1), (0, 1), (-1, 0), (1, 0)\}$$
  - If any neighbor tile has `TILE_FULL_COVER` (`2`): $\text{CoverDefense} = 40\%$
  - Else if any neighbor tile has `TILE_HALF_COVER` (`1`): $\text{CoverDefense} = 20\%$
  - Else: $\text{CoverDefense} = 0\%$ (Flanked / Exposed)
- **Distance Falloff Penalty**: $-2\%$ per tile of Manhattan distance.

#### Combat Log Trace
`Shot calculation: Aim ${attacker.aim} - Cover ${coverDefense} - Dist ${dist*2} = ${hitChance}%`

---

### 2.6 Damage Resolution & Lethal Handling
- **Random Roll**: `roll = Math.random() * 100`
- **Hit Condition**: `roll <= hitChance`
  - `damage = attacker.weaponDamage || attacker.attack || 4`
  - `defender.hp -= damage`
  - Log: `${attacker.name || attacker.id} hit ${defender.name || defender.id} for ${damage} damage!`
  - **Lethal Check**:
    - If `defender.hp <= 0`:
      - `defender.hp = 0`
      - `defender.isAlive = false`
      - Log: `${defender.name || defender.id} defeated!`
- **Miss Condition**: `roll > hitChance`
  - Log: `${attacker.name || attacker.id} missed!`

---

### 2.7 Enemy AI Decision Engine (`processEnemyTurn`)
Executed synchronously upon transitioning to enemy turn (`server.js` lines 260-326):

```
                        [ Start Enemy Turn ]
                                  │
                  Find Living Enemies & Players
                                  │
                     ┌────────────┴────────────┐
                     ▼                         ▼
             Players Count == 0        Enemies Count == 0
             [ Strike team defeated ]   [ All enemies defeated ]
                     │                         │
                     └────────────┬────────────┘
                                  ▼
               For each living Enemy (AP = maxAp):
                                  │
                     Find Closest Living Player
                    (Min Manhattan Distance dist)
                                  │
                                  ▼
                         Is (distX + distY > 1)?
                                  │
                    ┌─────────────┴─────────────┐
                   YES                          NO
                    ▼                            │
         Try Step along X (newX)                 │
         - In grid, empty, unoccp? ──YES──> Move X, AP-1
         - Else Try Step along Y?  ──YES──> Move Y, AP-1
                    │                            │
                    └─────────────┬──────────────┘
                                  ▼
                    Distance after move <= Range?
                                  │
                    ┌─────────────┴─────────────┐
                   YES                          NO
                    ▼                            │
         Execute Shot(Enemy, Player)             │
                    │                            │
                    └─────────────┬──────────────┘
                                  ▼
                            Set AP = 0
                                  │
                           Next Enemy Unit
                                  │
                                  ▼
                  Check Living Players Remaining
                                  │
                    ┌─────────────┴─────────────┐
                   YES                          NO
                    ▼                            ▼
          gameState.currentTurn='player'   [ Strike team defeated ]
          Reset all Player AP = maxAp
          "Player turn started."
```

#### Movement Heuristics Breakdown
1. Calculates $\Delta X = Player.x - Enemy.x$ and $\Delta Y = Player.y - Enemy.y$.
2. Target candidate X tile: $newX = Enemy.x + \text{sign}(\Delta X)$.
3. Target candidate Y tile: $newY = Enemy.y + \text{sign}(\Delta Y)$.
4. Checks obstacle / cover / occupancy for both candidates.
5. **Priority**: X-axis movement attempted first; if blocked, Y-axis movement attempted.
6. AP is decremented by 1 upon movement.

#### Attack Heuristics Breakdown
1. Checks distance after movement: $distAfterMove \le (Enemy.range \mathbin{\Vert} 1)$.
2. If in range, logs `${enemy.name || enemy.id} attacks!` and calls `executeShot(enemy, closestPlayer)`.
3. Sets `enemy.ap = 0`.

---

### 2.8 Game Win/Loss Conditions
Win and loss evaluations occur in both `executeShot()` and `processEnemyTurn()`:
- **Player Victory**: `livingEnemies.length === 0` $\rightarrow$ Log: `"All enemies defeated. You Win!"`
- **Player Defeat**: `livingPlayers.length === 0` $\rightarrow$ Log: `"Strike team defeated. Game Over."`

---

### 2.9 REST API Contracts & Endpoint Payloads

| Endpoint | Method | Input Payload | Response Status & Payload |
|---|---|---|---|
| `/api/init` | `POST` | None (or empty body) | `200 OK`: `gameState` |
| `/api/init_random` | `POST` | `{ players?: number, enemies?: number }` | `200 OK`: `gameState` |
| `/api/state` | `GET` | None | `200 OK`: `gameState` |
| `/api/action` | `POST` | `{ action: "move" \| "shoot" \| "end_turn", payload: { actorId?, x?, y?, targetId? } }` | `200 OK`: `gameState`<br>`400 Bad Request`: `{ error: string }` |

---

## 3. Client-Side Migration Architecture (`AcomEngine`)

### 3.1 Design Principles
1. **Zero External Server Dependency**: `index.html` must function as a standalone web application when opened directly in a browser or served via static CDN (Vercel, GitHub Pages).
2. **State & Logic Parity**: The client-side engine must produce identical data structures, log entries, and validation outcomes.
3. **Dual Environment Support (Browser & Node.js)**: `AcomEngine` should be written as a clean JavaScript module with UMD/CommonJS/Global exports so that both browser runtime (`window.AcomEngine`) and headless Node.js test runners (`require('./game.js')` or `require('./engine.js')`) can consume it directly.
4. **Seamless UI Adapter**: Existing UI rendering functions in `game.js` (`render()`, `renderUnits()`, `renderSquadDock()`, `renderTargetPreview()`, `showTurnBanner()`, `setUnitPose()`, `showFloatingText()`) can continue operating without structural alterations by binding directly to `AcomEngine.getState()` and `AcomEngine.dispatchAction()`.

### 3.2 Target Class Architecture (`AcomEngine`)

```javascript
class AcomEngine {
    constructor() {
        this.GRID_WIDTH = 10;
        this.GRID_HEIGHT = 10;
        this.TILE_EMPTY = 0;
        this.TILE_HALF_COVER = 1;
        this.TILE_FULL_COVER = 2;
        this.ARCHETYPES = { /* ... 6 Archetypes ... */ };
        this.gameState = {
            grid: [],
            units: [],
            currentTurn: 'player',
            logs: []
        };
    }

    // Lifecycle & Initialization
    init() { /* Ported from server.js initGame */ }
    initRandom(playerCount = 3, enemyCount = 3) { /* Ported from server.js initRandomGame */ }
    getState() { return JSON.parse(JSON.stringify(this.gameState)); }

    // Action Dispatcher (Replaces POST /api/action)
    dispatchAction(action, payload = {}) {
        // Returns { success: true, state: this.getState() } or { success: false, status: 400, error: '...' }
    }

    // Core Mechanics
    calculateCoverDefense(unit) { /* Orthogonal 4-neighbor cover evaluation */ }
    calculateHitChance(attacker, defender) { /* Aim - Cover - 2*Dist */ }
    executeShot(attacker, defender) { /* Damage, Lethal, Win/Loss */ }
    processEnemyTurn() { /* Target heuristics, movement, attack */ }
    
    // Helper Query Methods for UI
    getMovableCells(unitId) { /* Returns Array of {x, y} */ }
    getTargetableEnemies(unitId) { /* Returns Array of living enemies */ }
}
```

### 3.3 Direct Comparison: `server.js` vs `AcomEngine` (Client-Side)

| Aspect | Backend Architecture (`server.js`) | Client-Side Architecture (`AcomEngine`) |
|---|---|---|
| **Hosting Requirement** | Node.js Express 5.2 Server on port 3000 | Pure static HTML5/CSS3/ES6 (Zero server runtime) |
| **State Storage** | Server-side in-memory `gameState` variable | Client-side `AcomEngine.gameState` instance |
| **Action Execution** | Asynchronous HTTP `fetch` + JSON serialization | Direct JavaScript method invocation (`dispatchAction`) |
| **Latency / Offline** | Dependent on network socket / localhost port | Zero latency, 100% offline capable |
| **Testing** | Requires spawning background Node process | Can be instantiated directly in unit & headless tests |

---

## 4. Risks, Edge Cases & Mitigation Strategies

1. **AP Depletion & Zero AP Rejections**:
   - *Risk*: Firing or moving with 0 AP must be rejected with `{ status: 400, error: '...' }`.
   - *Mitigation*: Ensure `dispatchAction` faithfully mirrors the HTTP 400 error schema.
2. **Actor Fallback Compatibility**:
   - *Risk*: Existing automated tests and hotkeys may omit `actorId` in `payload`.
   - *Mitigation*: Retain the fallback logic: `const activePlayer = gameState.units.find(u => u.type === 'player' && u.hp > 0 && u.ap > 0) || ...`.
3. **Enemy AI Step Ordering**:
   - *Risk*: Changing the X-then-Y heuristic priority could alter AI navigation behavior.
   - *Mitigation*: Strictly preserve the exact conditional branch: `if (distX !== 0 && emptyX && !unitAtX) ... else if (distY !== 0 && emptyY && !unitAtY) ...`.
4. **Log String Formatting**:
   - *Risk*: UI CSS badges depend on exact log substrings (e.g., `moved`, `hit`, `damage`, `missed`, `defeated`, `Player turn started.`).
   - *Mitigation*: Retain 100% verbatim log message formatting.

---

## 5. Conclusion
All components in `server.js` (data schemas, constants, archetype registries, procedural map generation, action validation, cover defense and hit calculations, combat damage resolution, enemy AI turn engine, and logging) are self-contained pure JavaScript routines with zero native or database dependencies. They can be ported cleanly into `game.js` as an encapsulated `AcomEngine` class/module, achieving 100% feature parity while fulfilling static hosting requirements.
