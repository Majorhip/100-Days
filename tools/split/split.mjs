// Phase 4 generator: build src/ from the original game script, tools/split/spec.mjs and the
// approved-edits ledger.
//
//   node tools/split/split.mjs <step>        e.g. 4.2 or 4.10  (moves every spec entry up to that step)
//
// Moved code is copied verbatim. Each module gets:
//   - a chain import of the previous module (`import './prev.js';`), so that modules are
//     evaluated in the original top-to-bottom order even where they call each other in a
//     cycle (ES modules evaluate depth-first; src/main.js imports only the last module);
//   - named imports of exactly the top-level names it uses from other modules (found by
//     scope analysis, tools/split/analyze.mjs), plus three.js if it uses THREE;
//   - an export of every top-level name it declares.
// Code not yet moved stays in src/legacy.js, evaluated after every moved module. Only
// order-independent code (pure data, the game state) is moved ahead of earlier unmoved code.
// src/main.js is the map: one `// @moved-to:` marker per block, in original order.
import { writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, relative, posix } from 'node:path';
import { analyzeScript, originalScript, ROOT } from './analyze.mjs';
import { SPEC } from './spec.mjs';
import { EDITS as ALL_EDITS } from '../../tests/golden/approved-edits.mjs';

const m = String(process.argv[2] || '').match(/^4\.(\d+)$/);
if (!m) { console.error('usage: node tools/split/split.mjs 4.<step>   (e.g. 4.2, 4.10)'); process.exit(2); }
const step = parseInt(m[1], 10), stage = '4.' + step;

const text = originalScript();
const A = analyzeScript(text);
const L = A.lines;
const LAST = L[L.length - 1] === '' ? L.length - 1 : L.length;   // last real line

// ---- 1. blocks: spec entries -> line ranges ----
const stmtOf = name => { const s = A.statements.find(s => s.names.includes(name)); if (!s) throw new Error('spec: no statement declares ' + name); return s; };
const starts = SPEC.map((e, i) => {
  if (e.at === 'START') return 1;
  const s = stmtOf(e.at), k = A.statements.indexOf(s);
  return k === 0 ? 1 : A.statements[k - 1].to + 1;
});
for (let i = 1; i < starts.length; i++) if (!(starts[i] > starts[i - 1])) throw new Error(`spec out of order at ${SPEC[i].at}`);
let blocks = SPEC.map((e, i) => ({ ...e, from: starts[i], to: i + 1 < starts.length ? starts[i + 1] - 1 : LAST, moved: e.step <= step }));
// a statement must never be cut in two
for (const b of blocks) for (const s of A.statements) if (s.from < b.from && s.to >= b.from) throw new Error(`block ${b.file} starts inside a statement (line ${b.from})`);

// unmoved blocks -> legacy.js (adjacent ones merged)
const merged = [];
for (const b of blocks) {
  if (b.moved) { merged.push(b); continue; }
  const prev = merged[merged.length - 1];
  if (prev && !prev.moved) prev.to = b.to; else merged.push({ file: 'src/legacy.js', from: b.from, to: b.to, moved: false, what: 'The part of the original game script not yet moved into modules.' });
}
blocks = merged;
const files = new Map();   // file -> { blocks: [], what }
for (const b of blocks) {
  if (!files.has(b.file)) files.set(b.file, { file: b.file, blocks: [], what: b.what });
  const f = files.get(b.file); f.blocks.push(b); if (!f.what && b.what) f.what = b.what;
}
for (const f of files.values()) f.blocks.forEach((b, i) => { b.id = f.blocks.length > 1 ? (b.id || String(i + 1)) : null; });
// ledger entries with `when: <file>` apply only once that file is generated
const EDITS = ALL_EDITS.filter(e => !e.when || files.has(e.when));
const owner = new Array(LAST + 2);
for (const b of blocks) for (let l = b.from; l <= b.to; l++) owner[l] = b.file;

// ---- 2. chain order: moved files in original order, legacy last ----
const order = [...files.values()].filter(f => f.file !== 'src/legacy.js').sort((a, b) => a.blocks[0].from - b.blocks[0].from).map(f => f.file);
if (files.has('src/legacy.js')) order.push('src/legacy.js');
// moved files evaluated before earlier legacy code must be order-independent (pure)
const legacyFirst = files.has('src/legacy.js') ? files.get('src/legacy.js').blocks[0].from : Infinity;
const PURE_AHEAD = /^src\/(data\/|state\.js$)/;
for (const f of order) if (f !== 'src/legacy.js' && files.get(f).blocks[0].from > legacyFirst && !PURE_AHEAD.test(f)) throw new Error(`${f} would run before earlier unmoved code; move sections in original order`);

