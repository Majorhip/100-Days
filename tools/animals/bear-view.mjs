// Contact sheets for checking the bear rig and its clips by eye (tools/animals/bear-view.js):
// orthographic views with the skeleton drawn on top, one row per moment of the clip.
//
//   node tools/animals/bear-view.mjs <out.png|out.jpg> <file> [clip] [frames] [views] [span] [bones]
//   node tools/animals/bear-view.mjs --jobs "<out>|<file>|<clip>|<frames>|<views>|<span>|<bones>" ...
//     file    e.g. /assets/animals/game/Bear.glb (served by Vite)
//     clip    a clip name, or - for the bind pose
//     frames  a count (spread over the clip) or a list of times "0,0.2,0.4"
//     views   side,right,front,back,top,under,three,threeB
//     bones   1 skeleton on top, 0 none, w colour the vertices by their bones
//     center  what the cameras look at, "x,y,z" (default 0,0.7,0); span: metres in view
//   DUMP=<regex> prints the world positions of matching bones, and any vertex below the ground.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, ROOT } from '../../tests/golden/browser.mjs';

const argv = process.argv.slice(2);
const jobs = argv[0] === '--jobs' ? argv.slice(1).map(j => j.split('|')) : [argv];
const PORT = 5183;
const vite = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => { vite.stdout.on('data', d => { if (/ready|Local:/.test(String(d))) res(); }); vite.on('exit', c => rej(new Error('vite exited ' + c))); setTimeout(() => rej(new Error('vite did not start')), 60000); });
const { browser, close } = await launch({ gpu: true, width: 1800, height: 1000 });
try {
  for (const [out, file, clipArg = '-', frames = '1', views = 'side,front,top', span = '2.6', bones = '1', center = '0,0.7,0'] of jobs) {
    const clip = clipArg === '-' ? '' : clipArg;
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('page error:', e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.error(m.text()); });
    await page.goto(`http://localhost:${PORT}/tools/animals/blank.html`);
    const r = await page.evaluate(async (file, clip, frames, views, span, bones, dump, center, jpeg) => {
      const V = await import('/tools/animals/bear-view.js');
      const times = frames.includes(',') ? frames.split(',').map(Number) : +frames;
      return V.sheet({ file, clip, times, views: views.split(','), span: +span, bones: bones === '1', weights: bones === 'w', cell: [520, 380], dump: dump ? new RegExp(dump) : null, center: center.split(',').map(Number), jpeg });
    }, file, clip, frames, views, span, bones, process.env.DUMP || '', center, /\.jpe?g$/i.test(out));
    writeFileSync(resolve(out), Buffer.from(r.dataUrl.split(',')[1], 'base64'));
    console.log(out, clip || 'bind pose', 'at', r.times.join(' '));
    for (const row of r.info) console.log(JSON.stringify(row));
    await page.close();
  }
} finally { await close(); vite.kill(); }
