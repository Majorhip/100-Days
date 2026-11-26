// Browser side of tools/animals/lineup.mjs: runs inside the game (Vite dev server), loads the
// downloaded animal models and stands them in rows in front of the player, lit by the game's
// own lights and material (litMat), next to the hand-built models they would replace.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { R } from '/src/state.js';
import { litMat } from '/src/gfx/core.js';
import { ANIMALS } from '/src/models/animals.js';
import { groundAt } from '/src/player/movement.js';

// target height of the top of the model in metres (roughly the real animal, sized to the game's)
export const HEIGHT = {
  Wolf: 1.05, Stag: 2.1, Deer: 1.5, Fox: 0.62, Husky: 0.85, ShibaInu: 0.68, Horse: 2.1, Horse_White: 2.1, Donkey: 1.55, Alpaca: 1.85, Bull: 1.7, Cow: 1.6,
  BlackBear: 1.5, Bunny: 0.6, Frog: 0.3, Rat: 0.3, Spider: 0.7, Snake: 0.5, Crab: 0.45, Bat: 0.5, Pig: 0.8, Shark: 0.9, Fish: 0.35
};
const loader = new GLTFLoader();
const mixers = [];
let last = performance.now();
function tick() { const t = performance.now(), dt = Math.min(0.1, (t - last) / 1000); last = t; for (const m of mixers) m.update(dt); requestAnimationFrame(tick); }
tick();

/** convert the model's materials to the game's lit material, keeping each colour */
function gameMaterials(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    // glTF colours are linear; the game renders without colour management (its hex colours are
    // used as they are), so convert back to the sRGB values the artist picked
    const conv = m => { const g = litMat({ color: m.color ? m.color.clone().convertLinearToSRGB().getHex() : 0xffffff }); if (m.map) { m.map.encoding = THREE.LinearEncoding; g.map = m.map; } g.skinning = !!o.isSkinnedMesh; g.vertexColors = false; return g; };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    o.castShadow = true; o.frustumCulled = false;
  });
}

export async function place(names, { x0, z, gap, faceYaw = 0 }) {
  const placed = [];
  let x = x0;
  for (const name of names) {
    let obj, label = name;
    if (name.startsWith('old:')) { obj = ANIMALS[name.slice(4)]().g; label = name; }
    else if (name.startsWith('obj:')) {
      // a static textured model (OBJ + base colour PNG) in raw/<Name>/<Name>.obj
      const n = name.slice(4), dir = '/assets/animals/raw/' + n + '/';
      obj = await new OBJLoader().loadAsync(dir + n + '.obj');
      const map = await new THREE.TextureLoader().loadAsync(dir + n + '_BaseColor.png');
      obj.traverse(o => { if (o.isMesh) { o.material = litMat({ color: 0xffffff }); o.material.map = map; o.castShadow = true; } });
      const box = new THREE.Box3().setFromObject(obj), s = (HEIGHT[n] || 1) / (box.max.y - box.min.y);
      obj.scale.setScalar(s); label = n;
      const b2 = new THREE.Box3().setFromObject(obj); obj.userData.lift = -b2.min.y;
    }
    else {
      const gltf = await loader.loadAsync('/assets/animals/raw/' + name + '.glb');
      obj = gltf.scene; gameMaterials(obj);
      const mixer = new THREE.AnimationMixer(obj); mixers.push(mixer);
      const clip = gltf.animations.find(a => /(^|\|)Idle$/.test(a.name)) || gltf.animations.find(a => /Idle|Swim|Flying/.test(a.name)) || gltf.animations[0];
      if (clip) mixer.clipAction(clip).play();
      mixer.update(0.01);
      obj.updateMatrixWorld(true);
      // size from the skinned pose: bounding box of the bones' world positions plus the mesh
      const box = new THREE.Box3();
      obj.traverse(o => { if (o.isBone) box.expandByPoint(o.getWorldPosition(new THREE.Vector3())); });
      if (box.isEmpty()) box.setFromObject(obj);
      const h = Math.max(0.001, box.max.y - box.min.y), s = (HEIGHT[name] || 1) / h;
      obj.scale.multiplyScalar(s);
      obj.userData.clips = gltf.animations.map(a => a.name);
    }
    const gy = groundAt(x, z);
    obj.position.set(x, gy + (obj.userData.lift || 0), z); obj.rotation.y = faceYaw;
    R.scene.add(obj);
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj);
    placed.push({ name: label, x, size: b.isEmpty() ? null : [+(b.max.x - b.min.x).toFixed(2), +(b.max.y - b.min.y).toFixed(2), +(b.max.z - b.min.z).toFixed(2)], floor: +(b.min.y - gy).toFixed(2) });
    x += gap;
  }
  return placed;
}
