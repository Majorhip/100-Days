// Measures the animal models' clips (facing, bite moment, walk and gallop ground speed) for
// CLIP_INFO in src/models/gltf-animals.js. Runs tools/animals/measure.js in the Vite dev server.
//
//   node tools/animals/measure.mjs [Name=height ...]     (default: Wolf=1.05)
//   FEET=<regex> picks other foot bones (default: the FF/FFB foot bones of the Ultimate pack)
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { launch, ROOT } from '../../tests/golden/browser.mjs';

const want = process.argv.slice(2).length ? process.argv.slice(2) : ['Wolf=1.05'];
const PORT = 5182;
const vite = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => { vite.stdout.on('data', d => { if (/ready|Local:/.test(String(d))) res(); }); vite.on('exit', c => rej(new Error('vite exited ' + c))); setTimeout(() => rej(new Error('vite did not start')), 60000); });
const { browser, close } = await launch({ gpu: false });
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/tools/animals/blank.html`);
  for (const w of want) {
    const [name, h] = w.split('=');
    const r = await page.evaluate(async (name, h, process_feet) => (await import('/tools/animals/measure.js')).measure('/assets/animals/game/' + name + '.glb', +h, process_feet ? { feet: new RegExp(process_feet) } : {}), name, h || 1, process.env.FEET || '');
    console.log(name, JSON.stringify(r));
  }
} finally { await close(); vite.kill(); }
