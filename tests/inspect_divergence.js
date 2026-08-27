#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { deepInspectPng } = require('./adversarial_asset_test');

const ASSETS_DIR = path.resolve(__dirname, '../assets/characters');
const ASSETS = [
  'ally_assault.png',
  'ally_recon.png',
  'ally_heavy.png',
  'enemy_mutant.png',
  'enemy_scout.png',
  'enemy_heavy.png'
];

const reports = ASSETS.map(f => deepInspectPng(path.join(ASSETS_DIR, f)));

console.log('=== Detailed Pairwise Comparison ===\n');

for (let i = 0; i < reports.length; i++) {
  for (let j = i + 1; j < reports.length; j++) {
    const a = reports[i];
    const b = reports[j];

    // Compute RGB MSE on non-transparent union pixels
    let diffSqSum = 0;
    let differingPixels = 0;
    let totalNonTrans = 0;

    for (let p = 0; p < a.width * a.height; p++) {
      const idx = p * 4;
      const aR = a.rgbaPixels[idx], aG = a.rgbaPixels[idx+1], aB = a.rgbaPixels[idx+2], aA = a.rgbaPixels[idx+3];
      const bR = b.rgbaPixels[idx], bG = b.rgbaPixels[idx+1], bB = b.rgbaPixels[idx+2], bA = b.rgbaPixels[idx+3];

      if (aA > 0 || bA > 0) {
        totalNonTrans++;
        if (aR !== bR || aG !== bG || aB !== bB || aA !== bA) {
          differingPixels++;
          const dR = aR - bR;
          const dG = aG - bG;
          const dB = aB - bB;
          const dA = aA - bA;
          diffSqSum += (dR*dR + dG*dG + dB*dB + dA*dA) / 4;
        }
      }
    }

    const mse = diffSqSum / totalNonTrans;
    const rmse = Math.sqrt(mse);
    const diffPct = (differingPixels / totalNonTrans) * 100;

    console.log(`Pair [${a.filename} vs ${b.filename}]:`);
    console.log(`  - Non-transparent pixel difference: ${differingPixels} / ${totalNonTrans} (${diffPct.toFixed(2)}% differ)`);
    console.log(`  - Pixel RMSE: ${rmse.toFixed(2)} / 255.0`);
    console.log(`  - SHA256 distinct: ${a.sha256 !== b.sha256}`);
  }
}
