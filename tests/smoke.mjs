// Smoke test: play through the game's main systems in headless Chrome on the real graphics
// card, with zero page errors allowed (shader compile errors included: three.js reports them
// on the console).
//
//   node tests/smoke.mjs [target]     (default: dist/index.html)
//
// new game -> chop a tree -> build and light a campfire -> a night with wolves -> a storm ->
// sleep until morning -> swim (float, cross the lake, in from the shore and out) -> visit all three biomes -> switch through all four graphics
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

  // the wolves have animated models (src/models/gltf-animals.js): they play clips, bite, fall and
  // go away; the creatures without one keep the hand-built model. (Raid wolves: the campfire from
  // the steps above would scare ordinary ones away.)
  await step('animated wolves', async () => {
    await ev(() => {
      const S = window.__stranded, p = S.G.p; S.clearCreatures();
      window.__w = ['wolf', 'redwolf', 'snowwolf'].map((m, i) => { const c = S.spawnCreature(m === 'snowwolf' ? 'snowwolf' : 'wolf', p.x + 6 + i, p.z + 4, { model: m, raid: true }); c.state = 'chase'; c.warned = true; return c; });
      window.__bear = S.spawnCreature('bear', p.x - 30, p.z - 30);
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
    return { ok: models && rr.bit && rr.falling === 3 && left === 0 && fur >= 4 && bear, info: `${rr.mid.map(m => (m.m || 'hand-built') + ':' + m.clip).join(', ')}; bite ${rr.bit}; ${rr.falling} falling, ${left} left, +${fur} fur; bear ${bear ? 'hand-built' : 'WRONG'}` };
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

  for (const q of [1, 2, 3, 4]) {
    await step(`graphics level ${q}`, async () => { await ev(qq => window.__stranded.setQuality(qq), q); await wait(3000); },
      () => ev(qq => { const { R } = window.__stranded; return { ok: R.quality === qq && R.Q && R.Q.n === ['', 'Low', 'Medium', 'High', 'Ultra'][qq], info: `${R.Q.n}, ${Math.round(R.fps)} fps` }; }, q));
  }
} finally { await close(); }

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed, ${errors.length} page error(s) in total (${target})`);
if (failed.length || errors.length) { console.error('FAIL: smoke test'); process.exit(1); }
console.log('PASS: smoke test, zero errors.');
