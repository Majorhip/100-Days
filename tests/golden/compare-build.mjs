// Phase 2 check: is the built file the original game with only the CSS moved around?
//
//   node tests/golden/compare-build.mjs [built file]     (default: dist/index.html)
//
// Compares the inline <script> blocks byte for byte, the CSS text, and reports any other
// differences in the page markup.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, ORIGINAL } from './browser.mjs';

const built = process.argv[2] || join(ROOT, 'dist', 'index.html');
const A = readFileSync(ORIGINAL, 'utf8'), B = readFileSync(built, 'utf8');

const blocks = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => ({ attrs: m[1], body: m[2] }));
const strip = html => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<link\b[^>]*>/g, '').replace(/\s+/g, ' ').trim();
let ok = true;
const check = (label, pass, detail = '') => { console.log(`${pass ? 'same' : 'DIFF'}  ${label}${detail ? '  ' + detail : ''}`); if (!pass) ok = false; };

const sa = blocks(A, 'script'), sb = blocks(B, 'script').filter(s => !/type=["']module/.test(s.attrs));
check(`inline scripts (original ${sa.length}, built ${sb.length})`, sa.length === sb.length);
sa.forEach((s, i) => check(`  script ${i + 1} (${s.body.length.toLocaleString()} chars)`, !!sb[i] && sb[i].body === s.body));

const cssA = blocks(A, 'style').map(s => s.body).join('');
let cssB = blocks(B, 'style').map(s => s.body).join('');
// Vite appends a bookkeeping comment such as /*$vite$:1*/ to each CSS file. It's only a comment.
const marker = cssB.match(/\/\*\$vite\$:\d+\*\/\s*$/);
if (marker) { cssB = cssB.slice(0, marker.index); console.log(`note  ignoring Vite's trailing CSS comment ${marker[0].trim()}`); }
const norm = s => s.replace(/\s+/g, ' ').trim();
// exact, apart from the newline just inside <style> and </style>
check(`CSS text (${cssA.trim().length.toLocaleString()} chars)`, cssA.trim() === cssB.trim());
if (cssA.trim() !== cssB.trim()) console.log(`      ignoring all whitespace: ${norm(cssA) === norm(cssB) ? 'same' : 'still different'}`);

check('markup outside scripts and styles', strip(A) === strip(B));
const extra = blocks(B, 'script').length - sb.length;
if (extra) console.log(`note  ${extra} module script(s) added by the build`);

const sz = f => statSync(f).size;
console.log(`\nsize: original ${sz(ORIGINAL).toLocaleString()} bytes, built ${sz(built).toLocaleString()} bytes`);
console.log(ok ? 'PASS: built file = original game code, markup and CSS.' : 'FAIL: see DIFF lines above.');
process.exit(ok ? 0 : 1);
