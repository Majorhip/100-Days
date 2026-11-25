// Saves: the real Phase 1 save (tests/fixtures/save-v3.json) loads into the built game with
// day, player, inventory, structures and world changes intact, and saving it round-trips
// exactly (fixture -> load -> save gives the fixture; load -> save again gives the same).
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { builtFile, runScript, ROOT } from './browser-run.js';

it('the fixture is a version 3 save under the unchanged key', () => {
  const s = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'save-v3.json'), 'utf8'));
  expect(s.v).toBe(3);
  const src = readFileSync(join(ROOT, 'src', 'core', 'constants.js'), 'utf8');
  expect(src).toContain("const SAVE_KEY = 'stranded100_v3';");   // Caspar's existing save lives under this key
});

it('the Phase 1 save loads with everything intact', () => {
  const r = runScript('savecheck.mjs', [builtFile()]);
  expect(r.out).toContain('PASS: save loads');
  expect(r.code, r.out).toBe(0);
});

it('saving round-trips exactly', () => {
  const r = runScript('roundtrip.mjs', [builtFile()]);
  expect(r.out).toContain('differences from the fixture: 0');
  expect(r.out).toContain('identical to A: true');
  expect(r.code, r.out).toBe(0);
});
