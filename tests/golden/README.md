# Golden reference

What "the same game" means, recorded from `original/Stranded-100-Days-PC.html` (SHA-256 `F292FE87D7BFFA0EBD8E070A45CA67994509444A5462FF859A615CC61FC50B3A`) before anything was changed. Every script takes an optional target: a file path or a URL (for example `dist/index.html` or `http://localhost:5173/`). With no target it uses the original.

The scripts drive the Chrome installed on this PC through `puppeteer-core`, with a throwaway browser profile, so real saves are never touched.

**Everything at once:** `npm run parity` builds the game and runs every check below against `dist/index.html`, screenshots included (about 3–4 minutes). `node tests/golden/parity.mjs <target>` runs them against any build, for example the dev server.

| Check | Command | Pass |
|---|---|---|
| Built file | `npm run build`, then `node tests/golden/compare-build.mjs` | prints `PASS`: the modules put back together give the original script byte for byte, apart from the ledger's listed edits; every name resolves; standing rule kept; markup and CSS same |
| Island | `node tests/golden/fingerprint.mjs [target]` | prints `PASS` (hash identical, models included) |
| Save | `node tests/golden/savecheck.mjs [target]` | prints `PASS` (fixture loads; day, inventory, structures match) |
| New game | `node tests/golden/newgame.mjs [target]` | prints `PASS` (starts at the cove, walks, clock runs, zero page errors incl. shader errors) |
| Touch | `node tests/golden/touchcheck.mjs [target]` | prints `PASS` (as a touch phone: same detection, quality, buttons and start-up as the original) |
| Graphics | `node tests/golden/screenshots.mjs [target]` | shots in `shots-latest/` match `shots/` by eye, differences inside the noise baseline |

`--write` on `fingerprint.mjs` or `screenshots.mjs` re-records the golden files. Only do that from the original file.

## How the checks read the game
The checks read the game's state through `window.__stranded`:
- **From Phase 4 on**, this is the game's own read-only view: `src/main.js` sets it to `src/debug-exports.js`, which re-exports every module.
- **In Phase 3** it was the module namespace of `src/legacy.js`.
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

## Phase 4 result: the game split into 63 modules
`src/legacy.js` is gone. Every line of the original game script now lives in one of 63 modules:

| Folder | What's there (original section) |
|---|---|
| `core/` | maths, seeded RNG, noise, constants, model-building helpers (00_core) |
| `state.js` | `G` (saved), `R` (runtime), `newGameState`, `setG` |
| `gfx/` | graphics core (02a), quality tiers, textures, terrain, water, sky, weather, fx, grass, wildlife, post-processing, per-frame update (02b) |
| `audio/` | WebAudio synthesis (01) |
| `world/` | terrain, collision, sky keys (02); nodes and gathering (04) |
| `data/` | items, recipes, buildings, creatures, story text (03) |
| `models/` | animals, people, tools, structures (05) |
| `player/`, `game/survival.js`, `input/keyboard.js` | the player; the survival rules; keyboard and mouse (06) |
| `build/` | structures, placement, use and fire, update, sleep (07) |
| `creatures/` | creatures and AI, spawner and raids, Scout (08) |
| `story/` | props and chests, landmarks, Ray, quests (09) |
| `ui/` | `$`, HUD with its feedback, map, panels, settings (10) |
| `save.js`, `game/time.js`, `boot.js` | saving and settings; time and weather rules; boot, title, loop (11) |
| `input/touch.js` | phone and tablet support (12) |

### How the split is made and checked
- **Generated, not hand-split.** `tools/split/split.mjs` builds `src/` from three things: the original script; `tools/split/spec.mjs`, which says where each block goes and in which step; and the ledger. It works out each module's imports with a real JavaScript parser (acorn + eslint-scope), and it refuses a split that would break: if code in one module assigns to a variable declared in another, it stops. That's how the HUD stayed one file, because `updateHUD` clears a flag that `uiDirty` sets.
- **Load order is the original order.** Each module's first line is `import './<previous module>.js';`, and `src/main.js` imports only the last module. ES modules run depth-first, so all start-up code runs in the original top-to-bottom order, even though modules call each other in circles. That matters because some start-up code draws from shared counters (the world RNG, the model colour jitter). The fingerprint's **models** part (252 meshes, 69,048 vertices, vertex colours, the final jitter counter) would change if the order ever changed. It passes in the built file and on the dev server, where the browser's own module loader does the work.
- **`src/main.js` is the map.** It holds one `// @moved-to: <file>[#block]` line per block, in original order. `compare-build.mjs`:
  - expands them and requires the original script byte for byte;
  - parses all 63 modules and fails if any name isn't declared, imported or a browser global the original already used;
  - enforces the standing rule.
