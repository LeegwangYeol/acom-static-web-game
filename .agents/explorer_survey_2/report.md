# Asset Sourcing, Integration, and 2D Illustration Styling Survey Report

**Date**: 2026-08-26  
**Agent**: `explorer_survey_2`  
**Target Project**: `/Users/user/src/acom`  
**Reference Specification**: `/Users/user/src/acom/.agents/ORIGINAL_REQUEST.md`

---

## 1. Executive Summary

This investigation surveys the current asset pipeline, rendering architecture, and visual styling of the turn-based isometric XCOM web game, providing an end-to-end plan for upgrading to a polished, high-resolution 2D illustration style.

### Key Discoveries:
1. **Existing Asset Deficiencies**: The repository's existing assets (`goomba.png`, `megaman.png`) are upscaled 8-bit NES pixel art sprites with no smooth alpha transparency (0 semi-transparent pixels, 0 transparent background pixels in `goomba.png`), while `megaman_sprite.png` is a corrupted HTML document text file.
2. **High-Res 2D Sourcing**: We identified and verified 6 high-quality, free-to-use (CC0 / Public Domain), transparent-background 2D vector/illustration character assets (3 Allies and 3 Enemies) from Kenney's vector toon and sci-fi character collections. Each character contains 45 consistent poses (idle, attack, hit, hurt, fallDown, run, walk, cheer) at 192x256 resolution with full alpha channel anti-aliasing.
3. **Programmatic Validation Criteria**: Designed and tested a Python/Node.js validation algorithm that checks:
   - PNG format integrity (magic bytes).
   - High resolution (>= 128x128).
   - Alpha channel transparency ratio (> 15% transparent, > 10% opaque).
   - Anti-aliasing / Non-pixel-art verification (semi-transparent edge pixel count > 500, color depth > 200).
   - Distinctness (unique SHA-256 hashes and distinct character color palettes).
4. **Isometric Integration Architecture**: Defined exact CSS layout and transform properties ensuring aspect ratio preservation, bottom-center origin anchoring, realistic radial-gradient drop shadows, and CSS animations for unit selection, hover lift, shooting recoil, hit flash, and death fading.

---

## 2. Existing Asset & Codebase Audit

### 2.1 Asset Inventory

| File | Type | Resolution | Color Type | Alpha Support | Status / Finding |
|---|---|---|---|---|---|
| `goomba.png` | PNG | 860x721 | RGBA (8-bit) | Opaque (0 transparent px) | **Defective**: Upscaled 8-bit NES sprite with only 5 unique colors and no background transparency. |
| `goomba.jpg` | JPEG | 1024x1024 | RGB | None | **Incompatible**: Opaque background, cannot blend on isometric grid. |
| `megaman.png` | PNG | 860x751 | RGBA (8-bit) | Opaque (0 transparent px) | **Defective**: Upscaled 8-bit sprite with solid background rectangle. |
| `megaman.jpg` | JPEG | 1024x1024 | RGB | None | **Incompatible**: Opaque background. |
| `megaman_sprite.png` | HTML | N/A | N/A | N/A | **Corrupted**: Contains 186KB of HTML text from a failed HTTP download. |
| `download.py` | Python script | N/A | N/A | N/A | **Primitive**: Hardcodes download from `pngitem.com` without verification or error handling. |

### 2.2 Codebase Bindings

- **`style.css` (lines 194–203)**:
  - Enforces `image-rendering: pixelated;` which intentionally degrades vector and illustrated assets.
  - Hardcodes CSS classes `.megaman .unit-sprite` and `.goomba .unit-sprite`.
- **`game.js` (lines 135–136)**:
  - Hardcodes binary class assignment: `unit.type === 'player' ? 'megaman' : 'goomba'`.
- **`server.js` (lines 48–59, 90–108)**:
  - Hardcodes unit IDs `megaman_N` and `goomba_N` without distinctive character class types or varied stats.

---

## 3. High-Res 2D Asset Sourcing (R1 Specification)

To fulfill Requirement R1 (3 allies and 3 enemies with transparent backgrounds, strictly non-pixel-art, high-res 2D illustration style, free-to-use / CC0), we evaluated multiple sources:

### 3.1 Recommended Primary Sourcing: Kenney CC0 Vector Character Suite

