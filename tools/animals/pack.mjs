// Packs the animal models small for the game file: assets/animals/game/*.glb (the working
// models, made by build.mjs and rig-bear.mjs) -> assets/animals/packed/*.glb (what the game
// embeds, src/models/gltf-animals.js).
//
//   node tools/animals/pack.mjs
//
// - meshopt compression (EXT_meshopt_compression, with KHR_mesh_quantization): vertex data
//   quantised and every buffer compressed. three.js r128 decodes it with the meshopt decoder that
//   ships with three (examples/jsm/libs/meshopt_decoder.module.js), so nothing extra is shipped.
// - textures as WebP (EXT_texture_webp), at most TEXTURE px on a side.
// - nothing else changes: no dedup (it would merge identically-set-up materials, and the game
//   looks materials up by name: the bat's eyes and body would share one, and the body would lose
//   its skinning). The script checks that every material, mesh, node and clip keeps its name.
//
// Run it after changing any model in assets/animals/game/. The packed files are committed, so the
// game builds without this step. Uses glTF-Transform, meshoptimizer and sharp (development tools,
// not shipped in the game).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const TEXTURE = 1024;
const ROOT = resolve(import.meta.dirname, '..', '..');
const SRC = join(ROOT, 'assets', 'animals', 'game'), OUT = join(ROOT, 'assets', 'animals', 'packed');

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
mkdirSync(OUT, { recursive: true });
let a = 0, b = 0;
/** every material, mesh (with its primitives' materials), node and clip, by name: must not change */
const names = doc => { const r = doc.getRoot(); return JSON.stringify([r.listMaterials().map(m => m.getName()), r.listMeshes().map(m => m.getName() + ':' + m.listPrimitives().map(p => p.getMaterial() && p.getMaterial().getName()).join('+')), r.listNodes().map(n => n.getName()), r.listAnimations().map(a => a.getName())]); };
const kb = n => (n / 1024).toFixed(0).padStart(5) + ' KB';
// node tools/animals/pack.mjs Man   packs only the models named (default: all of them)
const ONLY = process.argv.slice(2);
for (const f of readdirSync(SRC).filter(f => f.endsWith('.glb') && (!ONLY.length || ONLY.includes(f.slice(0, -4)))).sort()) {
  const doc = await io.read(join(SRC, f));
  const before = names(doc);
  doc.setLogger({ debug() { }, info() { }, warn: m => console.warn('  ' + m), error: m => console.error('  ' + m) });
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEXTURE, TEXTURE] }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
    prune()
  );
  const after = names(doc);
  if (after !== before) throw new Error(`${f}: names changed in packing
  before ${before}
  after  ${after}`);
  await io.write(join(OUT, f), doc);
  const s0 = statSync(join(SRC, f)).size, s1 = statSync(join(OUT, f)).size; a += s0; b += s1;
  console.log(`${f.padEnd(16)} ${kb(s0)} -> ${kb(s1)}`);
}
console.log(`${'all'.padEnd(16)} ${(a / 1048576).toFixed(2)} MB -> ${(b / 1048576).toFixed(2)} MB`);
