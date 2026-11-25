// Shared helper for the golden-reference scripts: launch the installed Chrome with a
// throwaway profile (so real saves are never touched), open a build of the game and
// wait until the island has finished building and the title screen is showing.
import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = resolve(import.meta.dirname, '..', '..');
export const ORIGINAL = join(ROOT, 'original', 'Stranded-100-Days-PC.html');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

/** A file path or http(s) URL → URL the browser can open. */
export function toUrl(target) {
  if (/^https?:\/\//.test(target) || target.startsWith('file:')) return target;
  return pathToFileURL(resolve(target)).href;
}

/**
 * gpu: true asks Chrome to use the real graphics card (for screenshots);
 * false uses the software renderer (fine for the fingerprint, which never looks at pixels).
 */
export async function launch({ gpu = false, width = 1600, height = 900 } = {}) {
  const executablePath = CHROME_CANDIDATES.find(p => existsSync(p));
  if (!executablePath) throw new Error('No Chrome/Edge found. Set CHROME_PATH.');
  const userDataDir = mkdtempSync(join(tmpdir(), 'stranded-golden-'));
  const args = [
    `--window-size=${width},${height}`,
    '--autoplay-policy=no-user-gesture-required',
    '--allow-file-access-from-files',
    '--ignore-gpu-blocklist',
    '--hide-scrollbars',
    '--mute-audio'
  ];
  if (gpu) args.push('--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-swiftshader');
  else args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  const browser = await puppeteer.launch({
    executablePath, userDataDir, headless: true, args,
    defaultViewport: { width, height, deviceScaleFactor: 1 }
  });
  const close = async () => { await browser.close(); try { rmSync(userDataDir, { recursive: true, force: true }); } catch { } };
  return { browser, close };
}

export const SAVE_KEY = 'stranded100_v3';
export const FIXTURE = join(ROOT, 'tests', 'fixtures', 'save-v3.json');

/**
 * Runs in the page before the game's own script. Puts a save and settings into this
 * throwaway profile's localStorage, and optionally replaces Math.random with a seeded
 * generator so runs are repeatable. Nothing in the game file changes.
 * settings: quality 3 = High, locked (gfxManual) so auto-tuning can't change it;
 * drag-to-look so headless Chrome doesn't need pointer lock; sound off.
 */
export function prepPage(key, save, settings, seed) {
  try {
    if (save) localStorage.setItem(key, save);
    if (settings) localStorage.setItem(key + '_set', JSON.stringify(settings));
  } catch (e) { }
  if (seed) {
    let a = seed >>> 0;
    Math.random = function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
}
export const HIGH_SETTINGS = { sens: 1, vol: 0, music: false, quality: 3, drag: true, gfxV: 2, gfxManual: true };

/** Open the game and wait for the title screen. Throws if the island failed to build. */
export async function openGame(browser, target, { beforeLoad } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  if (beforeLoad) await page.evaluateOnNewDocument(beforeLoad.fn, ...(beforeLoad.args || []));
  await page.goto(toUrl(target), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => {
    const l = document.getElementById('loading'), t = document.getElementById('title');
    return (l && /went wrong|can't show/.test(l.textContent)) || (t && t.style.display === '' && l.style.display === 'none');
  }, { timeout: 180000, polling: 250 });
  const failed = await page.evaluate(() => { const l = document.getElementById('loading'); return l.style.display === 'none' ? null : l.textContent; });
  if (failed) throw new Error('Game failed to boot: ' + failed);
  return { page, errors };
}
