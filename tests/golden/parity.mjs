// Run every parity check against one build and print a one-line summary per check.
//
//   node tests/golden/parity.mjs [target] [--shots]
//
// target   a game file path or URL (default: dist/index.html)
// --shots  also take the six screenshots and compare them with golden (slower)
//
// For dist/index.html it first checks that the built file matches the sources
// (compare-build.mjs). Exits 1 if any check fails.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './browser.mjs';

const argv = process.argv.slice(2);
const target = argv.find(a => !a.startsWith('--')) || 'dist/index.html';
const NOISE = /could not be terminated|no running instance|operation attempted is not supported/;
const run = (label, script, args = []) => {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(ROOT, 'tests', 'golden', script), ...args], { cwd: ROOT, encoding: 'utf8' });   // script is relative to tests/golden
  const out = (r.stdout + r.stderr).split('\n').filter(l => l.trim() && !NOISE.test(l));
  const pass = r.status === 0;
  const key = out.filter(l => /^(PASS|FAIL)|^\s+\d-|DIFF|first mismatch|original:|rebuilt:|not resolved|page errors|HTTP \d|^after |steps passed|\d+\/\d+ passed/.test(l));
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(12)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const l of (pass ? key.filter(l => /^\s+\d-|^after |steps passed|\d+\/\d+ passed/.test(l)) : key.length ? key : out.slice(-15))) console.log('      ' + l.trim());
  return pass;
};
let ok = true;
if (/dist[\\/]index\.html$/.test(target)) ok = run('build', 'compare-build.mjs') && ok;
ok = run('island', 'fingerprint.mjs', [target]) && ok;
ok = run('save', 'savecheck.mjs', [target]) && ok;
ok = run('new game', 'newgame.mjs', [target]) && ok;
ok = run('touch', 'touchcheck.mjs', [target]) && ok;
ok = run('round trip', 'roundtrip.mjs', [target]) && ok;
ok = run('smoke', '../smoke.mjs', [target]) && ok;
if (argv.includes('--shots')) ok = run('screenshots', 'screenshots.mjs', [target]) && ok;
console.log(ok ? `\nALL PASS (${target})` : `\nSOME CHECKS FAILED (${target})`);
process.exit(ok ? 0 : 1);
