// Phase 6 check: does a save made in the ORIGINAL game file show up in the new build?
//
//   node tests/golden/ship.mjs [release file]    (default: release/Stranded-100-Days-PC.html)
//
// Saves live in the browser (localStorage), not in the file, so this plays it the way Caspar
// will, in one browser profile:
//   1. Open the original file from a folder, start a game, and save it with the original's
//      own code (Day 9, 13 wood).
//   2. Replace that file with the release file (same name, same folder) and open it: the
//      title must offer Continue (Day 9), and Continue must load Day 9 with the 13 wood.
//   3. Also open the release file from a different folder (e.g. a fresh download): in
//      Chrome and Edge every local file shares one storage, so the save must show there too.
// Chrome/Edge behaviour only: Firefox and Safari keep local files' storage apart, which is
// what Export / Import save is for.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { launch, openGame, prepPage, SAVE_KEY, HIGH_SETTINGS, ORIGINAL } from './browser.mjs';

const release = resolve(process.argv[2] || join('release', 'Stranded-100-Days-PC.html'));
if (!existsSync(release)) { console.error(`No release file at ${release}. Run npm run ship first.`); process.exit(1); }
const NAME = 'Stranded-100-Days-PC.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
const dir = mkdtempSync(join(tmpdir(), 'stranded-ship-'));
const casparDir = join(dir, 'Caspar'), downloadDir = join(dir, 'Downloads');
mkdirSync(casparDir); mkdirSync(downloadDir);
const results = [];
const report = (name, ok, info) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(52)} ${info}`); };

const { browser, close } = await launch({ gpu: true });
try {
  // settings only (no save): the save must come from the original's own play
  const prep = { beforeLoad: { fn: prepPage, args: [SAVE_KEY, null, HIGH_SETTINGS, 0] } };

  // 1. the original file, played and saved
  copyFileSync(ORIGINAL, join(casparDir, NAME));
  {
    const g = await openGame(browser, join(casparDir, NAME), prep);
    await g.page.evaluate(() => document.getElementById('tNew').click());
    await g.page.waitForSelector('#iSkip', { timeout: 15000 });
    await g.page.evaluate(() => document.getElementById('iSkip').click());
    await g.page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
    await wait(1500);
    const saved = await g.page.evaluate(key => { const S = window.__stranded; S.G.day = 9; S.G.inv.wood = 13; S.saveGame(); const s = JSON.parse(localStorage.getItem(key)); return { day: s.day, wood: s.inv.wood }; }, SAVE_KEY);
    report('original file: game saved', saved.day === 9 && saved.wood === 13, `Day ${saved.day}, ${saved.wood} wood`);
    await g.page.close();
  }

  // 2 and 3: the release file, replacing the original, and from another folder
  copyFileSync(release, join(casparDir, NAME));
  copyFileSync(release, join(downloadDir, NAME));
  for (const [label, path] of [['same name, same folder', join(casparDir, NAME)], ['downloaded to another folder', join(downloadDir, NAME)]]) {
    const g = await openGame(browser, path, prep);
    const t = await g.page.evaluate(() => { const c = document.getElementById('tContinue'); return c ? c.textContent.trim() : null; });
    report(`new file (${label}): title offers Continue`, !!t && /Day 9\b/.test(t), `"${t}"`);
    if (t) {
      await g.page.evaluate(() => document.getElementById('tContinue').click());
      await g.page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
      const s = await g.page.evaluate(() => { const { G } = window.__stranded; return { day: G.day, wood: G.inv.wood || 0, build: !!window.__stranded.swimStep }; });
      report(`new file (${label}): Continue loads the save`, s.day === 9 && s.wood === 13 && s.build, `Day ${s.day}, ${s.wood} wood, new build ${s.build}`);
    }
    report(`new file (${label}): zero page errors`, !g.errors.length, g.errors.slice(0, 3).join(' | '));
    await g.page.close();
  }
} finally { await close(); try { rmSync(dir, { recursive: true, force: true }); } catch { } }

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) { console.error('FAIL: ship check'); process.exit(1); }
console.log('PASS: a save made in the original file shows up in the new file (Chrome/Edge).');
