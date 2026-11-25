// Build check: is the game still the original, only moved?
//
//   node tests/golden/compare-build.mjs [built file]     (default: dist/index.html)
//
// 1. Verbatim move. Starting from src/main.js (the map), every "// @moved-to: <file>[#id]"
//    line is replaced by that block's code ("// @moved-from: original[ #id]" ...
//    "// @end-moved"), recursively. Inside blocks, "// @removed: <line>" markers and
//    "// TODO(split)" notes are resolved, and every ledger replacement
//    (tests/golden/approved-edits.mjs) is undone. The result must contain the original game
//    script byte for byte. Outside moved code a file may only hold comments, blank lines,
//    imports, `export { ... };`, `export * from '...';` and the ledger's approved additions.
//    Everything that is not a plain move is printed so a person can see it.
// 2. Standing rule (MIGRATION.md §4): src/data/ and src/game/ never import three.js and
//    never touch the page; anything that still does must sit under a TODO(split) note.
// 3. three.js comes from npm three@0.128.0, the version embedded in the original.
// 4. The built page has the original markup and CSS, and one inlined module script.
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, ORIGINAL } from './browser.mjs';
import { EDITS as ALL_EDITS } from './approved-edits.mjs';

const built = process.argv[2] || join(ROOT, 'dist', 'index.html');
// ledger entries with `when: <file>` apply only once that file exists
const EDITS = ALL_EDITS.filter(e => !e.when || existsSync(join(ROOT, e.when)));
const A = readFileSync(ORIGINAL, 'utf8');
const blocks = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => ({ attrs: m[1], body: m[2] }));
const strip = html => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<link\b[^>]*>/g, '').replace(/\s+/g, ' ').trim();
let ok = true;
const check = (label, pass, detail = '') => { console.log(`${pass ? 'same' : 'DIFF'}  ${label}${detail ? '  ' + detail : ''}`); if (!pass) ok = false; };

// ---------- 1. verbatim move ----------
const SRC = join(ROOT, 'src');
const TO = /^\s*\/\/ @moved-to: (\S+?)(?:#(\S+))?$/, FROM = /^\/\/ @moved-from: original(?: #(\S+))?$/, END = '// @end-moved';
const REMOVED = /^\/\/ @removed: (.*)$/, TODO = /^\s*\/\/ TODO\(split\)/;
const ALLOWED = [/^\s*$/, /^\s*\/\/.*$/, /^\s*\/\*.*\*\/\s*$/, /^import\s.+\sfrom\s+['"][^'"]+['"];(\s*\/\/.*)?$/, /^import\s+['"][^'"]+['"];(\s*\/\/.*)?$/, /^export \{[\w$\s,]+\};$/, /^export \* from ['"][^'"]+['"];$/];
const srcFiles = (function walk(d) { return readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [relative(ROOT, join(d, e.name)).split('\\').join('/')]); })(SRC).filter(f => f.endsWith('.js'));
const problems = [], notes = [];
const used = new Map();          // "file#id" -> times inlined
const addsUsed = new Map();      // ledger add entry -> times seen
const removedUsed = new Map();
let todoCount = 0;

// read every file once and undo the ledger's replacements (exactly once across src/)
const texts = new Map(srcFiles.map(f => [f, readFileSync(join(ROOT, f), 'utf8')]));
for (const e of EDITS.filter(e => e.kind === 'replace')) {
  const hits = [...texts.entries()].map(([f, t]) => [f, t.split(e.now).length - 1]).filter(([, n]) => n);
  const n = hits.reduce((s, [, k]) => s + k, 0);
  if (n !== 1) { problems.push(`ledger replace ${JSON.stringify(e.now)}: found ${n} times (expected exactly once)`); continue; }
  texts.set(hits[0][0], texts.get(hits[0][0]).replace(e.now, e.was));
  notes.push(`replace  ${hits[0][0]}: ${JSON.stringify(e.was)} -> ${JSON.stringify(e.now)}`);
}
const fileLines = f => texts.has(f) ? texts.get(f).split('\n') : null;

