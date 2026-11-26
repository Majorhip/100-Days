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
import { R } from '../state.js';
import { quadruped } from './animals.js';
import wolfUrl from '../../assets/animals/game/Wolf.glb?url';
import foxUrl from '../../assets/animals/game/Fox.glb?url';
import shibaUrl from '../../assets/animals/game/ShibaInu.glb?url';
import deerUrl from '../../assets/animals/game/Deer.glb?url';
import stagUrl from '../../assets/animals/game/Stag.glb?url';

const FILES = { Wolf: wolfUrl, Fox: foxUrl, ShibaInu: shibaUrl, Deer: deerUrl, Stag: stagUrl };

/**
 * Which model each creature (or model name in spawnCreature's o.model) uses.
 *   height  top of the model in metres at scale 1 (the hand-built model's height)
 *   scale   the creature's size, as the hand-built model had it: the creature code multiplies
 *           collision radius and reach by it, so it must stay the same
 *   colors  recolours by material name; glow: the material lights itself (eyes at night)
 *   walk, run  ground speed (m/s at scale 1) at which the Walk and Gallop clips' feet don't
 *           slide; the clip is sped up or slowed to match how fast the creature moves
 *   bite    the moment in the Attack clip (s) when the head is furthest forward
 *   variants  several models for one kind, picked at random by weight (deer: does and stags)
 *   fallback  builds a hand-built model for a creature the original game did not have, for
 *           when the animated one is not loaded
 *   collar  colour of a collar on the neck (Scout)
 */
const foxBox = (c, c2, c3) => () => quadruped({ c, c2, c3, body: [0.26, 0.28, 0.62], leg: 0.24, legT: 0.07, belly: true, head: [0.24, 0.22, 0.22], snout: [0.12, 0.1, 0.18], ears: 'point', tail: [0.15, 0.15, 0.45], tailC: c3, tailA: -0.4, headUp: 0.35, stride: 14 });
const KINDS = {
  wolf: { file: 'Wolf', height: 1.05, scale: 1, colors: { Eyes_Black: { c: 0xffd640, glow: true } } },
  redwolf: { file: 'Wolf', height: 1.08, scale: 1.08, colors: { Main: { c: 0x3a3338 }, Main_Light: { c: 0x5a4f55 }, Eyes_Black: { c: 0xff3020, glow: true } } },
  snowwolf: { file: 'Wolf', height: 1.08, scale: 1.1, colors: { Main: { c: 0xe4eaef }, Main_Light: { c: 0xffffff }, Eyes_Black: { c: 0x4fd0ff, glow: true } } },
  deer: { variants: [{ file: 'Deer', height: 1.55, weight: 0.65 }, { file: 'Stag', height: 2.0, weight: 0.35 }], scale: 1, colors: {} },
  fox: { file: 'Fox', height: 0.62, scale: 1, colors: {}, fallback: foxBox(0xc0652e, 0x8a4420, 0xf3e6d6) },
  arcticfox: { file: 'Fox', height: 0.62, scale: 1, colors: { Main: { c: 0xf2f4f6 }, Main_Light: { c: 0xffffff }, Grey: { c: 0xd3d9df } }, fallback: foxBox(0xf2f4f6, 0xd3d9df, 0xffffff) },
  scout: { file: 'ShibaInu', height: 0.75, scale: 1, colors: { Main: { c: 0xc98a3c } }, collar: 0xd9342b }
};
// measured by tools/animals/measure.mjs at height 'at' (speeds scale with the model's height);
// runAt: the speed from which it gallops; attack: the clip used for attacks
const CLIP_INFO = {
  Wolf: { at: 1.05, walk: 1.04, run: 3.15, bite: 0.375, runAt: 2.2, attack: 'Attack' },
  Fox: { at: 0.62, walk: 0.62, run: 1.86, bite: 0.375, runAt: 1.3, attack: 'Attack' },
  ShibaInu: { at: 0.75, walk: 0.64, run: 1.7, bite: 0.667, runAt: 1.3, attack: 'Attack' },
  Deer: { at: 1.55, walk: 0.96, run: 4.14, bite: 0.375, runAt: 2.4, attack: 'Attack_Headbutt' },
  Stag: { at: 2.0, walk: 0.97, run: 4.29, bite: 0.383, runAt: 2.4, attack: 'Attack_Headbutt' }
};

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

const isLoaded = kind => !!KINDS[kind] && (KINDS[kind].variants || [KINDS[kind]]).every(v => MODELS[v.file]);

/** pick one of a kind's variants by weight */
function variant(k) {
  if (!k.variants) return k;
  let r = Math.random() * k.variants.reduce((a, v) => a + v.weight, 0);
  for (const v of k.variants) if ((r -= v.weight) <= 0) return Object.assign({}, k, v);
  return Object.assign({}, k, k.variants[0]);
}