- **The ledger** (`tests/golden/approved-edits.mjs`) lists every change that isn't a plain move. There are five:
  1. `'use strict';` dropped, because modules are always strict.
  2. The `setG()` function added in `state.js` (MIGRATION.md §7).
  3. `G = mergeSave(s)` → `setG(mergeSave(s))` on Continue.
  4. `G = newGameState()` → `setG(newGameState())` on New Adventure.
  5. `window.__stranded = ALL;` in `main.js`, for the checks.

  ES module imports are live bindings, so after `setG` every module sees the new `G`. The save check proves this for Continue, and the new-game check, which requires a start at the cove, proves it for New Adventure.
- **Standing rule.** `src/game/` (survival, time) and `src/data/` must not use three.js or the page. In the two rules files, **11 lines** still read or write `R`, and their imports reach into `R`, the HUD, sound, saving, world and player code. Each one has a `// TODO(split)` note above it, as MIGRATION.md §4 asks, ready to untangle after the migration.
- **Proof the checks bite:**
  - changing a number (wolf health 42→43): caught
  - an extra code line: caught
  - a deleted marker: caught
  - `document` inside data: caught
  - a missing import (`setG`): caught by the name check, before it could become a runtime error on Continue

### Departures from MIGRATION.md, and why
- **`src/main.js` is the entry point and the map. Boot, title screen and game loop are in `src/boot.js`.** The plan put them in `main.js`, but the entry has to import only the last module for the load order to hold, and 12_touch runs after 11_main.
- **Shaders are still JavaScript strings, not `.glsl` files.** Most are built with interpolation, such as `${GLSL_HGT}` or `${HALF.toFixed(1)}`, so moving them into raw `.glsl` files changes code; it isn't a move, and the byte-for-byte check can't prove it. Best done after Phase 5, with the screenshots as the guard.
- **Saving and loading settings is in `save.js`**, as the plan's layout lists, although it sat in 10_ui in the original.
- **The phone and tablet code stays** (MIGRATION.md §11 leaves that open). `touchcheck.mjs` covers it.

### Changes to the checks during Phase 4
- **Screenshots** hold `R.sleeping` during each capture. Lightning only strikes while `!R.sleeping`, and one capture on a slow run caught the white strike overlay. The camera and rendering carry on.
- **The golden fingerprint was re-recorded from the original** to add the models part. All earlier parts kept their exact hashes.

### Phase 4 results (each step committed and pushed)
- Every step passed `compare-build`, island, save and new game on `dist/index.html`. Screenshots were taken at the visual steps (4.2, 4.3, 4.5, 4.6, 4.8, 4.9, 4.10, 4.12, 4.13, 4.14). The dev server was checked at 4.3, 4.6 and 4.14.
- **One stall at 4.3.** On the dev server, the new-game check lost its browser page when Chrome's graphics process stalled on an overloaded PC (11 fps at the time). The same check had just passed on the built file, and it passed again on an immediate rerun.
- **Final (4.14):**
  - Every check passes on `dist` and on the dev server.
  - Screenshots differ from golden by 1.3–4.7 on `dist` and 1.5–3.7 on dev. Storm is highest, at 4.7, the same as the original scored against itself under the same slow conditions (4.69).
  - Built file: 775,097 bytes.

### From here on
`tools/split/` regenerates `src/` from the original, so it's only for the migration. Once modules are edited by hand (Phase 5 onwards, or any later feature), stop running `split.mjs`. The byte-for-byte part of `compare-build.mjs` then becomes the record of what the migration did: retire it, or grow the ledger, with a reason for each entry. The island, save, new-game, touch and screenshot checks keep their value after the migration.
