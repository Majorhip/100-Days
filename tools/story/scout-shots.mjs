// Screenshots of Scout's story from the built game (dist/index.html):
//   1-standing, 2-howling   Scout from the side, standing, then howling at Frostpeak, nose up
//   3-box                   Tomas's box by the Old Iron Mine (chapter 3)
//   4-paws, 5-cairn         the glowing paw prints at night, and the cairn at their end (chapter 5)
//   6-circle-west, 7-circle-north   the carved stones with the stones back in them (chapter 6)
//   8-lights                the lights over Frostpeak (the northern aurora), stronger in chapter 6
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
  const shot = async (name, ms = 2500) => { await wait(ms); await page.screenshot({ path: join(out, name + '.png') }); console.log('shot', name); };
  await ev(() => document.getElementById('tNew').click());
  await page.waitForSelector('#iSkip', { timeout: 15000 });
  await ev(() => document.getElementById('iSkip').click());
  await page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
  await page.waitForFunction(() => !!window.__stranded.R.scout.model.gltf, { timeout: 30000 });
  // stand at (x, z) looking at (tx, ty, tz); a frozen clock at the given hour
  const look = (x, z, tx, ty, tz, hour) => ev((x, z, tx, ty, tz, hour) => {
    const S = window.__stranded, { G, R } = S, p = G.p;
    S.clearCreatures(); R.spawnOff = true; G.hour = hour; G.weather = 'clear'; G.weatherHrs = 99;
    p.x = x; p.z = z; p.y = S.groundAt(x, z); p.vy = 0;
    const dx = tx - x, dz = tz - z; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(ty - (p.y + 1.62), Math.hypot(dx, dz));
  }, x, z, tx, ty, tz, hour);
  await ev(() => {
    const S = window.__stranded, { G, R } = S;
    R.invuln = 1e9; G.scout.friend = true; G.scout.fed = 99; G.flags.rayFree = true; G.flags.rayChoice = 'stay'; G.flags.radio = true;
    G.story = { ch: 6, day: 71, done: false, boxOpen: false, blueFound: false, placed: { greenstone: true, goldstone: true, bluestone: true } };
    G.notes.push('tomas1'); S.updateScoutStory(); S.buildProps();
  });

  // Scout from the side: standing, then howling
  await ev(() => {
    const S = window.__stranded, { G, R } = S, s = R.scout, fp = S.SITES.summit;
    S.clearCreatures(); R.spawnOff = true; G.hour = 16; G.weather = 'clear'; G.weatherHrs = 99;
    s.x = 64.5; s.z = -133; const a = Math.atan2(fp.x - s.x, fp.z - s.z); s.yaw = a;
    const p = G.p; p.x = s.x + Math.cos(a) * 3; p.z = s.z - Math.sin(a) * 3; p.y = S.groundAt(p.x, p.z); p.vy = 0;
    p.yaw = Math.atan2(Math.cos(a), -Math.sin(a)); p.pitch = -0.36;
  });
  const neck = () => ev(() => { const s = window.__stranded.R.scout, b = {}; s.g.traverse(o => { if (o.isBone) b[o.name] = o; }); const y = o => o.getWorldPosition(new o.position.constructor()).y; return +(y(b.Head) - y(b.Neck1)).toFixed(3); });
  await shot('1-standing', 2000); console.log('  head above neck', await neck(), 'm');
  await ev(() => { window.__stranded.R.scout.howlT = 99; });
  await shot('2-howling', 2000); console.log('  head above neck', await neck(), 'm');
  await ev(() => { window.__stranded.R.scout.howlT = 0; window.__stranded.G.scout.friend = false; });

  const S0 = await ev(() => { const S = window.__stranded; return { box: S.STORY_SPOTS.box, trail: S.STORY_SPOTS.trail, blue: S.STORY_SPOTS.blue, ci: S.SITES.circle }; });
  const b = S0.box, T = S0.trail, bl = S0.blue, ci = S0.ci;
  await look(b.x + 0.8, b.z + 3, b.x, 0, b.z, 11); await ev(by => { const S = window.__stranded; S.G.p.pitch = -0.35; }, 0); await shot('3-box');
  await look(T[0][0] - 2, T[0][1] + 2.5, T[2][0], 30, T[2][1], 21.5); await ev(() => { window.__stranded.G.p.pitch = -0.32; window.__stranded.updateScoutStory(); }); await shot('4-paws', 3500);
  await look(bl.x + 2.5, bl.z + 2.2, bl.x, 0, bl.z, 21.5); await ev(() => { window.__stranded.G.p.pitch = -0.4; window.__stranded.updateScoutStory(); }); await shot('5-cairn', 2500);
  // 3.5 m in front of the west and north stones, inside the circle, in the evening light
  await look(ci.x - 4, ci.z + 1.2, ci.x - 7.5, 0, ci.z, 18.3); await ev(() => { window.__stranded.G.p.pitch = 0.0; window.__stranded.updateScoutStory(); }); await shot('6-circle-west');
  await look(ci.x + 1.2, ci.z - 4, ci.x, 0, ci.z - 7.5, 18.3); await ev(() => { window.__stranded.G.p.pitch = 0.0; window.__stranded.updateScoutStory(); }); await shot('7-circle-north');
  await look(-40, 60, -40, 0, -100, 23.5); await ev(() => { window.__stranded.G.p.pitch = 0.42; window.__stranded.updateScoutStory(); }); await shot('8-lights', 8000);
  console.log(errors.length ? 'page errors:\n  ' + errors.slice(0, 5).join('\n  ') : 'no page errors');
} finally { await close(); }
