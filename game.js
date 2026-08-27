const GRID_WIDTH = 10;
const GRID_HEIGHT = 10;
const TILE_EMPTY = 0;
const TILE_HALF_COVER = 1;
const TILE_FULL_COVER = 2;

// 6 Character Archetypes (3 Allies, 3 Enemies)
const ARCHETYPES = {
    ally_assault: {
        archetype: 'ally_assault',
        name: 'Assault Ranger',
        type: 'player',
        unitClass: 'assault',
        portrait: 'assets/characters/ally_assault.png',
        sprite: 'assets/characters/ally_assault.png',
        hp: 10,
        maxHp: 10,
        ap: 2,
        maxAp: 2,
        mobility: 4,
        aim: 80,
        weaponDamage: 4,
        attack: 4,
        range: 5,
        hitChance: 0.85
    },
    ally_recon: {
        archetype: 'ally_recon',
        name: 'Recon Scout',
        type: 'player',
        unitClass: 'recon',
        portrait: 'assets/characters/ally_recon.png',
        sprite: 'assets/characters/ally_recon.png',
        hp: 8,
        maxHp: 8,
        ap: 2,
        maxAp: 2,
        mobility: 5,
        aim: 85,
        weaponDamage: 3,
        attack: 3,
        range: 6,
        hitChance: 0.85
    },
    ally_heavy: {
        archetype: 'ally_heavy',
        name: 'Heavy Juggernaut',
        type: 'player',
        unitClass: 'heavy',
        portrait: 'assets/characters/ally_heavy.png',
        sprite: 'assets/characters/ally_heavy.png',
        hp: 14,
        maxHp: 14,
        ap: 2,
        maxAp: 2,
        mobility: 3,
        aim: 70,
        weaponDamage: 6,
        attack: 6,
        range: 4,
        hitChance: 0.70
    },
    enemy_mutant: {
        archetype: 'enemy_mutant',
        name: 'Bioweapon Mutant',
        type: 'enemy',
        unitClass: 'mutant',
        portrait: 'assets/characters/enemy_mutant.png',
        sprite: 'assets/characters/enemy_mutant.png',
        hp: 8,
        maxHp: 8,
        ap: 2,
        maxAp: 2,
        mobility: 4,
        aim: 65,
        weaponDamage: 3,
        attack: 3,
        range: 4,
        hitChance: 0.65
    },
    enemy_scout: {
        archetype: 'enemy_scout',
        name: 'Stealth Infiltrator',
        type: 'enemy',
        unitClass: 'infiltrator',
        portrait: 'assets/characters/enemy_scout.png',
        sprite: 'assets/characters/enemy_scout.png',
        hp: 6,
        maxHp: 6,
        ap: 2,
        maxAp: 2,
        mobility: 5,
        aim: 75,
        weaponDamage: 2,
        attack: 2,
        range: 5,
        hitChance: 0.75
    },
    enemy_heavy: {
        archetype: 'enemy_heavy',
        name: 'Cyber Enforcer',
        type: 'enemy',
        unitClass: 'enforcer',
        portrait: 'assets/characters/enemy_heavy.png',
        sprite: 'assets/characters/enemy_heavy.png',
        hp: 12,
        maxHp: 12,
        ap: 2,
        maxAp: 2,
        mobility: 3,
        aim: 60,
        weaponDamage: 5,
        attack: 5,
        range: 4,
        hitChance: 0.60
    }
};

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

function calculateHitChance(attacker, defender, grid) {
    if (typeof attacker === 'number') {
        const aim = attacker;
        const coverDefense = typeof defender === 'number' ? defender : 0;
        const dist = typeof grid === 'number' ? grid : 0;
        let hitChance = aim - coverDefense - (dist * 2);
        return Math.max(0, Math.min(100, hitChance));
    }
    const dist = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
    let coverDefense = 0;
    const adjacentTiles = [ {dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0} ];
    for (let offset of adjacentTiles) {
        const nx = defender.x + offset.dx;
        const ny = defender.y + offset.dy;
        if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT && grid && grid[ny] && grid[ny][nx]) {
            if (grid[ny][nx].type === TILE_HALF_COVER) coverDefense = Math.max(coverDefense, 20);
            if (grid[ny][nx].type === TILE_FULL_COVER) coverDefense = Math.max(coverDefense, 40);
        }
    }
    let hitChance = attacker.aim - coverDefense - (dist * 2);
    return Math.max(0, Math.min(100, hitChance));
}

class AcomEngine {
    constructor() {
        this.GRID_WIDTH = GRID_WIDTH;
        this.GRID_HEIGHT = GRID_HEIGHT;
        this.TILE_EMPTY = TILE_EMPTY;
        this.TILE_HALF_COVER = TILE_HALF_COVER;
        this.TILE_FULL_COVER = TILE_FULL_COVER;
        this.ARCHETYPES = ARCHETYPES;
        this.gameState = {
            grid: [],
            units: [],
            currentTurn: 'player',
            logs: []
        };
        this.initGame();
    }

    log(msg) {
        this.gameState.logs.push(msg);
        if (this.gameState.logs.length > 20) {
            this.gameState.logs.shift(); // Keep last 20 entries
        }
    }

