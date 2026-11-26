// Asset step for the animal models: from the downloaded files in assets/animals/raw/, keep only
// the animations the game uses, drop the duplicate copy of each clip that the Ultimate-pack
// files carry ("AnimalArmature|Walk" next to "Walk"), drop everything unused, and write compact
// .glb files to assets/animals/game/, which the game embeds (src/models/gltf-animals.js).
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

/** model file -> the clips the game plays (by their bare names in the file) */
export const MODELS = {
  Wolf: ['Idle', 'Walk', 'Gallop', 'Attack', 'Death', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Eating']
};

const io = new NodeIO();
mkdirSync(OUT, { recursive: true });
for (const [name, keep] of Object.entries(MODELS)) {
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
  await doc.transform(resample(), dedup(), prune());
  await io.write(dst, doc);
  const kb = f => (statSync(f).size / 1024).toFixed(0) + ' KB';
  console.log(`${name.padEnd(10)} ${kb(src).padStart(8)} -> ${kb(dst).padStart(7)}  clips: ${root.listAnimations().map(a => a.getName()).join(', ')}`);
}
