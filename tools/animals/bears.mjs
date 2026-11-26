// The rigged bears (tools/animals/rig-bear.mjs) on the island, in the game's own lighting and
// materials: a line-up next to the hand-built bear, Grizzle and Frostclaw and the new wolf for
// scale, then each clip at a few moments. Writes JPEGs to the folder given.
//
//   node tools/animals/bears.mjs <out dir> [shot,shot...]     (e.g. docs/animals/bears)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, openGame, prepPage, SAVE_KEY, HIGH_SETTINGS, ROOT } from '../../tests/golden/browser.mjs';

const out = resolve(process.argv[2] || 'docs/animals/bears'); mkdirSync(out, { recursive: true });
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const PORT = 5184, wait = ms => new Promise(r => setTimeout(r, ms));
const vite = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => { vite.stdout.on('data', d => { if (/ready|Local:/.test(String(d))) res(); }); vite.on('exit', c => rej(new Error('vite exited ' + c))); setTimeout(() => rej(new Error('vite did not start')), 60000); });

// the three bears at one moment of a clip, side on (facing east, the camera looking north)
const trio = (clip, t) => ['game:Bear@' + clip + '@' + t, 'game:Grizzle@' + clip + '@' + t, 'game:Frostclaw@' + clip + '@' + t];
const SHOTS = [
  { file: '00-lineup-bear', names: ['old:bear', 'game:Bear', 'Wolf'], gap: 3.2 },
  { file: '00-lineup-bosses', names: ['old:grizzle', 'game:Grizzle', 'old:frostclaw', 'game:Frostclaw'], gap: 5 },
  { file: '01-idle', names: trio('Idle', 0), gap: 4.6 },
  ...[0, 0.25, 0.5, 0.75].map((t, i) => ({ file: `02-walk-${i + 1}`, names: trio('Walk', t), gap: 4.6 })),
  ...[0, 0.154, 0.308, 0.462].map((t, i) => ({ file: `03-gallop-${i + 1}`, names: trio('Gallop', t), gap: 4.6 })),
  ...[0.33, 0.44, 0.5, 0.8].map((t, i) => ({ file: `04-attack-${i + 1}`, names: trio('Attack', t), gap: 4.6 })),
  { file: '04-attack-reach-3q', names: ['game:Grizzle@Attack@0.44'], gap: 4, view: 'three' },
  ...[0.6, 1.1, 2].map((t, i) => ({ file: `05-death-${i + 1}`, names: trio('Death', t), gap: 4.6 })),
  { file: '06-hit-left', names: trio('Idle_HitReact_Left', 0.09), gap: 4.6 },
  { file: '06-hit-right', names: trio('Idle_HitReact_Right', 0.09), gap: 4.6 },
  ...[0.3, 0.75].map((t, i) => ({ file: `07-roar-${i + 1}`, names: trio('Roar', t), gap: 4.6 })),
  { file: '07-roar-3q', names: ['game:Frostclaw@Roar@0.75'], gap: 4, view: 'three', far: 5 },
  { file: '07-roar-3q-grizzle', names: ['game:Grizzle@Roar@0.75'], gap: 4, view: 'three' },
  ...[0.55, 0.8, 0.95, 1.3].map((t, i) => ({ file: `08-slam-${i + 1}`, names: trio('Slam', t), gap: 4.6 })),
  { file: '08-slam-3q', names: ['game:Frostclaw@Slam@0.8'], gap: 4, view: 'three', far: 6.5 },
  { file: '08-slam-3q-impact', names: ['game:Frostclaw@Slam@0.95'], gap: 4, view: 'three', far: 6.5 },
  { file: '09-eating', names: trio('Eating', 1.5), gap: 4.6 },
  { file: '10-grizzle-face', names: ['game:Grizzle@Idle@0'], gap: 4, view: 'face' }
];

const { browser, close } = await launch({ gpu: true });
try {
  const { page, errors } = await openGame(browser, `http://localhost:${PORT}/`, { beforeLoad: { fn: prepPage, args: [SAVE_KEY, null, HIGH_SETTINGS, 5] } });
  await page.evaluate(() => document.getElementById('tNew').click());
  await page.waitForSelector('#iSkip', { timeout: 15000 });
  await page.evaluate(() => document.getElementById('iSkip').click());
  await page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
  // walk onto the lake first and wait for its "Discovered" banner to go
  await page.evaluate(() => { const S = window.__stranded, p = S.G.p; p.x = 66; p.z = -128; p.y = S.groundAt(p.x, p.z); });
  await wait(7000);
  for (const shot of SHOTS.filter(s => !ONLY || ONLY.some(o => s.file.startsWith(o)))) {
    const res = await page.evaluate(async r => {
      const S = window.__stranded, { G, R } = S;
      R.invuln = 1e9; S.clearCreatures(); G.hour = 11.5; G.weather = 'clear'; G.weatherHrs = 99;
      Object.assign(G.p, { warm: 100, food: 80, water: 80 });   // (Frostpeak is cold: no blackouts mid-run)
      for (const o of window.__lineup || []) R.scene.remove(o);
      const L = await import('/tools/animals/lineup.js');
      const before = new Set(R.scene.children);
      // on the Frozen Lake (flat, nothing to hide the paws), in a row facing east
      const x0 = 60, z = -138;
      const placed = await L.place(r.names, { x0, z, gap: r.gap, faceYaw: Math.PI / 2 });
      window.__lineup = R.scene.children.filter(o => !before.has(o));
      const mid = x0 + r.gap * (r.names.length - 1) / 2;
      if (r.view === 'three') { const k = r.far || 4.2; G.p.x = mid + k; G.p.z = z + k; G.p.yaw = Math.atan2(G.p.x - mid - 0.6, G.p.z - z); G.p.pitch = r.far ? -0.05 : -0.22; }
      else if (r.view === 'face') { G.p.x = mid + 3.6; G.p.z = z - 2.2; G.p.yaw = Math.atan2(G.p.x - mid - 1.5, G.p.z - z); G.p.pitch = -0.12; }   // its left side (the scar)
      else { const dist = Math.max(6, r.gap * r.names.length * 0.6 + 1.5); G.p.x = mid + 0.8; G.p.z = z + dist; G.p.yaw = 0; G.p.pitch = -0.18; }
      G.p.y = S.groundAt(G.p.x, G.p.z); G.p.vy = 0;
      return placed;
    }, shot);
    await wait(2200);
    await page.screenshot({ path: join(out, shot.file + '.jpg'), type: 'jpeg', quality: 88 });   // (PNGs were 1.2 MB each)
    console.log(shot.file); for (const p of res) console.log(`  ${p.name.padEnd(26)} size ${p.size ? p.size.join(' x ') : '?'}  floor ${p.floor}`);
  }
  console.log(errors.length ? 'page errors:\n  ' + errors.slice(0, 5).join('\n  ') : 'no page errors');
} finally { await close(); vite.kill(); }