    initGame() {
        this.gameState.grid = [];
        this.gameState.units = [];
        this.gameState.currentTurn = 'player';
        this.gameState.logs = [];

        // Designated spawn and adjacent clearance positions
        const clearPositions = [
            { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 0 },
            { x: 0, y: 3 }, { x: 3, y: 0 },
            { x: 8, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 7 }, { x: 9, y: 8 }, { x: 8, y: 9 },
            { x: 9, y: 5 }, { x: 5, y: 9 }
        ];

        // Generate 10x10 grid with half/full cover outside clearance zones
        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            this.gameState.grid[y] = [];
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                let type = this.TILE_EMPTY;
                const isCleared = clearPositions.some(s => s.x === x && s.y === y);
                if (!isCleared) {
                    if (Math.random() < 0.15) type = this.TILE_HALF_COVER;
                    else if (Math.random() < 0.1) type = this.TILE_FULL_COVER;
                }
                this.gameState.grid[y][x] = { x, y, type };
            }
        }

        // Spawn 3v3 default squads
        this.gameState.units.push(createUnit('ally_assault', 'ally_assault_1', 1, 1));
        this.gameState.units.push(createUnit('ally_recon', 'ally_recon_1', 0, 3));
        this.gameState.units.push(createUnit('ally_heavy', 'ally_heavy_1', 3, 0));

        this.gameState.units.push(createUnit('enemy_mutant', 'enemy_mutant_1', 8, 8));
        this.gameState.units.push(createUnit('enemy_scout', 'enemy_scout_1', 9, 5));
        this.gameState.units.push(createUnit('enemy_heavy', 'enemy_heavy_1', 5, 9));

        this.log("Tactical operation initialized. Player turn.");
        return this.getState();
    }

    init() {
        return this.initGame();
    }

    initRandomGame(playerCount = 3, enemyCount = 3) {
        this.gameState.grid = [];
        this.gameState.units = [];
        this.gameState.currentTurn = 'player';
        this.gameState.logs = [];

        // Generate grid
        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            this.gameState.grid[y] = [];
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                let type = this.TILE_EMPTY;
                if (Math.random() < 0.15) type = this.TILE_HALF_COVER;
                else if (Math.random() < 0.1) type = this.TILE_FULL_COVER;
                this.gameState.grid[y][x] = { x, y, type };
            }
        }

        const getRandomEmptyTile = () => {
            let x, y;
            let attempts = 0;
            do {
                x = Math.floor(Math.random() * this.GRID_WIDTH);
                y = Math.floor(Math.random() * this.GRID_HEIGHT);
                attempts++;
                if (attempts > 500) {
                    this.gameState.grid[y][x].type = this.TILE_EMPTY;
                    break;
                }
            } while (this.gameState.grid[y][x].type !== this.TILE_EMPTY || this.gameState.units.some(u => u.x === x && u.y === y));
            return { x, y };
        };

        const allyArchetypeKeys = ['ally_assault', 'ally_recon', 'ally_heavy'];
        const enemyArchetypeKeys = ['enemy_mutant', 'enemy_scout', 'enemy_heavy'];

        for (let i = 0; i < playerCount; i++) {
            const archKey = allyArchetypeKeys[i % allyArchetypeKeys.length];
            const pos = getRandomEmptyTile();
            this.gameState.units.push(createUnit(archKey, `${archKey}_${i + 1}`, pos.x, pos.y));
        }

        for (let i = 0; i < enemyCount; i++) {
            const archKey = enemyArchetypeKeys[i % enemyArchetypeKeys.length];
            const pos = getRandomEmptyTile();
            this.gameState.units.push(createUnit(archKey, `${archKey}_${i + 1}`, pos.x, pos.y));
        }

        this.log(`Random Squad Skirmish initialized: ${playerCount} Allies vs ${enemyCount} Enemies.`);
        return this.getState();
    }

    initRandom(playerCount = 3, enemyCount = 3) {
        return this.initRandomGame(playerCount, enemyCount);
    }

    getState() {
        return JSON.parse(JSON.stringify(this.gameState));
    }

    calculateCoverDefense(defender) {
        let coverDefense = 0;
        const adjacentTiles = [ {dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0} ];

        for (let offset of adjacentTiles) {
            const nx = defender.x + offset.dx;
            const ny = defender.y + offset.dy;
            if (nx >= 0 && nx < this.GRID_WIDTH && ny >= 0 && ny < this.GRID_HEIGHT) {
                if (this.gameState.grid[ny] && this.gameState.grid[ny][nx]) {
                    if (this.gameState.grid[ny][nx].type === this.TILE_HALF_COVER) coverDefense = Math.max(coverDefense, 20);
                    if (this.gameState.grid[ny][nx].type === this.TILE_FULL_COVER) coverDefense = Math.max(coverDefense, 40);
                }
            }
        }
        return coverDefense;
    }

    calculateHitChance(attacker, defender, dist) {
        if (typeof attacker === 'number') {
            const aim = attacker;
            const coverDefense = typeof defender === 'number' ? defender : 0;
            const distance = typeof dist === 'number' ? dist : 0;
            let hitChance = aim - coverDefense - (distance * 2);
            return Math.max(0, Math.min(100, hitChance));
        }
        const d = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
        const coverDefense = this.calculateCoverDefense(defender);
        let hitChance = attacker.aim - coverDefense - (d * 2);
        return Math.max(0, Math.min(100, hitChance));
    }

    executeShot(attacker, defender) {
        const dist = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
        let hitChance = attacker.aim;
        const coverDefense = this.calculateCoverDefense(defender);

        hitChance -= coverDefense;
        hitChance -= (dist * 2);
        hitChance = Math.max(0, Math.min(100, hitChance));
        const roll = Math.random() * 100;

        this.log(`Shot calculation: Aim ${attacker.aim} - Cover ${coverDefense} - Dist ${dist * 2} = ${hitChance}%`);

        let hit = false;
        let damage = 0;
        let targetDied = false;

        if (roll <= hitChance) {
            hit = true;
            damage = attacker.weaponDamage || attacker.attack || 4;
            defender.hp -= damage;
            this.log(`${attacker.name || attacker.id} hit ${defender.name || defender.id} for ${damage} damage!`);
            if (defender.hp <= 0) {
                defender.hp = 0;
                defender.isAlive = false;
                targetDied = true;
                this.log(`${defender.name || defender.id} defeated!`);
            }
        } else {
            this.log(`${attacker.name || attacker.id} missed!`);
        }

        const livingPlayers = this.gameState.units.filter(u => u.type === 'player' && u.hp > 0);
        const livingEnemies = this.gameState.units.filter(u => u.type === 'enemy' && u.hp > 0);
        if (livingEnemies.length === 0) {
            this.log("All enemies defeated. You Win!");
        } else if (livingPlayers.length === 0) {
            this.log("Strike team defeated. Game Over.");
        }

        return { hit, damage, targetDied, hitChance, roll };
    }

    processEnemyTurn() {
        const enemies = this.gameState.units.filter(u => u.type === 'enemy' && u.hp > 0);
        const players = this.gameState.units.filter(u => u.type === 'player' && u.hp > 0);

        if (enemies.length === 0 || players.length === 0) {
            if (players.length === 0) this.log("Strike team defeated. Game Over.");
            else this.log("All enemies defeated. You Win!");
            return;
        }

        for (let enemy of enemies) {
            if (enemy.hp <= 0) continue;
            enemy.ap = enemy.maxAp;

            // Find closest living player
            let closestPlayer = null;
            let minDistance = Infinity;
            for (let p of players) {
                if (p.hp <= 0) continue;
                let dist = Math.abs(p.x - enemy.x) + Math.abs(p.y - enemy.y);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestPlayer = p;
                }
            }

            if (!closestPlayer) continue;

            const distX = closestPlayer.x - enemy.x;
            const distY = closestPlayer.y - enemy.y;

            if (Math.abs(distX) + Math.abs(distY) > 1) {
                let newX = enemy.x + (distX !== 0 ? Math.sign(distX) : 0);
                let newY = enemy.y + (distY !== 0 ? Math.sign(distY) : 0);

                const emptyX = this.gameState.grid[enemy.y] && this.gameState.grid[enemy.y][newX] && this.gameState.grid[enemy.y][newX].type === this.TILE_EMPTY;
                const emptyY = this.gameState.grid[newY] && this.gameState.grid[newY][enemy.x] && this.gameState.grid[newY][enemy.x].type === this.TILE_EMPTY;
                const unitAtX = this.gameState.units.some(u => u.x === newX && u.y === enemy.y && u.hp > 0);
                const unitAtY = this.gameState.units.some(u => u.x === enemy.x && u.y === newY && u.hp > 0);

                if (distX !== 0 && emptyX && !unitAtX) {
                    enemy.x = newX;
                } else if (distY !== 0 && emptyY && !unitAtY) {
                    enemy.y = newY;
                }
                this.log(`${enemy.name || enemy.id} moved.`);
                enemy.ap -= 1;
            }

            const distAfterMove = Math.abs(closestPlayer.x - enemy.x) + Math.abs(closestPlayer.y - enemy.y);
            if (distAfterMove <= (enemy.range || 1)) {
                this.log(`${enemy.name || enemy.id} attacks!`);
                this.executeShot(enemy, closestPlayer);
            }

            enemy.ap = 0;
        }

        const alivePlayers = this.gameState.units.filter(u => u.type === 'player' && u.hp > 0);
        if (alivePlayers.length <= 0) {
            this.log("Strike team defeated. Game Over.");
        } else {
            this.gameState.currentTurn = 'player';
            alivePlayers.forEach(p => p.ap = p.maxAp);
            this.log("Player turn started.");
        }
    }

    handleAction(action, payload = {}) {
        payload = (payload && typeof payload === 'object') ? payload : {};
        if (!action) {
            return { success: false, status: 400, error: "Action is required." };
        }

        if (action === 'end_turn') {
            const alivePlayers = this.gameState.units.filter(u => u.type === 'player' && u.hp > 0);
            alivePlayers.forEach(p => p.ap = 0);
            this.gameState.currentTurn = 'enemy';
            this.log("Enemy turn started.");
            this.processEnemyTurn();
            const state = this.getState();
            return { success: true, status: 200, state, ...state, message: 'Enemy turn completed. Player turn started.' };
        }

        let actorId = payload.actorId;
        if (!actorId) {
            const activePlayer = this.gameState.units.find(u => u.type === 'player' && u.hp > 0 && u.ap > 0)
                || this.gameState.units.find(u => u.type === 'player' && u.hp > 0);
            if (activePlayer) actorId = activePlayer.id;
        }

        const player = this.gameState.units.find(u => u.id === actorId && u.type === 'player' && u.hp > 0);

        if (this.gameState.currentTurn !== 'player' || !player || player.hp <= 0) {
            return { success: false, status: 400, error: "Not player turn or invalid actor." };
        }

        if (action === 'move') {
            const { x, y } = payload;
            if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y) || isNaN(x) || isNaN(y)) {
                return { success: false, status: 400, error: "Invalid move: coordinates must be integers." };
            }
            if (x < 0 || x >= this.GRID_WIDTH || y < 0 || y >= this.GRID_HEIGHT) {
                return { success: false, status: 400, error: "Invalid move." };
            }
            const dist = Math.abs(player.x - x) + Math.abs(player.y - y);
            const cellHasUnit = this.gameState.units.some(u => u.x === x && u.y === y && u.hp > 0);
            const cellIsCover = this.gameState.grid[y] && this.gameState.grid[y][x] && this.gameState.grid[y][x].type !== this.TILE_EMPTY;

            if (dist <= player.mobility && !cellHasUnit && !cellIsCover && player.ap > 0) {
                player.x = x;
                player.y = y;
                player.ap -= 1;
                this.log(`${player.name || player.id} moved. (-1 AP)`);
                const state = this.getState();
                return { success: true, status: 200, state, ...state, message: `${player.name || player.id} moved. (-1 AP)` };
            } else {
                return { success: false, status: 400, error: "Invalid move." };
            }
        } else if (action === 'shoot') {
            const { targetId } = payload;
            if (!targetId) {
                return { success: false, status: 400, error: "Invalid target." };
            }
            const target = this.gameState.units.find(u => u.id === targetId && u.hp > 0 && u.type === 'enemy');

            if (target && player.ap > 0) {
                const shotResult = this.executeShot(player, target);
                player.ap = 0;
                const state = this.getState();
                return {
                    success: true,
                    status: 200,
                    state,
                    ...state,
                    hit: shotResult.hit,
                    damage: shotResult.damage,
                    targetDied: shotResult.targetDied
                };
            } else {
                return { success: false, status: 400, error: "Invalid target." };
            }
        } else {
            return { success: false, status: 400, error: "Unknown action." };
        }
    }

    dispatch(action, payload) {
        return this.handleAction(action, payload);
    }

    dispatchAction(action, payload) {
        return this.handleAction(action, payload);
    }
}

