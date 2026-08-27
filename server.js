const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

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

let gameState = {
    grid: [],
    units: [],
    currentTurn: 'player',
    logs: []
};

function log(msg) {
    gameState.logs.push(msg);
    if (gameState.logs.length > 20) gameState.logs.shift(); // Keep last 20
}

function initGame() {
    gameState.grid = [];
    gameState.units = [];
    gameState.currentTurn = 'player';
    gameState.logs = [];

    // Designated spawn and adjacent clearance positions
    const clearPositions = [
        { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 0 },
        { x: 0, y: 3 }, { x: 3, y: 0 },
        { x: 8, y: 8 }, { x: 7, y: 8 }, { x: 8, y: 7 }, { x: 9, y: 8 }, { x: 8, y: 9 },
        { x: 9, y: 5 }, { x: 5, y: 9 }
    ];

    // Generate grid
    for (let y = 0; y < GRID_HEIGHT; y++) {
        gameState.grid[y] = [];
        for (let x = 0; x < GRID_WIDTH; x++) {
            let type = TILE_EMPTY;
            const isCleared = clearPositions.some(s => s.x === x && s.y === y);
            if (!isCleared) {
                if (Math.random() < 0.15) type = TILE_HALF_COVER;
                else if (Math.random() < 0.1) type = TILE_FULL_COVER;
            }
            gameState.grid[y][x] = { x, y, type };
        }
    }

    // Spawn 3v3 squads with free movement lanes for lead units
    gameState.units.push(createUnit('ally_assault', 'ally_assault_1', 1, 1));
    gameState.units.push(createUnit('ally_recon', 'ally_recon_1', 0, 3));
    gameState.units.push(createUnit('ally_heavy', 'ally_heavy_1', 3, 0));

    gameState.units.push(createUnit('enemy_mutant', 'enemy_mutant_1', 8, 8));
    gameState.units.push(createUnit('enemy_scout', 'enemy_scout_1', 9, 5));
    gameState.units.push(createUnit('enemy_heavy', 'enemy_heavy_1', 5, 9));

    log("Tactical operation initialized. Player turn.");
}

function initRandomGame(playerCount = 3, enemyCount = 3) {
    gameState.grid = [];
    gameState.units = [];
    gameState.currentTurn = 'player';
    gameState.logs = [];

    // Generate grid
    for (let y = 0; y < GRID_HEIGHT; y++) {
        gameState.grid[y] = [];
        for (let x = 0; x < GRID_WIDTH; x++) {
            let type = TILE_EMPTY;
            if (Math.random() < 0.15) type = TILE_HALF_COVER;
            else if (Math.random() < 0.1) type = TILE_FULL_COVER;
            gameState.grid[y][x] = { x, y, type };
        }
    }

    // Helper to get random empty tile
    function getRandomEmptyTile() {
        let x, y;
        let attempts = 0;
        do {
            x = Math.floor(Math.random() * GRID_WIDTH);
            y = Math.floor(Math.random() * GRID_HEIGHT);
            attempts++;
            if (attempts > 500) {
                // Clear tile if grid is dense
                gameState.grid[y][x].type = TILE_EMPTY;
                break;
            }
        } while (gameState.grid[y][x].type !== TILE_EMPTY || gameState.units.some(u => u.x === x && u.y === y));
        return { x, y };
    }

    const allyArchetypeKeys = ['ally_assault', 'ally_recon', 'ally_heavy'];
    const enemyArchetypeKeys = ['enemy_mutant', 'enemy_scout', 'enemy_heavy'];

    // Spawn random players
    for (let i = 0; i < playerCount; i++) {
        const archKey = allyArchetypeKeys[i % allyArchetypeKeys.length];
        const pos = getRandomEmptyTile();
        gameState.units.push(createUnit(archKey, `${archKey}_${i + 1}`, pos.x, pos.y));
    }

    // Spawn random enemies
    for (let i = 0; i < enemyCount; i++) {
        const archKey = enemyArchetypeKeys[i % enemyArchetypeKeys.length];
        const pos = getRandomEmptyTile();
        gameState.units.push(createUnit(archKey, `${archKey}_${i + 1}`, pos.x, pos.y));
    }

    log(`Random Squad Skirmish initialized: ${playerCount} Allies vs ${enemyCount} Enemies.`);
}

function processEnemyTurn() {
    const enemies = gameState.units.filter(u => u.type === 'enemy' && u.hp > 0);
    const players = gameState.units.filter(u => u.type === 'player' && u.hp > 0);

    if (enemies.length === 0 || players.length === 0) {
        if (players.length === 0) log("Strike team defeated. Game Over.");
        else log("All enemies defeated. You Win!");
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
            
            const emptyX = gameState.grid[enemy.y] && gameState.grid[enemy.y][newX] && gameState.grid[enemy.y][newX].type === TILE_EMPTY;
            const emptyY = gameState.grid[newY] && gameState.grid[newY][enemy.x] && gameState.grid[newY][enemy.x].type === TILE_EMPTY;
            const unitAtX = gameState.units.some(u => u.x === newX && u.y === enemy.y && u.hp > 0);
            const unitAtY = gameState.units.some(u => u.x === enemy.x && u.y === newY && u.hp > 0);

            if (distX !== 0 && emptyX && !unitAtX) {
                enemy.x = newX;
            } else if (distY !== 0 && emptyY && !unitAtY) {
                enemy.y = newY;
            }
            log(`${enemy.name || enemy.id} moved.`);
            enemy.ap -= 1;
        }

        const distAfterMove = Math.abs(closestPlayer.x - enemy.x) + Math.abs(closestPlayer.y - enemy.y);
        if (distAfterMove <= (enemy.range || 1)) {
            log(`${enemy.name || enemy.id} attacks!`);
            executeShot(enemy, closestPlayer);
        }

        enemy.ap = 0;
    }

    const alivePlayers = gameState.units.filter(u => u.type === 'player' && u.hp > 0);
    if (alivePlayers.length <= 0) {
        log("Strike team defeated. Game Over.");
    } else {
        gameState.currentTurn = 'player';
        alivePlayers.forEach(p => p.ap = p.maxAp);
        log("Player turn started.");
    }
}

