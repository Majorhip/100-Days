// Finds open spots for the story's props in the built game (dist/index.html): dry, fairly flat
// ground, clear of trees, rocks and colliders, nearest to each wanted point. Prints them for
// src/data/story-spots.js. The island itself is never changed.
//
//   node tools/story/spots.mjs
import { join } from 'node:path';
import { launch, openGame, prepPage, SAVE_KEY, HIGH_SETTINGS, ROOT } from '../../tests/golden/browser.mjs';

// name, wanted point, search radius (m), biome (or any), steepest slope allowed
const WANT = [
  ['green', -150, 72, 30, 'forest', 0.35],      // the west woods, near Old Grizzle's den
  ['box', 209, 95.5, 3, 'any', 0.35],           // by the Old Iron Mine's entrance, a few metres from its chest
  ['trail0', 42, -117, 6, 'snow', 0.6],         // the paw trail: from the Frozen Lake's west shore...
  ['trail1', 30, -128, 6, 'snow', 0.6],
  ['trail2', 19, -139, 6, 'snow', 0.6],
  ['trail3', 8, -146, 6, 'snow', 0.6],
  ['trail4', -2, -151, 6, 'snow', 0.6],
  ['blue', -12, -156, 8, 'snow', 0.6],          // ...south-west through the snowy trees
  ['dawn', 120, 140, 25, 'any', 0.35],          // where Ember's family shows itself, seen from the Stone Circle
  ['whistle', 152.5, 168, 3, 'any', 0.35]       // the whistle box inside the circle
];

const { browser, close } = await launch({ gpu: true });
try {
  const { page } = await openGame(browser, join(ROOT, 'dist', 'index.html'), { beforeLoad: { fn: prepPage, args: [SAVE_KEY, null, HIGH_SETTINGS, 5] } });
  await page.waitForFunction(() => window.__stranded && window.__stranded.NODES && window.__stranded.NODES.length > 0, { timeout: 120000 });
  const out = await page.evaluate(want => {
    const S = window.__stranded, res = {};
    for (const [name, wx, wz, rad, biome, steep] of want) {
      let best = null;
      for (let dx = -rad; dx <= rad; dx += 0.5) for (let dz = -rad; dz <= rad; dz += 0.5) {
        const x = wx + dx, z = wz + dz, d = Math.hypot(dx, dz); if (d > rad || (best && d >= best.d)) continue;
        const h = S.heightAt(x, z); if (h < 0.8) continue;
        if (biome !== 'any' && S.biomeAt(x, z) !== biome) continue;
        if (S.slopeAt(x, z) > steep) continue;
        if (S.LAKES.some(l => Math.hypot(x - l.x, z - l.z) < l.r + 3)) continue;
        if (Math.hypot(x - S.SITES.icelake.x, z - S.SITES.icelake.z) < S.SITES.icelake.r + 2) continue;   // the Frozen Lake is a site, not in LAKES
        if (S.NODES.some(n => Math.abs(n.x - x) < 3 && Math.abs(n.z - z) < 3)) continue;
        const k = S.collide(x, z, 1.6); if (k[0] !== x || k[1] !== z) continue;
        best = { x, z, d, h: +h.toFixed(2), slope: +S.slopeAt(x, z).toFixed(2) };
      }
      res[name] = best;
    }
    return res;
  }, WANT);
  for (const [name] of WANT) console.log(name.padEnd(8), JSON.stringify(out[name]));
} finally { await close(); }