const gameEngine = new AcomEngine();
let gameState = gameEngine.getState();
let selectedAction = null; // 'move', 'shoot'
let selectedActorId = null; // ID of the currently selected player unit
let hoveredTargetId = null; // ID of enemy currently hovered or focused
let lastTurn = null; // Track turn transitions for banner animation

const ui = (typeof document !== 'undefined') ? {
    gridContainer: document.getElementById('grid-container'),
    unitsLayer: document.getElementById('units-layer'),
    squadDock: document.getElementById('squad-dock'),
    turnIndicator: document.getElementById('turn-indicator'),
    apCounter: document.getElementById('ap-counter'),
    combatLog: document.getElementById('combat-log'),
    btnMove: document.getElementById('btn-move'),
    btnShoot: document.getElementById('btn-shoot'),
    btnEndTurn: document.getElementById('btn-end-turn'),
    unitName: document.getElementById('unit-name'),
    unitHp: document.getElementById('unit-hp'),
    unitHpFill: document.getElementById('unit-hp-fill'),
    unitAim: document.getElementById('unit-aim'),
    unitMobility: document.getElementById('unit-mobility'),
    unitDamage: document.getElementById('unit-damage'),
    unitRange: document.getElementById('unit-range'),
    unitClassBadge: document.getElementById('unit-class-badge'),
    unitPortraitImg: document.getElementById('unit-portrait-img'),
    targetPreviewIdle: document.getElementById('target-preview-idle'),
    targetPreviewActive: document.getElementById('target-preview-active'),
    targetPortraitImg: document.getElementById('target-portrait-img'),
    targetName: document.getElementById('target-name'),
    targetHpText: document.getElementById('target-hp-text'),
    targetHpFill: document.getElementById('target-hp-fill'),
    targetCoverBadge: document.getElementById('target-cover-badge'),
    targetHitChance: document.getElementById('target-hit-chance'),
    targetBaseAim: document.getElementById('target-base-aim'),
    targetCoverMod: document.getElementById('target-cover-mod'),
    targetDistMod: document.getElementById('target-dist-mod'),
    targetExpectedDmg: document.getElementById('target-expected-dmg'),
    targetClassBadge: document.getElementById('target-class-badge'),
    turnBanner: document.getElementById('turn-banner'),
    turnBannerText: document.getElementById('turn-banner-text'),
    missionModal: document.getElementById('mission-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalSubtitle: document.getElementById('modal-subtitle'),
    modalStatStatus: document.getElementById('modal-stat-status'),
    modalStatSurvivors: document.getElementById('modal-stat-survivors'),
    modalStatKills: document.getElementById('modal-stat-kills'),
    btnRedeploy: document.getElementById('btn-redeploy'),
} : {};

async function fetchState() {
    gameState = gameEngine.getState();
    autoSelectActor();
    render();
    return gameState;
}

async function init() {
    // Hide mission modal if open
    if (ui.missionModal) ui.missionModal.classList.remove('active');
    
    // Clear stale DOM units before re-init
    if (ui.unitsLayer) ui.unitsLayer.innerHTML = '';
    
    gameState = gameEngine.initGame();
    lastTurn = gameState ? gameState.currentTurn : 'player';
    setupEventListeners();
    autoSelectActor();
    renderGridOnce();
    render();
    showTurnBanner('player');
    return gameState;
}

async function initRandomGame(playerCount = 3, enemyCount = 3) {
    // Hide mission modal if open
    if (ui.missionModal) ui.missionModal.classList.remove('active');
    
    // Clear stale DOM units before re-init
    if (ui.unitsLayer) ui.unitsLayer.innerHTML = '';
    
    gameState = gameEngine.initRandom(playerCount, enemyCount);
    lastTurn = gameState ? gameState.currentTurn : 'player';
    setupEventListeners();
    autoSelectActor();
    renderGridOnce();
    render();
    showTurnBanner('player');
    return gameState;
}

function autoSelectActor() {
    if (gameState && gameState.currentTurn === 'player') {
        let current = gameState.units.find(u => u.id === selectedActorId && u.hp > 0 && u.ap > 0);
        if (!current) {
            const firstAvailable = gameState.units.find(u => u.type === 'player' && u.hp > 0 && u.ap > 0);
            if (firstAvailable) {
                selectedActorId = firstAvailable.id;
            } else {
                const firstAlive = gameState.units.find(u => u.type === 'player' && u.hp > 0);
                selectedActorId = firstAlive ? firstAlive.id : null;
            }
        }
    } else {
        selectedActorId = null;
    }
}

function showTurnBanner(turn) {
    if (!ui.turnBanner || !ui.turnBannerText) return;
    
    if (turn === 'player') {
        ui.turnBanner.className = 'turn-banner-overlay player-phase show';
        ui.turnBannerText.innerText = 'PLAYER PHASE';
    } else {
        ui.turnBanner.className = 'turn-banner-overlay enemy-phase show';
        ui.turnBannerText.innerText = 'ALIEN ACTIVITY';
    }

    setTimeout(() => {
        if (ui.turnBanner) {
            ui.turnBanner.classList.remove('show');
        }
    }, 1200);
}

// Action pose manager
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

    if (durationMs > 0 && pose !== 'dead') {
        setTimeout(() => {
            const curUnit = gameState ? gameState.units.find(u => u.id === unitId) : null;
            if (curUnit && curUnit.hp > 0) {
                sprite.style.backgroundImage = `url('assets/characters/${archetype}.png')`;
            }
        }, durationMs);
    }
}

