// Start-up with a progress bar (added after the migration).
//
// The original built the whole island in one go and then drew the first frame, which made the
// graphics card compile every shader (37 of them) in one long freeze: Chrome showed nothing
// moving for 10-20 seconds and could offer to kill the "unresponsive" page. Now:
// - initWorld() (src/boot.js) pauses between its steps with loadStep(), so the bar can move;
// - warmUp() then compiles the shaders one material at a time, letting the page breathe between
//   them, including the animals' (so the first wolf no longer stutters) and the post-processing
//   passes, and draws the first frame while the loading screen is still up.
//
// The island must come out exactly as in the original, which built it without a pause. During
// a pause other code may run (the animal models finish parsing then) and draw random numbers;
// those come from a separate generator, so the island's own sequence is the same unbroken one.
import { R } from '../state.js';
import { PP } from '../gfx/post.js';
import { KINDS, loadAnimalModels, isLoaded, gltfAnimal } from '../models/gltf-animals.js';

let main = null, side = null;

/** the bar under "Building Kestrel Island..." */
function bar(frac, label) {
  const l = document.getElementById('loading'); if (!l) return;
  let b = l.querySelector('.lbar');
  if (!b) {
    l.insertAdjacentHTML('beforeend',
      '<div class="lbar" style="width:min(440px,72vw);height:14px;margin-top:24px;border-radius:7px;background:rgba(255,255,255,.14);overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.4)">' +
      '<i style="display:block;height:100%;width:0;border-radius:7px;background:linear-gradient(90deg,#f0b04a,#ffe08a);transition:width .2s"></i></div>' +
      '<div class="lnote" style="margin-top:12px;font-size:15px;font-weight:normal;letter-spacing:1px;opacity:.75;min-height:1.3em"></div>');
    b = l.querySelector('.lbar');
  }
  b.firstChild.style.width = (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + '%';
  if (label) l.querySelector('.lnote').textContent = label;
}

/** wait until the page has drawn (or 60 ms, if the tab is hidden and does not draw) */
function breathe() {
  return new Promise(res => {
    let done = false;
    const go = () => { if (!done) { done = true; setTimeout(res, 0); } };
    requestAnimationFrame(go); setTimeout(go, 60);
  });
}

/** show progress, then let the page draw and answer input before the next step */
async function loadStep(frac, label) {
  bar(frac, label);
  if (!main) {
    main = Math.random;
    let s = (Date.now() % 2147483646) + 1;
    side = () => (s = s * 16807 % 2147483647) / 2147483647;
  }
  Math.random = side;
  try { await breathe(); } finally { Math.random = main; }
}

/** compile every shader the title screen and the game need, a few at a time; then draw the
 *  first frame (firstFrame) behind the loading screen. Never fatal: whatever is left over
 *  compiles when it is first drawn, as before. */
async function warmUp(firstFrame) {
  const r = R.renderer;
  if (!main) main = Math.random;
  const pause = async (frac, label) => { bar(frac, label); Math.random = side || main; try { await breathe(); } finally { Math.random = main; } };
  const extra = [], objs = [];
  try {
    // the animals: one of each kind, out of sight, so their shaders are compiled too
    await pause(0.3, 'Waking the animals');
    Math.random = side || main;
    try {
      await Promise.race([loadAnimalModels(), new Promise(res => setTimeout(res, 20000))]);
      for (const kind in KINDS) {
        if (!isLoaded(kind)) continue;
        const m = gltfAnimal(kind); if (!m || !m.g) continue;
        m.g.position.set(0, -400, 0); R.scene.add(m.g); extra.push(m.g);
      }
    } finally { Math.random = main; }

    // the scene's shaders, one material at a time: take every material off, then put them
    // back one material at a time and compile what that needs (the renderer keeps what it has)
    const byMat = new Map();
    R.scene.traverse(o => {
      if (!o.material) return;
      objs.push([o, o.material]);
      const k = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!byMat.has(k)) byMat.set(k, []);
      byMat.get(k).push(o);
    });
    for (const [o] of objs) o.material = null;
    const keep = new Map(objs), groups = [...byMat.values()], target = PP.on && PP.rtScene ? PP.rtScene : null;
    let t = performance.now(), n = 0;
    for (const g of groups) {
      for (const o of g) o.material = keep.get(o);
      r.setRenderTarget(target); r.compile(R.scene, R.camera); r.setRenderTarget(null);
      n++;
      if (performance.now() - t > 40) { await pause(0.34 + 0.56 * n / groups.length, 'Mixing the colours (' + r.info.programs.length + ' shaders)'); t = performance.now(); }
    }

    // the post-processing passes (bloom, sun rays, the final picture)
    if (PP.on && PP.scene) {
      const was = PP.quad.material;
      for (const k of ['bright', 'down', 'up', 'mask', 'rays', 'comp']) {
        if (!PP[k]) continue;
        PP.quad.material = PP[k];
        r.setRenderTarget(k === 'comp' ? null : PP.rtM || null); r.compile(PP.scene, PP.cam); r.setRenderTarget(null);
        await pause(0.9 + 0.05 * ['bright', 'down', 'up', 'mask', 'rays', 'comp'].indexOf(k) / 6, 'Mixing the colours (' + r.info.programs.length + ' shaders)');
      }
      PP.quad.material = was;
    }
  } catch (e) { console.warn('Shader warm-up stopped early (the rest compile when first drawn).', e); }
  finally {
    for (const [o, m] of objs) o.material = m;
    for (const g of extra) R.scene.remove(g);
    r.setRenderTarget(null);
  }
  await pause(0.96, 'Almost ready');
  try { firstFrame(); } catch (e) { console.warn(e); }
  await pause(1, 'Ready!');
}

export { bar, breathe, loadStep, warmUp };
