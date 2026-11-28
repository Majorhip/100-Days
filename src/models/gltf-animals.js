// Animated animal models (glTF, by Quaternius, CC0), added after the migration (ANIMALS.md).
//
// The models are embedded in the game file, compressed (assets/animals/packed/*.glb, packed by
// tools/animals/pack.mjs from assets/animals/game/, made by tools/animals/build.mjs). loadAnimalModels() parses them once, while the title screen is up;
// gltfAnimal(kind) then gives each new creature its own copy, shaped like the hand-built models
// in src/models/animals.js ({ g, legs, head, mats, h, stride, ... }) so the creature code can
// use either, plus anim(c, dt), which picks and plays the clip for the creature's state.
//
// If a model is not loaded (still parsing, or it failed), gltfAnimal() returns null and the
// creature gets its hand-built model, so the game always works.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { litMat } from '../gfx/core.js';
import { G, R } from '../state.js';
import { quadruped } from './animals.js';
import { scorpion } from './scorpion.js';
import { posedBox } from './posed-box.js';
import wolfUrl from '../../assets/animals/packed/Wolf.glb?url';
import foxUrl from '../../assets/animals/packed/Fox.glb?url';
import shibaUrl from '../../assets/animals/packed/ShibaInu.glb?url';
import deerUrl from '../../assets/animals/packed/Deer.glb?url';
import stagUrl from '../../assets/animals/packed/Stag.glb?url';
import pigUrl from '../../assets/animals/packed/Pig.glb?url';
import snakeUrl from '../../assets/animals/packed/Snake.glb?url';
import crabUrl from '../../assets/animals/packed/Crab.glb?url';
import spiderUrl from '../../assets/animals/packed/Spider.glb?url';
import frogUrl from '../../assets/animals/packed/Frog.glb?url';
import batUrl from '../../assets/animals/packed/Bat.glb?url';
import horseUrl from '../../assets/animals/packed/Horse.glb?url';
import horseWhiteUrl from '../../assets/animals/packed/Horse_White.glb?url';
import donkeyUrl from '../../assets/animals/packed/Donkey.glb?url';
import alpacaUrl from '../../assets/animals/packed/Alpaca.glb?url';
import sharkUrl from '../../assets/animals/packed/Shark.glb?url';
import fishUrl from '../../assets/animals/packed/Fish.glb?url';
// the bears: 'Black bear' by Poly by Google (CC BY 3.0), rigged, animated and retextured here
// (tools/animals/rig-bear.mjs, docs/animals/bears/README.md)
import bearUrl from '../../assets/animals/packed/Bear.glb?url';
import grizzleUrl from '../../assets/animals/packed/Grizzle.glb?url';
import frostclawUrl from '../../assets/animals/packed/Frostclaw.glb?url';
// Uncle Ray: 'Man' by Quaternius (CC0), recoloured, with Ray's hat added here
import manUrl from '../../assets/animals/packed/Man.glb?url';

const FILES = { Wolf: wolfUrl, Fox: foxUrl, ShibaInu: shibaUrl, Deer: deerUrl, Stag: stagUrl, Pig: pigUrl, Snake: snakeUrl, Crab: crabUrl, Spider: spiderUrl, Frog: frogUrl, Bat: batUrl, Horse: horseUrl, Horse_White: horseWhiteUrl, Donkey: donkeyUrl, Alpaca: alpacaUrl, Shark: sharkUrl, Fish: fishUrl, Bear: bearUrl, Grizzle: grizzleUrl, Frostclaw: frostclawUrl, Man: manUrl };

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
 *   lift    the bone that lifts the head when the creature's c.howl is set, 0 to 1 (Scout
 *           howling at Frostpeak: src/story/scout-story.js)
 *   turn    the model faces backwards in its file: turn it round
 *   fly     flies this high (m) above the ground, bobbing (bats)
 *   colors on a textured material tint the texture (the boar is the pig, tinted brown)
 */
