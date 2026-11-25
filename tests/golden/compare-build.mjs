// Build check: is the game still the original, only moved?
//
//   node tests/golden/compare-build.mjs [built file]     (default: dist/index.html)
//
// 1. Verbatim move. Starting from src/legacy.js, every "// @moved-to: <file>" line is
//    replaced by the code between "// @moved-from:" and "// @end-moved" in that file
//    (recursively, so files can be split again later). The result must contain the
//    original game script byte for byte. Every line outside moved code, in any file, must
//    be an allowed addition: a comment, a blank line, `import ... from '...';` or
//    `export { ... };`. The additions are printed so a person can see them.
// 2. Standing rule (MIGRATION.md §4): src/data/ and src/game/ never import three.js and
//    never touch the page.
// 3. three.js comes from npm three@0.128.0, the version embedded in the original.
// 4. The built page has the original markup and CSS, and one inlined module script.
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, ORIGINAL } from './browser.mjs';

const built = process.argv[2] || join(ROOT, 'dist', 'index.html');
const A = readFileSync(ORIGINAL, 'utf8');
const blocks = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => ({ attrs: m[1], body: m[2] }));
const strip = html => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<link\b[^>]*>/g, '').replace(/\s+/g, ' ').trim();
let ok = true;
const check = (label, pass, detail = '') => { console.log(`${pass ? 'same' : 'DIFF'}  ${label}${detail ? '  ' + detail : ''}`); if (!pass) ok = false; };

// ---------- 1. verbatim move ----------
const SRC = join(ROOT, 'src');
const TO = /^\/\/ @moved-to: (\S+)$/, FROM = '// @moved-from:', END = '// @end-moved';
const ALLOWED = [/^\s*$/, /^\s*\/\/.*$/, /^\s*\/\*.*\*\/\s*$/, /^import\s.+\sfrom\s+['"][^'"]+['"];$/, /^import\s+['"][^'"]+['"];$/, /^export \{[\w\s,]+\};$/];
const added = [];          // [file, line] pairs outside moved code
const used = new Map();    // file -> times inlined
const problems = [];

/** Text of a file with its own markers expanded; `inner` = only the moved block. */
function expand(rel, inner) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) { problems.push(`${rel}: file named by a marker does not exist`); return ''; }
  let lines = readFileSync(abs, 'utf8').split('\n');
  if (inner) {
    const a = lines.findIndex(l => l.startsWith(FROM));
    const b = lines.indexOf(END, a + 1);
    if (a < 0 || b < 0) { problems.push(`${rel}: missing ${FROM} / ${END}`); return ''; }
    if (lines.slice(a + 1).filter(l => l.startsWith(FROM)).length) problems.push(`${rel}: more than one ${FROM} block`);
    lines.slice(0, a).concat(lines.slice(b + 1)).forEach(l => { if (!ALLOWED.some(r => r.test(l))) problems.push(`${rel}: not an allowed addition outside moved code: ${l.slice(0, 100)}`); else if (l.trim()) added.push([rel, l]); });
    lines = lines.slice(a + 1, b);
  }
  const out = [];
  for (const l of lines) {
    const m = l.match(TO);
    if (m) { used.set(m[1], (used.get(m[1]) || 0) + 1); out.push(expand(m[1], true).replace(/\n$/, '')); }
    else out.push(l);
  }
  return out.join('\n') + (inner ? '\n' : '');
}

const gameBody = blocks(A, 'script')[1].body;
const recon = expand('src/legacy.js', false);
const at = recon.indexOf(gameBody);
check(`original game script found intact in src/ after expanding moved code (${gameBody.length.toLocaleString()} chars)`, at >= 0);
if (at < 0) {
  // show the first place they part ways, to make a failure easy to find
  const lines = recon.split('\n'), orig = gameBody.split('\n');
  let i = 0, j = 0;
  while (i < lines.length && j < orig.length) { if (lines[i] === orig[j]) { i++; j++; } else if (ALLOWED.some(r => r.test(lines[i])) && !orig.includes(lines[i])) i++; else break; }
  console.log(`      first mismatch: original line ${j + 1}:\n        original: ${JSON.stringify((orig[j] || '').slice(0, 140))}\n        now:      ${JSON.stringify((lines[i] || '').slice(0, 140))}`);
} else {
  for (const [part, where] of [[recon.slice(0, at), 'top'], [recon.slice(at + gameBody.length), 'bottom']])
    part.split('\n').forEach(l => { if (!ALLOWED.some(r => r.test(l))) problems.push(`src/legacy.js ${where}: not an allowed addition: ${l.slice(0, 100)}`); else if (l.trim()) added.push(['src/legacy.js', l]); });
}
for (const [f, n] of used) if (n !== 1) problems.push(`${f} is inlined ${n} times`);
const srcFiles = (function walk(d) { return readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [relative(ROOT, join(d, e.name)).replace(/\\/g, '/')]); })(SRC).filter(f => f.endsWith('.js'));
for (const f of srcFiles) if (!['src/main.js', 'src/legacy.js'].includes(f) && !used.has(f)) problems.push(`${f} is not reached from src/legacy.js by any @moved-to marker`);
check(`moved files: ${used.size}, each inlined exactly once, no other changes`, !problems.length);
problems.forEach(p => console.log('      ' + p));
console.log(`      added lines outside moved code (${added.filter(([, l]) => !l.trim().startsWith('//')).length} code, the rest comments):`);
for (const [f, l] of added) if (!l.trim().startsWith('//')) console.log(`        ${f}: ${l}`);

// ---------- 2. standing rule ----------
const pure = srcFiles.filter(f => /^src\/(data|game)\//.test(f));
const breaches = [];
for (const f of pure) {
  const t = readFileSync(join(ROOT, f), 'utf8');
  t.split('\n').forEach((l, i) => {
    if (/^import\b.*['"]three['"]/.test(l) || /\bTHREE\./.test(l) || /\b(document|window|localStorage|navigator)\s*\./.test(l) || /\b(R|GFX)\.\w/.test(l)) breaches.push(`${f}:${i + 1}: ${l.trim().slice(0, 90)}`);
  });
}
check(`src/data/ and src/game/ (${pure.length} files): no three.js, no page`, !breaches.length);
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
if (bTime < newest) console.log('note  the built file is older than the sources: run `npm run build` first');

const sz = f => statSync(f).size;
console.log(`\nsize: original ${sz(ORIGINAL).toLocaleString()} bytes, built ${sz(built).toLocaleString()} bytes`);
console.log(ok ? 'PASS: game code = original (only moved), original markup and CSS, three.js r128 from npm.' : 'FAIL: see DIFF lines above.');
process.exit(ok ? 0 : 1);
