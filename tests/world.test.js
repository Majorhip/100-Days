// The island is identical to Phase 1: terrain heights, every tree/rock/pickup, their tints,
// the lakes, the landmark sites, the start point and every model (shape and vertex colours).
// Drives dist/index.html in headless Chrome (tests/golden/fingerprint.mjs).
import { it, expect } from 'vitest';
import { builtFile, runScript } from './browser-run.js';

it('world fingerprint matches the golden reference from the original file', () => {
  const r = runScript('fingerprint.mjs', [builtFile()]);
  expect(r.out).toContain('PASS: island identical to the golden reference.');
  expect(r.code, r.out).toBe(0);
});
