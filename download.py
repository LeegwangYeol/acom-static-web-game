#!/usr/bin/env python3
"""
ACOM Character Asset Downloader & Verifier
Fetches 6 distinct high-resolution 2D illustration PNG assets (CC0 Kenney toon characters)
with transparent backgrounds and anti-aliased vector rendering.
"""

import os
import sys
import struct
import zlib
import hashlib
import urllib.request

CHARACTER_ASSETS = {
    # Allies (3 distinct types)
    'ally_assault.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Male%20adventurer/PNG/Poses%20HD/character_maleAdventurer_idle.png',
    'ally_recon.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Female%20adventurer/PNG/Poses%20HD/character_femaleAdventurer_idle.png',
    'ally_heavy.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Robot/PNG/Poses%20HD/character_robot_idle.png',
    
    # Enemies (3 distinct types)
    'enemy_mutant.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Zombie/PNG/Poses%20HD/character_zombie_idle.png',
    'enemy_scout.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Female%20person/PNG/Poses%20HD/character_femalePerson_idle.png',
    'enemy_heavy.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Male%20person/PNG/Poses%20HD/character_malePerson_idle.png'
}

ACTION_POSES = {
    'ally_assault_attack.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Male%20adventurer/PNG/Poses%20HD/character_maleAdventurer_attack0.png',
    'ally_assault_hit.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Male%20adventurer/PNG/Poses%20HD/character_maleAdventurer_hit.png',
    'ally_assault_dead.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Male%20adventurer/PNG/Poses%20HD/character_maleAdventurer_fallDown.png',
    
    'ally_recon_attack.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Female%20adventurer/PNG/Poses%20HD/character_femaleAdventurer_attack0.png',
    'ally_recon_hit.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Female%20adventurer/PNG/Poses%20HD/character_femaleAdventurer_hit.png',
    'ally_recon_dead.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Female%20adventurer/PNG/Poses%20HD/character_femaleAdventurer_fallDown.png',
    
    'ally_heavy_attack.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Robot/PNG/Poses%20HD/character_robot_attack0.png',
    'ally_heavy_hit.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Robot/PNG/Poses%20HD/character_robot_hit.png',
    'ally_heavy_dead.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Robot/PNG/Poses%20HD/character_robot_fallDown.png',
    
    'enemy_mutant_attack.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Zombie/PNG/Poses%20HD/character_zombie_attack0.png',
    'enemy_mutant_hit.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Zombie/PNG/Poses%20HD/character_zombie_hit.png',
    'enemy_mutant_dead.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Zombie/PNG/Poses%20HD/character_zombie_fallDown.png',
    
    'enemy_scout_attack.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Female%20person/PNG/Poses%20HD/character_femalePerson_attack0.png',
    'enemy_scout_hit.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Female%20person/PNG/Poses%20HD/character_femalePerson_hit.png',
    'enemy_scout_dead.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Female%20person/PNG/Poses%20HD/character_femalePerson_fallDown.png',
    
    'enemy_heavy_attack.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Male%20person/PNG/Poses%20HD/character_malePerson_attack0.png',
    'enemy_heavy_hit.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Male%20person/PNG/Poses%20HD/character_malePerson_hit.png',
    'enemy_heavy_dead.png': 'https://raw.githubusercontent.com/ETdoFresh/kenney.nl/master/kenney_tooncharacters1/Male%20person/PNG/Poses%20HD/character_malePerson_fallDown.png',
}

def validate_png_file(filepath):
    if not os.path.exists(filepath):
        return False, f"File not found: {filepath}"
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    if not data.startswith(b'\x89PNG\r\n\x1a\n'):
        return False, "Invalid PNG magic header"
    
    w, h, depth, color_type = struct.unpack('>IIBB', data[16:26])
    if w < 128 or h < 128:
        return False, f"Resolution too low ({w}x{h} < 128x128)"
    
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
    
    trans_ratio = transparent_count / total_pixels
    opaque_ratio = opaque_count / total_pixels
    
    if trans_ratio < 0.15:
        return False, f"Insufficient transparency ({trans_ratio:.1%} < 15%)"
    if opaque_ratio < 0.10:
        return False, f"Insufficient subject content ({opaque_ratio:.1%} < 10%)"
    if semi_alpha_count < 100:
        return False, f"Low anti-aliasing count ({semi_alpha_count} < 100), likely hard-edge/pixel art"
    if len(unique_colors) < 50:
        return False, f"Low color diversity ({len(unique_colors)} < 50)"
        
    sha256 = hashlib.sha256(data).hexdigest()
    return True, {
        "dimensions": f"{w}x{h}",
        "transparent_ratio": f"{trans_ratio:.1%}",
        "anti_aliased_pixels": semi_alpha_count,
        "unique_colors": len(unique_colors),
        "sha256": sha256
    }

def main():
    target_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'characters')
    os.makedirs(target_dir, exist_ok=True)
    headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
    
    print("=== Downloading ACOM Character Assets ===")
    all_targets = {**CHARACTER_ASSETS, **ACTION_POSES}
    
    for filename, url in all_targets.items():
        dest = os.path.join(target_dir, filename)
        if not os.path.exists(dest):
            print(f"Fetching {filename}...")
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            with open(dest, 'wb') as f:
                f.write(data)
        else:
            print(f"Already exists: {filename}")
            
    print("\n=== Validating 6 Primary Character Assets ===")
    all_passed = True
    seen_hashes = set()
    for filename in CHARACTER_ASSETS:
        dest = os.path.join(target_dir, filename)
        valid, info = validate_png_file(dest)
        if not valid:
            print(f"FAILED: {filename} - {info}")
            all_passed = False
        else:
            if info['sha256'] in seen_hashes:
                print(f"FAILED: Duplicate asset hash for {filename}")
                all_passed = False
            seen_hashes.add(info['sha256'])
            print(f"PASSED: {filename} [{info['dimensions']}, {info['transparent_ratio']} transparent, {info['anti_aliased_pixels']} AA px, {info['unique_colors']} colors]")
            
    if all_passed:
        print("\nAll 6 character assets are valid high-res 2D illustrations with transparent backgrounds!")
        sys.exit(0)
    else:
        print("\nAsset validation failed.")
        sys.exit(1)

if __name__ == '__main__':
    main()
