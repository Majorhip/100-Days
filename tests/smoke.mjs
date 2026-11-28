// Smoke test: play through the game's main systems in headless Chrome on the real graphics
// card, with zero page errors allowed (shader compile errors included: three.js reports them
// on the console).
//
//   node tests/smoke.mjs [target] [--quick] [--only=<words>]     (default: dist/index.html)
//
// --quick runs only the core steps (QUICK below), for npm run check. --only=story runs only the
// steps whose names contain "story" (and "new game", which starts the game), while working on them.
//
// new game -> chop a tree -> build and light a campfire -> a night with wolves -> a storm ->
// sleep until morning -> swim (float, cross the lake, in from the shore and out) -> visit all three biomes -> switch through all four graphics
// levels. Each action uses the game's own functions (hitNode, startBuild/placeBuild, addFuel,
// lightFire, spawnCreature, trySleep, setQuality...) and then lets the game run in real time.
import { launch, openGame, prepPage, SAVE_KEY, HIGH_SETTINGS } from './golden/browser.mjs';

const target = process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
const QUICK = process.argv.includes('--quick') && new Set(['new game', 'chop a tree', 'build and light a fire', 'rarer finds and animals', 'difficulty levels', 'a storm', 'sleep until morning', 'visit desert']);

const { browser, close } = await launch({ gpu: true });
let errors = [];
try {
  const o = await openGame(browser, target, { beforeLoad: { fn: prepPage, args: [SAVE_KEY, null, HIGH_SETTINGS, 31337] } });
  const page = o.page; errors = o.errors;
  page.on('dialog', d => { errors.push('unexpected dialog: ' + d.message()); d.dismiss().catch(() => { }); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  async function step(name, run, check) {
    if (QUICK && !QUICK.has(name)) return;
    if (ONLY && name !== 'new game' && !name.includes(ONLY)) return;
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

  // the wolves have animated models (src/models/gltf-animals.js): they play clips, bite, fall and
  // go away; the creatures without one keep the hand-built model. (Raid wolves: the campfire from
  // the steps above would scare ordinary ones away.)
  await step('animated wolves', async () => {
    await ev(() => {
      const S = window.__stranded, p = S.G.p; S.clearCreatures();
      window.__w = ['wolf', 'redwolf', 'snowwolf'].map((m, i) => { const c = S.spawnCreature(m === 'snowwolf' ? 'snowwolf' : 'wolf', p.x + 6 + i, p.z + 4, { model: m, raid: true }); c.state = 'chase'; c.warned = true; return c; });
      window.__bear = S.spawnCreature('goat', p.x - 30, p.z - 30);   // a kind that is still hand-built
    });
    let bit = false; for (let i = 0; i < 40 && !bit; i++) { await wait(100); bit = await ev(() => window.__w.some(c => c.state === 'wind')); }
    const mid = await ev(() => window.__w.map(c => ({ m: c.model.gltf || null, clip: c.model.mixer ? c.model.mixer._actions.filter(a => a.isRunning()).map(a => a.getClip().name).join('+') : '' })));
    const loot0 = await ev(() => window.__stranded.inv('fur'));
    await ev(() => { for (const c of window.__w) window.__stranded.damageCreature(c, 999); });
    await wait(400);
    const falling = await ev(() => window.__w.filter(c => window.__stranded.R.creatures.includes(c) && c.model.mixer._actions.some(a => a.isRunning() && a.getClip().name === 'Death')).length);
    await wait(2500);
    return { mid, bit, loot0, falling };
  }, r => ev(rr => {
    const S = window.__stranded, left = window.__w.filter(c => S.R.creatures.includes(c)).length, bear = !window.__bear.model.gltf && window.__bear.model.legs.length === 4;
    const models = rr.mid.every(m => m.m), fur = S.inv('fur') - rr.loot0;
    return { ok: models && rr.bit && rr.falling === 3 && left === 0 && fur >= 4 && bear, info: `${rr.mid.map(m => (m.m || 'hand-built') + ':' + m.clip).join(', ')}; bite ${rr.bit}; ${rr.falling} falling, ${left} left, +${fur} fur; goat ${bear ? 'hand-built' : 'WRONG'}` };
  }, r));

  // step B: deer come as does and stags, the fox (and white arctic fox) is new, Scout is a Shiba
  // with a red collar; a fox without its animated model falls back to a box fox
  await step('deer, fox and Scout', async () => {
    const r = await ev(() => {
      const S = window.__stranded, p = S.G.p, files = {};
      for (let i = 0; i < 30; i++) files[S.gltfAnimal('deer').file] = 1;
      S.clearCreatures();
      window.__f = [S.spawnCreature('fox', p.x + 9, p.z + 9), S.spawnCreature('fox', p.x - 9, p.z + 9, { model: 'arcticfox' }), S.spawnCreature('deer', p.x, p.z + 12)];
      let collar = false; S.R.scout.g.traverse(o => { if (o.geometry && o.geometry.type === 'TorusGeometry') collar = true; });
      const box = S.KINDS.fox.fallback();
      return { files: Object.keys(files).sort().join('+'), scout: S.R.scout.model.gltf || 'hand-built', collar, fallback: box.legs.length === 4 && !box.gltf, models: window.__f.map(c => c.model.gltf || 'hand-built') };
    });
    await wait(1500);
    r.fled = await ev(() => window.__f.filter(c => c.state === 'flee').length);
    const meat0 = await ev(() => window.__stranded.inv('rawmeat') + '/' + window.__stranded.inv('fur'));
    await ev(() => { for (const c of window.__f.slice(0, 2)) window.__stranded.damageCreature(c, 999); });
    r.loot = meat0 + ' -> ' + await ev(() => window.__stranded.inv('rawmeat') + '/' + window.__stranded.inv('fur'));
    await ev(() => window.__stranded.clearCreatures());
    return r;
  }, r => {
    const [a, b] = r.loot.split(' -> ').map(x => x.split('/').map(Number));
    return { ok: r.files === 'Deer+Stag' && r.scout === 'scout' && r.collar && r.fallback && r.models.join() === 'fox,arcticfox,deer' && r.fled >= 2 && b[0] - a[0] === 2 && b[1] - a[1] === 2,
      info: `deer models ${r.files}; ${r.models.join(', ')}; ${r.fled} fled; foxes' loot meat/fur ${r.loot}; Scout ${r.scout}${r.collar ? ' with collar' : ''}; box fox ${r.fallback}` };
  });

  // step C: the new wildlife. Calm ones (boar, snake, crab) don't stop you sleeping; a boar
  // charges once hit; spiders live in the grotto, bats there at night; crabs and frogs find
  // beaches and lake banks
  await step('new wildlife', async () => {
    const r = await ev(() => {
      const S = window.__stranded, { G, R } = S, p = G.p, out = {};
      S.clearCreatures(); G.hour = 12;
      const T = ['boar', 'snake', 'crab', 'spider', 'frog', 'bat'];
      window.__c = T.map((t, i) => S.spawnCreature(t, p.x + Math.cos(i) * 7, p.z + Math.sin(i) * 7));
      out.models = window.__c.map(c => c.model.gltf || 'HAND-BUILT');
      window.__c[3].x += 60;   // the spider would rightly stop you sleeping; move it away
      out.calmOk = !S.nearestHostile(24);
      return out;
    });
    await wait(1200);
    Object.assign(r, await ev(() => {
      const S = window.__stranded, c = window.__c, out = {};
      out.boarCalm = c[0].state === 'idle';
      S.damageCreature(c[0], 5); out.boarAngry = c[0].state === 'chase';
      const inv0 = ['rawmeat', 'hide', 'chitin', 'fibre'].map(k => S.inv(k));
      for (const x of c.slice(0, 4)) S.damageCreature(x, 999);
      out.loot = ['rawmeat', 'hide', 'chitin', 'fibre'].map((k, i) => S.inv(k) - inv0[i]).join('/');
      S.clearCreatures();
      // places
      const p = S.G.p, home = [p.x, p.z], g = S.SITES.grotto, lake = S.LAKES[0];
      const tries = n => { let k = 0; for (let i = 0; i < n; i++) if (S.beachPoint()) k++; return k; };
      p.x = lake.x + lake.r + 20; p.z = lake.z; const lp = S.lakeEdgePoint();
      out.lakeEdge = !!lp && Math.hypot(lp.x - lake.x, lp.z - lake.z) < lake.r + 20 && S.heightAt(lp.x, lp.z) > 0.3;
      p.x = S.R.start.x; p.z = S.R.start.z; out.beach = tries(10);
      p.x = g.x + 20; p.z = g.z; S.G.hour = 23;
      S.updateWildlife({}, true);
      out.grotto = ['spider', 'bat'].map(t => S.R.creatures.filter(c => c.type === t && c.lair).length).join('/');
      S.updateWildlife({}, false);
      out.batsGone = !S.R.creatures.some(c => c.type === 'bat');
      S.clearCreatures(); p.x = home[0]; p.z = home[1]; p.y = S.groundAt(p.x, p.z); S.G.hour = 12;
      return out;
    }));
    return r;
  }, r => ({
    ok: r.models.every(m => m !== 'HAND-BUILT') && r.calmOk && r.boarCalm && r.boarAngry && r.loot === '4/2/1/2' && r.lakeEdge && r.beach > 0 && r.grotto === '2/3' && r.batsGone,
    info: `models ${r.models.join(',')}; calm ok ${r.calmOk}; boar calm ${r.boarCalm}, angry when hit ${r.boarAngry}; loot meat/hide/chitin/fibre ${r.loot}; lake bank ${r.lakeEdge}; beach spots ${r.beach}/10; spiders/bats near the grotto at night ${r.grotto}; bats gone by day ${r.batsGone}`
  }));

  // step D: herds (stay together, no loot), the shark (comes for a swimmer in the deep sea,
  // bites, gives up in the shallows) and fish in the lakes
  await step('herds, shark and fish', async () => {
    const r = await ev(() => {
      const S = window.__stranded, p = S.G.p, out = {}, files = {};
      S.clearCreatures(); S.G.hour = 11;
      for (let i = 0; i < 20; i++) files[S.gltfAnimal('horse').file] = 1;
      out.horses = Object.keys(files).sort().join('+');
      const h = ['horse', 'donkey', 'alpaca'].map((t, i) => { const c = S.spawnCreature(t, p.x + 30 + i * 2, p.z + 30); c.herd = 'test'; return c; });
      out.models = h.map(c => c.model.gltf || 'HAND-BUILT').join(',');
      h[2].x += 25; S.keepHerds(); out.regroup = h[2].tx !== null && Math.hypot(h[2].tx - h[0].x, h[2].tz - h[0].z) < Math.hypot(h[2].x - h[0].x, h[2].z - h[0].z) - 8;   // heads back towards the others
      const inv0 = JSON.stringify(S.G.inv); for (const c of h) S.damageCreature(c, 999); out.noLoot = JSON.stringify(S.G.inv) === inv0;
      S.clearCreatures();
      // out from the cove into deep sea water
      const l = Math.hypot(S.R.start.x, S.R.start.z), ux = S.R.start.x / l, uz = S.R.start.z / l;
      window.__home = [p.x, p.z];
      for (let d = 0; d < 80; d += 0.5) { const x = S.R.start.x + ux * d, z = S.R.start.z + uz * d, hh = S.heightAt(x, z); if (hh < -3.2 && hh > -4.3) { p.x = x; p.z = z; p.y = -1.2; p.vy = 0; break; } }
      out.deep = S.deepSea(p.x, p.z);
      return out;
    });
    let shark = null;
    for (let i = 0; i < 60 && !shark; i++) { await wait(250); shark = await ev(() => { const c = window.__stranded.R.creatures.find(c => c.type === 'shark'); return c ? c.model.gltf || 'HAND-BUILT' : null; }); }
    r.shark = shark;
    let bit = false; for (let i = 0; i < 200 && !bit && shark; i++) { await wait(100); bit = await ev(() => window.__stranded.R.creatures.some(c => c.type === 'shark' && c.state === 'wind')); }
    r.bit = bit;
    await ev(() => { const S = window.__stranded, p = S.G.p; p.x = window.__home[0]; p.z = window.__home[1]; p.y = S.groundAt(p.x, p.z); });
    await wait(1000);
    r.gaveUp = await ev(() => window.__stranded.R.creatures.filter(c => c.type === 'shark').every(c => c.state === 'leave'));
    // the lakes: a school near Mirror Lake
    await ev(() => { const S = window.__stranded, p = S.G.p, l = S.LAKES[0]; S.clearCreatures(); p.x = l.x + l.r + 10; p.z = l.z; p.y = S.groundAt(p.x, p.z); });
    await wait(1500);
    r.fish = await ev(() => window.__stranded.fishCount());
    await ev(() => { const S = window.__stranded, p = S.G.p; p.x = window.__home[0]; p.z = window.__home[1]; p.y = S.groundAt(p.x, p.z); });
    return r;
  }, r => ({
    ok: r.horses === 'Horse+Horse_White' && r.models === 'horse,donkey,alpaca' && r.regroup && r.noLoot && r.deep && r.shark === 'shark' && r.bit && r.gaveUp && r.fish >= 5,
    info: `horse models: ${r.horses}; ${r.models}; regroups ${r.regroup}; no loot ${r.noLoot}; deep sea ${r.deep}; shark ${r.shark}, bit ${r.bit}, gave up ${r.gaveUp}; ${r.fish} fish in Mirror Lake`
  }));

  // snow wolves ignore a hand-held torch; the Crystal Lantern scares them (and ordinary wolves).
  // On the Frozen Lake, far from the campfire, which would scare them anyway.
  await step('torch and crystal lantern', async () => {
    const trial = () => ev(() => {
      const S = window.__stranded, p = S.G.p; S.clearCreatures(); S.refreshViewModel();
      window.__t = [S.spawnCreature('wolf', p.x + 8, p.z - 3), S.spawnCreature('snowwolf', p.x - 8, p.z - 3)];
      for (const c of window.__t) { c.state = 'chase'; c.warned = true; }
    }).then(() => wait(1200)).then(() => ev(() => window.__t.map(c => c.state === 'flee')));
    await ev(() => { const S = window.__stranded, p = S.G.p; window.__home = [p.x, p.z]; p.x = 66; p.z = -130; p.y = S.groundAt(p.x, p.z); S.give('torch', 1); p.held = 'torch'; });
    const torch = await trial();
    await ev(() => window.__stranded.give('lantern', 1));
    const lantern = await trial();
    const light = await ev(() => { const R = window.__stranded.R; return { crystal: !!R.vm.userData.crystal, color: R.torchLight.color.getHex().toString(16), on: R.torchLight.userData.on }; });
    await ev(() => { const S = window.__stranded, p = S.G.p; S.clearCreatures(); p.held = 'hands'; S.refreshViewModel(); p.x = window.__home[0]; p.z = window.__home[1]; p.y = S.groundAt(p.x, p.z); });
    return { torch, lantern, light };
  }, r => ({
    ok: r.torch[0] && !r.torch[1] && r.lantern[0] && r.lantern[1] && r.light.crystal && r.light.on && r.light.color === '7fdcff',
    info: `torch: wolf flees ${r.torch[0]}, snow wolf flees ${r.torch[1]}; lantern: ${r.lantern[0]}, ${r.lantern[1]}; blue light ${r.light.on && r.light.color === '7fdcff'}`
  }));

  // the bears: the animated bear, Grizzle and Frostclaw; the bosses' wind-up plays Roar (then
  // a galloping charge) or, for Frostclaw's jump, Slam
  await step('bears and boss moves', async () => {
    const clips = () => ev(() => window.__b.map(c => c.model.mixer ? c.model.mixer._actions.filter(a => a.isRunning() && a.getEffectiveWeight() > 0.5).map(a => a.getClip().name).join('+') : 'HAND-BUILT'));
    await ev(() => {
      const S = window.__stranded, p = S.G.p; S.clearCreatures(); window.__home = [p.x, p.z];
      p.x = 66; p.z = -130; p.y = S.groundAt(p.x, p.z);
      window.__b = [S.spawnCreature('bear', p.x + 10, p.z - 10), S.spawnCreature('grizzle', p.x, p.z - 14), S.spawnCreature('frostclaw', p.x - 6, p.z - 8)];
      for (const c of window.__b) { c.state = 'idle'; c.st = 99; c.tx = null; c.def = Object.assign({}, c.def, { sense: 0 }); }
    });
    await wait(600);
    const files = await ev(() => window.__b.map(c => c.model.file || 'HAND-BUILT').join('/'));
    await ev(() => { const [, g, f] = window.__b; g.state = 'tele'; g.st = 0.95; g.mode = 'charge'; f.state = 'tele'; f.st = 0.95; f.mode = 'slam'; });
    await wait(400); const tele = await clips();
    await page.waitForFunction(() => window.__b[1].state === 'charge', { timeout: 8000, polling: 50 }).catch(() => { });
    await wait(150); const after = await clips();
    const states = await ev(() => window.__b.map(c => c.state).join('/'));
    await ev(() => { const S = window.__stranded, p = S.G.p; S.clearCreatures(); p.x = window.__home[0]; p.z = window.__home[1]; p.y = S.groundAt(p.x, p.z); });
    return { files, tele, after, states };
  }, r => ({
    ok: r.files === 'Bear/Grizzle/Frostclaw' && /Roar/.test(r.tele[1]) && /Slam/.test(r.tele[2]) && /Gallop/.test(r.after[1]),
    info: `${r.files}; wind-up: Grizzle ${r.tele[1]}, Frostclaw ${r.tele[2]}; then Grizzle ${r.after[1]}, Frostclaw ${r.after[2]} (${r.states})`
  }));

  // the credits: an About button at the bottom of the pause menu's settings
  await step('about and credits', async () => {
    await ev(() => window.__stranded.openPanel('pause'));
    await wait(500);
    const r = await ev(() => {
      const b = document.querySelector('[data-a="about"]'); if (!b) return { button: false };
      b.click(); const box = document.querySelector('.about'), text = box ? box.textContent : '';
      b.click(); const closed = !document.querySelector('.about');
      return { button: true, open: !!window.__stranded.R.panel, text, closed };
    });
    await ev(() => window.__stranded.closePanel && window.__stranded.closePanel());
    return r;
  }, r => ({
    ok: r.button && r.open && /Quaternius/.test(r.text) && /Black bear/.test(r.text) && /CC BY 3\.0/.test(r.text) && r.closed,
    info: r.button ? `About shows the credits ${/CC BY 3\.0/.test(r.text)}, panel still open ${r.open}, closes again ${r.closed}` : 'no About button'
  }));

  // Uncle Ray is the animated Quaternius man in Ray's colours and hat (swapped in once the models
  // are loaded); he faces you, and claps when you come up to him
  await step('uncle ray', async () => {
    await ev(() => { const S = window.__stranded; S.G.flags.rayFree = true; S.placeRay(); const r = S.R.ray; S.G.p.x = r.x + 30; S.G.p.z = r.z; });
    await page.waitForFunction(() => !!window.__stranded.R.ray.model.gltf, { timeout: 30000 });
    await wait(500);
    await ev(() => { const S = window.__stranded, r = S.R.ray; S.G.p.x = r.x; S.G.p.z = r.z + 4; S.G.p.y = S.groundAt(S.G.p.x, S.G.p.z); S.G.p.vy = 0; });
    await wait(1500);
    const r = await ev(() => {
      const S = window.__stranded, r = S.R.ray, m = r.model;
      let hat = false; r.g.traverse(o => { if (o.isBone && o.name === 'Head') o.traverse(h => { if (h.geometry && h.geometry.type === 'BoxGeometry') hat = true; }); });
      const facing = Math.abs(S.angDiff(r.g.rotation.y, Math.atan2(S.G.p.x - r.x, S.G.p.z - r.z)));
      const clip = m.mixer._actions.filter(a => a.isRunning() && a.getEffectiveWeight() > 0.5).map(a => a.getClip().name).join('+');
      return { model: m.gltf, inScene: S.R.scene.children.includes(r.g), visible: r.g.visible, hat, facing: +facing.toFixed(2), clip, clapT: +(m.clapT || 0).toFixed(1) };
    });
    await ev(() => { window.__stranded.G.flags.rayFree = false; window.__stranded.placeRay(); });
    return r;
  }, r => ({ ok: r.model === 'ray' && r.inScene && r.visible && r.hat && r.facing < 0.3 && r.clip === 'Clap', info: `model ${r.model}, in scene ${r.inScene}, hat ${r.hat}, facing off by ${r.facing} rad, playing ${r.clip}` }));

  // Scout's story, step 2 (src/story/scout-story.js, MIDDLE-DAYS-PLAN.md): chapter 1 starts after
  // "stay" and Ray tells the pup story; no chapter 2 yet; a storm makes Scout shiver; at dusk on a
  // howling evening he stops, faces Frostpeak and lifts his nose
  await step("scout's story", async () => {
    const r = {};
    const keep = await ev(() => {
      const S = window.__stranded, { G, R } = S, k = { friend: G.scout.friend, fed: G.scout.fed, rayFree: G.flags.rayFree, rayChoice: G.flags.rayChoice, radio: G.flags.radio, day: G.day, hour: G.hour };
      S.clearCreatures(); G.day = 25; G.hour = 10; G.weather = 'clear'; G.weatherHrs = 99;
      G.scout.friend = true; G.scout.fed = 25; G.flags.radio = true; G.flags.rayFree = true; G.flags.rayChoice = 'stay'; delete G.story; S.placeRay(); R.teleScout = true;
      S.updateScoutStory(); return k;
    });
    Object.assign(r, await ev(() => { const S = window.__stranded, st = S.G.story || {}; return { ch: st.ch, done0: st.done, toast: /wants a word about Scout/.test(document.getElementById('toasts').textContent), label: S.R.rayPoi.label() }; }));
    Object.assign(r, await ev(() => {   // talk to Ray: the pup story, then the chapter is done
      const S = window.__stranded, lines = []; S.talkToRay();
      for (let i = 0; i < 8 && S.R.panel === 'dialog'; i++) { lines.push(document.getElementById('panel').textContent); S.R.panelNext(); }
      const o = { lines: lines.length, circle: lines.some(l => /Stone Circle/.test(l)), done: S.G.story.done, closed: !S.R.panel, label2: S.R.rayPoi.label() };
      S.G.day = 27; S.updateScoutStory(); o.ch2 = S.G.story.ch;   // too soon for chapter 2 (Day 31, and 3 days after chapter 1)
      S.G.weather = 'storm'; S.updateScoutStory(); return o;
    }));
    await wait(400);
    Object.assign(r, await ev(async () => {   // a storm: Scout shivers
      const S = window.__stranded, a = [];
      for (let i = 0; i < 8; i++) { a.push(S.R.scout.g.rotation.z); await new Promise(q => setTimeout(q, 31)); }
      return { scared: S.R.scout.scared, shiver: +(Math.max(...a) - Math.min(...a)).toFixed(3), stormToast: /hates thunder/.test(document.getElementById('toasts').textContent) };
    }));
    // how far his head sits above the base of his neck (m), and the clip playing: lifting his nose
    // raises it; eating would put his nose on the ground
    const headY = () => ev(() => {
      const s = window.__stranded.R.scout, b = {}; s.g.traverse(o => { if (o.isBone) b[o.name] = o; });
      const y = o => o.getWorldPosition(new o.position.constructor()).y;
      return { y: b.Head ? +(y(b.Head) - y(b.Neck1)).toFixed(3) : null, clip: s.model.mixer._actions.filter(a => a.isRunning() && a.getEffectiveWeight() > 0.5).map(a => a.getClip().name).join('+') };
    });
    await ev(() => {   // dusk on a howling evening (Day 32, even)
      const S = window.__stranded, { G, R } = S; G.weather = 'clear'; S.updateScoutStory(); S.clearCreatures();
      G.day = 32; G.hour = 19.2; R.scout.x = G.p.x + 3; R.scout.z = G.p.z; S.updateScoutStory();
    });
    await wait(1500);
    Object.assign(r, await ev(() => {
      const S = window.__stranded, s = S.R.scout, fp = S.SITES.summit;
      return { howlT: +s.howlT.toFixed(1), howl: +s.howl.toFixed(2), facing: +Math.abs(S.angDiff(s.yaw, Math.atan2(fp.x - s.x, fp.z - s.z))).toFixed(2), howlToast: /howls/.test(document.getElementById('toasts').textContent) };
    }));
    const up = await headY(); r.headUp = up.y; r.howlClip = up.clip;
    await ev(() => { window.__stranded.R.scout.howlT = 0; });
    await wait(2000);   // nose back down; eating can't start for another second or so
    r.headDown = (await headY()).y;
    await ev(k => {
      const S = window.__stranded, { G } = S, set = (o, n, v) => { if (v === undefined) delete o[n]; else o[n] = v; };
      G.scout.friend = k.friend; G.scout.fed = k.fed; set(G.flags, 'rayFree', k.rayFree); set(G.flags, 'rayChoice', k.rayChoice); set(G.flags, 'radio', k.radio);
      G.day = k.day; G.hour = k.hour; delete G.story; S.placeRay(); S.clearCreatures();
    }, keep);
    return r;
  }, r => ({
    ok: r.ch === 1 && r.done0 === false && r.toast && /💬/.test(r.label) && r.lines === 4 && r.circle && r.done && r.closed && !/💬/.test(r.label2) && r.ch2 === 1 &&
      r.scared && r.shiver > 0.01 && r.stormToast && r.howlT > 3 && r.howl > 0.8 && r.facing < 0.3 && r.howlToast && r.headUp - r.headDown > 0.015 && !/Eating/.test(r.howlClip),
    info: `chapter ${r.ch} with toast ${r.toast}, prompt "${r.label}"; ${r.lines} lines (Stone Circle ${r.circle}), done ${r.done}; no chapter 2 on Day 27: ${r.ch2 === 1}; storm: shiver ${r.shiver} rad, tip ${r.stormToast}; dusk: howling ${r.howlT} s left, nose up ${r.howl}, facing Frostpeak off by ${r.facing} rad, head above neck ${r.headDown} -> ${r.headUp} m playing ${r.howlClip}`
  }));

  // story step 3: chapter 2 on Day 31. Ray hints WEST; 50 m from the spot Scout runs ahead of you
  // towards it; close to it he digs (his Eating clip), and helping him gives the Green Stone and
  // Tomas's page 1
  await step('story: scout leads the way', async () => {
    const r = {};
    const keep = await ev(() => {
      const S = window.__stranded, { G, R } = S, g = S.STORY_SPOTS.green, k = { friend: G.scout.friend, fed: G.scout.fed, rayFree: G.flags.rayFree, rayChoice: G.flags.rayChoice, radio: G.flags.radio, day: G.day, hour: G.hour, pos: [G.p.x, G.p.z] };
      S.clearCreatures(); G.day = 31; G.hour = 9; G.weather = 'clear'; G.weatherHrs = 99; S.take('greenstone', 99);
      G.scout.friend = true; G.scout.fed = 31; G.flags.radio = true; G.flags.rayFree = true; G.flags.rayChoice = 'stay'; G.story = { ch: 1, day: 21, done: true }; S.placeRay();
      G.p.x = g.x + 50; G.p.z = g.z; G.p.y = S.groundAt(G.p.x, G.p.z); G.p.vy = 0; R.teleScout = true;
      S.updateScoutStory(); return k;
    });
    Object.assign(r, await ev(() => {
      const S = window.__stranded, o = { ch: S.G.story.ch, toast: /Scout keeps staring WEST/.test(document.getElementById('toasts').textContent) };
      S.talkToRay(); o.hint = /WEST/.test(document.getElementById('panel').textContent); S.closePanel(); return o;
    }));
    await wait(2500);
    Object.assign(r, await ev(() => {
      const S = window.__stranded, s = S.R.scout, g = S.STORY_SPOTS.green, p = S.G.p;
      return { leading: !!s.lead, ahead: +(Math.hypot(p.x - g.x, p.z - g.z) - Math.hypot(s.x - g.x, s.z - g.z)).toFixed(1) };
    }));
    await ev(() => { const S = window.__stranded, { G, R } = S, g = S.STORY_SPOTS.green; G.p.x = g.x + 4; G.p.z = g.z; G.p.y = S.groundAt(G.p.x, G.p.z); R.scout.x = g.x + 3; R.scout.z = g.z + 1; S.updateScoutStory(); });
    await wait(2500);
    Object.assign(r, await ev(() => {
      const S = window.__stranded, s = S.R.scout, poi = S.POIS.find(q => q.id === 'storyDig');
      const o = { dig: !!s.dig, clip: s.model.mixer._actions.filter(a => a.isRunning() && a.getEffectiveWeight() > 0.5).map(a => a.getClip().name).join('+'), on: poi.on(), label: poi.label };
      poi.act(); o.stone = S.inv('greenstone'); o.page = S.G.notes.includes('tomas1'); o.note = /TOMAS/.test(document.getElementById('panel').textContent); o.done = S.G.story.done; S.closePanel();
      return o;
    }));
    await ev(k => {
      const S = window.__stranded, { G } = S, set = (o, n, v) => { if (v === undefined) delete o[n]; else o[n] = v; };
      G.scout.friend = k.friend; G.scout.fed = k.fed; set(G.flags, 'rayFree', k.rayFree); set(G.flags, 'rayChoice', k.rayChoice); set(G.flags, 'radio', k.radio);
      G.day = k.day; G.hour = k.hour; G.p.x = k.pos[0]; G.p.z = k.pos[1]; G.p.y = S.groundAt(G.p.x, G.p.z); S.take('greenstone', 99); G.notes = G.notes.filter(n => n !== 'tomas1'); delete G.story; S.placeRay(); S.clearCreatures();
    }, keep);
    return r;
  }, r => ({
    ok: r.ch === 2 && r.toast && r.hint && r.leading && r.ahead > 4 && r.dig && /Eating/.test(r.clip) && r.on && r.stone === 1 && r.page && r.note && r.done,
    info: `chapter ${r.ch}, toast ${r.toast}, Ray's hint ${r.hint}; leading ${r.leading}, ${r.ahead} m ahead of you; digging ${r.dig} (${r.clip}), prompt ${r.on} "${r.label}"; Green Stone ${r.stone}, page ${r.page} shown ${r.note}, done ${r.done}`
  }));

  // rarer finds: about half the small finds are not there (hidden, cannot be picked, never
  // grow back), all of them stay near the start; rarer animals: smaller caps, one at a time
  await step('rarer finds and animals', () => ev(() => {
    const S = window.__stranded, { NODES, PICKUP_KEEP, R } = S, out = { kinds: {}, nearStart: 0, hiddenOk: true, unpickable: true, regrow: false };
    for (const n of NODES) {
      if (PICKUP_KEEP[n.t] === undefined) { if (n.absent) out.other = (out.other || 0) + 1; continue; }
      const k = out.kinds[n.t] = out.kinds[n.t] || [0, 0]; k[0]++; if (n.absent) k[1]++;
      if (n.absent && Math.hypot(n.x - R.start.x, n.z - R.start.z) < S.START_SAFE) out.nearStart++;
      if (n.absent) {
        const m = S.NODE_MESH[n.t].m.instanceMatrix.array; if (m[n.i * 16] > 0.001) out.hiddenOk = false;
        S.nodeNear(n.x, n.z, 1, q => { if (q === n) out.unpickable = false; });
      }
    }
    const a = NODES.find(n => n.absent); S.G.nodeState[a.idx] = 0; S.restoreNode(a); out.regrow = !a.absent || !a.gone || a.idx in S.G.nodeState;
    out.caps = ['rabbit', 'deer', 'fox', 'snake'].map(t => S.rareCap(t, 2)).join('/');
    return out;
  }), r => {
    const share = Object.entries(r.kinds).map(([t, [n, gone]]) => `${t} ${n - gone}/${n}`).join(', ');
    const thinned = Object.values(r.kinds).every(([n, gone]) => gone > n * 0.2 && gone < n * 0.6);
    return { ok: thinned && !r.other && r.nearStart === 0 && r.hiddenOk && r.unpickable && !r.regrow && r.caps === '1/1/2/1', info: `${share}; near start missing ${r.nearStart}; caps of 2: ${r.caps}` };
  });

  // difficulty (step 4): finds come and go in a fixed order; animals and damage scale
  await step('difficulty levels', () => ev(() => {
    const S = window.__stranded, { NODES, PICKUP_KEEP, DIFFICULTY, G, R } = S;
    const absent = () => NODES.filter(n => PICKUP_KEEP[n.t] !== undefined && n.absent).length;
    const normal = absent(), ids = NODES.filter(n => n.absent).map(n => n.idx).join();
    S.setFinds(DIFFICULTY.easy); const easy = absent();
    S.setFinds(DIFFICULTY.hard); const hard = absent();
    S.setFinds(DIFFICULTY.normal); const back = absent(), same = NODES.filter(n => n.absent).map(n => n.idx).join() === ids;
    G.diff = 'easy'; const capEasy = S.rareCap('deer', 2); G.diff = 'hard'; const pHard = S.rareRoll.length;
    const inv0 = R.invuln, hp0 = G.p.hp, arm = S.armorValue(); R.invuln = 0; G.p.hp = 100; S.hurtPlayer(10, 'hurt'); const hurtHard = 100 - G.p.hp;
    delete G.diff; G.p.hp = 100; S.hurtPlayer(10, 'hurt'); const hurtNormal = 100 - G.p.hp; G.p.hp = hp0; R.invuln = inv0;
    return { normal, easy, hard, back, same, capEasy, capNormal: S.rareCap('deer', 2), hurtHard, hurtNormal, arm };
  }), r => ({ ok: r.easy < r.normal * 0.5 && r.hard > r.normal && r.back === r.normal && r.same && r.capEasy === 2 && r.capNormal === 1 && r.hurtNormal === 10 && r.hurtHard === 13,
    info: `missing finds: easy ${r.easy}, normal ${r.normal}, hard ${r.hard}, back to ${r.back} (same ones ${r.same}); deer cap of 2: easy ${r.capEasy}, normal ${r.capNormal}; a 10 bite: normal ${r.hurtNormal}, hard ${r.hurtHard}` }));

  // the animal journal (step 6): a deer in front is written in; a wolf behind is not
  await step('animal journal', async () => {
    await ev(() => {
      const S = window.__stranded, { G } = S, p = G.p; S.clearCreatures(); delete G.seen;
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      S.spawnCreature('deer', p.x + fx * 12, p.z + fz * 12); S.spawnCreature('wolf', p.x - fx * 12, p.z - fz * 12);
      S.slowTick();
      S.openPanel('journal'); S.R.jTab = 'animals'; S.renderPanel();
    });
    await wait(600);
    return ev(() => { const S = window.__stranded, html = document.getElementById('panel').textContent, toast = document.getElementById('toasts').textContent; S.closePanel(); S.clearCreatures(); return { seen: Object.keys(S.G.seen || {}).join(), day: (S.G.seen || {}).deer === S.G.day, card: /Deer/.test(html) && html.includes('???'), count: (html.match(/spotted: (\d+ \/ \d+)/) || [])[1], toast: /New animal: Deer/.test(toast) }; });
  }, r => ({ ok: r.seen === 'deer' && r.day && r.card && r.toast && r.count === '1 / 21', info: `spotted: ${r.seen} (wolf behind not), card shown ${r.card}, tip ${r.toast}, journal ${r.count}` }));

  // riding (step 7): feed a wild horse on 3 days, ride it, deep water stops it, get off, a hit
  // throws you off, and it comes back if it goes missing
  await step('tame and ride a horse', async () => {
    const r = {};
    await ev(() => {
      const S = window.__stranded, { G, R } = S, p = G.p; S.clearCreatures(); delete G.mount; R.riding = null;
      p.x = 0; p.z = 60; p.y = S.groundAt(p.x, p.z); p.vy = 0; p.yaw = 0; p.pitch = -0.3; S.give('berries', 5);
      const c = S.spawnCreature('horse', p.x, p.z - 2.6); c.st = 99; c.tx = null; window.__horse = c;
    });
    for (let day = 0; day < 3; day++) {
      await ev(() => { const S = window.__stranded, c = window.__horse; c.x = S.G.p.x; c.z = S.G.p.z - 2.6; c.st = 99; c.tx = null; S.slowTick(); });
      await wait(400);
      r['target' + day] = await ev(() => { const S = window.__stranded, t = S.R.target; const ok = !!(t && t.kind === 'poi' && t.ref.id === 'mount'); S.interact(); S.G.day++; return ok; });
    }
    Object.assign(r, await ev(() => { const S = window.__stranded, c = window.__horse; return { tame: !!(S.G.mount && S.G.mount.tame && c.tame), badge: !!S.G.badges.rider }; }));
    await ev(() => { window.__stranded.slowTick(); });
    await wait(400);
    r.mounted = await ev(() => { const S = window.__stranded; S.interact(); return S.R.riding === window.__horse; });
    const a = await ev(() => { const { G, R } = window.__stranded; R.keys.KeyW = true; return { x: G.p.x, z: G.p.z }; });
    await wait(2000);
    Object.assign(r, await ev(a0 => { const S = window.__stranded, { G, R } = S, c = window.__horse; R.keys.KeyW = false; S.primaryAction(); return { moved: Math.hypot(G.p.x - a0.x, G.p.z - a0.z), under: Math.hypot(c.x - G.p.x, c.z - G.p.z) < 0.01, eye: R.camera.position.y - G.p.y, noSwing: !(R.swing > 0) }; }, a));
    await ev(() => {   // to the shore of Mirror Lake, facing the middle
      const { G, R, LAKES, heightAt, groundAt } = window.__stranded, L = LAKES.find(l => l.id === 'mirror');
      let d = 20; while (heightAt(L.x, L.z + d) < 0.8 && d < 90) d += 0.5;
      G.p.x = L.x; G.p.z = L.z + d + 1; G.p.y = groundAt(G.p.x, G.p.z); G.p.yaw = 0; R.keys.KeyW = true;
    });
    await wait(3000);
    Object.assign(r, await ev(() => { const S = window.__stranded, { G, R } = S; R.keys.KeyW = false; const o = { swam: !!R.swim, depth: S.heightAt(G.p.x, G.p.z) }; S.interact(); o.off = !S.R.riding; return o; }));
    Object.assign(r, await ev(() => {
      const S = window.__stranded, { G, R } = S, c = window.__horse; S.mountUp(c); const inv0 = R.invuln, hp0 = G.p.hp; R.invuln = 0; S.hurtPlayer(5, 'hurt'); R.invuln = inv0; G.p.hp = hp0;
      const thrown = !R.riding && c.bolt > 0;
      S.clearCreatures(); S.slowTick(); const back = R.creatures.find(q => q.tame);
      const o = { thrown, back: !!back && back.type === 'horse' && Math.hypot(back.x - G.mount.x, back.z - G.mount.z) < 0.5 };
      S.clearCreatures(); delete G.mount; return o;
    }));
    return r;
  }, r => ({ ok: r.target0 && r.target1 && r.target2 && r.tame && r.badge && r.mounted && r.moved > 12 && r.under && r.eye > 2.2 && r.noSwing && !r.swam && r.depth > -0.65 && r.off && r.thrown && r.back,
    info: `fed on 3 days (aimed at it ${[r.target0, r.target1, r.target2].join('/')}), tame ${r.tame}, badge ${r.badge}; rode ${r.moved && r.moved.toFixed(1)} m in 2 s, eye ${r.eye && r.eye.toFixed(2)} m, no swing ${r.noSwing}; at the lake: swam ${r.swam}, stopped at depth ${r.depth && r.depth.toFixed(2)}, got off ${r.off}; thrown off ${r.thrown}; came back ${r.back}` }));

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

  // swimming (added after the migration, src/player/swim.js): the original walked along the lake bed
  await step('swim: float', async () => {
    await ev(() => { const { G, LAKES } = window.__stranded; const L = LAKES.find(l => l.id === 'mirror'); G.p.x = L.x; G.p.z = L.z; G.p.y = 0.5; G.p.vy = 0; });
    await wait(4000);
  }, () => ev(() => {
    const { G, R } = window.__stranded, lift = R.camera.position.y - R.water.position.y;
    return { ok: R.swim === true && G.p.y > -1.45 && G.p.y < -0.95 && R.ground < -2.5 && lift > 0.25 && R.stepKind === 'water', info: `Mirror Lake: body ${G.p.y.toFixed(2)}, bed ${R.ground.toFixed(2)}, eyes ${lift.toFixed(2)} m above the water` };
  }));

  await step('swim: across the lake', async () => {
    const a = await ev(() => { const { G, R } = window.__stranded; G.p.stam = 100; G.p.yaw = Math.atan2(-1, 0); R.keys.KeyW = true; return { x: G.p.x, z: G.p.z }; });   // face +x
    await wait(4000);
    return ev(a0 => { const { G, R } = window.__stranded; R.keys.KeyW = false; return { moved: Math.hypot(G.p.x - a0.x, G.p.z - a0.z), stam: G.p.stam, swim: R.swim, y: G.p.y }; }, a);
  }, r => ({ ok: r.moved > 6 && r.swim && r.stam < 99 && r.y > -1.45, info: `${r.moved.toFixed(1)} m in 4 s, afloat ${r.swim}, stamina ${r.stam.toFixed(0)}` }));

  await step('swim: in from the shore and out', async () => {
    // start on the bank, walk in until afloat, then turn round and walk out onto dry land
    await ev(() => {
      const { G, R, LAKES, heightAt, groundAt } = window.__stranded, L = LAKES.find(l => l.id === 'mirror');
      let r = 20; while (heightAt(L.x, L.z + r) < 0.8 && r < 90) r += 0.5;
      G.p.x = L.x; G.p.z = L.z + r + 1; G.p.y = groundAt(G.p.x, G.p.z); G.p.vy = 0; G.p.stam = 100;
      G.p.yaw = 0;                        // forward is -z, toward the lake centre
      R.keys.KeyW = true;
    });
    const tIn = Date.now();
    await page.waitForFunction(() => window.__stranded.R.swim === true, { timeout: 30000, polling: 100 });
    const secsIn = (Date.now() - tIn) / 1000;
    await wait(1500);
    await ev(() => { window.__stranded.G.p.yaw = Math.PI; });   // turn round: forward is +z, back to the bank
    const tOut = Date.now();
    await page.waitForFunction(() => { const { G, R } = window.__stranded; return !R.swim && G.p.y > 0.3; }, { timeout: 30000, polling: 100 });
    const secsOut = (Date.now() - tOut) / 1000;
    await ev(() => { window.__stranded.R.keys.KeyW = false; });
    return { secsIn, secsOut };
  }, r => ev(rr => { const { G, R, groundAt } = window.__stranded; const onLand = Math.abs(G.p.y - groundAt(G.p.x, G.p.z)) < 0.05; return { ok: onLand && !R.swim, info: `afloat after ${rr.secsIn.toFixed(1)} s, back on land after ${rr.secsOut.toFixed(1)} s` }; }, r));

  for (const [biome, x, z] of [['forest', 0, 60], ['desert', 205, 10], ['snow', -60, -150]]) {
    await step(`visit ${biome}`, async () => {
      await ev(([x, z]) => { const S = window.__stranded, p = S.G.p; p.x = x; p.z = z; p.y = S.groundAt(x, z); p.vy = 0; }, [x, z]);
      await wait(2500);
    }, () => ev(b => { const { R } = window.__stranded; return { ok: R.biome === b, info: `biome ${R.biome}` }; }, biome));
  }

  // Auto graphics (step 5): slow frames step the level down, all the way to Low; a level picked
  // by hand is left alone
  await step('auto graphics', async () => {
    const slow = () => ev(() => { const { GFX } = window.__stranded; GFX.fpsT = 14.5; GFX.fpsN = 5; });
    const was = await ev(() => { const S = window.__stranded, { R } = S, w = { manual: R.gfxManual, q: R.quality }; R.gfxManual = false; R.gfxTuned = false; S.setQuality(3); return w; });
    const html = await ev(() => window.__stranded.settingsHTML());
    const seen = [];
    for (let i = 0; i < 3; i++) { await slow(); await wait(1500); seen.push(await ev(() => window.__stranded.R.quality)); }
    const toast = await ev(() => document.getElementById('toasts').textContent);
    await ev(() => { const S = window.__stranded; S.R.gfxManual = true; S.setQuality(3); }); await slow(); await wait(1500);
    const manual = await ev(() => window.__stranded.R.quality);
    await ev(w => { const S = window.__stranded; S.R.gfxManual = w.manual; S.setQuality(w.q); }, was);
    return { seen, toast: /Graphics set to Low/.test(toast), manual, auto: html.includes('<option value="0" selected>Auto (now High)</option>') };
  }, r => ({ ok: r.seen.join() === '2,1,1' && r.toast && r.manual === 3 && r.auto, info: `High -> ${r.seen.join(' -> ')} (Low reached, tip shown ${r.toast}); picked by hand stays ${r.manual}; Settings offers Auto ${r.auto}` }));

  for (const q of [1, 2, 3, 4]) {
    await step(`graphics level ${q}`, async () => { await ev(qq => window.__stranded.setQuality(qq), q); await wait(3000); },
      () => ev(qq => { const { R } = window.__stranded; return { ok: R.quality === qq && R.Q && R.Q.n === ['', 'Low', 'Medium', 'High', 'Ultra'][qq], info: `${R.Q.n}, ${Math.round(R.fps)} fps` }; }, q));
  }
} finally { await close(); }

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed, ${errors.length} page error(s) in total (${target})`);
if (failed.length || errors.length) { console.error('FAIL: smoke test'); process.exit(1); }
console.log('PASS: smoke test, zero errors.');
