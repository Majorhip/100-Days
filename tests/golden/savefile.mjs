// Export / Import save buttons, used the way a player would (real clicks, the real file picker,
// the real confirm box).
//
//   node tests/golden/savefile.mjs [target]     (default: dist/index.html)
//
// 1. Pause menu -> Export save: downloads stranded-day10-<date>.json holding the current game.
// 2. Pause menu -> Import save: pick a different save (Day 12), confirm; the game restarts at
//    the title, and Continue loads Day 12.
// 3. A copy with no save: title -> Load a save file -> the fixture; Continue appears (Day 10).
// 4. A file that is not a save is refused with a message, and nothing changes.
// 5. Saying "Cancel" in the confirm box changes nothing.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, toUrl, prepPage, FIXTURE, SAVE_KEY, HIGH_SETTINGS, ROOT } from './browser.mjs';

const target = process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html';
const fixture = readFileSync(FIXTURE, 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'stranded-savefile-'));
const day12 = join(tmp, 'day12.json');
{ const s = JSON.parse(fixture); s.day = 12; s.inv.wood = 99; writeFileSync(day12, JSON.stringify(s)); }
const notASave = join(ROOT, 'package.json');
const fixtureFile = FIXTURE;

const results = [];
const report = (name, ok, info) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(44)} ${info}`); };

/** a fresh browser (its own empty storage), the game loaded, optionally with a save stored */
async function fresh(save) {
  const { browser, close } = await launch({ gpu: false });
  const page = await browser.newPage();
  const errors = [], dialogs = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', d => { dialogs.push({ type: d.type(), msg: d.message() }); (page.__answer === false ? d.dismiss() : d.accept()).catch(() => { }); });
  await page.evaluateOnNewDocument(prepPage, SAVE_KEY, null, HIGH_SETTINGS, 0);   // settings only
  const boot = async () => {
    await page.waitForFunction(() => document.getElementById('loading').style.display === 'none' && document.getElementById('title').style.display === '', { timeout: 180000, polling: 250 });
  };
  await page.goto(toUrl(target), { waitUntil: 'load' }); await boot();
  if (save) { await page.evaluate((k, s) => localStorage.setItem(k, s), SAVE_KEY, save); await page.reload({ waitUntil: 'load' }); await boot(); }
  const title = () => page.evaluate(() => { const c = document.getElementById('tContinue'); return c ? c.textContent.trim() : null; });
  return { browser, close, page, errors, dialogs, boot, title };
}
async function pick(page, selector, file) {
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 15000 }), page.click(selector)]);
  await chooser.accept([file]);
}

// ---- 1 + 2: in a game, export, then import a different save ----
{
  const g = await fresh(fixture);
  try {
    await g.page.evaluate(() => { document.getElementById('tContinue').click(); window.__stranded.R.cinematic = true; window.__stranded.openPanel('pause'); });
    await new Promise(r => setTimeout(r, 500));
    await g.page.evaluate(() => {
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dl = fetch(this.href).then(r => r.text()).then(text => ({ name: this.download, text })); return; } return orig.call(this); };
    });
    await g.page.click('[data-a="export"]');
    const dl = await g.page.evaluate(() => window.__dl);
    const s = JSON.parse(dl.text), f = JSON.parse(fixture);
    const toast = await g.page.evaluate(() => document.getElementById('toasts').textContent);
    report('pause menu: Export save downloads the game', /^stranded-day10-\d{4}-\d\d-\d\d\.json$/.test(dl.name) && s.day === 10 && JSON.stringify(s.inv) === JSON.stringify(f.inv) && s.structures.length === 27 && /Saved to your downloads/.test(toast),
      `${dl.name}, day ${s.day}, ${Object.keys(s.inv).length} item types, ${s.structures.length} structures`);

    const nav = g.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 });
    await pick(g.page, '[data-a="import"]', day12);
    await nav; await g.boot();
    const t = await g.title();
    await g.page.evaluate(() => document.getElementById('tContinue').click());
    const after = await g.page.evaluate(() => ({ day: window.__stranded.G.day, wood: window.__stranded.G.inv.wood }));
    report('pause menu: Import save loads another save', g.dialogs.some(d => d.type === 'confirm' && /Day 12, Level 7/.test(d.msg) && /will be replaced/.test(d.msg)) && /Day 12/.test(t) && after.day === 12 && after.wood === 99,
      `asked first; title now "${t}"; continued on day ${after.day} with ${after.wood} wood`);
    if (g.errors.length) report('no page errors (in game)', false, g.errors.join(' | '));
  } finally { await g.close(); }
}

// ---- 3, 4, 5: a copy of the game with no save yet ----
{
  const g = await fresh(null);
  try {
    const before = await g.title();
    g.page.__answer = false;   // 5. say Cancel
    await pick(g.page, '#tLoad', fixtureFile);
    await new Promise(r => setTimeout(r, 800));
    const afterCancel = await g.title();
    report('title: Cancel in the confirm box changes nothing', before === null && afterCancel === null, `no save before, none after Cancel`);

    g.page.__answer = true;    // 3. load the fixture
    await pick(g.page, '#tLoad', fixtureFile);
    await g.page.waitForFunction(() => !!document.getElementById('tContinue'), { timeout: 15000 });
    const t = await g.title();
    report('title: Load a save file (no save yet) offers Continue', /Day 10, Level 7/.test(t), `title now "${t}"`);

    const n = g.dialogs.length;  // 4. not a save
    await pick(g.page, '#tLoad', notASave);
    await new Promise(r => setTimeout(r, 800));
    const msg = g.dialogs.slice(n).find(d => d.type === 'alert');
    const t2 = await g.title();
    report('title: a file that is not a save is refused', !!msg && /not a Stranded save/.test(msg.msg) && /Day 10/.test(t2), msg ? `"${msg.msg.slice(0, 60)}…"; still "${t2}"` : 'no message shown');
    report('no page errors', !g.errors.length, g.errors.join(' | ') || '0');
  } finally { await g.close(); }
}

const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed (${target})`);
if (failed) { console.error('FAIL: export / import save'); process.exit(1); }
console.log('PASS: Export / Import save work, ask before replacing, and refuse files that are not saves.');
