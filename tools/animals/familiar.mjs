// Step B screenshots from the built game (dist/index.html): a doe, a stag, a fox, an arctic fox
// and Scout standing in a row, then walking (Scout trots after the player), then a close look at Scout.
//
//   node tools/animals/familiar.mjs <out dir>
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, openGame, prepPage, SAVE_KEY, HIGH_SETTINGS, ROOT } from '../../tests/golden/browser.mjs';

const out = resolve(process.argv[2] || 'familiar'); mkdirSync(out, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
const { browser, close } = await launch({ gpu: true });
try {
  const { page, errors } = await openGame(browser, join(ROOT, 'dist', 'index.html'), { beforeLoad: { fn: prepPage, args: [SAVE_KEY, null, HIGH_SETTINGS, 5] } });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  await ev(() => document.getElementById('tNew').click());
  await page.waitForSelector('#iSkip', { timeout: 15000 });
  await ev(() => document.getElementById('iSkip').click());
  await page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
  await wait(1500);
  const report = () => ev(() => { const S = window.__stranded; return S.R.creatures.concat([S.R.scout]).filter(c => c.model.gltf).map(c => `${c.model.file}${c.model.gltf !== c.model.file ? '(' + c.model.gltf + ')' : ''} ${c.state} ${c.moving.toFixed(1)}m/s ${c.model.mixer._actions.filter(a => a.isRunning() && a.getEffectiveWeight() > 0.5).map(a => a.getClip().name).join('+')}`); });
  await ev(() => {
    const S = window.__stranded, { G, R } = S;
    R.invuln = 1e9; S.clearCreatures(); G.hour = 11.5; G.weather = 'clear'; G.weatherHrs = 99; R.spawnOff = true;
    const z = -137, row = [];
    // a doe and a stag (the deer kind picks one at random)
    for (const want of ['Deer', 'Stag']) for (let i = 0; i < 40; i++) { const c = S.spawnCreature('deer', 0, 0); if (c.model.file === want) { row.push(c); break; } S.removeCreature(c); }
    row.push(S.spawnCreature('fox', 0, 0), S.spawnCreature('fox', 0, 0, { model: 'arcticfox' }));
    let x = 60;
    for (const c of row) { c.x = x; c.z = z; c.yaw = Math.PI / 2; c.def = Object.assign({}, c.def, { flee: 0 }); c.st = 99; c.tx = null; x += 3; }
    G.scout.friend = false; const s = R.scout; s.x = x; s.z = z; s.yaw = Math.PI / 2;
    G.p.x = 64.5; G.p.z = -129.5; G.p.y = S.groundAt(G.p.x, G.p.z); G.p.vy = 0; G.p.yaw = 0; G.p.pitch = -0.12;
  });
  await wait(2500); console.log('1 standing', await report()); await page.screenshot({ path: join(out, '1-standing.png') });
  await ev(() => { const S = window.__stranded; for (const c of S.R.creatures) { c.state = 'idle'; c.tx = c.x + 40; c.tz = c.z; c.st = 99; } S.G.scout.friend = true; S.G.scout.fed = S.G.day; S.G.p.x += 4; });
  await wait(1500); console.log('2 walking', await report()); await page.screenshot({ path: join(out, '2-walking.png') });
  await ev(() => { const S = window.__stranded, s = S.R.scout, p = S.G.p; S.clearCreatures(); S.G.scout.friend = false; s.x = p.x; s.z = p.z - 2.2; s.yaw = 0.9; p.pitch = -0.45; p.yaw = 0; });
  await wait(1500); console.log('3 scout', await report()); await page.screenshot({ path: join(out, '3-scout.png') });
  console.log(errors.length ? 'page errors:\n  ' + errors.slice(0, 5).join('\n  ') : 'no page errors');
} finally { await close(); }