// Floating Combat Text
function showFloatingText(x, y, text, color = '#ff3333') {
    const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size')) || 60;
    const floatEl = document.createElement('div');
    floatEl.className = 'floating-text';
    floatEl.innerText = text;
    floatEl.style.left = `${x * cellSize + cellSize / 2}px`;
    floatEl.style.top = `${y * cellSize}px`;
    floatEl.style.color = color;
    ui.unitsLayer.appendChild(floatEl);
    setTimeout(() => {
        if (floatEl.parentNode) floatEl.remove();
    }, 1000);
}

async function sendAction(action, payload = {}) {
    const actor = getSelectedUnit();
    
    // Attacker animation before request
    if (action === 'shoot' && actor) {
        const actorEl = document.getElementById(`unit-${actor.id}`);
        if (actorEl) {
            actorEl.classList.add('shoot-recoil');
            setTimeout(() => actorEl.classList.remove('shoot-recoil'), 450);
        }
        setUnitPose(actor.id, 'attack', 500);
    }

    const prevState = gameState;
    const oldTarget = payload.targetId && prevState ? prevState.units.find(u => u.id === payload.targetId) : null;

    const actionResult = gameEngine.handleAction(action, { ...payload, actorId: payload.actorId || selectedActorId });
    if (actionResult && actionResult.success) {
        gameState = gameEngine.getState();
    } else {
        return actionResult;
    }

    // Check turn transition for banner
    if (gameState && lastTurn !== gameState.currentTurn) {
        showTurnBanner(gameState.currentTurn);
        lastTurn = gameState.currentTurn;
    }

    // Defender reaction animation
    if (action === 'shoot' && payload.targetId) {
        const newTarget = gameState.units.find(u => u.id === payload.targetId);
        const targetEl = document.getElementById(`unit-${payload.targetId}`);
        
        if (targetEl) {
            targetEl.classList.add('damage-flash');
            setTimeout(() => targetEl.classList.remove('damage-flash'), 500);
            
            if (newTarget && oldTarget && newTarget.hp < oldTarget.hp) {
                const dmg = oldTarget.hp - newTarget.hp;
                showFloatingText(newTarget.x, newTarget.y, `-${dmg} HP`, '#ff3333');
                setUnitPose(newTarget.id, 'hit', 500);
            } else if (newTarget && oldTarget && newTarget.hp === oldTarget.hp) {
                showFloatingText(newTarget.x, newTarget.y, 'MISS', '#88bbff');
            }
        }
    }
    
    selectedAction = null;
    hoveredTargetId = null;
    clearHighlights();
    autoSelectActor();
    render();
    checkEndgame();
    return actionResult;
}