function executeShot(attacker, defender) {
    const dist = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
    let hitChance = attacker.aim;
    
    let coverDefense = 0;
    const adjacentTiles = [ {dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0} ];

    for (let offset of adjacentTiles) {
        const nx = defender.x + offset.dx;
        const ny = defender.y + offset.dy;
        if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
            if (gameState.grid[ny][nx].type === TILE_HALF_COVER) coverDefense = Math.max(coverDefense, 20);
            if (gameState.grid[ny][nx].type === TILE_FULL_COVER) coverDefense = Math.max(coverDefense, 40);
        }
    }

    hitChance -= coverDefense;
    hitChance -= (dist * 2);

    hitChance = Math.max(0, Math.min(100, hitChance));
    const roll = Math.random() * 100;
    
    log(`Shot calculation: Aim ${attacker.aim} - Cover ${coverDefense} - Dist ${dist*2} = ${hitChance}%`);

    if (roll <= hitChance) {
        const damage = attacker.weaponDamage || attacker.attack || 4;
        defender.hp -= damage;
        log(`${attacker.name || attacker.id} hit ${defender.name || defender.id} for ${damage} damage!`);
        if (defender.hp <= 0) {
            defender.hp = 0;
            defender.isAlive = false;
            log(`${defender.name || defender.id} defeated!`);
        }
    } else {
        log(`${attacker.name || attacker.id} missed!`);
    }

    const livingPlayers = gameState.units.filter(u => u.type === 'player' && u.hp > 0);
    const livingEnemies = gameState.units.filter(u => u.type === 'enemy' && u.hp > 0);
    if (livingEnemies.length === 0) {
        log("All enemies defeated. You Win!");
    } else if (livingPlayers.length === 0) {
        log("Strike team defeated. Game Over.");
    }
}

// API Routes
app.post('/api/init', (req, res) => {
    initGame();
    res.json(gameState);
});

app.post('/api/init_random', (req, res) => {
    const { players = 3, enemies = 3 } = req.body || {};
    initRandomGame(Number(players) || 3, Number(enemies) || 3);
    res.json(gameState);
});

app.get('/api/state', (req, res) => {
    res.json(gameState);
});

app.post('/api/action', (req, res) => {
    const { action, payload = {} } = req.body || {};
    
    if (!action) {
        return res.status(400).json({ error: "Action is required." });
    }

    // Auto end turn if requested
    if (action === 'end_turn') {
        const alivePlayers = gameState.units.filter(u => u.type === 'player' && u.hp > 0);
        alivePlayers.forEach(p => p.ap = 0);
        gameState.currentTurn = 'enemy';
        log("Enemy turn started.");
        processEnemyTurn();
        return res.json(gameState);
    }

    let actorId = payload.actorId;
    if (!actorId) {
        const activePlayer = gameState.units.find(u => u.type === 'player' && u.hp > 0 && u.ap > 0)
            || gameState.units.find(u => u.type === 'player' && u.hp > 0);
        if (activePlayer) actorId = activePlayer.id;
    }

    const player = gameState.units.find(u => u.id === actorId && u.type === 'player' && u.hp > 0);

    if (gameState.currentTurn !== 'player' || !player || player.hp <= 0) {
        return res.status(400).json({ error: "Not player turn or invalid actor." });
    }

    if (action === 'move') {
        const { x, y } = payload;
        if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
            return res.status(400).json({ error: "Invalid move." });
        }
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
            return res.status(400).json({ error: "Invalid move." });
        }
        const dist = Math.abs(player.x - x) + Math.abs(player.y - y);
        const cellHasUnit = gameState.units.some(u => u.x === x && u.y === y && u.hp > 0);
        const cellIsCover = gameState.grid[y] && gameState.grid[y][x] && gameState.grid[y][x].type !== TILE_EMPTY;

        if (dist <= player.mobility && !cellHasUnit && !cellIsCover && player.ap > 0) {
            player.x = x;
            player.y = y;
            player.ap -= 1;
            log(`${player.name || player.id} moved. (-1 AP)`);
        } else {
            return res.status(400).json({ error: "Invalid move." });
        }
    } else if (action === 'shoot') {
        const { targetId } = payload;
        if (!targetId) {
            return res.status(400).json({ error: "Invalid target." });
        }
        const target = gameState.units.find(u => u.id === targetId && u.hp > 0 && u.type === 'enemy');
        
        if (target && player.ap > 0) {
            executeShot(player, target);
            player.ap = 0; // Shooting ends turn
        } else {
            return res.status(400).json({ error: "Invalid target." });
        }
    } else {
        return res.status(400).json({ error: "Unknown action." });
    }

    res.json(gameState);
});

// Start game initially
initGame();

app.listen(port, () => {
    console.log(`Game server running on http://localhost:${port}`);
});
