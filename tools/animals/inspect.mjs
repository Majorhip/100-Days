// Lists what is inside each downloaded animal model (assets/animals/raw/*.glb), reading only
// the glTF JSON chunk: animations, meshes, skins, materials, textures and the model's size.
//
//   node tools/animals/inspect.mjs [--json out.json]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = resolve(import.meta.dirname, '..', '..', 'assets', 'animals', 'raw');

export function readGlbJson(file) {
  const b = readFileSync(file);
  if (b.toString('latin1', 0, 4) !== 'glTF') throw new Error(file + ': not a GLB');
  const len = b.readUInt32LE(12), type = b.toString('latin1', 16, 20);
  if (type !== 'JSON') throw new Error(file + ': first chunk is not JSON');
  return JSON.parse(b.toString('utf8', 20, 20 + len));
}

function info(file) {
  const j = readGlbJson(file);
  const acc = j.accessors || [];
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], verts = 0, tris = 0;
  for (const m of j.meshes || []) for (const p of m.primitives) {
    const a = acc[p.attributes.POSITION]; verts += a.count;
    tris += p.indices !== undefined ? acc[p.indices].count / 3 : a.count / 3;
    if (a.min) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], a.min[i]); max[i] = Math.max(max[i], a.max[i]); }
  }
  const anims = (j.animations || []).map(an => {
    let dur = 0; for (const s of an.samplers) { const a = acc[s.input]; if (a.max) dur = Math.max(dur, a.max[0]); }
    return { name: an.name, secs: +dur.toFixed(2) };
  });
  const mats = (j.materials || []).map(m => { const f = m.pbrMetallicRoughness?.baseColorFactor; return { name: m.name, color: f ? '#' + f.slice(0, 3).map(v => Math.round(Math.pow(v, 1 / 2.2) * 255).toString(16).padStart(2, '0')).join('') : null, tex: !!m.pbrMetallicRoughness?.baseColorTexture }; });
  const nodeScale = (j.nodes || []).find(n => n.scale)?.scale;
  return {
    generator: j.asset?.generator, meshes: (j.meshes || []).length, skins: (j.skins || []).length, bones: (j.skins || [])[0]?.joints.length || 0,
    verts, tris: Math.round(tris), textures: (j.textures || []).length, vertexColors: (j.meshes || []).some(m => m.primitives.some(p => p.attributes.COLOR_0 !== undefined)),
    size: max.map((v, i) => +(v - min[i]).toFixed(2)), nodeScale, mats, anims
  };
}

const out = {};
for (const f of readdirSync(DIR).filter(f => f.endsWith('.glb')).sort()) {
  const r = info(join(DIR, f)); out[f] = r;
  console.log(`\n${f}  (${r.generator})`);
  console.log(`  ${r.meshes} mesh, ${r.skins} skin (${r.bones} bones), ${r.verts} verts, ${r.tris} tris, textures ${r.textures}, vertex colours ${r.vertexColors}, mesh size ${r.size.join(' x ')}${r.nodeScale ? ' node scale ' + r.nodeScale.map(v => +v.toFixed(3)).join(',') : ''}`);
  console.log(`  materials: ${r.mats.map(m => m.name + (m.color ? ' ' + m.color : '') + (m.tex ? ' [tex]' : '')).join(', ')}`);
  console.log(`  animations (${r.anims.length}): ${r.anims.map(a => `${a.name} ${a.secs}s`).join(', ')}`);
}
const k = process.argv.indexOf('--json'); if (k > 0) writeFileSync(process.argv[k + 1], JSON.stringify(out, null, 1));