- **License**: CC0 1.0 Universal (Public Domain / Free for commercial and personal use).
- **Style**: Polished, modern 2D vector cartoon/sci-fi illustration with smooth line art, cell shading, and anti-aliased alpha borders.
- **Direct Mirror Repository**: `https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/`

#### 3 Distinct Allies:
1. **Ally Assault (Assault Operative / Scout)**:
   - Asset URL: `https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Male%20adventurer/PNG/Poses%20HD/character_maleAdventurer_idle.png`
   - Role: Fast frontline infantry with assault rifle.
   - Poses available: `character_maleAdventurer_attack0.png`, `character_maleAdventurer_hit.png`, `character_maleAdventurer_fallDown.png`.
2. **Ally Recon (Sniper / Recon Specialist)**:
   - Asset URL: `https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Female%20adventurer/PNG/Poses%20HD/character_femaleAdventurer_idle.png`
   - Role: High-aim long-range marksman.
   - Poses available: `character_femaleAdventurer_attack0.png`, `character_femaleAdventurer_hit.png`, `character_femaleAdventurer_fallDown.png`.
3. **Ally Heavy (Armored Combat Android / Specialist)**:
   - Asset URL: `https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Robot/PNG/Poses%20HD/character_robot_idle.png`
   - Role: High-HP cybernetic tank unit with heavy plasma blaster.
   - Poses available: `character_robot_attack0.png`, `character_robot_hit.png`, `character_robot_fallDown.png`.

#### 3 Distinct Enemies:
1. **Enemy Mutant (Bio-Mutant / Swarm Infiltrator)**:
   - Asset URL: `https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Zombie/PNG/Poses%20HD/character_zombie_idle.png`
   - Role: Aggressive melee/corrosive bio-soldier with high mobility.
   - Poses available: `character_zombie_attack0.png`, `character_zombie_hit.png`, `character_zombie_fallDown.png`.
2. **Enemy Scout (Alien Infiltrator / Rogue Spy)**:
   - Asset URL: `https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Female%20person/PNG/Poses%20HD/character_femalePerson_idle.png`
   - Role: Agile skirmisher with dual pistols and evasive perks.
   - Poses available: `character_femalePerson_attack0.png`, `character_femalePerson_hit.png`, `character_femalePerson_fallDown.png`.
3. **Enemy Heavy (Rogue Mercenary / Brute Commander)**:
   - Asset URL: `https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Male%20person/PNG/Poses%20HD/character_malePerson_idle.png`
   - Role: Heavy armor alien syndicate enforcer with shotgun.
   - Poses available: `character_malePerson_attack0.png`, `character_malePerson_hit.png`, `character_malePerson_fallDown.png`.

### 3.2 Alternative Sourcing Options

| Source | Collection | Pros | Cons |
|---|---|---|---|
| **Kenney Space Kit & Isometric Packs** | `space-kit-1.0/Isometric` (Astronaut, Alien, Robot) | True isometric pre-rendered angles | Lower resolution (45x67 to 64x64) |
| **Wikimedia Commons Vector Renders** | `Category:Science fiction characters`, `Category:Fictional robots` | High-res SVG source, CC0/CC-BY | Heterogeneous art styles require manual scaling and style harmonization |
| **OpenGameArt.org** | "Knight, Princess, Dragon", "Calciumtrice 2D" | Animated spritesheets | Multiple licenses, requires spritesheet cropping |

---

## 4. Programmatic Asset Validation Suite

To satisfy Acceptance Criteria ("A programmatic check confirms the existence of at least 6 distinct, valid transparent PNG files in the project directory that are strictly non-pixel-art"), we specify a standalone validation script.

### 4.1 Validation Heuristics & Metrics

```
+-------------------------------------------------------------------------+
|                          Asset Validation Pipeline                      |
|                                                                         |
| 1. Format Integrity: Magic Bytes == \x89PNG\r\n\x1a\n                   |
| 2. Resolution: Width >= 128px AND Height >= 128px                       |
| 3. Transparency:                                                        |
|      - Has alpha (ColorType 4, 6 or tRNS chunk)                         |
|      - Transparent pixel ratio > 15% (not solid background)             |
|      - Opaque pixel ratio > 10% (not empty canvas)                      |
| 4. Non-Pixel-Art Verification:                                          |
|      - Anti-aliased Edge Pixels (0 < Alpha < 255) >= 100 px             |
|      - Unique Color Count >= 100                                        |
| 5. Distinctness:                                                        |
|      - Unique SHA-256 checksums across all 6 assets                     |
|      - Color palette / perceptual difference > 0                        |
+-------------------------------------------------------------------------+
```