const foxBox = (c, c2, c3) => () => quadruped({ c, c2, c3, body: [0.26, 0.28, 0.62], leg: 0.24, legT: 0.07, belly: true, head: [0.24, 0.22, 0.22], snout: [0.12, 0.1, 0.18], ears: 'point', tail: [0.15, 0.15, 0.45], tailC: c3, tailA: -0.4, headUp: 0.35, stride: 14 });
const KINDS = {
  wolf: { file: 'Wolf', height: 1.05, scale: 1, colors: { Eyes_Black: { c: 0xffd640, glow: true } } },
  redwolf: { file: 'Wolf', height: 1.08, scale: 1.08, colors: { Main: { c: 0x3a3338 }, Main_Light: { c: 0x5a4f55 }, Eyes_Black: { c: 0xff3020, glow: true } } },
  snowwolf: { file: 'Wolf', height: 1.08, scale: 1.1, colors: { Main: { c: 0xe4eaef }, Main_Light: { c: 0xffffff }, Eyes_Black: { c: 0x4fd0ff, glow: true } } },
  deer: { variants: [{ file: 'Deer', height: 1.55, weight: 0.65 }, { file: 'Stag', height: 2.0, weight: 0.35 }], scale: 1, colors: {} },
  fox: { file: 'Fox', height: 0.62, scale: 1, colors: {}, fallback: foxBox(0xc0652e, 0x8a4420, 0xf3e6d6) },
  arcticfox: { file: 'Fox', height: 0.62, scale: 1, colors: { Main: { c: 0xf2f4f6 }, Main_Light: { c: 0xffffff }, Grey: { c: 0xd3d9df } }, fallback: foxBox(0xf2f4f6, 0xd3d9df, 0xffffff) },
  scout: { file: 'ShibaInu', height: 0.75, scale: 1, colors: { Main: { c: 0xc98a3c } }, collar: 0xd9342b, lift: 'Neck1' },
  stormdog: { file: 'ShibaInu', height: 0.9, scale: 1, colors: { Main: { c: 0xb4582a } }, lift: 'Neck1' },   // Scout's wild family (Scout's story, chapter 8)
  boar: { file: 'Pig', height: 0.8, scale: 1, colors: { AtlasMaterial: { c: 0x93806f } } },
  snake: { file: 'Snake', height: 0.7, scale: 1, colors: {}, turn: true },
  crab: { file: 'Crab', height: 0.45, scale: 1, colors: {}, turn: true },
  spider: { file: 'Spider', height: 0.5, scale: 1, colors: {}, turn: true },
  frog: { file: 'Frog', height: 0.22, scale: 1, colors: {} },
  bat: { file: 'Bat', height: 0.4, scale: 1, colors: {}, fly: 1.7 },
  horse: { variants: [{ file: 'Horse', height: 2.1, weight: 0.6 }, { file: 'Horse_White', height: 2.1, weight: 0.4 }], scale: 1, colors: {} },
  donkey: { file: 'Donkey', height: 1.55, scale: 1, colors: {} },
  alpaca: { file: 'Alpaca', height: 1.85, scale: 1, colors: {} },
  shark: { file: 'Shark', height: 1.1, scale: 1, colors: {} },
  fish: { file: 'Fish', height: 0.14, scale: 1, colors: {} },
  // the bears. Frostclaw's height includes the ice on its back, so its body matches the others
  bear: { file: 'Bear', height: 1.5, scale: 1, colors: {} },
  grizzle: { file: 'Grizzle', height: 1.5, scale: 1.55, colors: { Eyes: { c: 0xff9a2a, glow: true } } },
  frostclaw: { file: 'Frostclaw', height: 1.82, scale: 1.7, colors: { Eyes: { c: 0x39d0ff, glow: true }, Ice: { c: 0x8fdcff, glow: true } } },
  // Uncle Ray, in the hand-built Ray's colours (green shirt, brown trousers, greying hair) and hat
  ray: { file: 'Man', height: 1.78, scale: 1, colors: { Shirt: { c: 0x4d6e3c }, Pants: { c: 0x5a4632 }, Hair: { c: 0x6b5a4a }, Skin: { c: 0xe2b48c } }, hat: 0x8c6c3c }
};
// measured by tools/animals/measure.mjs at height 'at' (speeds scale with the model's height);
// runAt: the speed from which it gallops; attack: the clip used for attacks
const CLIP_INFO = {
  Wolf: { at: 1.05, walk: 1.04, run: 3.15, bite: 0.375, runAt: 2.2, attack: 'Attack' },
  Fox: { at: 0.62, walk: 0.62, run: 1.86, bite: 0.375, runAt: 1.3, attack: 'Attack' },
  ShibaInu: { at: 0.75, walk: 0.64, run: 1.7, bite: 0.667, runAt: 1.3, attack: 'Attack' },
  Deer: { at: 1.55, walk: 0.96, run: 4.14, bite: 0.375, runAt: 2.4, attack: 'Attack_Headbutt' },
  Stag: { at: 2.0, walk: 0.97, run: 4.29, bite: 0.383, runAt: 2.4, attack: 'Attack_Headbutt' },
  Pig: { at: 0.8, walk: 0.59, run: 1.65, bite: 0.458, runAt: 2.0, attack: 'Attack' },
  // no foot bones to measure (or ones that don't touch the ground): walk speeds set by eye
  Snake: { at: 0.55, walk: 0.8, run: 0.8, bite: 0.233, runAt: 99, attack: 'Attack' },
  Crab: { at: 0.35, walk: 0.7, run: 0.7, bite: 0.125, runAt: 99, attack: 'Attack' },
  Spider: { at: 0.5, walk: 1.2, run: 1.2, bite: 0.333, runAt: 99, attack: 'Attack' },
  Frog: { at: 0.22, walk: 1.4, run: 1.4, bite: 0.417, runAt: 99, attack: 'Attack' },
  Bat: { at: 0.4, walk: 1, run: 1, bite: 0.258, runAt: 99, attack: 'Attack', noSync: true },
  Horse: { at: 2.1, walk: 1.15, run: 4.29, bite: 0.3, runAt: 2.6, attack: 'Attack_Kick' },
  Horse_White: { at: 2.1, walk: 1.15, run: 4.29, bite: 0.3, runAt: 2.6, attack: 'Attack_Kick' },
  Donkey: { at: 1.55, walk: 1.04, run: 4.43, bite: 0.3, runAt: 2.4, attack: 'Attack_Kick' },
  Alpaca: { at: 1.85, walk: 0.73, run: 3.37, bite: 0.3, runAt: 2.0, attack: 'Attack_Kick' },
  // swimming: Swim (as Idle and Walk), Swim_Fast (as Gallop); speeds by eye
  Shark: { at: 1.1, walk: 3, run: 6, bite: 0.25, runAt: 6.5, attack: 'Attack' },
  Fish: { at: 0.14, walk: 1, run: 1, bite: 0, runAt: 99, attack: 'Attack', noSync: true },
  // the bears (measured with feet Toe[LR]$); extra clips Roar and Slam for the bosses' specials
  Bear: { at: 1.5, walk: 0.92, run: 3.58, bite: 0.517, runAt: 2.4, attack: 'Attack' },
  Grizzle: { at: 1.5, walk: 0.92, run: 3.58, bite: 0.517, runAt: 2.4, attack: 'Attack' },
  Frostclaw: { at: 1.82, walk: 0.92, run: 3.58, bite: 0.517, runAt: 2.4, attack: 'Attack' },
  // Uncle Ray stands (Idle) and claps (Clap); he doesn't walk or fight
  Man: { at: 1.78, walk: 1, run: 1, bite: 0, runAt: 99, attack: 'Attack', noSync: true }
};

