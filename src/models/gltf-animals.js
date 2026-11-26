// Animated animal models (glTF, by Quaternius, CC0), added after the migration (ANIMALS.md).
//
// The models are embedded in the game file (assets/animals/game/*.glb, made by
// tools/animals/build.mjs). loadAnimalModels() parses them once, while the title screen is up;
// gltfAnimal(kind) then gives each new creature its own copy, shaped like the hand-built models
// in src/models/animals.js ({ g, legs, head, mats, h, stride, ... }) so the creature code can
// use either, plus anim(c, dt), which picks and plays the clip for the creature's state.
//
// If a model is not loaded (still parsing, or it failed), gltfAnimal() returns null and the
// creature gets its hand-built model, so the game always works.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { litMat } from '../gfx/core.js';
import wolfUrl from '../../assets/animals/game/Wolf.glb?url';

const FILES = { Wolf: wolfUrl };

/**
 * Which model each creature (or model name in spawnCreature's o.model) uses.
 *   height  top of the model in metres at scale 1 (the hand-built model's height)
 *   scale   the creature's size, as the hand-built model had it: the creature code multiplies
 *           collision radius and reach by it, so it must stay the same
 *   colors  recolours by material name; glow: the material lights itself (eyes at night)
 *   walk, run  ground speed (m/s at scale 1) at which the Walk and Gallop clips' feet don't
 *           slide; the clip is sped up or slowed to match how fast the creature moves
 *   bite    the moment in the Attack clip (s) when the head is furthest forward
 */
const KINDS = {
  wolf: { file: 'Wolf', height: 1.05, scale: 1, colors: { Eyes_Black: { c: 0xffd640, glow: true } } },
  redwolf: { file: 'Wolf', height: 1.08, scale: 1.08, colors: { Main: { c: 0x3a3338 }, Main_Light: { c: 0x5a4f55 }, Eyes_Black: { c: 0xff3020, glow: true } } },
  snowwolf: { file: 'Wolf', height: 1.08, scale: 1.1, colors: { Main: { c: 0xe4eaef }, Main_Light: { c: 0xffffff }, Eyes_Black: { c: 0x4fd0ff, glow: true } } }
};
// measured by tools/animals/measure.mjs; runAt: the speed (m/s at scale 1) from which it gallops
const CLIP_INFO = { Wolf: { walk: 1.04, run: 3.15, bite: 0.375, runAt: 2.2 } };

const MODELS = {};   // file -> { scene, clips: {name: AnimationClip}, fit: {s, x, y, z} }
let loading = null;

/** parse every embedded model; resolves when done (a model that fails is just left out) */
function loadAnimalModels() {
  if (loading) return loading;
  const loader = new GLTFLoader();
  loading = Promise.all(Object.entries(FILES).map(([name, url]) => loader.loadAsync(url).then(gltf => {
    const scene = gltf.scene, clips = {};
    for (const a of gltf.animations) clips[a.name] = a;
    // size in the Idle pose (the meshes are stored tiny and sized by the skin)
    const mixer = new THREE.AnimationMixer(scene);
    if (clips.Idle) mixer.clipAction(clips.Idle).play();
    mixer.update(0);
    const box = posedBox(scene);
    mixer.stopAllAction(); mixer.uncacheRoot(scene);
    scene.traverse(o => { if (o.isMesh) o.geometry.userData.shared = true; });
    MODELS[name] = { scene, clips, box };
  }).catch(e => console.warn('Animal model ' + name + ' did not load; using the hand-built one.', e))));
  return loading;
}

/** bounding box of a skinned model in its current pose, from its vertices */
function posedBox(scene) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3(), v = new THREE.Vector3();
  scene.traverse(o => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (o.isSkinnedMesh) o.boneTransform(i, v); else v.fromBufferAttribute(pos, i);
      box.expandByPoint(v.applyMatrix4(o.matrixWorld));
    }
  });
  return box;
}

const isLoaded = kind => !!(KINDS[kind] && MODELS[KINDS[kind].file]);

