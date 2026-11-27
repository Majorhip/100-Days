// Backup saves (src/backups.js), used the way a player would: real days passing, real reloads,
// the real title buttons and confirm boxes.
//
//   node tests/golden/backups.mjs [target]     (default: dist/index.html)
//
// 1. Each new day keeps the day before as a backup; three are kept, newest first; saving again
//    on the same day changes nothing.
// 2. On a 10th day a tip reminds the player to Export a copy.
// 3. A save that can't be read: the title offers the newest backup, which loads, and the broken
//    save is kept aside.
// 4. A save that reads but fails to load: Continue says so, and the title then offers the backup.
// 5. New Adventure (after confirming) clears the backups too.
import { readFileSync } from 'node:fs';
import { launch, toUrl, prepPage, FIXTURE, SAVE_KEY, HIGH_SETTINGS } from './browser.mjs';

const target = process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html';
const fixture = readFileSync(FIXTURE, 'utf8');
const results = [];
const report = (name, ok, info) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(50)} ${info}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

const { browser, close } = await launch({ gpu: false });
try {
  const page = await browser.newPage();
  const errors = [], dialogs = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', d => { dialogs.push({ type: d.type(), msg: d.message() }); d.accept().catch(() => { }); });
  await page.evaluateOnNewDocument(prepPage, SAVE_KEY, null, HIGH_SETTINGS, 0);
  const boot = () => page.waitForFunction(() => document.getElementById('loading').style.display === 'none' && document.getElementById('title').style.display === '', { timeout: 180000, polling: 250 });
  const reload = async () => { await page.reload({ waitUntil: 'load' }); await boot(); };
  const title = () => page.evaluate(() => ({ cont: (document.getElementById('tContinue') || {}).textContent || null, bak: (document.getElementById('tBackup') || {}).textContent || null }));
  const backups = () => page.evaluate(() => window.__stranded.listBackups().map(b => b.day).join(','));
  const store = (k, v) => page.evaluate((k, v) => localStorage.setItem(k, v), k, v);

  await page.goto(toUrl(target), { waitUntil: 'load' }); await boot();
  await store(SAVE_KEY, fixture); await reload();

  // ---- 1: four days pass ----
  await page.evaluate(() => { document.getElementById('tContinue').click(); window.__stranded.R.invuln = 1e9; });
  await page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
  const r1 = await page.evaluate(() => {
    const S = window.__stranded, seen = [];
    for (let i = 0; i < 4; i++) { S.G.hour = 23.99; S.advanceTime(0.02, false); seen.push(S.listBackups().map(b => b.day).join(',')); }
    const before = S.listBackups().map(b => b.day).join(','); S.saveGame(); const after = S.listBackups().map(b => b.day).join(',');
    return { seen, day: JSON.parse(localStorage.getItem(S.SAVE_KEY)).day, sameDay: before === after };
  });
  report('each new day keeps the day before; three kept', r1.seen.join(' | ') === '10 | 11,10 | 12,11,10 | 13,12,11' && r1.day === 14 && r1.sameDay,
    `backups after each day: ${r1.seen.join(' | ')}; main save day ${r1.day}; same-day save left them alone: ${r1.sameDay}`);

  // ---- 2: the 10th-day reminder ----
  await page.evaluate(() => { const S = window.__stranded; S.G.day = 19; S.G.hour = 23.99; S.advanceTime(0.02, false); S.G.hour = 9; S.G.raidDone = 20; S.slowTick(); });   // (morning: no Wolf Moon raid; the per-second checks run now)
  await page.waitForFunction(() => /Export save/.test(document.getElementById('toasts').textContent), { timeout: 8000 }).catch(() => { });
  const nudge = await page.evaluate(() => ({ toast: /Day 20!.*Export save/.test(document.getElementById('toasts').textContent), flag: window.__stranded.G.flags.exportNudge, day: window.__stranded.G.day, why: ['panel', 'sleeping', 'cinematic', 'paused'].map(k => k + '=' + window.__stranded.R[k]).join(' ') }));
  report('Day 20: a tip to Export a copy, once', nudge.toast && nudge.flag === 20, `tip shown ${nudge.toast}, remembered for day ${nudge.flag} (day ${nudge.day}, ${nudge.why}); backups now ${await backups()}`);

  // ---- 3: a save that can't be read ----
  await store(SAVE_KEY, '{"v":3,"day":2'); await reload();
  const t3 = await title();
  const n3 = dialogs.length;
  await page.click('#tBackup'); await wait(500);
  const t3b = await title();
  const kept = await page.evaluate(k => localStorage.getItem(k + '_broken'), SAVE_KEY);
  await page.evaluate(() => document.getElementById('tContinue').click());
  await page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
  const day3 = await page.evaluate(() => window.__stranded.G.day);
  report('unreadable save: the title offers the backup, which loads', !t3.cont && /Day 14/.test(t3.bak || '') && dialogs.slice(n3).some(d => d.type === 'confirm' && /Day 14/.test(d.msg)) && /Day 14/.test(t3b.cont || '') && !t3b.bak && day3 === 14 && kept === '{"v":3,"day":2',
    `title "${(t3.bak || '').trim()}", asked first, then "${(t3b.cont || '').trim()}"; continued on day ${day3}; broken save kept aside: ${kept !== null}`);

  // ---- 4: a save that reads but fails to load ----
  { const s = JSON.parse(fixture); s.structures = [null]; await store(SAVE_KEY, JSON.stringify(s)); }
  await reload();
  const t4 = await title(), n4 = dialogs.length;
  const nav = page.waitForNavigation({ waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.getElementById('tContinue').click());
  await nav; await boot();
  const t4b = await title();
  report('save that fails to load: says so, then offers the backup', /Day 10/.test(t4.cont || '') && dialogs.slice(n4).some(d => d.type === 'alert' && /could not be loaded/.test(d.msg)) && !t4b.cont && /Day 14/.test(t4b.bak || ''),
    `Continue "${(t4.cont || '').trim()}" -> message shown; title now "${(t4b.bak || '').trim()}"`);

  // ---- 5: New Adventure clears the backups ----
  const nav5 = page.waitForNavigation({ waitUntil: 'load', timeout: 60000 });
  await page.click('#tNew'); await nav5; await boot();
  const t5 = await title(), left = await backups();
  report('New Adventure (confirmed) clears the backups', !t5.cont && !t5.bak && left === '', `title has no Continue or backup; backups left: "${left}"`);

  report('no page errors', !errors.length, errors.join(' | ') || '0');
} finally { await close(); }

const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed (${target})`);
if (failed) { console.error('FAIL: backup saves'); process.exit(1); }
console.log('PASS: backups are kept each day, offered when the save fails, and cleared by New Adventure.');