function checkEndgame() {
    if (!gameState || !ui.missionModal) return;
    const alivePlayers = gameState.units.filter(u => u.type === 'player' && u.hp > 0);
    const aliveEnemies = gameState.units.filter(u => u.type === 'enemy' && u.hp > 0);
    const totalEnemies = gameState.units.filter(u => u.type === 'enemy').length;
    const totalPlayers = gameState.units.filter(u => u.type === 'player').length;

    const modalCard = ui.missionModal.querySelector('.mission-modal-card');

    if (aliveEnemies.length === 0 && totalEnemies > 0) {
        // Player Victory
        if (modalCard) {
            modalCard.className = 'mission-modal-card victory';
        }
        ui.modalTitle.innerText = 'MISSION ACCOMPLISHED';
        ui.modalSubtitle.innerText = 'All hostile biothreats eliminated. Sector 7 secured.';
        ui.modalStatStatus.innerText = 'VICTORY';
        ui.modalStatStatus.style.color = 'var(--neon-emerald)';
        ui.modalStatSurvivors.innerText = `${alivePlayers.length} / ${totalPlayers}`;
        ui.modalStatKills.innerText = `${totalEnemies} / ${totalEnemies}`;
        ui.missionModal.classList.add('active');
    } else if (alivePlayers.length === 0 && totalPlayers > 0) {
        // Player Defeat
        if (modalCard) {
            modalCard.className = 'mission-modal-card defeat';
        }
        ui.modalTitle.innerText = 'MISSION FAILED';
        ui.modalSubtitle.innerText = 'All squad operatives lost in action. Sector overrun.';
        ui.modalStatStatus.innerText = 'DEFEAT';
        ui.modalStatStatus.style.color = 'var(--neon-crimson)';
        ui.modalStatSurvivors.innerText = `0 / ${totalPlayers}`;
        ui.modalStatKills.innerText = `${totalEnemies - aliveEnemies.length} / ${totalEnemies}`;
        ui.missionModal.classList.add('active');
    }
}

// --- Rendering ---
function render() {
    if (!gameState) return;
    renderSquadDock();
    renderUnits();
    updateUI();
    renderTargetPreview();
    renderLogs();
}

function renderSquadDock() {
    if (!ui.squadDock || !gameState) return;
    ui.squadDock.innerHTML = '';

    const players = gameState.units.filter(u => u.type === 'player');
    players.forEach(unit => {
        const card = document.createElement('div');
        const isSelected = unit.id === selectedActorId;
        const isDefeated = unit.hp <= 0;
        card.className = `squad-card ${isSelected ? 'selected' : ''} ${isDefeated ? 'defeated' : ''}`;
        card.dataset.unitId = unit.id;

        const archetype = unit.archetype || 'ally_assault';
        const portraitUrl = unit.portrait || `assets/characters/${archetype}.png`;
        const hpPercent = Math.max(0, (unit.hp / unit.maxHp) * 100);

        card.innerHTML = `
            <div class="squad-card-portrait" style="background-image: url('${portraitUrl}');"></div>
            <div class="squad-card-info">
                <div class="squad-card-header">
                    <span class="squad-card-name">${unit.name || unit.id}</span>
                    <span class="squad-card-badge">${(unit.unitClass || 'Operative').toUpperCase()}</span>
                </div>
                <div class="squad-card-hp-bar">
                    <div class="squad-card-hp-fill" style="width: ${hpPercent}%;"></div>
                </div>
                <div class="squad-card-stats">
                    <span>${unit.hp}/${unit.maxHp} HP</span>
                    <span class="squad-card-ap">${isDefeated ? 'K.I.A.' : 'AP: ' + unit.ap + '/' + unit.maxAp}</span>
                </div>
            </div>
        `;

        if (!isDefeated) {
            card.addEventListener('click', () => {
                if (gameState.currentTurn === 'player') {
                    selectedActorId = unit.id;
                    selectedAction = null;
                    clearHighlights();
                    render();
                }
            });
        }

        ui.squadDock.appendChild(card);
    });
}