/** a new animated model for this kind, or null (the caller then builds the hand-built one) */
function gltfAnimal(kind) {
  const k = KINDS[kind], src = k && MODELS[k.file]; if (!src) return null;
  const info = CLIP_INFO[k.file];
  const inner = SkeletonUtils.clone(src.scene);
  // the game's own lit material, one per material name, coloured as the artist chose (glTF
  // colours are linear; the game uses its colours as they are, so convert back to sRGB)
  const byName = {}, mats = [];
  inner.traverse(o => {
    if (!o.isMesh) return;
    const conv = m => {
      if (byName[m.name]) return byName[m.name];
      const re = k.colors[m.name], hex = re ? re.c : m.color.clone().convertLinearToSRGB().getHex();
      const g = litMat({ color: hex, emissive: re && re.glow ? hex : 0 });
      g.skinning = !!o.isSkinnedMesh; g.name = m.name;
      if (!(re && re.glow)) mats.push(g);   // the hit flash lights these; glowing eyes keep their glow
      return (byName[m.name] = g);
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    o.castShadow = true; o.frustumCulled = false;   // skinned: the bind-pose bounds don't follow the animation
  });
  const b = src.box, s = k.height / (b.max.y - b.min.y);
  inner.scale.multiplyScalar(s);
  inner.position.set(-(b.min.x + b.max.x) / 2 * s, -b.min.y * s, -(b.min.z + b.max.z) / 2 * s);
  const g = new THREE.Group(); g.add(inner); g.scale.setScalar(k.scale);

  const mixer = new THREE.AnimationMixer(inner), act = {};
  for (const n in src.clips) act[n] = mixer.clipAction(src.clips[n]);
  for (const n of ['Attack', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right']) if (act[n]) { act[n].setLoop(THREE.LoopOnce, 1); act[n].clampWhenFinished = true; }
  let cur = null, lock = 0, lastFlash = 0, pause = 0;
  const play = (name, fade = 0.2, at = 0) => {
    const a = act[name] || act.Idle; if (a === cur) return a;
    a.reset(); a.time = at; a.setEffectiveTimeScale(1); a.setEffectiveWeight(1); a.play();
    if (cur) cur.crossFadeTo(a, fade, false);
    cur = a; return a;
  };
  play('Idle', 0, Math.random() * 3);

  const model = {
    g, legs: [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()], head: null, tail: null, body: null,
    mats, eye: null, stride: 10, h: k.height * k.scale, gltf: kind,
    deathT: (src.clips.Death ? src.clips.Death.duration : 0) + 0.45,   // play the fall, then shrink away as before
    mixer,
    /** called every frame by updateCreatures after it has moved the creature */
    anim(c, dt) {
      lock -= dt;
      if (c.dead) play('Death', 0.12);
      else if (c.state === 'wind') {
        // time the bite: the game bites when 'wind' runs out (c.st reaches 0), so start the
        // clip where its head reaches furthest forward exactly then
        if (cur !== act.Attack) { play('Attack', 0.1, Math.max(0, info.bite - Math.max(0, c.st))); lock = 0; }
        lock = Math.max(lock, act.Attack ? act.Attack.getClip().duration - act.Attack.time : 0);
      } else if (c.flash > lastFlash + 0.05 && c.moving < info.runAt && lock <= 0) {
        play(Math.random() < 0.5 ? 'Idle_HitReact_Left' : 'Idle_HitReact_Right', 0.08); lock = 0.4;
      } else if (lock <= 0) {
        const v = c.moving / k.scale;
        if (v > 0.05) {
          pause = 0;
          const run = v >= info.runAt, a = play(run ? 'Gallop' : 'Walk', 0.25);
          a.setEffectiveTimeScale(Math.min(2.2, Math.max(0.5, v / (run ? info.run : info.walk))));
        } else {
          // standing still: idle, and now and then (when calm) put the nose down to eat
          if (cur !== act.Idle && cur !== act.Eating) pause = 0;
          pause += dt;
          if (cur === act.Eating && cur.time > cur.getClip().duration - 0.3) play('Idle', 0.4);
          else if (cur !== act.Eating) play(c.state === 'idle' && pause > 1.2 && Math.random() < dt * 0.15 && act.Eating ? 'Eating' : 'Idle', 0.3);
        }
      }
      lastFlash = c.flash;
      mixer.update(dt);
    }
  };
  return model;
}

export { KINDS, CLIP_INFO, loadAnimalModels, posedBox, isLoaded, gltfAnimal };
