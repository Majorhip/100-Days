// Plays the built game (dist/index.html) with the animated wolves and takes screenshots:
// standing, chasing, biting and falling. Prints each wolf's model and clip as it goes.
//
//   node tools/animals/wolves.mjs <out dir>
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, openGame, prepPage, SAVE_KEY, HIGH_SETTINGS, ROOT } from '../../tests/golden/browser.mjs';

const out = resolve(process.argv[2] || 'wolves'); mkdirSync(out, { recursive: true });
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
  const report = () => ev(() => window.__stranded.R.creatures.filter(c => c.model.gltf).map(c => `${c.model.gltf} ${c.state} ${Math.hypot(c.x - window.__stranded.G.p.x, c.z - window.__stranded.G.p.z).toFixed(1)}m away ${c.moving.toFixed(1)}m/s ${(c.model.mixer && c.model.mixer._actions.filter(a => a.isRunning() && a.getEffectiveWeight() > 0.5).map(a => a._clip.name).join('+')) || ''}`));
  // on the Frozen Lake: flat and open, so nothing hides them
  await ev(() => {
    const S = window.__stranded, { G, R } = S;
    R.invuln = 1e9; S.clearCreatures(); G.hour = 11.5; G.weather = 'clear'; G.weatherHrs = 99;
    G.p.x = 66; G.p.z = -130; G.p.y = S.groundAt(G.p.x, G.p.z); G.p.vy = 0; G.p.yaw = 0; G.p.pitch = -0.15;
    const a = S.spawnCreature('wolf', 63, -136), b = S.spawnCreature('wolf', 66, -137, { model: 'redwolf' }), c = S.spawnCreature('snowwolf', 69, -136);
    for (const w of [a, b, c]) { w.yaw = Math.PI / 2; w.def = Object.assign({}, w.def, { sense: 0 }); w.st = 99; w.tx = null; }
  });
  await wait(2500); console.log('1 standing', await report()); await page.screenshot({ path: join(out, '1-wolves-standing.png') });
  // gallop across the view: scare them east (flee from a point to the west)
  await ev(() => { const S = window.__stranded; S.G.p.z = -122; for (const w of S.R.creatures) { w.state = 'flee'; w.st = 1.0; w.fx = 30; w.fz = w.z; } });
  await wait(450); console.log('2 galloping', await report()); await page.screenshot({ path: join(out, '2-wolves-galloping.png') });
  // then they come for the player, who faces them
  await ev(() => { const S = window.__stranded, p = S.G.p; S.R.creatures = S.R.creatures.filter(c => { if (c.model.gltf) return true; S.R.scene.remove(c.g); return false; }); const w = S.R.creatures; const cx = w.reduce((a, c) => a + c.x, 0) / w.length, cz = w.reduce((a, c) => a + c.z, 0) / w.length; p.x = cx + 7; p.z = cz + 7; p.y = S.groundAt(p.x, p.z); p.yaw = Math.atan2(p.x - cx, p.z - cz); p.pitch = -0.25; for (const c of w) { c.def = Object.assign({}, c.def, { sense: 28 }); c.state = 'chase'; c.st = 0; } });
  // shoot when the first one starts its bite
  for (let i = 0; i < 40 && !(await ev(() => window.__stranded.R.creatures.some(c => c.state === 'wind'))); i++) await wait(50);
  await ev(() => { const S = window.__stranded, p = S.G.p, w = S.R.creatures.filter(c => c.model.gltf).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; p.yaw = Math.atan2(p.x - w.x, p.z - w.z); p.pitch = -0.45; });
  await wait(200); console.log('3 biting', await report()); await page.screenshot({ path: join(out, '3-wolves-biting.png') });
  await ev(() => { const S = window.__stranded; for (const w of S.R.creatures.slice()) if (w.model.gltf) S.damageCreature(w, 999); });
  await wait(600); console.log('4 falling', await report()); await page.screenshot({ path: join(out, '4-wolves-falling.png') });
  await wait(1500); console.log('5 after', await ev(() => window.__stranded.R.creatures.length), 'creatures left');
  console.log(errors.length ? 'page errors:\n  ' + errors.slice(0, 5).join('\n  ') : 'no page errors');
} finally { await close(); }
