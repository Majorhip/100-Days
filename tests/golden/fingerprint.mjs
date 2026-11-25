// World fingerprint: proves the island is identical between builds.
//
//   node tests/golden/fingerprint.mjs [target] [--write]
//
// target  a game file path or URL (default: original/Stranded-100-Days-PC.html)
// --write save the result as the golden reference (tests/golden/world-fingerprint.json)
//
// Without --write it compares against the golden reference and exits 1 on any difference,
// naming which part of the world changed.
//
// It reads the game's top-level variables (HGT, NODES, LAKES, SITES, NODE_MESH, R) from the
// page. That works while the game is a classic <script>; once it becomes an ES module
// (Phase 3) the game will need a small read-only debug hook for this script to read.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { launch, openGame, ORIGINAL, ROOT } from './browser.mjs';

const GOLDEN = join(ROOT, 'tests', 'golden', 'world-fingerprint.json');
const argv = process.argv.slice(2);
const write = argv.includes('--write');
const target = argv.find(a => !a.startsWith('--')) || ORIGINAL;

const sha = s => createHash('sha256').update(s).digest('hex');

/** Runs inside the page. Numbers survive JSON exactly (shortest round-trip form). */
function collect() {
  const prim = o => { const r = {}; for (const k of Object.keys(o).sort()) { const v = o[k]; if (v === null || typeof v !== 'object' && typeof v !== 'function') r[k] = v; } return r; };
  const tints = {};
  for (const t of Object.keys(NODE_MESH).sort()) { const ic = NODE_MESH[t].m.instanceColor; tints[t] = ic ? Array.from(ic.array) : null; }
  return {
    terrain: { grid: GRID, cell: CELL, heights: Array.from(HGT) },
    nodes: NODES.map(n => [n.t, n.x, n.y, n.z, n.s, n.ry, n.hp]),
    nodeTints: tints,
    lakes: LAKES.map(prim),
    sites: Object.keys(SITES).map(k => [k, prim(SITES[k])]),
    spawn: { x: R.start.x, z: R.start.z }
  };
}

const { browser, close } = await launch({ gpu: false });
let result;
try {
  const { page, errors } = await openGame(browser, target);
  const data = await page.evaluate(collect);
  const parts = {};
  for (const k of Object.keys(data)) parts[k] = sha(JSON.stringify(data[k]));
  const counts = {};
  for (const n of data.nodes) counts[n[0]] = (counts[n[0]] || 0) + 1;
  result = {
    world: sha(JSON.stringify(parts)),
    parts,
    counts: {
      heights: data.terrain.heights.length,
      nodes: data.nodes.length,
      byType: Object.fromEntries(Object.entries(counts).sort()),
      lakes: data.lakes.length,
      sites: data.sites.length
    },
    spawn: data.spawn
  };
  if (errors.length) console.warn('Page errors during boot:\n  ' + errors.join('\n  '));
} finally { await close(); }

console.log(`target: ${target}`);
console.log(`world:  ${result.world}`);
for (const [k, v] of Object.entries(result.parts)) console.log(`  ${k.padEnd(10)} ${v}`);
console.log(`nodes: ${result.counts.nodes}, heights: ${result.counts.heights}`);

if (write) {
  const out = { source: 'original/Stranded-100-Days-PC.html', recorded: new Date().toISOString().slice(0, 10), ...result };
  writeFileSync(GOLDEN, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote ${GOLDEN}`);
} else {
  if (!existsSync(GOLDEN)) { console.error('No golden fingerprint yet. Run with --write against the original.'); process.exit(2); }
  const g = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  const diff = Object.keys(g.parts).filter(k => g.parts[k] !== result.parts[k]);
  if (g.world === result.world && !diff.length) console.log('\nPASS: island identical to the golden reference.');
  else { console.error(`\nFAIL: island differs from the golden reference in: ${diff.join(', ') || 'world'}`); process.exit(1); }
}