function renderGridOnce() {
    ui.gridContainer.innerHTML = '';
    const GRID_HEIGHT = gameState.grid.length;
    const GRID_WIDTH = gameState.grid[0].length;
    
    document.documentElement.style.setProperty('--grid-width', GRID_WIDTH);
    document.documentElement.style.setProperty('--grid-height', GRID_HEIGHT);

    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            const cellData = gameState.grid[y][x];
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${x}-${y}`;
            cell.dataset.x = x;
            cell.dataset.y = y;

            if (cellData.type === TILE_HALF_COVER) {
                const cover = document.createElement('div');
                cover.className = 'cover-half';
                cell.appendChild(cover);
            } else if (cellData.type === TILE_FULL_COVER) {
                const cover = document.createElement('div');
                cover.className = 'cover-full';
                cell.appendChild(cover);
            }

            cell.addEventListener('click', () => handleCellClick(x, y));
            
            // Hover preview for enemies on cell
            cell.addEventListener('mouseenter', () => {
                const enemyOnCell = gameState.units.find(u => u.x === x && u.y === y && u.type === 'enemy' && u.hp > 0);
                if (enemyOnCell) {
                    hoveredTargetId = enemyOnCell.id;
                    renderTargetPreview();
                }
            });

            cell.addEventListener('mouseleave', () => {
                if (hoveredTargetId) {
                    hoveredTargetId = null;
                    renderTargetPreview();
                }
            });

            ui.gridContainer.appendChild(cell);
        }
    }
}

function renderUnits() {
    const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size')) || 60;

    // Remove stale unit DOM nodes that no longer exist in gameState
    const allCurrentUnitIds = new Set(gameState.units.map(u => `unit-${u.id}`));
    Array.from(ui.unitsLayer.querySelectorAll('.unit')).forEach(el => {
        if (!allCurrentUnitIds.has(el.id)) {
            el.remove();
        }
    });

    gameState.units.forEach(unit => {
        let unitEl = document.getElementById(`unit-${unit.id}`);

        if (unit.hp <= 0) {
            if (unitEl) {
                unitEl.classList.add('death-fade');
                setUnitPose(unit.id, 'dead', 0);
                setTimeout(() => {
                    if (unitEl && unitEl.parentNode) unitEl.remove();
                }, 800);
            }
            return;
        }

        if (!unitEl) {
            unitEl = document.createElement('div');
            unitEl.id = `unit-${unit.id}`;
            const archClass = unit.archetype || (unit.type === 'player' ? 'ally_assault' : 'enemy_mutant');
            unitEl.className = `unit ${unit.type} ${archClass} ${unit.unitClass || ''}`;
            
            // Grounding radial-gradient drop shadow
            const shadow = document.createElement('div');
            shadow.className = 'unit-shadow';
            unitEl.appendChild(shadow);

            // High-resolution 2D Illustration Sprite
            const sprite = document.createElement('div');
            sprite.className = 'unit-sprite';
            sprite.id = `sprite-${unit.id}`;
            if (unit.sprite) {
                sprite.style.backgroundImage = `url('${unit.sprite}')`;
            }
            unitEl.appendChild(sprite);

            // HP Bar
            const hpBarWrapper = document.createElement('div');
            hpBarWrapper.className = 'unit-hp-bar';
            const hpFill = document.createElement('div');
            hpFill.className = 'unit-hp-fill';
            hpFill.id = `hp-fill-${unit.id}`;
            hpBarWrapper.appendChild(hpFill);
            unitEl.appendChild(hpBarWrapper);

            // Add click listener to select player units or target enemies
            unitEl.addEventListener('click', (e) => {
                if (unit.type === 'player' && gameState.currentTurn === 'player') {
                    selectedActorId = unit.id;
                    selectedAction = null;
                    clearHighlights();
                    render();
                    e.stopPropagation();
                } else if (unit.type === 'enemy') {
                    if (selectedAction === 'shoot') {
                        handleCellClick(unit.x, unit.y);
                        e.stopPropagation();
                    } else {
                        hoveredTargetId = unit.id;
                        renderTargetPreview();
                    }
                }
            });

            // Hover listener for target preview
            unitEl.addEventListener('mouseenter', () => {
                if (unit.type === 'enemy' && unit.hp > 0) {
                    hoveredTargetId = unit.id;
                    renderTargetPreview();
                }
            });

            unitEl.addEventListener('mouseleave', () => {
                if (hoveredTargetId === unit.id) {
                    hoveredTargetId = null;
                    renderTargetPreview();
                }
            });

            ui.unitsLayer.appendChild(unitEl);
        }

        // Update Position
        unitEl.style.left = `${unit.x * cellSize}px`;
        unitEl.style.top = `${unit.y * cellSize}px`;

        // Dynamic Y-depth sorting formula (z = y * 10 + 5)
        const baseZIndex = unit.y * 10 + 5;
        unitEl.style.zIndex = baseZIndex;

        // Update HP Bar Fill
        const hpFill = document.getElementById(`hp-fill-${unit.id}`);
        if (hpFill) {
            const hpPercent = Math.max(0, (unit.hp / unit.maxHp) * 100);
            hpFill.style.width = `${hpPercent}%`;
        }
        
        // Active Selection Styling
        if (unit.id === selectedActorId) {
            unitEl.classList.add('selected');
        } else {
            unitEl.classList.remove('selected');
        }
    });
}

// --- Interaction & Game Logic ---
let listenersAttached = false;
function setupEventListeners() {
    if (listenersAttached || typeof window === 'undefined' || typeof document === 'undefined') return;
    listenersAttached = true;
    if (ui.btnMove) {
        ui.btnMove.addEventListener('click', () => {
            const p = getSelectedUnit();
            if (p && p.ap > 0) {
                selectedAction = 'move';
                highlightMovableCells();
            }
        });
    }

    if (ui.btnShoot) {
        ui.btnShoot.addEventListener('click', () => {
            const p = getSelectedUnit();
            if (p && p.ap > 0) {
                selectedAction = 'shoot';
                highlightTargetableCells();
            }
        });
    }

    if (ui.btnEndTurn) {
        ui.btnEndTurn.addEventListener('click', () => {
            sendAction('end_turn', {});
        });
    }

    if (ui.btnRedeploy) {
        ui.btnRedeploy.addEventListener('click', () => {
            init();
        });
    }

    // Global keyboard hotkeys
    window.addEventListener('keydown', (e) => {
        if (ui.missionModal && ui.missionModal.classList.contains('active')) {
            if (e.key === 'Enter' || e.key === ' ') {
                init();
            }
            return;
        }

        if (e.key === 'm' || e.key === 'M') {
            const p = getSelectedUnit();
            if (p && p.ap > 0 && gameState.currentTurn === 'player') {
                selectedAction = 'move';
                highlightMovableCells();
            }
        } else if (e.key === 's' || e.key === 'S') {
            const p = getSelectedUnit();
            if (p && p.ap > 0 && gameState.currentTurn === 'player') {
                selectedAction = 'shoot';
                highlightTargetableCells();
            }
        } else if (e.key === ' ' || e.key === 'e' || e.key === 'E') {
            if (gameState && gameState.currentTurn === 'player') {
                sendAction('end_turn', {});
            }
        } else if (e.key >= '1' && e.key <= '9') {
            const idx = parseInt(e.key) - 1;
            const players = gameState ? gameState.units.filter(u => u.type === 'player' && u.hp > 0) : [];
            if (players[idx]) {
                selectedActorId = players[idx].id;
                selectedAction = null;
                clearHighlights();
                render();
            }
        } else if (e.key === 'Escape') {
            selectedAction = null;
            clearHighlights();
        }
    });
}

function getSelectedUnit() {
    return gameState && gameState.units ? gameState.units.find(u => u.id === selectedActorId && u.hp > 0) : null;
}

function handleCellClick(x, y) {
    const player = getSelectedUnit();
    if (!player || gameState.currentTurn !== 'player') return;

    if (selectedAction === 'move') {
        sendAction('move', { x, y });
    } else if (selectedAction === 'shoot') {
        const target = gameState.units.find(u => u.x === x && u.y === y && u.type === 'enemy' && u.hp > 0);
        if (target) {
            sendAction('shoot', { targetId: target.id });
        }
    }
}

function clearHighlights() {
    document.querySelectorAll('.cell').forEach(c => {
        c.classList.remove('valid-move');
        c.classList.remove('valid-target');
    });
}

function highlightMovableCells() {
    const player = getSelectedUnit();
    if (!player) return;
    
    document.querySelectorAll('.cell').forEach(c => {
        const x = parseInt(c.dataset.x);
        const y = parseInt(c.dataset.y);
        const dist = Math.abs(player.x - x) + Math.abs(player.y - y);
        const cellHasUnit = gameState.units.some(u => u.x === x && u.y === y && u.hp > 0);
        const cellIsCover = gameState.grid[y][x].type !== TILE_EMPTY;

        if (dist <= player.mobility && !cellHasUnit && !cellIsCover) {
            c.classList.add('valid-move');
        }
    });
}

function highlightTargetableCells() {
    document.querySelectorAll('.cell').forEach(c => {
        const x = parseInt(c.dataset.x);
        const y = parseInt(c.dataset.y);
        const target = gameState.units.find(u => u.x === x && u.y === y && u.type === 'enemy' && u.hp > 0);
        if (target) {
            c.classList.add('valid-target');
        }
    });
}

function updateUI() {
    const player = getSelectedUnit();
    if (player) {
        ui.unitName.innerText = (player.name || player.id).toUpperCase();
        ui.unitHp.innerText = `${player.hp}/${player.maxHp}`;
        if (ui.unitHpFill) {
            const hpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
            ui.unitHpFill.style.width = `${hpPercent}%`;
        }
        ui.unitAim.innerText = `${player.aim}%`;
        ui.unitMobility.innerText = player.mobility;
        if (ui.unitDamage) ui.unitDamage.innerText = player.weaponDamage || player.attack || 4;
        if (ui.unitRange) ui.unitRange.innerText = player.range || 5;
        if (ui.unitClassBadge) ui.unitClassBadge.innerText = (player.unitClass || 'Assault').toUpperCase();
        
        const archetype = player.archetype || 'ally_assault';
        if (ui.unitPortraitImg) {
            ui.unitPortraitImg.src = player.portrait || `assets/characters/${archetype}.png`;
        }
        
        ui.apCounter.innerText = `AP: ${player.ap}`;
        
        ui.btnMove.disabled = player.ap <= 0 || gameState.currentTurn !== 'player';
        ui.btnShoot.disabled = player.ap <= 0 || gameState.currentTurn !== 'player';
        ui.btnEndTurn.disabled = gameState.currentTurn !== 'player';
    } else {
        ui.unitName.innerText = gameState && gameState.currentTurn === 'player' ? "SELECT AN OPERATIVE" : "ENEMY ACTIVITY...";
        ui.unitHp.innerText = '-';
        if (ui.unitHpFill) ui.unitHpFill.style.width = '0%';
        ui.unitAim.innerText = '-';
        ui.unitMobility.innerText = '-';
        if (ui.unitDamage) ui.unitDamage.innerText = '-';
        if (ui.unitRange) ui.unitRange.innerText = '-';
        if (ui.unitClassBadge) ui.unitClassBadge.innerText = 'STANDBY';
        
        ui.apCounter.innerText = `AP: 0`;
        
        ui.btnMove.disabled = true;
        ui.btnShoot.disabled = true;
        ui.btnEndTurn.disabled = !gameState || gameState.currentTurn !== 'player';
    }
    
    if (gameState) {
        ui.turnIndicator.innerText = gameState.currentTurn === 'player' ? 'PLAYER TURN' : 'ALIEN ACTIVITY';
        ui.turnIndicator.style.color = gameState.currentTurn === 'player' ? 'var(--neon-cyan)' : 'var(--neon-crimson)';
        ui.turnIndicator.style.borderColor = gameState.currentTurn === 'player' ? 'var(--neon-cyan)' : 'var(--neon-crimson)';
    }
}

function renderTargetPreview() {
    if (!ui.targetPreviewIdle || !ui.targetPreviewActive) return;

    const actor = getSelectedUnit();
    let target = null;

    if (hoveredTargetId && gameState) {
        target = gameState.units.find(u => u.id === hoveredTargetId && u.type === 'enemy' && u.hp > 0);
    }

    if (!target && selectedAction === 'shoot' && gameState) {
        // If in shoot mode, pick first living enemy in range as default preview if none hovered
        target = gameState.units.find(u => u.type === 'enemy' && u.hp > 0);
    }

    if (!target || !actor) {
        ui.targetPreviewIdle.style.display = 'flex';
        ui.targetPreviewActive.style.display = 'none';
        if (ui.targetClassBadge) {
            ui.targetClassBadge.innerText = 'SCANNING';
            ui.targetClassBadge.className = 'badge badge-enemy';
        }
        return;
    }

    // Active target preview
    ui.targetPreviewIdle.style.display = 'none';
    ui.targetPreviewActive.style.display = 'flex';

    const targetArchetype = target.archetype || 'enemy_mutant';
    if (ui.targetPortraitImg) {
        ui.targetPortraitImg.src = target.portrait || `assets/characters/${targetArchetype}.png`;
    }
    if (ui.targetName) ui.targetName.innerText = (target.name || target.id).toUpperCase();
    if (ui.targetClassBadge) {
        ui.targetClassBadge.innerText = (target.unitClass || 'Mutant').toUpperCase();
    }
    if (ui.targetHpText) ui.targetHpText.innerText = `${target.hp}/${target.maxHp}`;
    if (ui.targetHpFill) {
        const hpPercent = Math.max(0, (target.hp / target.maxHp) * 100);
        ui.targetHpFill.style.width = `${hpPercent}%`;
    }

    // Cover calculation
    let coverDefense = 0;
    const adjacentTiles = [ {dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0} ];
    for (let offset of adjacentTiles) {
        const nx = target.x + offset.dx;
        const ny = target.y + offset.dy;
        if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10 && gameState.grid[ny] && gameState.grid[ny][nx]) {
            if (gameState.grid[ny][nx].type === TILE_HALF_COVER) coverDefense = Math.max(coverDefense, 20);
            if (gameState.grid[ny][nx].type === TILE_FULL_COVER) coverDefense = Math.max(coverDefense, 40);
        }
    }

    const dist = Math.abs(actor.x - target.x) + Math.abs(actor.y - target.y);
    let hitChance = actor.aim - coverDefense - (dist * 2);
    hitChance = Math.max(0, Math.min(100, hitChance));

    if (ui.targetHitChance) ui.targetHitChance.innerText = `${hitChance}%`;
    if (ui.targetBaseAim) ui.targetBaseAim.innerText = `${actor.aim}%`;
    if (ui.targetCoverMod) ui.targetCoverMod.innerText = `-${coverDefense}%`;
    if (ui.targetDistMod) ui.targetDistMod.innerText = `-${dist * 2}% (${dist} tiles)`;
    
    const dmg = actor.weaponDamage || actor.attack || 4;
    if (ui.targetExpectedDmg) {
        ui.targetExpectedDmg.innerText = dmg >= target.hp ? `${dmg} DMG [LETHAL]` : `${dmg} DMG`;
        ui.targetExpectedDmg.style.color = dmg >= target.hp ? 'var(--neon-crimson)' : 'var(--neon-amber)';
    }

    if (ui.targetCoverBadge) {
        if (coverDefense === 40) {
            ui.targetCoverBadge.className = 'cover-badge cover-full-badge';
            ui.targetCoverBadge.innerText = 'FULL COVER (+40%)';
        } else if (coverDefense === 20) {
            ui.targetCoverBadge.className = 'cover-badge cover-half-badge';
            ui.targetCoverBadge.innerText = 'HALF COVER (+20%)';
        } else {
            ui.targetCoverBadge.className = 'cover-badge cover-none';
            ui.targetCoverBadge.innerText = 'NO COVER (FLANKED)';
        }
    }
}

function renderLogs() {
    if (!gameState || !ui.combatLog) return;
    ui.combatLog.innerHTML = '';
    const reversedLogs = [...gameState.logs].reverse();
    
    reversedLogs.forEach(msg => {
        const p = document.createElement('div');
        p.className = 'log-entry';
        
        let tagHtml = '<span class="log-tag tag-sys">[SYS]</span>';
        if (msg.includes('moved')) {
            tagHtml = '<span class="log-tag tag-move">[MOVE]</span>';
        } else if (msg.includes('hit') || msg.includes('damage')) {
            tagHtml = '<span class="log-tag tag-hit">[HIT]</span>';
            p.classList.add('damage');
        } else if (msg.includes('missed')) {
            tagHtml = '<span class="log-tag tag-miss">[MISS]</span>';
        } else if (msg.includes('defeated') || msg.includes('Game Over') || msg.includes('Win')) {
            tagHtml = '<span class="log-tag tag-kill">[KILL]</span>';
        } else if (msg.includes('turn') || msg.includes('Turn')) {
            tagHtml = '<span class="log-tag tag-phase">[PHASE]</span>';
        } else if (msg.includes('calculation') || msg.includes('Aim')) {
            tagHtml = '<span class="log-tag tag-calc">[CALC]</span>';
        }

        if (msg.includes('Assault') || msg.includes('Recon') || msg.includes('Heavy') || msg.includes('ally_') || msg.includes('Player') || msg.includes('Mega Man')) {
            p.classList.add('player-action');
        } else if (msg.includes('Mutant') || msg.includes('Infiltrator') || msg.includes('Enforcer') || msg.includes('enemy_') || msg.includes('Enemy') || msg.includes('Goomba')) {
            p.classList.add('enemy-action');
        }
        
        p.innerHTML = `${tagHtml} <span>${msg}</span>`;
        ui.combatLog.appendChild(p);
    });
}

// Universal module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AcomEngine,
        createUnit,
        ARCHETYPES,
        calculateHitChance,
        gameEngine,
        init,
        initRandomGame,
        sendAction,
        fetchState,
        getSelectedUnit,
        render
    };
}
if (typeof window !== 'undefined') {
    window.AcomEngine = AcomEngine;
    window.ARCHETYPES = ARCHETYPES;
    window.createUnit = createUnit;
    window.calculateHitChance = calculateHitChance;
    window.gameEngine = gameEngine;
    window.__ACOM_ENGINE__ = gameEngine;
    window.__ACOM_GAME__ = {
        get state() { return gameState; },
        init: init,
        initRandom: initRandomGame,
        sendAction: sendAction,
        getSelectedUnit: getSelectedUnit,
        render: render
    };
    try {
        Object.defineProperty(window, 'gameState', {
            get() { return gameState; },
            set(val) { gameState = val; },
            configurable: true
        });
    } catch (e) {
        window.gameState = gameState;
    }
    window.init = init;
    window.initRandomGame = initRandomGame;
    window.fetchState = async () => { render(); return gameState; };
    window.sendAction = sendAction;
    window.getSelectedUnit = getSelectedUnit;
    window.render = render;
    window.renderGridOnce = renderGridOnce;
}

// Start game if running in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    init();
}