/** a new animated model for this kind; if it is not loaded, the kind's fallback or null (the
 *  caller then builds the hand-built one) */
function gltfAnimal(kind) {
  const k0 = KINDS[kind]; if (!k0) return null;
  const k = variant(k0), src = MODELS[k.file];
  if (!src) return k.fallback ? k.fallback() : null;
  const info = CLIP_INFO[k.file], ATTACK = info.attack, speedK = info.at / k.height;
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
  if (k.collar) addCollar(inner, k.collar, k.height);

  const mixer = new THREE.AnimationMixer(inner), act = {};
  for (const n in src.clips) act[n] = mixer.clipAction(src.clips[n]);
  for (const n of [ATTACK, 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right']) if (act[n]) { act[n].setLoop(THREE.LoopOnce, 1); act[n].clampWhenFinished = true; }
  let cur = null, lock = 0, lastFlash = 0, pause = 0;
  const play = (name, fade = 0.2, at = 0) => {
    const a = act[name] || act.Idle; if (a === cur) return a;
    a.reset(); a.time = at; a.setEffectiveTimeScale(1); a.setEffectiveWeight(1); a.play();
    if (cur) cur.crossFadeTo(a, fade, false);
    cur = a; return a;
  };
  play('Idle', 0, Math.random() * 3);

  const model = {
    // legs, head and tail are stand-ins: code written for the hand-built models may still turn them
    g, legs: [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()], head: new THREE.Object3D(), tail: new THREE.Object3D(), body: null,
    mats, eye: null, stride: 10, h: k.height * k.scale, gltf: kind, file: k.file,
    deathT: (src.clips.Death ? src.clips.Death.duration : 0) + 0.45,   // play the fall, then shrink away as before
    mixer,
    /** called every frame by updateCreatures after it has moved the creature */
    anim(c, dt) {
      lock -= dt;
      if (c.dead) play('Death', 0.12);
      else if (c.state === 'wind') {
        // time the bite: the game bites when 'wind' runs out (c.st reaches 0), so start the
        // clip where its head reaches furthest forward exactly then
        if (cur !== act[ATTACK]) { play(ATTACK, 0.1, Math.max(0, info.bite - Math.max(0, c.st))); lock = 0; }
        lock = Math.max(lock, act[ATTACK] ? act[ATTACK].getClip().duration - act[ATTACK].time : 0);
      } else if (c.flash > lastFlash + 0.05 && c.moving < info.runAt && lock <= 0) {
        play(Math.random() < 0.5 ? 'Idle_HitReact_Left' : 'Idle_HitReact_Right', 0.08); lock = 0.4;
      } else if (lock <= 0) {
        const v = c.moving / k.scale * speedK;
        if (v > 0.05) {
          pause = 0;
          const run = v >= info.runAt, a = play(run ? 'Gallop' : 'Walk', 0.25);
          a.setEffectiveTimeScale(Math.min(3, Math.max(0.5, v / (run ? info.run : info.walk))));
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

/** a collar round the neck: a ring on the Neck1 bone, sized in metres */
function addCollar(inner, color, height) {
  inner.updateMatrixWorld(true);
  let neck = null, head = null; inner.traverse(o => { if (o.isBone && o.name === 'Neck1') neck = o; if (o.isBone && o.name === 'Head') head = o; });
  if (!neck || !head) return;
  // a third of the way from the base of the neck to the head (lower down, the shoulders hide it)
  const ws = neck.getWorldScale(new THREE.Vector3()).x, r = height * 0.13;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.24, 5, 12), litMat({ color }));
  ring.position.copy(neck.worldToLocal(head.getWorldPosition(new THREE.Vector3()))).multiplyScalar(0.35);
  ring.rotation.x = Math.PI / 2; ring.scale.setScalar(1 / ws); ring.castShadow = true;
  neck.add(ring);
}

/** Ray's dog: swap the hand-built Scout for the animated one once it is loaded (Scout is made
 *  while the island is built, before the models have finished loading) */
function upgradeScout(s) {
  if (s.model.gltf || !isLoaded('scout')) return;
  const m = gltfAnimal('scout'); if (!m) return;
  R.scene.remove(s.g); m.g.position.copy(s.g.position); m.g.rotation.y = s.yaw;
  s.model = m; s.g = m.g; R.scene.add(m.g);
}
/** Scout's state in the terms anim() reads: biting just after a bite lands, else moving or idle */
const scoutPose = s => ({ state: s.bite > 0.8 ? 'wind' : 'idle', st: 0, moving: s.moving, flash: 0, dead: false });

export { KINDS, CLIP_INFO, loadAnimalModels, posedBox, isLoaded, gltfAnimal, upgradeScout, scoutPose };
