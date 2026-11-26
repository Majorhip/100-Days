// In-game screenshots of the bears from the built game (dist/index.html), driven by the game's
// own creature code: the bear, Grizzle and Frostclaw on the Frozen Lake; Grizzle roaring before
// a charge; Frostclaw rearing up for its slam, then landing.
//
//   node tools/animals/bosses.mjs <out dir>
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, openGame, prepPage, SAVE_KEY, HIGH_SETTINGS, ROOT } from '../../tests/golden/browser.mjs';

const out = resolve(process.argv[2] || 'bosses'); mkdirSync(out, { recursive: true });
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
  const clip = () => ev(() => window.__stranded.R.creatures.filter(c => c.model.mixer && /bear|grizzle|frostclaw/.test(c.type)).map(c => `${c.type} ${c.state} ${c.model.mixer._actions.filter(a => a.isRunning() && a.getEffectiveWeight() > 0.5).map(a => a.getClip().name + '@' + a.time.toFixed(2)).join('+')}`).join(' | '));
  // stand on the Frozen Lake looking north at a row of bears, side on
  const setup = types => ev(types => {
    const S = window.__stranded, { G, R } = S, p = G.p;
    R.invuln = 1e9; S.clearCreatures(); G.hour = 11.5; G.weather = 'clear'; G.weatherHrs = 99;
    p.x = 63; p.z = -122; p.y = S.groundAt(p.x, p.z); p.vy = 0; p.yaw = 0; p.pitch = -0.08;
    let x = 63 - (types.length - 1) * 3.6;
    for (const t of types) { const c = S.spawnCreature(t, x, -134); c.yaw = Math.PI / 2; c.st = 99; c.tx = null; c.def = Object.assign({}, c.def, { sense: 0, leash: 999 }); x += 7.2; }
  }, types);

  await setup(['bear', 'grizzle', 'frostclaw']);
  await wait(2000); console.log('1', await clip()); await page.screenshot({ path: join(out, '1-bears.png') });

  // Grizzle roars (the wind-up before a charge), facing you
  await setup(['grizzle']);
  await ev(() => { const c = window.__stranded.R.creatures.find(c => c.type === 'grizzle'); c.yaw = Math.PI; c.x = 63; c.z = -131; });
  await wait(1200);
  await ev(() => { const c = window.__stranded.R.creatures.find(c => c.type === 'grizzle'); c.state = 'tele'; c.st = 0.95; c.mode = 'charge'; });
  await wait(600); console.log('2', await clip()); await page.screenshot({ path: join(out, '2-grizzle-roar.png') });

  // Frostclaw rears up for the slam, then lands; seen from the side
  await setup(['frostclaw']);
  await ev(() => { const c = window.__stranded.R.creatures.find(c => c.type === 'frostclaw'); c.x = 63; c.z = -133; });
  await wait(1200);
  await ev(() => { const c = window.__stranded.R.creatures.find(c => c.type === 'frostclaw'); c.state = 'tele'; c.st = 0.95; c.mode = 'slam'; });
  await wait(550); console.log('3', await clip()); await page.screenshot({ path: join(out, '3-frostclaw-rears.png') });
  await wait(420); console.log('4', await clip()); await page.screenshot({ path: join(out, '4-frostclaw-lands.png') });
  console.log(errors.length ? 'page errors:\n  ' + errors.slice(0, 5).join('\n  ') : 'no page errors');
} finally { await close(); }
