// Save round trip: load tests/fixtures/save-v3.json with Continue and save at once (in the same
// step, before a single game tick can change anything): that is save A. Load A in a fresh page
// and save again: save B. B must equal A exactly, and A must keep every value of the fixture;
// any field that differs from the fixture is listed so it can be explained.
//
//   node tests/golden/roundtrip.mjs [target]     (default: dist/index.html)
import { readFileSync } from 'node:fs';
import { launch, openGame, prepPage, FIXTURE, SAVE_KEY, HIGH_SETTINGS } from './browser.mjs';

const target = process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html';
const fixture = readFileSync(FIXTURE, 'utf8');

async function loadAndSave(browser, raw) {
  const { page, errors } = await openGame(browser, target, { beforeLoad: { fn: prepPage, args: [SAVE_KEY, raw, HIGH_SETTINGS, 0] } });
  const out = await page.evaluate(() => {
    const S = window.__stranded;
    document.getElementById('tContinue').click();   // audioInit, setG(mergeSave(s)), applyWorldState, startGame
    S.R.cinematic = true;                           // nothing else may change the state now
    S.saveGame();
    return S.R.memSave;
  });
  await page.close();
  return { json: out, errors };
}

function diff(a, b, path = '', out = []) {
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) { out.push(`${path || '(root)'}: ${JSON.stringify(a)?.slice(0, 60)} -> ${JSON.stringify(b)?.slice(0, 60)}`); return out; }
  if (a && typeof a === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in b)) out.push(`${path}.${k}: removed`); else if (!(k in a)) out.push(`${path}.${k}: added ${JSON.stringify(b[k]).slice(0, 60)}`); else diff(a[k], b[k], `${path}.${k}`, out);
    }
  } else if (a !== b) out.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  return out;
}

const { browser, close } = await launch({ gpu: false });
let A, B;
try { A = await loadAndSave(browser, fixture); B = await loadAndSave(browser, A.json); } finally { await close(); }

const fromFixture = diff(JSON.parse(fixture), JSON.parse(A.json));
console.log(`target: ${target}`);
console.log(`save A (fixture loaded, then saved): ${A.json.length.toLocaleString()} chars; differences from the fixture: ${fromFixture.length}`);
fromFixture.forEach(d => console.log('  ' + d));
console.log(`save B (A loaded, then saved): identical to A: ${A.json === B.json}`);
const errors = [...A.errors, ...B.errors];
if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '));
// Expected: the only change on load is that the player is lifted onto the ground/floor if the
// save had them slightly below it (saveGame does p.y = max(p.y, groundAt)).
const unexplained = fromFixture.filter(d => !/^\.p\.y: /.test(d));
if (A.json !== B.json || unexplained.length || errors.length) { console.error('FAIL: the save does not round-trip' + (unexplained.length ? '; unexplained differences: ' + unexplained.join('; ') : '')); process.exit(1); }
console.log('PASS: the Phase 1 save loads, and saving it round-trips exactly.');