// ---- 3. imports, exports, cross-module writes ----
const declOwner = name => owner[A.decls.get(name).line];
const uses = new Map(order.map(f => [f, new Map()]));   // file -> Map(sourceFile -> Set(names))
const problems = [];
const replaceCovers = line => EDITS.some(e => e.kind === 'replace' && L[line - 1].includes(e.was));
for (const r of A.refs) {
  const F = owner[r.line], D = declOwner(r.name);
  if (!F || !D || F === D) continue;
  if (r.write && !r.init && !replaceCovers(r.line)) problems.push(`line ${r.line}: ${F} assigns to ${r.name}, declared in ${D}`);
  const m = uses.get(F); if (!m.has(D)) m.set(D, new Set()); m.get(D).add(r.name);
}
if (problems.length) { console.error('Cross-module writes (imported bindings are read-only):\n  ' + problems.join('\n  ')); process.exit(1); }
// names introduced by ledger edits (e.g. setG): import them where a replacement uses them
const addDecls = new Map(EDITS.filter(e => e.kind === 'add').map(e => [(e.line.match(/^function (\w+)/) || [])[1], e.file]).filter(([n]) => n));
for (const e of EDITS.filter(e => e.kind === 'replace')) {
  const line = L.findIndex(l => l.includes(e.was)) + 1;
  const F = owner[line];
  for (const [name, D] of addDecls) if (new RegExp(`\\b${name}\\b`).test(e.now) && D !== F) {
    const m = uses.get(F); if (!m.has(D)) m.set(D, new Set()); m.get(D).add(name);
  }
}
const threeUsers = new Set(A.globalRefs.filter(g => g.name === 'THREE').map(g => owner[g.line]));
const exportsOf = f => [...A.decls.entries()].filter(([, d]) => owner[d.line] === f).sort((a, b) => a[1].line - b[1].line).map(([n]) => n);
const declOrder = name => A.decls.has(name) ? A.decls.get(name).line : Infinity;
const rel = (from, to) => { let p = relative(dirname(join(ROOT, from)), join(ROOT, to)).split('\\').join('/'); return p.startsWith('.') ? p : './' + p; };

// standing rule helpers (src/game/, src/data/)
const PURE_SRC = /^src\/(core\/(math|rng|noise|constants)\.js|data\/|game\/)/;
const PURE_STATE = new Set(['G', 'setG', 'newGameState']);
const isRuleFile = f => /^src\/(game|data)\//.test(f);
const PAGE = new Set(['document', 'window', 'localStorage', 'navigator', 'THREE', 'sessionStorage', 'location']);
const todoLines = new Map();   // line -> reason, for lines in rule files that reach out
for (const g of A.globalRefs) if (PAGE.has(g.name) && isRuleFile(owner[g.line])) todoLines.set(g.line, (todoLines.get(g.line) || new Set()).add(g.name));
for (const r of A.refs) if (r.name === 'R' && isRuleFile(owner[r.line])) todoLines.set(r.line, (todoLines.get(r.line) || new Set()).add('R'));

