// Build check (Phase 3): is the game still the original, only moved?
//
//   node tests/golden/compare-build.mjs [built file]     (default: dist/index.html)
//
// 1. src/legacy.js = the original game script, byte for byte, plus only the lines Phase 3
//    added (the three.js import at the top, the read-only export at the bottom). The added
//    lines are printed so a person can see exactly what they are.
// 2. three.js comes from npm three@0.128.0, the version embedded in the original
//    (byte-identical to its build/three.min.js, checked in Phase 2).
// 3. The built page has the original markup and CSS, and one inlined module script in
//    place of the two original inline scripts.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, ORIGINAL } from './browser.mjs';

const built = process.argv[2] || join(ROOT, 'dist', 'index.html');
const A = readFileSync(ORIGINAL, 'utf8'), B = readFileSync(built, 'utf8');
const blocks = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => ({ attrs: m[1], body: m[2] }));
const strip = html => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<link\b[^>]*>/g, '').replace(/\s+/g, ' ').trim();
let ok = true;
const check = (label, pass, detail = '') => { console.log(`${pass ? 'same' : 'DIFF'}  ${label}${detail ? '  ' + detail : ''}`); if (!pass) ok = false; };

// 1. legacy.js vs the original game script
const origScripts = blocks(A, 'script');
const gameBody = origScripts[1].body;
const legacy = readFileSync(join(ROOT, 'src', 'legacy.js'), 'utf8');
const IMPORT = "import * as THREE from 'three';\n";
const MARK = '// ---- added in Phase 3:';
const iImp = legacy.indexOf(IMPORT), iMark = legacy.lastIndexOf(MARK);
const headAdded = iImp >= 0 ? legacy.slice(0, iImp + IMPORT.length) : '';
const tailAdded = iMark >= 0 ? legacy.slice(iMark) : '';
const core = legacy.slice(headAdded.length, iMark >= 0 ? iMark : legacy.length);
const headCodeOnly = headAdded.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
const tailCodeOnly = tailAdded.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
check(`src/legacy.js game code vs original script (${gameBody.length.toLocaleString()} chars)`, core === gameBody);
check('  added at top: only the three.js import', headCodeOnly.length === 1 && headCodeOnly[0] + '\n' === IMPORT, JSON.stringify(headCodeOnly));
check('  added at bottom: only a read-only export', tailCodeOnly.length === 1 && /^export \{[\w\s,]+\};$/.test(tailCodeOnly[0]), tailCodeOnly.join(' '));
if (core !== gameBody) {
  let i = 0; while (i < core.length && core[i] === gameBody[i]) i++;
  console.log(`      first difference at char ${i}: ${JSON.stringify(core.slice(i - 30, i + 30))} vs ${JSON.stringify(gameBody.slice(i - 30, i + 30))}`);
}

// 2. three.js version
const threeVer = JSON.parse(readFileSync(join(ROOT, 'node_modules', 'three', 'package.json'), 'utf8')).version;
const pinned = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).dependencies.three;
check(`three.js from npm: installed ${threeVer}, package.json "${pinned}"`, threeVer === '0.128.0' && pinned === '0.128.0');

// 3. built page: markup, CSS, scripts
const cssA = blocks(A, 'style').map(s => s.body).join('');
let cssB = blocks(B, 'style').map(s => s.body).join('');
const marker = cssB.match(/\/\*\$vite\$:\d+\*\/\s*$/);   // Vite's bookkeeping comment, only a comment
if (marker) cssB = cssB.slice(0, marker.index);
check(`built CSS text (${cssA.trim().length.toLocaleString()} chars${marker ? ', ignoring Vite comment ' + marker[0].trim() : ''})`, cssA.trim() === cssB.trim());
check('built markup outside scripts and styles', strip(A) === strip(B));
const sb = blocks(B, 'script');
const modules = sb.filter(s => /type=["']module/.test(s.attrs)), classic = sb.filter(s => !/type=["']module/.test(s.attrs) && !/\bsrc=/.test(s.attrs));
check(`built scripts: ${modules.length} inlined module, ${classic.length} classic (expect 1 and 0)`, modules.length === 1 && classic.length === 0 && !sb.some(s => /\bsrc=/.test(s.attrs)));

const sz = f => statSync(f).size;
console.log(`\nsize: original ${sz(ORIGINAL).toLocaleString()} bytes, built ${sz(built).toLocaleString()} bytes`);
console.log(ok ? 'PASS: built file = original game code (moved), original markup and CSS, three.js r128 from npm.' : 'FAIL: see DIFF lines above.');
process.exit(ok ? 0 : 1);
