// Asset step for the animal models: from the downloaded files in assets/animals/raw/, keep only
// the animations the game uses, drop the duplicate copy of each clip that the Ultimate-pack
// files carry ("AnimalArmature|Walk" next to "Walk"), drop everything unused, and write compact
// .glb files to assets/animals/game/. tools/animals/pack.mjs then packs them small into
// assets/animals/packed/, which the game embeds (src/models/gltf-animals.js).
//
//   node tools/animals/build.mjs
//
// The game files are committed, so the game builds without this step; run it again only after
// changing the list below. Uses glTF-Transform (MIT), a development tool not shipped in the game.
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, resample } from '@gltf-transform/functions';
import { mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const RAW = join(ROOT, 'assets', 'animals', 'raw'), OUT = join(ROOT, 'assets', 'animals', 'game');

/** model file -> the clips the game plays: a list of names in the file, or { name in the file:
 *  name the game uses } for models whose clips are named differently (the game expects Idle,
 *  Walk, Gallop, Attack, Death, Idle_HitReact_Left/Right, Eating; missing ones fall back) */
export const MODELS = {
  Wolf: ['Idle', 'Walk', 'Gallop', 'Attack', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Eating'],
  Fox: ['Idle', 'Walk', 'Gallop', 'Attack', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Eating'],
  ShibaInu: ['Idle', 'Walk', 'Gallop', 'Attack', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Eating'],
  Deer: ['Idle', 'Walk', 'Gallop', 'Attack_Headbutt', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Eating'],
  Stag: ['Idle', 'Walk', 'Gallop', 'Attack_Headbutt', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Eating'],
  Pig: Object.fromEntries([['Idle', 'Idle'], ['Walk', 'Walk'], ['Run', 'Gallop'], ['Headbutt', 'Attack'], ['Death', 'Death'], ['Idle_Eating', 'Eating']].map(([a, b]) => ['AnimalArmature|AnimalArmature|AnimalArmature|' + a, b])),
  Snake: { 'SnakeArmature|Snake_Idle': 'Idle', 'SnakeArmature|Snake_Walk': 'Walk', 'SnakeArmature|Snake_Attack': 'Attack' },
  Crab: { 'MonsterArmature|Idle': 'Idle', 'MonsterArmature|Walk': 'Walk', 'MonsterArmature|Bite_Front': 'Attack', 'MonsterArmature|Death': 'Death', 'MonsterArmature|HitRecieve': 'Idle_HitReact_Left' },
  Spider: { 'SpiderArmature|Spider_Idle': 'Idle', 'SpiderArmature|Spider_Walk': 'Walk', 'SpiderArmature|Spider_Attack': 'Attack', 'SpiderArmature|Spider_Death': 'Death' },
  Frog: { 'FrogArmature|Frog_Idle': 'Idle', 'FrogArmature|Frog_Jump': 'Walk', 'FrogArmature|Frog_Attack': 'Attack', 'FrogArmature|Frog_Death': 'Death' },
  Bat: { 'BatArmature|Bat_Flying': 'Idle', 'BatArmature|Bat_Attack': 'Attack', 'BatArmature|Bat_Death': 'Death', 'BatArmature|Bat_Hit': 'Idle_HitReact_Left' },
  Horse: ['Idle', 'Walk', 'Gallop', 'Attack_Kick', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Eating'],
  Horse_White: ['Idle', 'Walk', 'Gallop', 'Attack_Kick', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Eating'],
  Donkey: ['Idle', 'Walk', 'Gallop', 'Attack_Kick', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Eating'],
  Alpaca: ['Idle', 'Walk', 'Gallop', 'Attack_Kick', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Eating'],
  Shark: { 'SharkArmature|SharkArmature|SharkArmature|Swim|SharkArmature|Swim': 'Idle', 'SharkArmature|SharkArmature|SharkArmature|Swim_Fast|SharkArmature|Swim_Fast': 'Gallop', 'SharkArmature|SharkArmature|SharkArmature|Swim_Bite|SharkArmature|Swim_Bite': 'Attack' },
  Fish: { 'Armature|Swim': 'Idle' },
  // Uncle Ray (src/models/gltf-animals.js upgradeRay): standing, and clapping when you come by
  Man: { 'HumanArmature|Man_Idle': 'Idle', 'HumanArmature|Man_Clapping': 'Clap' }
};
// node tools/animals/build.mjs Man   builds only the models named (default: all of them)
const ONLY = process.argv.slice(2);

const io = new NodeIO();
mkdirSync(OUT, { recursive: true });
for (const [name, list] of Object.entries(MODELS)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  const rename = Array.isArray(list) ? Object.fromEntries(list.map(k => [k, k])) : list, keep = Object.keys(rename);
  const src = join(RAW, name + '.glb'), dst = join(OUT, name + '.glb');
  const doc = await io.read(src), root = doc.getRoot();
  const missing = keep.filter(k => !root.listAnimations().some(a => a.getName() === k));
  if (missing.length) throw new Error(`${name}: no clip named ${missing.join(', ')}`);
  // dispose the channels and samplers too: an orphaned sampler still holds its keyframe data,
  // and prune() would keep it
  for (const a of root.listAnimations()) if (!keep.includes(a.getName())) {
    for (const s of a.listSamplers()) s.dispose();   // (their keyframe accessors may be shared; prune() removes the unused ones)
    for (const c of a.listChannels()) c.dispose();
    a.dispose();
  }
  for (const a of root.listAnimations()) a.setName(rename[a.getName()]);
  await doc.transform(resample(), dedup(), prune());
  await io.write(dst, doc);
  const kb = f => (statSync(f).size / 1024).toFixed(0) + ' KB';
  console.log(`${name.padEnd(10)} ${kb(src).padStart(8)} -> ${kb(dst).padStart(7)}  clips: ${root.listAnimations().map(a => a.getName()).join(', ')}`);
}
