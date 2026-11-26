// Browser side of tools/animals/measure.mjs: measures an animal model's clips at a given
// height, for CLIP_INFO in src/models/gltf-animals.js.
//   facing  which way the head points (+z is the game's forward)
//   bite    time in the Attack clip when the head is furthest forward
//   walk, run  ground speed (m/s) of the Walk and Gallop clips: how fast a foot moves backwards
//           while it is on the ground, which is how fast the body must move for it not to slide
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { posedBox } from '/src/models/posed-box.js';

export async function measure(file, height, { attack = 'Attack', walk = 'Walk', run = 'Gallop', head = 'Head', feet: feetRe = /^FFB?[LR]$/ } = {}) {
  const gltf = await new GLTFLoader().loadAsync(file), scene = gltf.scene;
  const clip = n => gltf.animations.find(a => a.name === n);
  const mixer = new THREE.AnimationMixer(scene), v = new THREE.Vector3();
  const bones = []; scene.traverse(o => { if (o.isBone) bones.push(o); });
  const byName = n => bones.find(b => b.name === n);
  const pose = (c, t) => { mixer.stopAllAction(); const a = mixer.clipAction(c); a.reset().play(); a.time = t; mixer.update(0); scene.updateMatrixWorld(true); };
  // size from the Idle pose's vertices, as the game does
  pose(clip('Idle') || gltf.animations[0], 0);
  const box = posedBox(scene);
  const s = height / (box.max.y - box.min.y), cz = (box.min.z + box.max.z) / 2;
  const out = { scale: +s.toFixed(4), facing: Math.sign(byName(head).getWorldPosition(v).z - cz), size: box.getSize(new THREE.Vector3()).multiplyScalar(s).toArray().map(x => +x.toFixed(2)) };
  const sample = (c, fn) => { const r = []; for (let t = 0; t <= c.duration + 1e-6; t += 1 / 120) { pose(c, t); r.push([t, fn()]); } return r; };
  if (clip(attack)) {
    const r = sample(clip(attack), () => byName(head).getWorldPosition(v).z * out.facing);
    out.bite = +r.reduce((a, b) => (b[1] > a[1] ? b : a))[0].toFixed(3);
    out.attackDur = +clip(attack).duration.toFixed(3);
  }
  // (three.js drops the dots from node names: "FF.L" is "FFL")
  const feet = bones.filter(b => feetRe.test(b.name));
  out.feet = feet.map(f => f.name);
  for (const [key, name] of [['walk', walk], ['run', run]]) {
    const c = clip(name); if (!c || !feet.length) continue;
    let dist = 0, time = 0;
    for (const f of feet) {
      const r = sample(c, () => { const p = f.getWorldPosition(v); return [p.y, p.z * out.facing]; });
      const minY = Math.min(...r.map(x => x[1][0])), tol = (box.max.y - box.min.y) * 0.03;
      for (let i = 1; i < r.length; i++) if (r[i][1][0] < minY + tol && r[i - 1][1][0] < minY + tol) { const dz = r[i - 1][1][1] - r[i][1][1]; if (dz > 0) { dist += dz; time += r[i][0] - r[i - 1][0]; } }
    }
    out[key] = time ? +(dist / time * s).toFixed(2) : null;
    out[key + 'Dur'] = +c.duration.toFixed(3);
  }
  return out;
}
