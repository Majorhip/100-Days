// Step C screenshots from the built game (dist/index.html): boar, snake, crab, spider, frog and
// bat in a row, then walking, then attacking the player.
//
//   node tools/animals/wildlife.mjs <out dir>
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, openGame, prepPage, SAVE_KEY, HIGH_SETTINGS, ROOT } from '../../tests/golden/browser.mjs';

const out = resolve(process.argv[2] || 'wildlife'); mkdirSync(out, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
const TYPES = ['boar', 'snake', 'bat', 'crab', 'spider', 'frog'];
const { browser, close } = await launch({ gpu: true });
try {
  const { page, errors } = await openGame(browser, join(ROOT, 'dist', 'index.html'), { beforeLoad: { fn: prepPage, args: [SAVE_KEY, null, HIGH_SETTINGS, 5] } });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  await ev(() => document.getElementById('tNew').click());
  await page.waitForSelector('#iSkip', { timeout: 15000 });
  await ev(() => document.getElementById('iSkip').click());
  await page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
  await wait(1500);
  const report = () => ev(T => window.__stranded.R.creatures.filter(c => T.includes(c.type)).map(c => `${c.type} ${c.model.gltf ? '' : 'HAND-BUILT '}${c.state} ${c.moving.toFixed(1)}m/s ${c.model.mixer ? c.model.mixer._actions.filter(a => a.isRunning() && a.getEffectiveWeight() > 0.5).map(a => a.getClip().name).join('+') : ''}`), TYPES);
  const place = (T, z, calm) => ev((T, z, calm) => {
    const S = window.__stranded, { G, R } = S;
    R.invuln = 1e9; S.clearCreatures(); G.hour = 11.5; G.weather = 'clear'; G.weatherHrs = 99;
    let x = 59;
    for (const t of T) { const c = S.spawnCreature(t, x, z); c.yaw = Math.PI / 2; c.st = 99; c.tx = null; if (calm) c.def = Object.assign({}, c.def, { sense: 0, flee: 0 }); x += 2.2; }
    G.p.x = 64.5; G.p.z = z + 6.5; G.p.y = S.groundAt(G.p.x, G.p.z); G.p.vy = 0; G.p.yaw = 0; G.p.pitch = -0.2;
  }, T, z, calm);
  await place(TYPES, -137, true);
  await wait(2500); console.log('1 standing', await report()); await page.screenshot({ path: join(out, '1-standing.png') });
  await ev(T => { for (const c of window.__stranded.R.creatures) if (T.includes(c.type)) { c.state = 'idle'; c.tx = c.x + 30; c.tz = c.z; c.st = 99; } }, TYPES);
  await wait(1200); console.log('2 walking', await report()); await page.screenshot({ path: join(out, '2-walking.png') });
  // the fighters come for the player
  await place(['boar', 'snake', 'crab', 'spider'], -137, false);
  await ev(() => { for (const c of window.__stranded.R.creatures) { c.state = 'chase'; c.warned = true; c.def = Object.assign({}, c.def, { lose: 40, sense: 20 }); } });
  for (let i = 0; i < 60 && (await ev(() => window.__stranded.R.creatures.filter(c => c.state === 'wind').length)) < 2; i++) await wait(50);
  await wait(150); console.log('3 attacking', await report()); await page.screenshot({ path: join(out, '3-attacking.png') });
  console.log(errors.length ? 'page errors:\n  ' + errors.slice(0, 5).join('\n  ') : 'no page errors');
} finally { await close(); }