/** the outside-of-blocks lines of a file must all be allowed */
function checkOutside(f, lines) {
  const adds = EDITS.filter(e => e.kind === 'add' && e.file === f);
  for (const l of lines) {
    if (ALLOWED.some(r => r.test(l))) continue;
    const a = adds.find(e => e.line === l);
    if (a) { addsUsed.set(a, (addsUsed.get(a) || 0) + 1); continue; }
    problems.push(`${f}: not an allowed addition outside moved code: ${l.slice(0, 110)}`);
  }
}
/** expand one block (or a whole root file) */
function expand(f, id, root) {
  const lines = fileLines(f);
  if (!lines) { problems.push(`marker points at missing file ${f}`); return ''; }
  let body = lines;
  if (!root) {
    const starts = lines.map((l, i) => [i, l.match(FROM)]).filter(([, m]) => m);
    const want = starts.filter(([, m]) => (m[1] || null) === (id || null));
    if (want.length !== 1) { problems.push(`${f}: block ${id ? '#' + id : '(single)'} found ${want.length} times`); return ''; }
    const a = want[0][0], b = lines.indexOf(END, a + 1);
    if (b < 0) { problems.push(`${f}: block ${id || ''} has no ${END}`); return ''; }
    body = lines.slice(a + 1, b);
  }
  const outLines = [];
  for (const l of body) {
    const m = l.match(TO);
    if (m) { const key = m[1] + '#' + (m[2] || ''); used.set(key, (used.get(key) || 0) + 1); outLines.push(expand(m[1], m[2], false).replace(/\n$/, '')); continue; }
    if (!root) {
      const r = l.match(REMOVED);
      if (r) { const e = EDITS.find(e => e.kind === 'remove' && e.text === r[1]); if (!e) problems.push(`${f}: @removed line not in the ledger: ${r[1]}`); else removedUsed.set(e, (removedUsed.get(e) || 0) + 1); outLines.push(r[1]); continue; }
      if (TODO.test(l)) { todoCount++; continue; }
    }
    outLines.push(l);
  }
  return outLines.join('\n') + (root ? '' : '\n');
}
// every file: the lines outside its blocks must be allowed
for (const f of srcFiles) {
  const lines = fileLines(f); let inside = false; const outside = [];
  for (const l of lines) { if (FROM.test(l)) { inside = true; continue; } if (l === END) { inside = false; continue; } if (!inside) outside.push(l); }
  checkOutside(f, outside.filter(l => !TO.test(l)));
}
const gameBody = blocks(A, 'script')[1].body;
const recon = expand('src/main.js', null, true);
const at = recon.indexOf(gameBody);
check(`original game script rebuilt from src/ byte for byte (${gameBody.length.toLocaleString()} chars)`, at >= 0);
if (at < 0) {
  const lines = recon.split('\n'), orig = gameBody.split('\n');
  let s = lines.indexOf(orig[0]); let i = Math.max(0, s), j = 0;
  while (i < lines.length && j < orig.length && lines[i] === orig[j]) { i++; j++; }
  console.log(`      first mismatch at original line ${j + 1}:\n        original: ${JSON.stringify((orig[j] || '').slice(0, 140))}\n        rebuilt:  ${JSON.stringify((lines[i] || '').slice(0, 140))}`);
}
// every block of every file used exactly once; every file reached
const blocksIn = f => fileLines(f).map(l => l.match(FROM)).filter(Boolean).map(m => f + '#' + (m[1] || ''));
for (const f of srcFiles) {
  if (f === 'src/main.js') continue;
  const bs = blocksIn(f);
  if (f === 'src/debug-exports.js') { if (bs.length) problems.push(`${f} must not contain moved code`); continue; }
  if (!bs.length) problems.push(`${f} has no moved code and is not part of the map`);
  for (const k of bs) if (used.get(k) !== 1) problems.push(`${k.replace(/#$/, '')} is used ${used.get(k) || 0} times by @moved-to markers (expected 1)`);
}
for (const [k] of used) if (!blocksIn(k.split('#')[0]).includes(k) && existsSync(join(ROOT, k.split('#')[0]))) problems.push(`marker ${k} points at a block that does not exist`);
for (const e of EDITS) {
  if (e.kind === 'add' && addsUsed.get(e) !== 1) problems.push(`ledger add in ${e.file} used ${addsUsed.get(e) || 0} times (expected 1): ${e.line}`);
  if (e.kind === 'add' && addsUsed.get(e) === 1) notes.push(`add      ${e.file}: ${e.line}`);
  if (e.kind === 'remove' && removedUsed.get(e) !== 1) problems.push(`ledger remove used ${removedUsed.get(e) || 0} times (expected 1): ${e.text}`);
  if (e.kind === 'remove' && removedUsed.get(e) === 1) notes.push(`remove   ${e.text}`);
}
check(`${srcFiles.length} files, ${used.size} moved blocks, each used exactly once; outside moved code only imports, exports, comments and ledger entries`, !problems.length);
problems.forEach(p => console.log('      ' + p));
console.log(`      changes that are not plain moves (ledger, tests/golden/approved-edits.mjs): ${notes.length}`);
notes.forEach(n => console.log('        ' + n));
if (todoCount) console.log(`      TODO(split) notes inside moved code: ${todoCount}`);

