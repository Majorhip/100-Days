// Save check: load tests/fixtures/save-v3.json into a build with "Continue" and confirm
// the day, player, inventory, structures and world changes came through intact.
//
//   node tests/golden/savecheck.mjs [target]     (default: the original file)
import { readFileSync } from 'node:fs';
import { launch, openGame, prepPage, ORIGINAL, FIXTURE, SAVE_KEY, HIGH_SETTINGS } from './browser.mjs';

const target = process.argv.slice(2).find(a => !a.startsWith('--')) || ORIGINAL;
const raw = readFileSync(FIXTURE, 'utf8');
const want = JSON.parse(raw);

const { browser, close } = await launch({ gpu: false });
let got, errors, title;
try {
  const o = await openGame(browser, target, { beforeLoad: { fn: prepPage, args: [SAVE_KEY, raw, HIGH_SETTINGS, 0] } });
  errors = o.errors;
  title = await o.page.evaluate(() => { const b = document.getElementById('tContinue'); return b ? b.textContent : null; });
  if (!title) throw new Error('No Continue button: the save was not recognised.');
  await o.page.click('#tContinue');
  await o.page.waitForFunction(() => R.started === true, { timeout: 60000 });
  got = await o.page.evaluate(() => JSON.parse(JSON.stringify({
    v: G.v, day: G.day, p: { level: G.p.level, xp: G.p.xp, maxHp: G.p.maxHp, held: G.p.held },
    inv: G.inv, structures: G.structures.map(s => [s.k, s.x, s.y, s.z, s.ry, s.d]),
    nodeState: G.nodeState, chests: G.chests, bossDead: G.bossDead, flags: G.flags, notes: G.notes, quest: G.quest
  })));
} finally { await close(); }

const exp = {
  v: want.v, day: want.day, p: { level: want.p.level, xp: want.p.xp, maxHp: want.p.maxHp, held: want.p.held },
  inv: want.inv, structures: want.structures.map(s => [s.k, s.x, s.y, s.z, s.ry, s.d]),
  nodeState: want.nodeState, chests: want.chests, bossDead: want.bossDead, flags: want.flags, notes: want.notes, quest: want.quest
};
const fails = [];
for (const k of Object.keys(exp)) {
  // inventory/structure contents compared order-insensitively for object keys
  const a = JSON.stringify(sortKeys(exp[k])), b = JSON.stringify(sortKeys(got[k]));
  if (a !== b) fails.push(k);
}
function sortKeys(v) { if (Array.isArray(v)) return v.map(sortKeys); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])); return v; }

console.log(`target:    ${target}`);
console.log(`title:     ${title.trim()}`);
console.log(`loaded:    day ${got.day}, level ${got.p.level}, ${Object.keys(got.inv).length} item types, ${got.structures.length} structures, ${Object.keys(got.nodeState).length} changed nodes`);
if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '));
if (fails.length) { console.error(`FAIL: differs from the fixture in: ${fails.join(', ')}`); process.exit(1); }
console.log('PASS: save loads; day, player, inventory, structures and world changes match.');