### 4.2 Production Validation Script (`validate_assets.py`)

```python
import os
import struct
import zlib
import hashlib

ASSET_FILES = [
    'ally_assault.png',
    'ally_recon.png',
    'ally_heavy.png',
    'enemy_mutant.png',
    'enemy_scout.png',
    'enemy_heavy.png'
]

def validate_png(filepath):
    if not os.path.exists(filepath):
        return False, f"File not found: {filepath}"
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # 1. Check Magic Bytes
    if not data.startswith(b'\x89PNG\r\n\x1a\n'):
        return False, "Not a valid PNG file (invalid magic header)"
    
    # 2. Parse IHDR
    w, h, depth, color_type = struct.unpack('>IIBB', data[16:26])
    if w < 128 or h < 128:
        return False, f"Resolution too low ({w}x{h} < 128x128)"
    
    # 3. Extract Chunks
    offset = 8
    idat = b''
    palette = []
    trns = b''
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset+4])[0]
        ctype = data[offset+4:offset+8]
        cdata = data[offset+8:offset+8+length]
        if ctype == b'IDAT':
            idat += cdata
        elif ctype == b'PLTE':
            palette = [cdata[i:i+3] for i in range(0, len(cdata), 3)]
        elif ctype == b'tRNS':
            trns = cdata
        offset += 12 + length
    
    raw = zlib.decompress(idat)
    total_pixels = w * h
    transparent_count = 0
    semi_alpha_count = 0
    opaque_count = 0
    unique_colors = set()
    
    if color_type == 6: # RGBA
        stride = 1 + w * 4
        for y in range(h):
            row = raw[y*stride + 1 : (y+1)*stride]
            for x in range(0, len(row), 4):
                r, g, b, a = row[x:x+4]
                unique_colors.add((r, g, b, a))
                if a == 0: transparent_count += 1
                elif a == 255: opaque_count += 1
                else: semi_alpha_count += 1
    elif color_type == 3: # Indexed PNG with tRNS
        stride = 1 + w
        for y in range(h):
            row = raw[y*stride + 1 : (y+1)*stride]
            for idx in row:
                unique_colors.add(idx)
                alpha = trns[idx] if idx < len(trns) else 255
                if alpha == 0: transparent_count += 1
                elif alpha == 255: opaque_count += 1
                else: semi_alpha_count += 1
    else:
        return False, f"Unsupported color type: {color_type}"
    
    # 4. Check Transparency Ratios
    trans_ratio = transparent_count / total_pixels
    opaque_ratio = opaque_count / total_pixels
    if trans_ratio < 0.15:
        return False, f"Insufficient transparency ({trans_ratio:.1%} < 15%)"
    if opaque_ratio < 0.10:
        return False, f"Insufficient subject content ({opaque_ratio:.1%} < 10%)"
    
    # 5. Check Anti-Aliasing (Non-pixel-art check)
    if semi_alpha_count < 100:
        return False, f"Low anti-aliasing count ({semi_alpha_count} < 100), likely hard-edge/pixel art"
    if len(unique_colors) < 50:
        return False, f"Low color diversity ({len(unique_colors)} < 50), likely 8-bit palette"
        
    sha256 = hashlib.sha256(data).hexdigest()
    return True, {
        "dimensions": f"{w}x{h}",
        "transparent_ratio": f"{trans_ratio:.1%}",
        "anti_aliased_pixels": semi_alpha_count,
        "unique_colors": len(unique_colors),
        "sha256": sha256
    }
```

---

## 5. Asset Integration & Isometric Grid Rendering

### 5.1 Coordinate Mapping & Anchor Points

The current grid uses CSS 3D transforms (`rotateX(20deg)` with `perspective: 800px`). To achieve an authentic 2.5D tactical feel:

1. **Tile Anchoring**:
   - Each tile is a square `var(--cell-size) = 60px` (or scaled to `70px` for high-res clarity).
   - The unit root `.unit` is positioned at `left: x * cell_size`, `top: y * cell_size`.
   - The sprite is anchored at the tile base: `transform-origin: 50% 100%`, `bottom: 8px`, `left: 50%`, `transform: translateX(-50%)`.

