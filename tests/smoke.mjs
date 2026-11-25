// Smoke test: play through the game's main systems in headless Chrome on the real graphics
// card, with zero page errors allowed (shader compile errors included: three.js reports them
// on the console).
//
//   node tests/smoke.mjs [target]     (default: dist/index.html)
//
// new game -> chop a tree -> build and light a campfire -> a night with wolves -> a storm ->
// sleep until morning -> swim -> visit all three biomes -> switch through all four graphics
// levels. Each action uses the game's own functions (hitNode, startBuild/placeBuild, addFuel,
// lightFire, spawnCreature, trySleep, setQuality...) and then lets the game run in real time.
import { launch, openGame, prepPage, SAVE_KEY, HIGH_SETTINGS } from './golden/browser.mjs';

const target = process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];

const { browser, close } = await launch({ gpu: true });
let errors = [];
try {
  const o = await openGame(browser, target, { beforeLoad: { fn: prepPage, args: [SAVE_KEY, null, HIGH_SETTINGS, 31337] } });
  const page = o.page; errors = o.errors;
  page.on('dialog', d => { errors.push('unexpected dialog: ' + d.message()); d.dismiss().catch(() => { }); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  async function step(name, run, check) {
    const before = errors.length;
    let ok = false, info = '';
    try { const r = await run(); const c = await check(r); ok = c.ok; info = c.info || ''; } catch (e) { info = 'threw: ' + e.message; }
    const errs = errors.slice(before);
    if (errs.length) { ok = false; info += (info ? '; ' : '') + errs.length + ' page error(s)'; }
    results.push({ name, ok, info });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(26)} ${info}`);
    errs.forEach(e => console.log('        ' + e.slice(0, 200)));
  }

  await step('new game', async () => {
    await ev(() => document.getElementById('tNew').click());
    await page.waitForSelector('#iSkip', { timeout: 15000 });
    await ev(() => document.getElementById('iSkip').click());
    await page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
    await ev(() => { window.__stranded.R.invuln = 1e9; });   // the wolves below must not end the run
    await wait(3000);
  }, () => ev(() => { const { G, R } = window.__stranded; const d = Math.hypot(G.p.x - R.start.x, G.p.z - R.start.z); return { ok: G.day === 1 && d < 5, info: `day ${G.day}, ${d.toFixed(1)} m from the cove start` }; }));

  await step('chop a tree', () => ev(() => {
    const S = window.__stranded, { G, NODES, NT, ITEMS } = S;
    S.give('axe', 1); G.p.held = 'axe'; S.refreshViewModel();
    let best = null, bd = 1e9;
    for (const n of NODES) if (!n.gone && NT[n.t].cls === 'tree') { const d = Math.hypot(n.x - G.p.x, n.z - G.p.z); if (d < bd) { bd = d; best = n; } }
    G.p.x = best.x + 1.8; G.p.z = best.z; G.p.y = S.groundAt(G.p.x, G.p.z);
    const wood0 = S.inv('wood'); let swings = 0;
    while (!best.gone && swings < 30) { S.hitNode(best, ITEMS.axe.tool); swings++; }
    return { wood0, wood: S.inv('wood'), gone: best.gone, swings, type: best.t };
  }).then(async r => { await wait(3500); return r; }),     // let the tree topple (falling-tree effect)
  r => ({ ok: r.gone && r.wood > r.wood0, info: `${r.type} down in ${r.swings} swings, wood ${r.wood0} -> ${r.wood}` }));

  await step('build and light a fire', async () => {
    await ev(() => { const S = window.__stranded; S.give('stone', 3); S.give('stick', 4); S.G.p.pitch = -0.55; S.startBuild('campfire'); });
    await wait(800);                                             // the ghost follows the aim for a few frames
    await ev(() => window.__stranded.placeBuild());
    const r = await ev(() => {
      const S = window.__stranded, s = S.G.structures.find(q => q.k === 'campfire');
      if (!s) return { built: false };
      S.give('wood', 2); S.addFuel(s, 'wood'); S.addFuel(s, 'wood'); S.lightFire(s);
      return { built: true, fuel: s.d.fuel, lit: s.d.lit };
    });
    await wait(3000);
    return r;
  }, r => ev(rr => { const s = window.__stranded.G.structures.find(q => q.k === 'campfire'); return { ok: rr.built && rr.lit && !!s && s.d.lit, info: rr.built ? `campfire built, fuel ${rr.fuel}, lit ${s && s.d.lit}` : 'could not place a campfire' }; }, r));

  await step('a night with wolves', async () => {
    await ev(() => { const S = window.__stranded, p = S.G.p; S.G.hour = 22; S.spawnCreature('wolf', p.x + 14, p.z + 3); S.spawnCreature('wolf', p.x - 12, p.z + 8); });
    let seen = 0; for (let i = 0; i < 8; i++) { await wait(1000); seen = Math.max(seen, await ev(() => window.__stranded.R.creatures.filter(c => c.type === 'wolf').length)); }
    return seen;
  }, seen => ev(n => ({ ok: n >= 1 && window.__stranded.nightAmount() > 0.9, info: `${n} wolves active at ${window.__stranded.G.hour.toFixed(1)} h` }), seen));

  await step('a storm', async () => {
    await ev(() => { const { G } = window.__stranded; G.weather = 'storm'; G.weatherHrs = 99; G.hour = 14; });
    await wait(6000);
  }, () => ev(() => { const { G, R } = window.__stranded; return { ok: G.weather === 'storm' && R.overcast > 0.8, info: `overcast ${R.overcast.toFixed(2)}, rain ${R.rain.visible}` }; }));

  await step('sleep until morning', async () => {
    const day0 = await ev(() => { const S = window.__stranded; S.clearCreatures(); S.G.weather = 'clear'; S.G.weatherHrs = 99; S.G.hour = 21; const d = S.G.day; S.trySleep({ k: 'bed' }); return d; });
    await page.waitForFunction(() => { const { G, R } = window.__stranded; return R.panel && G.hour > 5.9 && G.hour < 6.5; }, { timeout: 30000, polling: 100 });
    await wait(500);
    await ev(() => window.__stranded.closePanel());
    await page.waitForFunction(() => !window.__stranded.R.sleeping, { timeout: 15000 });
    return day0;
  }, day0 => ev(d => { const { G } = window.__stranded; return { ok: G.day === d + 1 && G.hour >= 6 && G.hour < 7, info: `woke on day ${G.day} at ${G.hour.toFixed(2)} h` }; }, day0));

  await step('swim', async () => {
    await ev(() => { const { G, LAKES } = window.__stranded; const L = LAKES.find(l => l.id === 'mirror'); G.p.x = L.x; G.p.z = L.z; G.p.y = 0.5; G.p.vy = 0; });
    await wait(4000);
  }, () => ev(() => { const { G, R } = window.__stranded; return { ok: G.p.y < 0 && R.stepKind === 'water', info: `in Mirror Lake, y ${G.p.y.toFixed(2)}, ${R.stepKind}` }; }));

  for (const [biome, x, z] of [['forest', 0, 60], ['desert', 205, 10], ['snow', -60, -150]]) {
    await step(`visit ${biome}`, async () => {
      await ev(([x, z]) => { const S = window.__stranded, p = S.G.p; p.x = x; p.z = z; p.y = S.groundAt(x, z); p.vy = 0; }, [x, z]);
      await wait(2500);
    }, () => ev(b => { const { R } = window.__stranded; return { ok: R.biome === b, info: `biome ${R.biome}` }; }, biome));
  }

  for (const q of [1, 2, 3, 4]) {
    await step(`graphics level ${q}`, async () => { await ev(qq => window.__stranded.setQuality(qq), q); await wait(3000); },
      () => ev(qq => { const { R } = window.__stranded; return { ok: R.quality === qq && R.Q && R.Q.n === ['', 'Low', 'Medium', 'High', 'Ultra'][qq], info: `${R.Q.n}, ${Math.round(R.fps)} fps` }; }, q));
  }
} finally { await close(); }

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed, ${errors.length} page error(s) in total (${target})`);
if (failed.length || errors.length) { console.error('FAIL: smoke test'); process.exit(1); }
console.log('PASS: smoke test, zero errors.');
