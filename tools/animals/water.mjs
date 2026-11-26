// Step D screenshots from the built game (dist/index.html): a horse herd, donkeys and alpacas;
// the herd galloping; a shark circling a swimmer in the deep sea, then biting; fish in a lake.
//
//   node tools/animals/water.mjs <out dir>
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, openGame, prepPage, SAVE_KEY, HIGH_SETTINGS, ROOT } from '../../tests/golden/browser.mjs';

const out = resolve(process.argv[2] || 'water'); mkdirSync(out, { recursive: true });
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
  const report = T => ev(T => window.__stranded.R.creatures.filter(c => T.includes(c.type)).map(c => `${c.model.file || 'HAND-BUILT'} ${c.state} ${c.moving.toFixed(1)}m/s ${Math.hypot(c.x - window.__stranded.G.p.x, c.z - window.__stranded.G.p.z).toFixed(1)}m ${c.model.mixer ? c.model.mixer._actions.filter(a => a.isRunning() && a.getEffectiveWeight() > 0.5).map(a => a.getClip().name).join('+') : ''}`), T);

  // 1-2: herds on the Frozen Lake (flat and open)
  await ev(() => {
    const S = window.__stranded, { G, R } = S;
    R.invuln = 1e9; S.clearCreatures(); G.hour = 11.5; G.weather = 'clear'; G.weatherHrs = 99;
    const row = [['horse', 0], ['horse', 0], ['horse', 0], ['donkey', 0], ['alpaca', 0]];
    let x = 57;
    for (const [t] of row) { const c = S.spawnCreature(t, x, -138); c.yaw = Math.PI / 2; c.st = 99; c.tx = null; c.def = Object.assign({}, c.def, { flee: 0 }); x += 3.2; }
    G.p.x = 63.5; G.p.z = -128; G.p.y = S.groundAt(G.p.x, G.p.z); G.p.vy = 0; G.p.yaw = 0; G.p.pitch = -0.1;
  });
  await wait(2500); console.log('1 herds', await report(['horse', 'donkey', 'alpaca'])); await page.screenshot({ path: join(out, '1-herds.png') });
  await ev(() => { for (const c of window.__stranded.R.creatures) { c.state = 'idle'; c.tx = c.x + 60; c.tz = c.z; c.st = 99; } });
  await ev(() => { for (const c of window.__stranded.R.creatures) c.def = Object.assign({}, c.def, { spd: c.def.spd }); });
  // gallop: make them flee from a point behind (west of) them by moving the player there, out of shot
  await ev(() => { const S = window.__stranded; for (const c of S.R.creatures) { c.state = 'flee'; c.st = 2; } });
  await wait(300); console.log('2 galloping', await report(['horse', 'donkey', 'alpaca'])); await page.screenshot({ path: join(out, '2-galloping.png') });

  // 3-4: the shark. Out from the cove into deep sea water, swimming
  const sea = await ev(() => {
    const S = window.__stranded, { G, R } = S, p = G.p; S.clearCreatures(); G.hour = 11;
    const sx = R.start.x, sz = R.start.z, l = Math.hypot(sx, sz), ux = sx / l, uz = sz / l;
    for (let d = 0; d < 80; d += 0.5) { const x = sx + ux * d, z = sz + uz * d, h = S.heightAt(x, z); if (h < -3.2 && h > -4.3) { p.x = x; p.z = z; p.y = -1.2; p.vy = 0; p.yaw = Math.atan2(-ux, -uz) + Math.PI; p.pitch = -0.05; return { x, z, h }; } }
    return null;
  });
  console.log('deep sea spot', sea);
  for (let i = 0; i < 80 && !(await ev(() => window.__stranded.R.creatures.some(c => c.type === 'shark'))); i++) await wait(250);
  await wait(3500);
  await ev(() => { const S = window.__stranded, p = S.G.p, c = S.R.creatures.find(c => c.type === 'shark'); if (c) { p.yaw = Math.atan2(p.x - c.x, p.z - c.z); p.pitch = -0.12; } });
  await wait(100); console.log('3 shark circling', await report(['shark']), await ev(() => ({ swim: window.__stranded.R.swim }))); await page.screenshot({ path: join(out, '3-shark-circling.png') });
  for (let i = 0; i < 200 && !(await ev(() => window.__stranded.R.creatures.some(c => c.type === 'shark' && c.state === 'wind'))); i++) await wait(100);
  await ev(() => { const S = window.__stranded, p = S.G.p, c = S.R.creatures.find(c => c.type === 'shark'); if (c) { p.yaw = Math.atan2(p.x - c.x, p.z - c.z); p.pitch = -0.25; } });
  await wait(50); console.log('4 shark biting', await report(['shark'])); await page.screenshot({ path: join(out, '4-shark-biting.png') });

  // 5: fish in Mirror Lake, seen from the bank by their school
  await ev(() => { const S = window.__stranded, { G, R } = S, p = G.p, l = S.LAKES[0]; S.clearCreatures(); G.hour = 12; p.x = l.x + l.r + 15; p.z = l.z; p.y = S.groundAt(p.x, p.z); });
  await wait(1500);
  const fish = await ev(() => {
    const S = window.__stranded, p = S.G.p, l = S.LAKES[0]; let f = null;
    S.R.scene.traverse(o => { if (!f && o.isSkinnedMesh) { let q = o; while (q.parent && q.parent !== S.R.scene) q = q.parent; if (q.position.y < 1 && Math.hypot(q.position.x - l.x, q.position.z - l.z) < l.r + 2 && q.children[0] && q.children[0].scale.x < 1) f = q; } });
    if (!f) return null;
    const dx = f.position.x - l.x, dz = f.position.z - l.z, dl = Math.hypot(dx, dz);
    p.x = f.position.x + dx / dl * 4.5; p.z = f.position.z + dz / dl * 4.5; p.y = S.groundAt(p.x, p.z); p.yaw = Math.atan2(dx, dz); p.pitch = -0.6;
    return { x: f.position.x, z: f.position.z, y: f.position.y };
  });
  console.log('5 a fish at', fish);
  await wait(800); await page.screenshot({ path: join(out, '5-fish.png') });
  console.log(errors.length ? 'page errors:\n  ' + errors.slice(0, 5).join('\n  ') : 'no page errors');
} finally { await close(); }