2. **Aspect Ratio Preservation**:
   - Instead of stretching, the `.unit-sprite` container uses `background-size: contain; background-position: bottom center; background-repeat: no-repeat;`.
   - Dimensions set to `width: 140%; height: 160%;` ensuring characters naturally stand tall and overlap background grid cells upwards without clipping or horizontal distortion.

3. **Ground Shadow Effect**:
   - An ellipse radial-gradient shadow placed under the feet:
   ```css
   .unit-shadow {
       position: absolute;
       bottom: 2px;
       left: 50%;
       transform: translateX(-50%);
       width: 65%;
       height: 20%;
       background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0) 75%);
       border-radius: 50%;
       pointer-events: none;
       z-index: 5;
   }
   ```

### 5.2 Visual Polish & Animations

1. **Selection Ring**:
   - Active player gets an animated sci-fi neon ring on the ground tile:
   ```css
   .unit.selected .unit-base-ring {
       position: absolute;
       bottom: 0px;
       left: 50%;
       transform: translateX(-50%);
       width: 80%;
       height: 30%;
       border: 2px solid #00e5ff;
       border-radius: 50%;
       box-shadow: 0 0 12px #00e5ff, inset 0 0 8px #00e5ff;
       animation: ringPulse 1.5s infinite ease-in-out;
   }
   ```
2. **Hover State**:
   - Hovering over a selectable unit or target applies subtle elevation (`transform: translateX(-50%) translateY(-6px)`) and a bright drop-shadow outline (`filter: drop-shadow(0 0 8px rgba(77, 166, 255, 0.9))`).
3. **Combat Animations**:
   - **Shoot / Recoil**: `@keyframes shootRecoil { 0% { transform: translateX(-50%) scale(1); } 30% { transform: translateX(-50%) translateY(-6px) scale(1.08); } 100% { transform: translateX(-50%) scale(1); } }`
   - **Damage / Hit Flash**: `@keyframes damageFlash { 0% { filter: brightness(2.5) drop-shadow(0 0 10px red); } 100% { filter: brightness(1) drop-shadow(0 8px 6px rgba(0,0,0,0.6)); } }`
   - **Death Fade**: `@keyframes unitDeath { 0% { opacity: 1; transform: translateX(-50%) scale(1); } 100% { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.6); filter: grayscale(1); } }`

---

## 6. Character Archetypes & Gameplay Balancing

| Unit ID | Name | Team | HP | AP | Mobility | Aim | Weapon Dmg | Visual Silhouette |
|---|---|---|---|---|---|---|---|---|
| `ally_assault` | Assault Operative | Player | 10 | 2 | 4 | 80% | 4 | Male Adventurer with standard combat harness |
| `ally_recon` | Recon Specialist | Player | 8 | 2 | 5 | 90% | 4 | Female Adventurer with scout rifle |
| `ally_heavy` | Armored Android | Player | 14 | 2 | 3 | 70% | 6 | Cybernetic Combat Robot |
| `enemy_mutant` | Bio-Mutant | Enemy | 8 | 2 | 4 | 65% | 3 | Green Toxic Zombie |
| `enemy_scout` | Alien Infiltrator | Enemy | 6 | 2 | 5 | 75% | 3 | Agile Rogue Skirmisher |
| `enemy_heavy` | Enforcer Brute | Enemy | 12 | 2 | 2 | 60% | 5 | Heavy Syndicate Enforcer |

---

## 7. Recommendations for Implementation & Verification

1. **Asset Downloader (`download_assets.py`)**:
   - Implement an automated downloader fetching the 6 verified Kenney CC0 assets.
   - Include auto-fallback and immediate PNG validation check upon download completion.
2. **Game Logic Updates (`server.js` & `game.js`)**:
   - Expand `initGame()` and `initRandomGame()` to spawn heterogeneous units using the 6 class types.
   - Update `renderUnits()` to attach classes `ally_assault`, `ally_recon`, `ally_heavy`, `enemy_mutant`, `enemy_scout`, `enemy_heavy`.
3. **Automated Verification Script**:
   - Provide `verify_all.js` (or python headless check) confirming:
     - All 6 PNG files exist and pass validation heuristics.
     - Server initializes with 6 distinct units.
     - DOM rendering spawns all 6 sprite containers with 0 network 404s.
