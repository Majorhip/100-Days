// Helper for Vitest files that drive the built game in headless Chrome: run one of the
// tests/golden scripts against dist/index.html and return its exit code and output.
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..');
export const DIST = join(ROOT, 'dist', 'index.html');

export function builtFile() {
  if (!existsSync(DIST)) throw new Error('dist/index.html is missing: run `npm run build` first (or use `npm test`, which builds).');
  return DIST;
}
export function runScript(script, args = []) {
  const r = spawnSync(process.execPath, [join(ROOT, 'tests', 'golden', script), ...args], { cwd: ROOT, encoding: 'utf8', timeout: 280000 });
  const out = (r.stdout + r.stderr).split('\n').filter(l => !/could not be terminated|no running instance|operation attempted is not supported/.test(l)).join('\n');
  return { code: r.status, out };
}
export const builtAt = () => statSync(DIST).mtime.toISOString();
