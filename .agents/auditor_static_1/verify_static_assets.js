/**
 * verify_static_assets.js
 * Verifies that all assets referenced in index.html, style.css, and game.js exist on the local file system.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../');

console.log("=== STATIC ASSETS & ZERO-SERVER COMPATIBILITY CHECK ===");

// 1. Check index.html script and link references
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Scripts
const scriptMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
for (const s of scriptMatches) {
    if (!s.startsWith('http://') && !s.startsWith('https://')) {
        const fullPath = path.join(ROOT, s);
        assert.ok(fs.existsSync(fullPath), `Script ${s} must exist locally`);
        console.log(`[PASS] Script reference resolved locally: ${s}`);
    }
}

// Stylesheets
const linkMatches = [...html.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map(m => m[1]);
for (const l of linkMatches) {
    if (!l.startsWith('http://') && !l.startsWith('https://') && !l.startsWith('data:')) {
        const fullPath = path.join(ROOT, l);
        assert.ok(fs.existsSync(fullPath), `Stylesheet ${l} must exist locally`);
        console.log(`[PASS] Stylesheet reference resolved locally: ${l}`);
    }
}

// Images in HTML
const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
for (const img of imgMatches) {
    if (!img.startsWith('http://') && !img.startsWith('https://') && !img.startsWith('data:')) {
        const fullPath = path.join(ROOT, img);
        assert.ok(fs.existsSync(fullPath), `Image ${img} must exist locally`);
        console.log(`[PASS] HTML Image reference resolved locally: ${img}`);
    }
}

// 2. Check CSS url() references
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const cssUrlMatches = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m => m[1]);
for (const url of cssUrlMatches) {
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
        const fullPath = path.join(ROOT, url);
        assert.ok(fs.existsSync(fullPath), `CSS url ${url} must exist locally`);
        console.log(`[PASS] CSS url reference resolved locally: ${url}`);
    }
}

// 3. Check game.js archetype sprites and portraits
const { ARCHETYPES } = require(path.join(ROOT, 'game.js'));
for (const [key, arch] of Object.entries(ARCHETYPES)) {
    const portraitPath = path.join(ROOT, arch.portrait);
    const spritePath = path.join(ROOT, arch.sprite);
    assert.ok(fs.existsSync(portraitPath), `Archetype ${key} portrait must exist: ${arch.portrait}`);
    assert.ok(fs.existsSync(spritePath), `Archetype ${key} sprite must exist: ${arch.sprite}`);
    console.log(`[PASS] Archetype ${key} visual assets resolved locally.`);
}

console.log("\nALL STATIC LOCAL ASSET CHECKS PASSED!");
