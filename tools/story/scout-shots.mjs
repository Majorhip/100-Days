// Screenshots of Scout's story moments from the built game (dist/index.html), seen from the side:
// standing, then howling at Frostpeak with his nose up (src/story/scout-story.js).
//
//   node tools/story/scout-shots.mjs <out dir>
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, openGame, prepPage, SAVE_KEY, HIGH_SETTINGS, ROOT } from '../../tests/golden/browser.mjs';

const out = resolve(process.argv[2] || 'scout-shots'); mkdirSync(out, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
const { browser, close } = await launch({ gpu: true });
try {
  const { page, errors } = await openGame(browser, join(ROOT, 'dist', 'index.html'), { beforeLoad: { fn: prepPage, args: [SAVE_KEY, null, HIGH_SETTINGS, 5] } });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  await ev(() => document.getElementById('tNew').click());
  await page.waitForSelector('#iSkip', { timeout: 15000 });
  await ev(() => document.getElementById('iSkip').click());
  await page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
  await page.waitForFunction(() => !!window.__stranded.R.scout.model.gltf, { timeout: 30000 });
  await ev(() => {
    const S = window.__stranded, { G, R } = S, s = R.scout, fp = S.SITES.summit;
    R.invuln = 1e9; S.clearCreatures(); R.spawnOff = true; G.hour = 16; G.weather = 'clear'; G.weatherHrs = 99;
    G.scout.friend = true; G.scout.fed = G.day; s.x = 64.5; s.z = -133;
    const a = Math.atan2(fp.x - s.x, fp.z - s.z); s.yaw = a;   // facing Frostpeak
    const p = G.p; p.x = s.x + Math.cos(a) * 3; p.z = s.z - Math.sin(a) * 3; p.y = S.groundAt(p.x, p.z); p.vy = 0;
    p.yaw = Math.atan2(Math.cos(a), -Math.sin(a)); p.pitch = -0.36;   // looking at him from his side
  });
  // how far the head sits above the base of the neck (m): goes up when he lifts his nose
  const neck = () => ev(() => { const s = window.__stranded.R.scout, b = {}; s.g.traverse(o => { if (o.isBone) b[o.name] = o; }); const y = o => o.getWorldPosition(new o.position.constructor()).y; return +(y(b.Head) - y(b.Neck1)).toFixed(3); });
  await wait(2000); await page.screenshot({ path: join(out, '1-standing.png') }); console.log('standing: head above neck', await neck(), 'm');
  await ev(() => { window.__stranded.R.scout.howlT = 99; });
  await wait(2000); await page.screenshot({ path: join(out, '2-howling.png') }); console.log('howling: head above neck', await neck(), 'm');
  console.log(errors.length ? 'page errors:\n  ' + errors.slice(0, 5).join('\n  ') : 'no page errors');
} finally { await close(); }
