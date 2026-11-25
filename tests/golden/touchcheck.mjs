// Touch check: start the game as a touch phone (landscape) and start a new game.
// The phone/tablet code (src/input/touch.js) only runs on touch devices, so the desktop
// checks never exercise it. Compares the same facts for the original and the target.
//
//   node tests/golden/touchcheck.mjs [target]     (default: dist/index.html)
import puppeteer from 'puppeteer-core';
import { launch, prepPage, toUrl, ORIGINAL, SAVE_KEY } from './browser.mjs';

const target = process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html';
const PHONE = { viewport: { width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' };

async function probe(browser, t) {
  const page = await browser.newPage();
  const errors = [], dialogs = [];
  const step = s => console.log(`  [${t.slice(-28)}] ${s}`);
  page.setDefaultTimeout(90000);
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => { }); });
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.emulate(PHONE);
  // both runs share one profile (and file:// shares one origin): start each with no save
  await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) { } });
  await page.evaluateOnNewDocument(prepPage, SAVE_KEY, null, null, 4242);
  step('loading');
  await page.goto(toUrl(t), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => document.getElementById('loading').style.display === 'none', { timeout: 180000, polling: 250 });
  step('title screen');
  await page.evaluate(() => { if (!window.__stranded) window.__stranded = new Proxy({}, { get: (_, k) => typeof k === 'string' ? (0, eval)(k) : undefined }); });
  const before = await page.evaluate(() => ({ touch: window.__stranded.R.touch, quality: window.__stranded.R.Q.n, bodyTouch: document.body.classList.contains('touch'), buttons: document.querySelectorAll('.tb').length }));
  // start through the buttons' own handlers (a simulated tap can time out while the page renders)
  await page.evaluate(() => { setTimeout(() => document.getElementById('tNew').click(), 0); });
  await page.waitForSelector('#iSkip', { timeout: 30000 });
  step('intro');
  await page.evaluate(() => { setTimeout(() => document.getElementById('iSkip').click(), 0); });
  await page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000, polling: 250 });
  step('playing');
  await new Promise(r => setTimeout(r, 6000));
  const after = await page.evaluate(() => ({ started: window.__stranded.R.started, playing: document.body.classList.contains('playing'), hud: document.getElementById('hud').style.display !== 'none', tbtnsVisible: getComputedStyle(document.getElementById('tbtns')).display !== 'none' }));
  await page.close();
  if (dialogs.length) step('dialogs: ' + dialogs.join(' | '));
  return { before, after: { ...after, dialogs }, errors };
}

const { browser, close } = await launch({ gpu: true, width: 844, height: 390 });
let a, b;
try { a = await probe(browser, ORIGINAL); b = await probe(browser, target); } finally { await close(); }
const show = (n, r) => console.log(`${n.padEnd(9)} touch=${r.before.touch} body.touch=${r.before.bodyTouch} quality=${r.before.quality} buttons=${r.before.buttons} | after starting: started=${r.after.started} playing=${r.after.playing} hud=${r.after.hud} touch-buttons-shown=${r.after.tbtnsVisible} | errors=${r.errors.length}`);
show('original', a); show('target', b);
[...a.errors.map(e => 'original: ' + e), ...b.errors.map(e => 'target: ' + e)].forEach(e => console.log('  ' + e));
const same = JSON.stringify([a.before, a.after]) === JSON.stringify([b.before, b.after]);
if (!same || b.errors.length || !b.before.touch) { console.error('FAIL: touch mode differs from the original, or has errors'); process.exit(1); }
console.log('PASS: touch mode behaves the same as the original (detected, phone quality, touch buttons built and shown, a new game starts), zero page errors.');
