// New-game check: start a brand-new game (no save), skip the intro, walk forward and let
// the clock run, on the real graphics card at High. Fails on any page error, including
// shader compile errors, which three.js reports on the console.
//
//   node tests/golden/newgame.mjs [target]     (default: the original file)
import { launch, openGame, prepPage, ORIGINAL, SAVE_KEY, HIGH_SETTINGS } from './browser.mjs';

const target = process.argv.slice(2).find(a => !a.startsWith('--')) || ORIGINAL;
const RUN_MS = 20000;
const { browser, close } = await launch({ gpu: true });
let r, errors, warnings = [];
try {
  const o = await openGame(browser, target, { beforeLoad: { fn: prepPage, args: [SAVE_KEY, null, HIGH_SETTINGS, 777] } });
  errors = o.errors;
  o.page.on('console', m => { if (m.type() === 'warning' && /THREE|shader|WebGL/i.test(m.text())) warnings.push(m.text().slice(0, 300)); });
  if (await o.page.$('#tContinue')) throw new Error('A save exists in the fresh profile; expected none.');
  await o.page.click('#tNew');
  await o.page.waitForSelector('#iSkip', { timeout: 10000 });
  await o.page.click('#iSkip');
  await o.page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
  const start = await o.page.evaluate(() => { const { G } = window.__stranded; return { day: G.day, hour: G.hour, x: G.p.x, z: G.p.z }; });
  await o.page.keyboard.down('KeyW');
  await new Promise(res => setTimeout(res, 3000));
  await o.page.keyboard.up('KeyW');
  await new Promise(res => setTimeout(res, RUN_MS - 3000));
  const end = await o.page.evaluate(() => { const { G, R } = window.__stranded; return { day: G.day, hour: G.hour, x: G.p.x, z: G.p.z, fps: Math.round(R.fps || 0), quality: R.Q.n, hp: G.p.hp }; });
  r = { start, end, moved: Math.hypot(end.x - start.x, end.z - start.z) };
} finally { await close(); }

const hours = ((r.end.day - r.start.day) * 24 + r.end.hour - r.start.hour);
console.log(`target:   ${target}`);
console.log(`started:  day ${r.start.day}, ${r.start.hour.toFixed(2)} h at (${r.start.x.toFixed(1)}, ${r.start.z.toFixed(1)})`);
console.log(`after ${RUN_MS / 1000}s: ${hours.toFixed(2)} game hours passed (expect ~${(RUN_MS / 1000 / 20).toFixed(1)}), walked ${r.moved.toFixed(1)} m, hp ${r.end.hp}, ${r.end.quality}, ${r.end.fps} fps`);
if (warnings.length) console.log('three.js warnings:\n  ' + warnings.join('\n  '));
const fails = [];
if (errors.length) fails.push('page errors:\n  ' + errors.join('\n  '));
if (r.moved < 1) fails.push('player did not move when W was held');
if (hours < 0.5) fails.push('game clock did not advance');
if (fails.length) { console.error('FAIL: ' + fails.join('\n')); process.exit(1); }
console.log('PASS: new game starts, the player walks, the clock runs, zero page errors.');
