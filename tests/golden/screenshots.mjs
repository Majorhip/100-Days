// Reference screenshots: the same 6 views at High quality, 1600x900.
//
//   node tests/golden/screenshots.mjs [target] [--write]
//
// target  a game file path or URL (default: the original file)
// --write save into tests/golden/shots/ as the golden reference
//         (otherwise into tests/golden/shots-latest/, which git ignores, and each shot
//          is compared with its golden reference: mean colour difference per pixel)
//
// Every view loads tests/fixtures/save-v3.json with Continue, then the script sets the
// player's position, the time and the weather in the save state, freezes the clock
// (R.cinematic, as the game does in cut-scenes) and waits for the sky and fog to settle.
// Math.random is seeded in the test browser so repeat runs are close. Animals and wind
// still move, so expect small differences: these are checked by eye.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { launch, openGame, prepPage, ORIGINAL, ROOT, FIXTURE, SAVE_KEY, HIGH_SETTINGS } from './browser.mjs';

const argv = process.argv.slice(2);
const write = argv.includes('--write');
const target = argv.find(a => !a.startsWith('--')) || ORIGINAL;
const GOLD_DIR = join(ROOT, 'tests', 'golden', 'shots');
const OUT = write ? GOLD_DIR : join(ROOT, 'tests', 'golden', 'shots-latest');
mkdirSync(OUT, { recursive: true });

// yaw: 0 looks north (-z), +PI/2 looks west (-x). Pitch is negative to look down.
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
export const VIEWS = [
  { name: '1-meadow-noon', x: 20, z: 70, yaw: 0, pitch: -0.02, hour: 12, weather: 'clear' },
  { name: '2-dusk', x: 20, z: 70, yaw: Math.PI / 2, pitch: 0.02, hour: 18.9, weather: 'clear' },
  { name: '3-campfire-night', x: -57.5, z: 155, yaw: yawTo(-62.43 + 57.5, 151.04 - 155), pitch: -0.28, hour: 23, weather: 'clear', fire: 2 },
  { name: '4-frostpeak', x: -80, z: -105, yaw: yawTo(-20 + 80, -190 + 105), pitch: 0.08, hour: 11, weather: 'clear' },
  { name: '5-dust-flats', x: 160, z: 20, yaw: yawTo(222 - 160, -72 - 20), pitch: -0.03, hour: 13, weather: 'clear' },
  { name: '6-storm', x: 20, z: 70, yaw: 0, pitch: -0.02, hour: 14, weather: 'storm' }
];
const SETTLE_MS = 9000;

const raw = readFileSync(FIXTURE, 'utf8');
const { browser, close } = await launch({ gpu: true });
const meta = { target, date: new Date().toISOString().slice(0, 10), views: [] };
try {
  const { page, errors, hook } = await openGame(browser, target, { beforeLoad: { fn: prepPage, args: [SAVE_KEY, raw, HIGH_SETTINGS, 12345] } });
  meta.hook = hook;
  meta.gpu = await page.evaluate(() => {
    const gl = window.__stranded.R.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  await page.click('#tContinue');
  await page.waitForFunction(() => window.__stranded.R.started === true, { timeout: 60000 });
  meta.quality = await page.evaluate(() => window.__stranded.R.Q.n);

  for (const v of VIEWS) {
    await page.evaluate(v => {
      const { G, R, groundAt, lightFire } = window.__stranded;
      R.cinematic = true; R.invuln = 1e9;
      G.hour = v.hour; G.weather = v.weather; G.weatherHrs = 99;
      G.p.x = v.x; G.p.z = v.z; G.p.y = groundAt(v.x, v.z); G.p.vy = 0; G.p.yaw = v.yaw; G.p.pitch = v.pitch;
      R.ground = G.p.y;
      if (v.fire !== undefined) { const s = G.structures.find(q => q.id === v.fire); if (s && !s.d.lit) { s.d.fuel = Math.max(s.d.fuel, 8); lightFire(s); } }
    }, v);
    await new Promise(r => setTimeout(r, SETTLE_MS));
    const info = await page.evaluate(() => { const { G, R } = window.__stranded; return { fps: Math.round(R.fps || 0), biome: R.biome, hour: G.hour, weather: G.weather }; });
    const file = join(OUT, v.name + '.png');
    await page.screenshot({ path: file });
    meta.views.push({ ...v, ...info });
    console.log(`${v.name.padEnd(18)} ${info.biome.padEnd(7)} hour ${info.hour.toFixed(1)}  ${info.weather.padEnd(6)} ${info.fps} fps`);
  }
  meta.errors = errors;
  if (errors.length) console.warn('Page errors:\n  ' + errors.join('\n  '));

  if (!write) {
    // compare each shot with its golden reference in the same browser
    const cmp = await browser.newPage();
    console.log('\nmean colour difference vs golden (0 = identical, 255 = opposite):');
    for (const v of VIEWS) {
      const g = join(GOLD_DIR, v.name + '.png'); if (!existsSync(g)) { console.log(`  ${v.name}: no golden shot`); continue; }
      const a = readFileSync(g).toString('base64'), b = readFileSync(join(OUT, v.name + '.png')).toString('base64');
      const d = await cmp.evaluate(async (a, b) => {
        const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const px = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
        const pa = px(ia), pb = px(ib); let s = 0;
        for (let i = 0; i < pa.length; i += 4) s += Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
        return s / (pa.length / 4 * 3);
      }, a, b);
      v.diff = +d.toFixed(2); console.log(`  ${v.name.padEnd(18)} ${v.diff}`);
    }
  }
} finally { await close(); }

writeFileSync(join(OUT, 'shots.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`\nGPU: ${meta.gpu}\nQuality: ${meta.quality}\nSaved to ${OUT}`);