const MODELS = {};   // file -> { scene, clips: {name: AnimationClip}, fit: {s, x, y, z} }
let loading = null;

/**
 * The packed models store vertex data as scaled whole numbers (KHR_mesh_quantization). The GPU
 * reads them correctly, but in r128 the CPU-side reads (getX, boneTransform: posedBox sizes the
 * models with them) return the raw numbers. Turn them back into ordinary floats once, at load.
 */
const NORM = [[Int8Array, 127], [Uint8Array, 255], [Int16Array, 32767], [Uint16Array, 65535]];
function unquantize(geo) {
  for (const name in geo.attributes) {
    const a = geo.attributes[name], arr = a.isInterleavedBufferAttribute ? a.data.array : a.array;
    if (!a.normalized) continue;
    const n = NORM.find(([T]) => arr instanceof T); if (!n) continue;
    const out = new Float32Array(a.count * a.itemSize), get = ['getX', 'getY', 'getZ', 'getW'];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = Math.max(a[get[k]](i) / n[1], -1);
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
}

/** parse every embedded model; resolves when done (a model that fails is just left out) */
function loadAnimalModels() {
  if (loading) return loading;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loading = Promise.all(Object.entries(FILES).map(([name, url]) => loader.loadAsync(url).then(gltf => {
    const scene = gltf.scene, clips = {};
    scene.traverse(o => { if (o.isMesh) unquantize(o.geometry); });
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
  // the scorpion and the Dune King: a hand-built faceted black scorpion (src/models/scorpion.js),
  // not a glTF — the reference model has no skeleton and only a skitter clip. Returned here so the
  // creature code gets it before falling back to the original scorpionModel() in animals.js.
  if (kind === 'scorpion') return scorpion(1, false);
  if (kind === 'duneking') return scorpion(2.6, true);
  const k0 = KINDS[kind]; if (!k0) return null;
  const k = variant(k0), src = MODELS[k.file];
  if (!src) return k.fallback ? k.fallback() : null;
  const info = CLIP_INFO[k.file], ATTACK = info.attack, speedK = info.at / k.height;
  const inner = SkeletonUtils.clone(src.scene);
  // the game's own lit material, one per material name, coloured as the artist chose (glTF
  // colours are linear; the game uses its colours as they are, so convert back to sRGB).
  // Skinned and plain meshes get separate copies: the bat's eyes (plain) and body (skinned) share
  // the material "Main", and a skinned mesh drawn with a plain material ignores its skeleton.
  const byName = {}, mats = [];
  inner.traverse(o => {
    if (!o.isMesh) return;
    const conv = m => {
      const key = m.name + (o.isSkinnedMesh ? '|skinned' : '');
      if (byName[key]) return byName[key];
      const re = k.colors[m.name], hex = re ? re.c : m.color.clone().convertLinearToSRGB().getHex();
      const g = litMat({ color: hex, emissive: re && re.glow ? hex : 0 });
      g.skinning = !!o.isSkinnedMesh; g.name = m.name;
      if (m.map) { m.map.encoding = THREE.LinearEncoding; g.map = m.map; }   // (as the hex colours: no colour management)
      if (!(re && re.glow)) mats.push(g);   // the hit flash lights these; glowing eyes keep their glow
      return (byName[key] = g);
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    o.castShadow = true; o.frustumCulled = false;   // skinned: the bind-pose bounds don't follow the animation
  });
  const b = src.box, s = k.height / (b.max.y - b.min.y);
  inner.scale.multiplyScalar(s);
  const turn = k.turn ? -1 : 1;
  inner.position.set(-(b.min.x + b.max.x) / 2 * s * turn, -b.min.y * s, -(b.min.z + b.max.z) / 2 * s * turn);
  if (k.turn) inner.rotation.y = Math.PI;
  const baseY = inner.position.y;
  const g = new THREE.Group(); g.add(inner); g.scale.setScalar(k.scale);
  if (k.collar) addCollar(inner, k.collar, k.height);
  if (k.hat) addHat(g, inner, k.hat, k.height);
  // lifting the head (k.lift): the turn is undone before the mixer runs each frame, so it can
  // never build up, even on a bone no clip moves
  let liftB = null, lifted = false; const liftQ = new THREE.Quaternion(), _m = new THREE.Matrix4(), _ax = new THREE.Vector3();
  if (k.lift) inner.traverse(o => { if (o.isBone && o.name === k.lift) liftB = o; });

  const mixer = new THREE.AnimationMixer(inner), act = {};
  for (const n in src.clips) act[n] = mixer.clipAction(src.clips[n]);
  for (const n of [ATTACK, 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Roar', 'Slam']) if (act[n]) { act[n].setLoop(THREE.LoopOnce, 1); act[n].clampWhenFinished = true; }
  let cur = null, lock = 0, lastFlash = 0, pause = 0, flyT = Math.random() * 9;
  const play = (name, fade = 0.2, at = 0) => {
    const a = act[name] || (name === 'Gallop' && act.Walk) || (name === 'Idle_HitReact_Right' && act.Idle_HitReact_Left) || act.Idle; if (a === cur) return a;
    a.reset(); a.time = at; a.setEffectiveTimeScale(1); a.setEffectiveWeight(1); a.play();
    if (cur) cur.crossFadeTo(a, fade, false);
    cur = a; return a;
  };
  play('Idle', 0, Math.random() * 3);

  const model = {
    // legs, head and tail are stand-ins: code written for the hand-built models may still turn them
    g, legs: [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()], head: new THREE.Object3D(), tail: new THREE.Object3D(), body: null,
    mats, eye: null, stride: 10, h: (k.height + (k.fly || 0)) * k.scale, gltf: kind, file: k.file,
    deathT: (src.clips.Death ? src.clips.Death.duration : 0) + 0.45,   // play the fall, then shrink away as before
    mixer, play,
    /** called every frame by updateCreatures after it has moved the creature */
    anim(c, dt) {
      lock -= dt;
      if (c.dead) play('Death', 0.12);
      else if (c.state === 'wind') {
        // time the bite: the game bites when 'wind' runs out (c.st reaches 0), so start the
        // clip where its head reaches furthest forward exactly then
        if (cur !== act[ATTACK]) { play(ATTACK, 0.1, Math.max(0, info.bite - Math.max(0, c.st))); lock = 0; }
        lock = Math.max(lock, act[ATTACK] ? act[ATTACK].getClip().duration - act[ATTACK].time : 0);
      } else if (c.state === 'tele' && (act.Roar || act.Slam)) {
        // a boss winds up its special (0.95 s). Slam: rear up and crash down, landing when the
        // wind-up runs out (when the game shakes the ground); otherwise roar, then charge
        const name = c.mode === 'slam' && act.Slam ? 'Slam' : 'Roar';
        if (cur !== act[name]) play(name, 0.12, name === 'Slam' ? Math.max(0, 0.95 - Math.max(0, c.st)) : 0);
        lock = 0;
      } else if (c.state === 'charge' && act.Gallop) {
        play('Gallop', 0.12).setEffectiveTimeScale(Math.min(3.5, Math.max(1, c.moving / k.scale * speedK / info.run)));
      } else if (c.state === 'stun' && (cur === act.Slam || cur === act.Roar) && cur.time < cur.getClip().duration - 0.1) {
        // let the slam finish stepping back (the game wobbles a dizzy boss as before)
      } else if (c.flash > lastFlash + 0.05 && c.moving < info.runAt && lock <= 0) {
        play(Math.random() < 0.5 ? 'Idle_HitReact_Left' : 'Idle_HitReact_Right', 0.08); lock = 0.4;
      } else if (lock <= 0) {
        const v = c.moving / k.scale * speedK;
        if (v > 0.05) {
          pause = 0;
          const run = v >= info.runAt, a = play(run ? 'Gallop' : 'Walk', 0.25);
          a.setEffectiveTimeScale(info.noSync ? 1 : Math.min(3.5, Math.max(0.5, v / (run ? info.run : info.walk))));
        } else {
          // standing still: idle, and now and then (when calm) put the nose down to eat
          if (cur !== act.Idle && cur !== act.Eating) pause = 0;
          pause += dt;
          if (c.howl > 0.01) { play('Idle', 0.3); pause = 0; }   // howling (Scout): head up, never eating
          else if (c.dig && act.Eating) { const a = play('Eating', 0.3); if (a.time > a.getClip().duration - 0.35) a.time = 0.4; pause = 0; }   // digging or sniffing (Scout): nose down, over and over
          else if (cur === act.Eating && cur.time > cur.getClip().duration - 0.3) play('Idle', 0.4);
          else if (cur !== act.Eating) play(c.state === 'idle' && pause > 1.2 && Math.random() < dt * 0.15 && act.Eating ? 'Eating' : 'Idle', 0.3);
        }
      }
      lastFlash = c.flash;
      if (k.fly) { flyT += dt; inner.position.y = c.dead ? Math.max(baseY, inner.position.y - dt * 4) : baseY + k.fly + Math.sin(flyT * 2.3) * 0.2; }
      if (lifted) { liftB.quaternion.multiply(liftQ.invert()); liftQ.invert(); lifted = false; }
      mixer.update(dt);
      if (liftB && c.howl > 0.01) {
        // nose up: turn the bone about the animal's own left-right axis (its +X), in the bone's frame.
        // Full matrices, not world quaternions: a mirrored bone's quaternion would give the wrong axis
        liftB.updateWorldMatrix(true, false);
        _ax.set(1, 0, 0).transformDirection(g.matrixWorld).transformDirection(_m.copy(liftB.matrixWorld).invert());
        liftQ.setFromAxisAngle(_ax, -0.9 * c.howl); liftB.quaternion.multiply(liftQ); lifted = true;
      }
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

/** Ray's hat, as the hand-built Ray wore it (a wide brim and a crown), on the Head bone. Placed in
 *  metres on top of the head, level, whatever way the bone points */
const HAT_DOWN = 0.07;   // how far the brim sits below the top of the head (m)
function addHat(g, inner, color, height) {
  g.updateMatrixWorld(true);
  let head = null; inner.traverse(o => { if (o.isBone && o.name === 'Head') head = o; });
  if (!head) return;
  const mat = litMat({ color }), hat = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.48), mat), crown = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.14, 0.27), mat);
  crown.position.y = 0.09; brim.castShadow = crown.castShadow = true; hat.add(brim, crown);
  const at = head.getWorldPosition(new THREE.Vector3()); at.y = height - HAT_DOWN;
  hat.position.copy(head.worldToLocal(at));
  hat.quaternion.copy(head.getWorldQuaternion(new THREE.Quaternion()).invert());
  hat.scale.setScalar(1 / head.getWorldScale(new THREE.Vector3()).x);
  head.add(hat);
}

/** Uncle Ray: swap the hand-built model for the animated one once it is loaded, as for Scout.
 *  The story code (src/story/quests.js updateStory) turns r.g to face you and sways r.model.armL
 *  and r.model.head; on the animated model those are stand-ins, and rayAnim() plays the clips */
function upgradeRay(r) {
  if (!r || r.model.gltf || !isLoaded('ray')) return;
  const m = gltfAnimal('ray'); if (!m) return;
  m.armL = new THREE.Object3D(); m.armR = new THREE.Object3D();
  m.g.position.copy(r.g.position); m.g.rotation.y = r.g.rotation.y; m.g.visible = r.g.visible;
  R.scene.remove(r.g); r.model = m; r.g = m.g; R.scene.add(m.g);
}
/** every frame while Ray is out: he stands, and claps when you come up to him (again each time
 *  you've been away) */
const CLAP_NEAR = 7, CLAP_RESET = 16, CLAP_SECS = 3.3;   // metres, metres, seconds (two claps)
function rayAnim(r, dt) {
  const m = r.model; if (!m.gltf) return;
  const d = Math.hypot(G.p.x - r.x, G.p.z - r.z);
  if (d > CLAP_RESET) m.met = false;
  if (!m.met && d < CLAP_NEAR) { m.met = true; m.clapT = CLAP_SECS; m.play('Clap', 0.25); }
  if (m.clapT > 0 && (m.clapT -= dt) <= 0) m.play('Idle', 0.4);
  m.mixer.update(dt);
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
const scoutPose = s => ({ state: s.bite > 0.8 ? 'wind' : 'idle', st: 0, moving: s.moving, flash: 0, dead: false, howl: s.howl || 0, dig: !!s.dig });

/** a chip of glowing blue stone hanging from Scout's collar (Scout's story, after the Great Storm) */
function collarChip(m) {
  if (!m || !m.gltf || m.chip) return;
  let neck = null, head = null; m.g.traverse(o => { if (o.isBone && o.name === 'Neck1') neck = o; if (o.isBone && o.name === 'Head') head = o; });
  if (!neck || !head) return;
  m.g.updateMatrixWorld(true);
  const ring = neck.localToWorld(neck.worldToLocal(head.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.35));   // where the collar sits
  const fwd = new THREE.Vector3(0, 0, 1).transformDirection(m.g.matrixWorld);
  const at = ring.add(new THREE.Vector3(0, -0.085, 0)).addScaledVector(fwd, 0.045);   // the front of the collar, under the chin
  const chip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), litMat({ color: 0x7fdcff, emissive: 0x7fdcff, emissiveIntensity: 0.9 }));
  chip.position.copy(neck.worldToLocal(at)); chip.scale.setScalar(1 / neck.getWorldScale(new THREE.Vector3()).x);
  neck.add(chip); m.chip = chip;
}

export { KINDS, CLIP_INFO, loadAnimalModels, posedBox, isLoaded, gltfAnimal, upgradeScout, scoutPose, upgradeRay, rayAnim, collarChip };