// ---------- 1b. every name resolves ----------
// Parse each module as an ES module: any name it uses must be declared in it, imported, or a
// browser global the original script already used. Catches a missing import before it can
// turn into a runtime error in some rarely used corner of the game.
{
  const { parse } = await import('acorn');
  const { analyze } = await import('eslint-scope');
  const scopeOf = (code, sourceType) => analyze(parse(code, { ecmaVersion: 'latest', sourceType, locations: true, ranges: true }), { ecmaVersion: 2022, sourceType });
  const origGlobals = new Set(scopeOf(gameBody, 'script').globalScope.through.map(r => r.identifier.name));
  origGlobals.add('window');   // src/main.js sets window.__stranded
  const unresolved = [];
  for (const f of srcFiles) {
    let sm; try { sm = scopeOf(readFileSync(join(ROOT, f), 'utf8'), 'module'); } catch (e) { unresolved.push(`${f}: does not parse: ${e.message}`); continue; }
    const missing = [...new Set(sm.globalScope.through.map(r => r.identifier.name))].filter(n => !origGlobals.has(n));
    if (missing.length) unresolved.push(`${f}: ${missing.join(', ')}`);
  }
  check(`every name in ${srcFiles.length} modules is declared, imported or a browser global the original used`, !unresolved.length);
  unresolved.forEach(u => console.log('      not resolved: ' + u));
}

// ---------- 2. standing rule ----------
const pure = srcFiles.filter(f => /^src\/(data|game)\//.test(f));
const breaches = [];
const PURE_IMPORT = /from\s+['"](\.\.\/core\/(math|rng|noise|constants)\.js|\.\.\/data\/[^'"]+|\.\.\/game\/[^'"]+|\.\/[^'"]+)['"]/;
for (const f of pure) {
  const lines = texts.get(f).split('\n');
  lines.forEach((l, i) => {
    const prevTodo = i > 0 && TODO.test(lines[i - 1]);
    if (/^import\b.*['"]three['"]/.test(l)) breaches.push(`${f}:${i + 1}: imports three.js`);
    else if (/^import\s.+\sfrom\s/.test(l) && !PURE_IMPORT.test(l) && !/^import \{ (G|setG|newGameState)(, (G|setG|newGameState))* \} from '\.\.\/state\.js';$/.test(l) && !prevTodo) breaches.push(`${f}:${i + 1}: impure import without TODO(split): ${l.slice(0, 90)}`);
    else if (!/^\s*\/\//.test(l) && !/^import\b/.test(l) && (/\bTHREE\./.test(l) || /\b(document|window|localStorage|navigator|sessionStorage)\s*\./.test(l) || /(^|[^.\w$])R\.\w/.test(l)) && !prevTodo) breaches.push(`${f}:${i + 1}: ${l.trim().slice(0, 90)}`);
  });
}
check(`src/data/ and src/game/ (${pure.length} files): no three.js, no page, except under TODO(split)`, !breaches.length);
breaches.forEach(b => console.log('      ' + b));

// ---------- 3. three.js version ----------
const threeVer = JSON.parse(readFileSync(join(ROOT, 'node_modules', 'three', 'package.json'), 'utf8')).version;
const pinned = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).dependencies.three;
check(`three.js from npm: installed ${threeVer}, package.json "${pinned}"`, threeVer === '0.128.0' && pinned === '0.128.0');

// ---------- 4. built page ----------
const B = readFileSync(built, 'utf8');
const cssA = blocks(A, 'style').map(s => s.body).join('');
let cssB = blocks(B, 'style').map(s => s.body).join('');
const marker = cssB.match(/\/\*\$vite\$:\d+\*\/\s*$/);   // Vite's bookkeeping comment, only a comment
if (marker) cssB = cssB.slice(0, marker.index);
check(`built CSS text (${cssA.trim().length.toLocaleString()} chars${marker ? ', ignoring Vite comment ' + marker[0].trim() : ''})`, cssA.trim() === cssB.trim());
check('built markup outside scripts and styles', strip(A) === strip(B));
const sb = blocks(B, 'script');
const modules = sb.filter(s => /type=["']module/.test(s.attrs)), classic = sb.filter(s => !/type=["']module/.test(s.attrs));
check(`built scripts: ${modules.length} inlined module, ${classic.length} classic (expect 1 and 0)`, modules.length === 1 && classic.length === 0 && !sb.some(s => /\bsrc=/.test(s.attrs)));
const bTime = statSync(built).mtimeMs, newest = Math.max(...srcFiles.map(f => statSync(join(ROOT, f)).mtimeMs), statSync(join(ROOT, 'index.html')).mtimeMs);
if (bTime < newest) { console.log('DIFF  the built file is older than the sources: run `npm run build` first'); ok = false; }

const sz = f => statSync(f).size;
console.log(`\nsize: original ${sz(ORIGINAL).toLocaleString()} bytes, built ${sz(built).toLocaleString()} bytes`);
console.log(ok ? 'PASS: game code = original (moved, plus the listed ledger edits), original markup and CSS, three.js r128 from npm.' : 'FAIL: see DIFF lines above.');
process.exit(ok ? 0 : 1);
