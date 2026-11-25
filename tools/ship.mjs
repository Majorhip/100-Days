// Phase 6: copy the built game to release/ under the original file name, so it can replace
// Caspar's copy one for one. Run through `npm run ship` (build, copy, then the save check).
import { copyFileSync, mkdirSync, statSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const from = join(ROOT, 'dist', 'index.html');
const to = join(ROOT, 'release', 'Stranded-100-Days-PC.html');
mkdirSync(join(ROOT, 'release'), { recursive: true });
copyFileSync(from, to);
const size = statSync(to).size, sha = createHash('sha256').update(readFileSync(to)).digest('hex').slice(0, 16);
console.log(`release/Stranded-100-Days-PC.html  ${(size / 1024).toFixed(0)} KB  sha256 ${sha}…`);
