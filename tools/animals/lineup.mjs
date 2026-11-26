// Render the downloaded animal models on the island, in the game's own lighting and materials,
// next to the hand-built models they would replace. Writes PNGs to the folder given.
//
//   node tools/animals/lineup.mjs <out dir>
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, openGame, prepPage, SAVE_KEY, HIGH_SETTINGS, ROOT } from '../../tests/golden/browser.mjs';

const out = resolve(process.argv[2] || 'lineup'); mkdirSync(out, { recursive: true });
const PORT = 5181, wait = ms => new Promise(r => setTimeout(r, ms));
const vite = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => { vite.stdout.on('data', d => { if (/ready|Local:/.test(String(d))) res(); }); vite.on('exit', c => rej(new Error('vite exited ' + c))); setTimeout(() => rej(new Error('vite did not start')), 60000); });

// on the Frozen Lake (flat, no grass to hide the small ones), looking north at a row facing east
const ROWS = [
  { file: '1-big-animals', names: ['old:wolf', 'Wolf', 'old:deer', 'Deer', 'Stag', 'Fox', 'Husky', 'ShibaInu', 'old:scout'], x0: 61.6, gap: 2.6, z: -138 },
  { file: '2-farm-plains', names: ['Horse', 'Horse_White', 'Donkey', 'Alpaca', 'Bull', 'Cow', 'old:goat'], x0: 61.8, gap: 3.4, z: -138 },
  { file: '3-small-critters', names: ['old:rabbit', 'Bunny', 'Frog', 'Rat', 'Spider', 'Snake', 'Crab', 'Bat', 'Pig', 'old:scorpion'], x0: 65.9, gap: 1.35, z: -138 },
  { file: '4-water', names: ['Shark', 'Fish'], x0: 70, gap: 4, z: -138 }
];

const { browser, close } = await launch({ gpu: true });
try {
  const { page, errors } = await openGame(browser, `http://localhost:${PORT}/`, { beforeLoad: { fn: prepPage, args: [SAVE_KEY, null, HIGH_SETTINGS, 5] } });
  await page.evaluate(() => document.getElementById('tNew').click());
  await page.waitForSelector('#iSkip', { timeout: 15000 });
  await page.evaluate(() => document.getElementById('iSkip').click());
  await page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
  await wait(1500);
  for (const row of ROWS) {
    const res = await page.evaluate(async r => {
      const S = window.__stranded, { G, R } = S;
      R.invuln = 1e9; S.clearCreatures(); G.hour = 11.5; G.weather = 'clear'; G.weatherHrs = 99;
      for (const o of window.__lineup || []) R.scene.remove(o);
      const L = await import('/tools/animals/lineup.js');
      const before = new Set(R.scene.children);
      const placed = await L.place(r.names, { x0: r.x0, z: r.z, gap: r.gap, faceYaw: Math.PI / 2 });
      window.__lineup = R.scene.children.filter(o => !before.has(o));
      const mid = r.x0 + r.gap * (r.names.length - 1) / 2, dist = r.gap * r.names.length * 0.55 + 1.5;
      G.p.x = mid; G.p.z = r.z + dist; G.p.y = S.groundAt(G.p.x, G.p.z); G.p.vy = 0; G.p.yaw = 0; G.p.pitch = -0.2;
      return placed;
    }, row);
    await wait(2500);
    await page.screenshot({ path: join(out, row.file + '.png') });
    console.log(row.file); for (const p of res) console.log(`  ${p.name.padEnd(12)} size ${p.size ? p.size.join(' x ') : '?'}  floor ${p.floor}`);
  }
  console.log(errors.length ? 'page errors:\n  ' + errors.slice(0, 5).join('\n  ') : 'no page errors');
} finally { await close(); vite.kill(); }
