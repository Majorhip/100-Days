// Build check: the code rules that hold for every change.
//
//   node tests/golden/compare-build.mjs [built file]     (default: dist/index.html)
//
// 1. Every name resolves: each module parses, and every name it uses is declared in it,
//    imported, or a browser global (the ones the original script used, plus EXTRA_GLOBALS).
//    Catches a missing import before it can become a runtime error in a rarely used corner.
// 2. Standing rule (MIGRATION.md §4): src/data/ and src/game/ never import three.js, never
//    touch the page and never use the runtime state R. They import only core maths, other
//    rules or data modules, and G from state.js. There are no exceptions any more.
// 3. three.js comes from npm three@0.128.0, the version embedded in the original.
// 4. The built page has one inlined module script and nothing loaded from outside.
//
// Until 27 Nov 2026 this check also rebuilt the original game script from src/ byte for byte,
// undoing every change listed in tests/golden/approved-edits.mjs. That proved the migration was
// a pure move. It is retired now the migration is over: the ledger is frozen as the record of
// what the migration changed, and new work is guarded by the tests, the island fingerprint,
// the save checks, the smoke test and the screenshots.
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, ORIGINAL } from './browser.mjs';

/** browser globals the code may use that the original script never did */
const EXTRA_GLOBALS = ['window', 'Blob', 'URL', 'FileReader', 'alert', 'Date', 'Promise', 'Array', 'isFinite'];

const built = process.argv[2] || join(ROOT, 'dist', 'index.html');
const A = readFileSync(ORIGINAL, 'utf8');
const blocks = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => ({ attrs: m[1], body: m[2] }));
let ok = true;
const check = (label, pass, detail = '') => { console.log(`${pass ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); if (!pass) ok = false; };

const SRC = join(ROOT, 'src');
const srcFiles = (function walk(d) { return readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [relative(ROOT, join(d, e.name)).split('\\').join('/')]); })(SRC).filter(f => f.endsWith('.js'));
const texts = new Map(srcFiles.map(f => [f, readFileSync(join(ROOT, f), 'utf8')]));

// ---------- 0. plain text ----------
const badText = srcFiles.filter(f => texts.get(f).includes('\r') || texts.get(f).charCodeAt(0) === 0xfeff);
check(`${srcFiles.length} source files: LF line endings, no byte-order mark`, !badText.length);
badText.forEach(f => console.log('      CRLF or BOM: ' + f));

// ---------- 1. every name resolves ----------
{
  const { parse } = await import('acorn');
  const { analyze } = await import('eslint-scope');
  const scopeOf = (code, sourceType) => analyze(parse(code, { ecmaVersion: 'latest', sourceType, locations: true, ranges: true }), { ecmaVersion: 2022, sourceType });
  const known = new Set(scopeOf(blocks(A, 'script')[1].body, 'script').globalScope.through.map(r => r.identifier.name));
  EXTRA_GLOBALS.forEach(g => known.add(g));
  const unresolved = [];
  for (const f of srcFiles) {
    let sm; try { sm = scopeOf(texts.get(f), 'module'); } catch (e) { unresolved.push(`${f}: does not parse: ${e.message}`); continue; }
    const missing = [...new Set(sm.globalScope.through.map(r => r.identifier.name))].filter(n => !known.has(n));
    if (missing.length) unresolved.push(`${f}: ${missing.join(', ')}`);
  }
  check(`every name in ${srcFiles.length} modules is declared, imported or a known browser global`, !unresolved.length);
  unresolved.forEach(u => console.log('      not resolved: ' + u + '  (a new browser global goes in EXTRA_GLOBALS)'));
}

// ---------- 2. standing rule ----------
const pure = srcFiles.filter(f => /^src\/(data|game)\//.test(f));
const breaches = [];
const PURE_IMPORT = /from\s+['"](\.\.\/core\/(math|rng|noise|constants)\.js|\.\.\/data\/[^'"]+|\.\.\/game\/[^'"]+|\.\/[^'"]+)['"]/;
const STATE_IMPORT = /^import \{ (G|setG|newGameState)(, (G|setG|newGameState))* \} from '\.\.\/state\.js';$/;
for (const f of pure) {
  texts.get(f).split('\n').forEach((l, i) => {
    if (/^import\b.*['"]three['"]/.test(l)) breaches.push(`${f}:${i + 1}: imports three.js`);
    else if (/^import\s.+\sfrom\s/.test(l) && !PURE_IMPORT.test(l) && !STATE_IMPORT.test(l)) breaches.push(`${f}:${i + 1}: imports outside the rules: ${l.slice(0, 90)}`);
    else if (!/^\s*(\/\/|\*|\/\*)/.test(l) && !/^import\b/.test(l) && (/\bTHREE\./.test(l) || /\b(document|window|localStorage|navigator|sessionStorage)\s*\./.test(l) || /(^|[^.\w$])R\.\w/.test(l))) breaches.push(`${f}:${i + 1}: ${l.trim().slice(0, 90)}`);
  });
}
check(`src/data/ and src/game/ (${pure.length} files): no three.js, no page, no R`, !breaches.length);
breaches.forEach(b => console.log('      ' + b));

// ---------- 3. three.js version ----------
const threeVer = JSON.parse(readFileSync(join(ROOT, 'node_modules', 'three', 'package.json'), 'utf8')).version;
const pinned = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).dependencies.three;
check(`three.js from npm: installed ${threeVer}, package.json "${pinned}"`, threeVer === '0.128.0' && pinned === '0.128.0');

// ---------- 4. built page ----------
const B = readFileSync(built, 'utf8');
const sb = blocks(B, 'script');
const modules = sb.filter(s => /type=["']module/.test(s.attrs)), classic = sb.filter(s => !/type=["']module/.test(s.attrs));
check(`built scripts: ${modules.length} inlined module, ${classic.length} classic (expect 1 and 0)`, modules.length === 1 && classic.length === 0 && !sb.some(s => /\bsrc=/.test(s.attrs)));
check('built page loads nothing from outside (no <link href> or <script src>)', !/<link\b[^>]*\bhref=["'](?!data:)/.test(B) && !sb.some(s => /\bsrc=/.test(s.attrs)));
const bTime = statSync(built).mtimeMs, newest = Math.max(...srcFiles.map(f => statSync(join(ROOT, f)).mtimeMs), statSync(join(ROOT, 'index.html')).mtimeMs);
if (bTime < newest) { console.log('FAIL  the built file is older than the sources: run `npm run build` first'); ok = false; }

console.log(`\nsize: original ${statSync(ORIGINAL).size.toLocaleString()} bytes, built ${statSync(built).size.toLocaleString()} bytes`);
console.log(ok ? 'PASS: names resolve, the rules code is pure, three.js r128 from npm, one self-contained page.' : 'FAIL: see FAIL lines above.');
process.exit(ok ? 0 : 1);
