# Golden reference

What "the same game" means, recorded from `original/Stranded-100-Days-PC.html` (SHA-256 `F292FE87D7BFFA0EBD8E070A45CA67994509444A5462FF859A615CC61FC50B3A`) before anything was changed. Every script takes an optional target: a file path or a URL (for example `dist/index.html` or `http://localhost:5173/`). With no target it uses the original.

The scripts drive the Chrome installed on this PC through `puppeteer-core`, with a throwaway browser profile, so real saves are never touched.

| Check | Command | Pass |
|---|---|---|
| Built file | `npm run build`, then `node tests/golden/compare-build.mjs` | prints `PASS` (moved code puts back together into the original byte for byte; only imports, exports and comments added; markup and CSS same) |
| Island | `node tests/golden/fingerprint.mjs [target]` | prints `PASS` (hash identical) |
| Save | `node tests/golden/savecheck.mjs [target]` | prints `PASS` (fixture loads; day, inventory, structures match) |
| New game | `node tests/golden/newgame.mjs [target]` | prints `PASS` (starts, walks, clock runs, zero page errors incl. shader errors) |
| Graphics | `node tests/golden/screenshots.mjs [target]` | shots in `shots-latest/` match `shots/` by eye, differences inside the noise baseline |

`--write` on `fingerprint.mjs` or `screenshots.mjs` re-records the golden files. Only do that from the original file.

## How the checks read the game
The checks read the game's state through `window.__stranded`:
- **From Phase 3 on**, this is the game's own read-only export: `src/main.js` sets it to the module namespace of `src/legacy.js`.
- **For the original single file**, which has no such export, `browser.mjs` adds an equivalent shim. It uses indirect `eval` at global scope, which can read a classic script's top-level `const`, `let` and functions.

The output says which one was used.

## World fingerprint (`world-fingerprint.json`)
These are SHA-256 hashes of:
- the exact terrain heights (201 × 201)
- every node's type, position, scale, rotation and HP (2,909 nodes)
- each node's colour tint, which is drawn from the world RNG straight after placement, so it catches a change in RNG call order
- the lakes
- the landmark sites, including their flattened heights
- the start point

There's an overall hash plus one hash per part, so a failure names what changed. Checked: two runs give the same hash, and bumping `WORLD_SEED` by one fails it.

## Save fixture (`../fixtures/save-v3.json`)
This is a real version 3 save: Day 10, Level 7, 32 item types, 27 structures (house, a bed, a bench, two campfires), 23 changed nodes and 3 bosses killed.

## Screenshots (`shots/`)
These are six views at **High**, 1600 × 900, captured on an Intel UHD 620 (D3D11):
1. meadow at noon
2. dusk
3. campfire at night
4. Frostpeak
5. Dust Flats
6. storm

Each view loads the fixture save, sets the position, time and weather, freezes the clock and waits 9 s for the sky and fog to settle.

**Seeding:** `Math.random` is seeded in the test browser only, and the sequence **restarts when the game boots** (the `load` event). The game uses `Math.random` for purely visual things, such as where grass blades and flowers grow and where animals wander, so in real play these differ on every load. three.js also draws random numbers for object IDs while it loads, and how many depends on the three.js build: 120 calls for the original's embedded copy, 112 for npm's tree-shaken one. Without the restart at boot, every build would plant a different meadow. The golden shots were re-recorded from the original with this seeding during Phase 3.

**Noise baseline:** recapturing the unchanged original gives a mean colour difference of **0.7–3.4** (out of 255) per shot. The storm view is the noisiest, from rain and gusts, followed by the meadow (grass sway). A real visual change shows up well above that, and you should still look at the images.

## Phase 2 result (Vite scaffold)
- `compare-build.mjs` (Phase 2 version) passed:
  - Both inline scripts in `dist/index.html` were byte-identical to the original, and so were the CSS text and the markup.
  - The only extra was Vite's trailing `/*$vite$:1*/` CSS comment.
  - Size: 959,144 bytes, against 959,102.
- The fingerprint and save check passed against `dist/index.html` opened from disk and against `npm run dev`. The screenshots matched by eye.
- On the dev server the browser asks for `/favicon.ico` and gets a 404. The original has no favicon either, so the checks ignore that request.

## Phase 3 result (lift and shift)
- **`compare-build.mjs` passes:**
  - `src/legacy.js` is the original game script byte for byte, plus two added lines: `import * as THREE from 'three';` at the top, and a read-only `export { … }` at the bottom.
  - three.js is npm `three@0.128.0`.
  - The built page has the original markup and CSS, and one inlined module script.
- **The built file is 768,910 bytes**, against 959,102. The difference comes from minification and from dropping the parts of three.js the game doesn't use.
- **The fingerprint, save check and new-game check pass** on `dist/index.html` opened from disk and on `npm run dev`.
- **Screenshots of the build differ from golden by 0.8–3.2**, inside the original's own 0.7–3.4, and match by eye.

## Moving code in Phase 4: the marker rule
Every block of code that leaves `src/legacy.js` (or any later file) is moved **verbatim**:
- **In the file it leaves**, one line stays behind in its place: `// @moved-to: src/data/items.js`.
- **In the new file**, the code sits between `// @moved-from: legacy.js` and `// @end-moved`. Outside those markers, a file may only contain comments, blank lines, `import … from '…';` and `export { … };`.
- **`compare-build.mjs`** expands every marker (recursively), and the result must contain the original game script byte for byte. It prints every added code line.

It also enforces the standing rule: nothing in `src/data/` or `src/game/` may import three.js, mention `THREE`, or use `document.`, `window.`, `localStorage.`, `navigator.`, `R.` or `GFX.`.

Tested by four deliberate bad edits, each caught with the exact line:
1. wolf health 42→43
2. an extra code line outside a moved block
3. a deleted marker
4. `document` inside data

An edit that has to change code, not just move it (MIGRATION.md §7, e.g. `G = mergeSave(...)`), will fail this check on purpose. Such edits must be listed and explained when they come.

## Phase 4.1 result: `03_data` → `src/data/`
- `items.js` (`ITEMS`, `HOTBAR`, `HANDS`), `recipes.js`, `buildings.js` (`BUILDS`, `BUILD_BY_ID`), `creatures.js`, `story.js` (`NOTES`, `DIALOGS`, `INTRO`, `LANDMARKS`, `BADGES`, `TIPS`).
- These constants depend on nothing else in the game and do nothing while loading, so loading them before the rest of the game (as imports) changes nothing.
- `compare-build` passes. The fingerprint, save and new-game checks pass on `dist` and on the dev server. Screenshots differ from golden by 0.7–3.6, matching by eye; storm at 3.6 is rain-streak placement.