// ---- 4. write the modules ----
const EDIT_ADD = f => EDITS.filter(e => e.kind === 'add' && e.file === f).map(e => e.line);
const out = new Map();
order.forEach((f, idx) => {
  const info = files.get(f);
  const head = [];
  head.push(`// ${info.what || ''}`.trimEnd());
  if (f === 'src/legacy.js') head.push('// Shrinks with every Phase 4 step and is deleted at the end.');
  head.push('// Generated by tools/split/split.mjs: moved verbatim from the original game script.');
  head.push('// The code between @moved-from and @end-moved must stay byte-identical to the original');
  head.push('// (tests/golden/compare-build.mjs); changes go through tests/golden/approved-edits.mjs.');
  if (isRuleFile(f)) head.push('// Standing rule: no three.js, no page. TODO(split) marks where this still reaches out.');
  head.push('');
  if (idx > 0) head.push(`import '${rel(f, order[idx - 1])}';   // load order: runs after the previous part of the original script`);
  if (threeUsers.has(f)) head.push("import * as THREE from 'three';");
  const srcs = [...uses.get(f).entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  for (const [src, names] of srcs) {
    const list = [...names].sort((a, b) => declOrder(a) - declOrder(b));
    if (isRuleFile(f) && !PURE_SRC.test(src)) {
      const clean = src === 'src/state.js' ? list.filter(n => PURE_STATE.has(n)) : [];
      const dirty = list.filter(n => !clean.includes(n));
      if (clean.length) head.push(`import { ${clean.join(', ')} } from '${rel(f, src)}';`);
      if (dirty.length) { head.push(`// TODO(split): reaches into ${src.replace(/^src\//, '')} (${dirty.join(', ')})`); head.push(`import { ${dirty.join(', ')} } from '${rel(f, src)}';`); }
    } else head.push(`import { ${list.join(', ')} } from '${rel(f, src)}';`);
  }
  const body = [];
  for (const b of info.blocks) {
    body.push('');
    body.push(`// @moved-from: original${b.id ? ' #' + b.id : ''}`);
    for (let l = b.from; l <= b.to; l++) {
      let line = L[l - 1];
      const rm = EDITS.find(e => e.kind === 'remove' && e.text === line);
      if (rm) { body.push(`// @removed: ${line}`); continue; }
      if (todoLines.has(l)) body.push(`${line.match(/^\s*/)[0]}// TODO(split): uses ${[...todoLines.get(l)].join(', ')}`);
      body.push(line);
    }
    body.push('// @end-moved');
  }
  const adds = EDIT_ADD(f);
  const tail = [''];
  if (adds.length) { tail.push('// ---- approved additions (tests/golden/approved-edits.mjs) ----'); tail.push(...adds); tail.push(''); }
  const ex = exportsOf(f).concat(adds.map(l => (l.match(/^function (\w+)/) || [])[1]).filter(Boolean));
  if (ex.length) tail.push(`export { ${ex.join(', ')} };`);
  let txt = head.join('\n') + '\n' + body.join('\n') + '\n' + tail.join('\n') + '\n';
  out.set(f, txt);
});

// approved replacements: forward-apply once, wherever the original text now lives
for (const e of EDITS.filter(e => e.kind === 'replace')) {
  const hits = [...out.entries()].filter(([, t]) => t.split(e.was).length - 1 >= 1);
  const count = hits.reduce((n, [, t]) => n + t.split(e.was).length - 1, 0);
  if (count !== 1) throw new Error(`ledger replace ${JSON.stringify(e.was)} found ${count} times`);
  out.set(hits[0][0], hits[0][1].replace(e.was, e.now));
}

// ---- 5. main.js (the map) and debug-exports.js ----
const main = [
  '// Entry point, and the map of the original game script.',
  '// Generated by tools/split/split.mjs. Every block of the original script is listed below',
  '// in its original order; tests/golden/compare-build.mjs expands these markers and checks',
  '// the result is the original script, byte for byte.',
  '',
  `import '${rel('src/main.js', order[order.length - 1])}';   // the last part of the chain: loading it runs the whole game in original order`,
  "import * as ALL from './debug-exports.js';",
  '',
  '// Read-only view for the parity checks in tests/golden. A module namespace cannot be',
  '// assigned to from outside, and its bindings are live (G after a save loads, for example).',
  ...EDIT_ADD('src/main.js'),
  '',
  ...blocks.map(b => `// @moved-to: ${b.file}${files.get(b.file).blocks.length > 1 ? '#' + b.id : ''}`),
  ''
].join('\n');
out.set('src/main.js', main);
out.set('src/debug-exports.js', [
  '// Every module\'s exports in one namespace, for window.__stranded (see src/main.js).',
  '// Generated by tools/split/split.mjs. Imported after the game has loaded, so it does not',
  '// change the order in which modules run.',
  ...order.map(f => `export * from '${rel('src/debug-exports.js', f)}';`),
  ''
].join('\n'));

// ---- 6. write, and remove generated .js files that no longer exist ----
const wanted = new Set(out.keys());
(function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) { walk(p); if (!readdirSync(p).length) rmSync(p, { recursive: true }); } else if (p.endsWith('.js')) { const r = relative(ROOT, p).split('\\').join('/'); if (!wanted.has(r)) rmSync(p); } } })(join(ROOT, 'src'));
for (const [f, t] of out) { mkdirSync(dirname(join(ROOT, f)), { recursive: true }); writeFileSync(join(ROOT, f), t); }

const moved = order.filter(f => f !== 'src/legacy.js');
console.log(`stage ${stage}: ${moved.length} modules moved, ${files.has('src/legacy.js') ? files.get('src/legacy.js').blocks.reduce((n, b) => n + b.to - b.from + 1, 0) + ' lines left in legacy.js' : 'legacy.js gone'}`);
console.log('chain: ' + order.map(f => f.replace(/^src\//, '')).join(' -> '));
if (todoLines.size) console.log(`TODO(split) markers: ${todoLines.size} lines in src/game|data`);
