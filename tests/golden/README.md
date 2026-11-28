# Golden reference

What "the same game" means, recorded from `original/Stranded-100-Days-PC.html` (SHA-256 `F292FE87D7BFFA0EBD8E070A45CA67994509444A5462FF859A615CC61FC50B3A`) before anything was changed. Every script takes an optional target: a file path or a URL (for example `dist/index.html` or `http://localhost:5173/`). With no target it uses the original.

The scripts drive the Chrome installed on this PC through `puppeteer-core`, with a throwaway browser profile, so real saves are never touched.

**Quick set:** `npm run check` (about 1–2 minutes): build, the build check, the rules tests, island, save and the core smoke steps. Use it while working.

**Everything at once:** `npm run parity` builds the game and runs every check below against `dist/index.html`, screenshots included (about 3–4 minutes). `node tests/golden/parity.mjs <target>` runs them against any build, for example the dev server.

| Check | Command | Pass |
|---|---|---|
| Built file | `npm run build`, then `node tests/golden/compare-build.mjs` | prints `PASS`: LF line endings, every name resolves, the rules code is pure, three.js r128, one self-contained page. (Until 27 Nov 2026 it also rebuilt the original script byte for byte; see the end.) |
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

## Phase 5: tests worth having
**`npm test`** builds the game, then runs Vitest. **`npm run parity`** builds, then runs every browser check below, screenshots included.

| Test | What it proves |
|---|---|
| `tests/survival.test.js` | **27 tests**, Node, under a second. Runs the real survival rules (`src/game/survival.js`) with small stand-ins for what they still reach into (the TODO(split) list). It pins:<br>• hunger 3.0/h and thirst 3.8/h; sprinting ×1.6/×1.5; asleep ×0.5; desert heat doubles thirst<br>• warmth: comfort at 14°, +11/h, +34/h by a fire, cold loss 0.85 per degree<br>• health: +2.5/h awake, +4 sheltered or +7 in bed asleep; −5 starving, −7 thirsty, −9 frozen<br>• blackouts (cold, then thirst, then hunger); a floor of 5 health while asleep<br>• every ambient-temperature rule<br>• the 30 Hz tick adds up to the same result as one big step<br>• cooked against raw food values<br>Changing one rate (hunger 3.0 → 3.1) made 6 tests fail. |
| `tests/world.test.js` | The island fingerprint, models included, matches the original. |
| `tests/save.test.js` | • The Phase 1 save loads.<br>• It **round-trips exactly**: loading it and saving straight away gives back the fixture with no differences, and doing it again gives the identical text (`roundtrip.mjs`).<br>• The save key is unchanged (`stranded100_v3`). |
| `tests/smoke.mjs` | Headless Chrome on the real graphics card, using the game's own functions, with zero page errors allowed. 16 steps:<br>• a new game<br>• chop a tree (pine, 5 swings, 4 wood)<br>• build and light a campfire<br>• a night with two wolves<br>• a storm<br>• sleep until 06:05 the next day<br>• swim: float in Mirror Lake (eyes 0.4 m above the water, 3.2 m bed below), swim across it, walk in from the bank and back out<br>• all three biomes<br>• all four graphics levels<br>The original passed the 14 steps from before swimming with the same results; it fails the three swim steps, because it walks along the lake bed. |

**Balance targets.** "Energy" in MIGRATION.md is the food meter.
- **What the tests prove:**
  - A standard day (15 h awake, 9 h asleep) costs **58.5 energy**.
  - Breaking even takes 9.8 berries, or 3.9 roast mushrooms, or 1.8 cooked fish, or 1.5 cooked meat.
  - Cooking triples mushrooms, quadruples fish and nearly quadruples meat (×3.8).
- **What they can't prove yet:** the four targets themselves (forage only ≈ −36, fire + cooked forage ≈ −2, fire + fishing ≈ −9, hunting + fire ≈ 0). They depend on what a typical forage, fishing or hunting day gathers, and that model isn't in the repository. Inventing one that lands on these numbers would prove nothing, so this is marked `todo` in `survival.test.js` until the original day model turns up.
- **Water depth (fixed after the migration, see Swimming below):** in deep water the original walked the player along the lake bed (Mirror Lake: 3.2 m down).

## Export / Import save (the first feature after the freeze)
MIGRATION.md §7 asks for this as insurance before the game goes to Caspar. Saves live in the browser, and a new copy of the game file may not see them.
- **Pause menu:** 📤 **Export save** downloads `stranded-day<N>-<date>.json`, after saving first. 📥 **Import save** checks the file is a version 3 Stranded save, asks before replacing anything, then restarts at the title, where Continue picks it up.
- **Title screen:** 📂 **Load a save file**, for a copy of the game with no save yet. After it, the title offers Continue.
- **The code** is in `src/ui/savefile.js`. `src/main.js` imports it after the whole game has loaded, so it can't change the original load order. It catches clicks on its own buttons, so the game's click handling is untouched.
- **In the ledger:** the new module, plus the buttons added to the two HTML strings. That's 3 entries, 8 in total.
- **`savefile.mjs`** tests it the way a player would, using real clicks, the real file picker and the real confirm box. 6 out of 6 pass:
  1. Export gives the Day 10 game: 32 item types, 27 structures.
  2. Import of a Day 12 save asks first, and Continue then loads Day 12.
  3. Cancel in the confirm box changes nothing.
  4. A copy with no save offers Continue after Load a save file.
  5. A file that isn't a save is refused with a message.
  6. Zero page errors.

## Swimming
In the original, the player was stopped where the water got 1.25 m deep, but a lake bank, a teleport or a blackout could still put them deeper, and then they walked along the bed with the camera under water.
- **Now:** in water deeper than 1.2 m the player floats, eyes 0.4 m above the surface (the same eye height as standing). Jumping in from a height dips under and bobs back up, with a splash.
- **Stamina:** swimming uses ⚡ stamina, 2.5 a second while moving and 1 a second treading water: about 40 s of swimming from full. With none left, the player loses 4 health a second until they reach the shore. A blackout that way says so (`drown`).
- **The open sea** deeper than 4.5 m (about 30 m past the beach) still stops the player: "The sea is too rough out here." The lakes are at most 3.2 m deep, so all of them can be swum.
- **Wading:** the eyes stay at least 0.4 m above the water. The original crouched to 1.25 m, which put the camera at the waterline in waist-deep water, flickering under it with the waves.
- **Backpack:** a blackout in deep water drops the backpack on the nearest shore, not the lake bed.
- **Code:** `src/player/swim.js` (new module), called from `updatePlayer()`; 7 ledger entries.
- **Tests:** the three swim steps in `tests/smoke.mjs`.

## Animated animals (ANIMALS.md), step A: the wolves
- **Models:** Quaternius's Wolf (CC0), slimmed by `node tools/animals/build.mjs` from `assets/animals/raw/` to `assets/animals/game/Wolf.glb` (964 KB to 378 KB: the 8 clips used, no duplicates). Vite embeds it in the game file (about +0.5 MB).
- **Code:** `src/models/gltf-animals.js` (new module) makes each creature's model and plays its clips; `src/models/gltf-load.js` starts parsing at file open. 6 ledger entries in `src/creatures/creatures.js` hook it in, and 1 adds the credit on the title screen.
- **Recolours:** the red wolf (Wolf Moon) and the snow wolf use the same model with their old colours and glowing eyes (yellow, red, blue), and keep their old sizes, so reach and collision are unchanged.
- **Animation:** walk and gallop are sped up or slowed to the creature's speed. The numbers come from `node tools/animals/measure.mjs` (feet: 1.04 m/s walking, 3.15 m/s galloping at the clip's own pace). The Attack clip starts so that the head is furthest forward when the game deals the bite: the bite timing itself is unchanged. Then come a hit react when struck while standing or walking, and the Death clip before the old 0.45 s shrink.
- **Fallback:** if the model is not loaded yet, or fails, `gltfAnimal()` returns null and the creature gets its hand-built model.
- **Island fingerprint:** unchanged, because no creature exists until a game starts.
- **Tests:** the `animated wolves` step in `tests/smoke.mjs` spawns all three. It checks they play clips and bite, then kills them and checks the Death clip, their removal, the loot, and that a bear keeps its hand-built model. `node tools/animals/wolves.mjs <dir>` takes the screenshots in `docs/animals/wolves/`.

## Animated animals, step B: deer, fox, Scout
- **Deer:** each one is a doe (65%) or a stag (35%), picked at random (`variants` in `src/models/gltf-animals.js`). The behaviour is unchanged.
- **Fox (new):** `fox` in `src/data/creatures.js` is shy (runs from 14 m) and quick (7.4 m/s), with 1 raw meat and 1 fur. One spawns in the forest; on Frostpeak it's a white arctic fox (`model: 'arcticfox'`). The original had no fox, so its `fallback` is a box fox for when the model is not loaded.
- **Scout:** the Shiba Inu, coloured like the old Scout, with a red collar (a ring on the neck bone). He is built with the island, before the models load, so `upgradeScout()` swaps the model on his first update. The island fingerprint stays the same because the title screen still shows the original.
- **Code:** speeds scale with each model's height (`CLIP_INFO.at`). Deer use `Attack_Headbutt`. The models add about 2.1 MB to the game file, which is now 3.5 MB. There are 5 ledger entries.
- **Tests:** the `deer, fox and Scout` smoke step checks both deer models, the foxes' models, that the foxes flee, their loot, Scout's model and collar, and the box-fox fallback. `node tools/animals/familiar.mjs docs/animals/familiar` takes the screenshots.

## Animated animals, step C: new wildlife
- **Creatures** (`src/data/creatures.js`):
  - **Wild boar** (the Pig, tinted): peaceful until hit, then charges for up to 30 m. 3 raw meat, 1 hide.
  - **Snake:** bites if you come within 4 m. 1 hide.
  - **Crab:** pinches if you come within 2.5 m. 1 raw meat, 1 chitin.
  - **Cave spider:** hostile and stays near its cave. 2 fibre.
  - **Frog** and **bat:** harmless.
  - **New data fields:** `calm` (an idle one doesn't stop you sleeping), `lose` (how far a chase goes) and `hiss`.
- **Places** (`src/creatures/wildlife.js`, called from `updateSpawner()`):
  - **Forest:** 1 boar.
  - **Desert:** up to 2 snakes (1 at night).
  - **Beaches:** up to 3 crabs, on sand away from the lakes and not in the snow.
  - **Lake banks:** up to 3 frogs.
  - **Grotto and mine:** 2 spiders each, as lairs that come back 5 days after they're killed.
  - **Grotto, mine and bear cave:** 3 bats each at night, which leave by day.
- **Models** (`tools/animals/build.mjs`): the build renames these models' clips to the game's names (Idle, Walk, Attack, Death...). Missing clips fall back: no Gallop plays Walk, and no Death just shrinks.
  - **Turned round:** the snake, crab and spider face backwards in their files (`turn`).
  - **Bats:** fly 1.7 m up, bobbing (`fly`).
  - **Boar:** a textured model, tinted brown.
  - **Speeds:** these models' foot bones don't measure reliably, so their walk speeds are set by eye.
- **Checks:**
  - `posedBox` now lives in `src/models/posed-box.js` (three.js only), so `tools/animals/measure.mjs` can load it without the game. It skips the Crab's few vertices with broken weights.
  - Ledger: the creature data entry is anchored on the goat line, because step B's fox entry already replaces the deer line.
  - Size: the game file is 5.8 MB.
- **Tests:** the `new wildlife` smoke step checks:
  - every model loads
  - calm animals don't block sleep
  - the boar ignores you until hit, then chases
  - the loot is right
  - lake banks and beaches are found
  - spiders and bats appear at the grotto at night, and the bats leave by day

  `node tools/animals/wildlife.mjs docs/animals/wildlife` takes the screenshots.

## Animated animals, step D: herds and water
- **Herds** (`src/creatures/wildlife.js`): 2–4 wild horses in the forest by day (brown or white, at random), donkeys in the desert, and alpacas on Frostpeak by day.
  - **Behaviour:** they're shy and not for hunting: no loot.
  - **Staying together:** a member more than 9 m from the rest of its herd heads back (`keepHerds`).
- **The shark** (`src/creatures/sea.js`):
  - **When it comes:** after 5 s of swimming in deep sea water (ground below −2.6 m, away from the lakes), a shark appears about 22 m further out to sea, with a tip.
  - **How it attacks:** it circles closer, charges and bites for 12, then circles again.
  - **When it leaves:** it gives up when you reach water shallower than 1.6 m or the land, and it swims off when badly hurt.
  - **Fighting back:** it can be hit and shot, and drops 3 raw fish.
  - **How it moves:** land creatures refuse water, so `updateCreatures()` hands it to `updateShark()` (`def.sea`).
- **Fish** (`src/creatures/sea.js`): a school of 5–8 swims in each lake near the player, just under the surface in water about 1.5 m deep. The lake water is nearly opaque over deeper water, so they keep to where you can see them. Every 4–9 s one leaps out with a splash. They are only scenery.
- **Code:** `updateSea(dt)` runs in the game loop. There are 3 ledger entries plus the new module. The creature data is anchored on the wolf line, because the lines above it are other entries' anchors. The game file is 8.7 MB.
- **Tests:** the `herds, shark and fish` smoke step checks:
  - both horse models and the herd models
  - that a stray rejoins its herd and that herds drop no loot
  - that the shark comes in deep sea water, bites, and gives up when you're back on land
  - that the fish swim in Mirror Lake

  `node tools/animals/water.mjs docs/animals/water` takes the screenshots.

## The bears
- **Models:** `Bear`, `Grizzle` and `Frostclaw.glb` were rigged and animated from "Black bear" by Poly by Google (CC BY 3.0) by `tools/animals/rig-bear.mjs`. The README in `docs/animals/bears/` covers the clips and numbers.
- **Credit:** CC BY needs one, so the title screen credits the model, with a link and a note that it was changed. This is a change to the existing Quaternius credit entry in the ledger.
- **Clips:** `src/models/gltf-animals.js` plays extra clips for the bosses:
  - their 0.95 s wind-up ('tele') plays Roar before a charge, or Slam before Frostclaw's jump; Slam starts so its paws land when the wind-up ends
  - 'charge' plays Gallop
  - a dizzy boss ('stun') lets the slam finish
  - the red-orange glow during the wind-up is the original's warning
- **Code:** no ledger entries apart from the credit; all the changes are in the module.
- **Tests:** the `bears and boss moves` smoke step checks the three models, Grizzle's roar then gallop, and Frostclaw's slam. The wolf step now uses a goat as the creature that is still hand-built. `node tools/animals/bosses.mjs docs/animals/bosses` takes the screenshots.

## After the animals: loading bar, rarer finds and animals
- **Loading bar** (`src/ui/loading.js`): the original built the island and then compiled all 37 shaders on the first frame. That was one freeze of 10–20 s, and Chrome could offer to kill the "unresponsive" page.
  - `initWorld()` now pauses between its steps (`loadStep`), so the bar moves.
  - `warmUp()` then compiles the shaders one material at a time, including the animals and the post-processing passes (47 shaders in all, so the first wolf no longer stutters). It then draws the first frame behind the loading screen.
  - Measured on this PC: the longest freeze went from 8.9 s to 1.4 s.
  - During a pause, other code (the animal models finishing parsing) may draw random numbers. Those come from a separate generator, so the island's random sequence is unbroken and the island fingerprint still matches the original.
- **Rarer finds** (`src/world/rarity.js`): the island is laid out exactly as before, with the same `NODES` and the same save indices, so the fingerprint and old saves still match. Then only a share of each small find is really there:
  - sticks and stones 55%, flint 65%, mushrooms 50%, herbs 65%, berry bushes 60%, reeds 70%
  - Which ones stay is fixed by index, with no random numbers. Everything within 40 m of the start stays, for a fair first day.
  - A missing find is hidden, can't be picked, never grows back (`restoreNode` ignores it, even if an older save lists it), and leaves no bare patch in the grass.
- **Rarer animals:** each kind has a smaller cap and a chance per second that one turns up, instead of the original's instant refill:
  - common: rabbits, goats, crabs, frogs
  - uncommon: deer, scorpions, snakes
  - rare: boars, foxes, and the herds (about one every 3 minutes in their biome)
  - Night wolves and snow wolves still come, one at a time. Dens, lairs, bosses and raids are unchanged.
- **Tests:** the `rarer finds and animals` smoke step checks the share of each kind, that none are missing near the start, that missing finds are hidden, can't be picked and don't regrow, and the caps.

## Phase 6: ship
- **`npm run ship`** builds the game, copies it to `release/Stranded-100-Days-PC.html` (the original file name, so it replaces Caspar's copy one for one; `release/` is not in git), then runs `ship.mjs`.
- **`ship.mjs`** plays it the way Caspar will, in one browser profile. 7 out of 7 pass:
  1. The original file, opened from a folder, starts a game and saves it with its own code (Day 9, 13 wood).
  2. The release file put in its place (same name, same folder): the title offers Continue (Day 9), Continue loads Day 9 with the 13 wood, zero page errors.
  3. The release file opened from a different folder, as if freshly downloaded: the same three checks.
- **Why it works:** the save key is unchanged (`stranded100_v3`), and Chrome and Edge give every local file one shared storage. Firefox and Safari may keep each file apart. The original has no Export button, so in those browsers check on Caspar's computer before deleting the old copy.

### From here on
- **The migration is over.** `tools/split/split.mjs` now refuses to run, because `src/` holds code added after the migration and regenerating it from the original would delete that code.
- **Edit modules directly.** Until 27 Nov 2026 each change to original code also needed a ledger entry; that rule is retired (see the last section).
- **The other checks keep their value:** island, save, round trip, save files, new game, touch, smoke and screenshots.

## After the migration: lighter checks (27 Nov 2026)
**What changed:**
- **The byte-for-byte rebuild is retired.** `compare-build.mjs` no longer puts the original script
  back together from `src/`. That proved the migration was a pure move, but it made every
  gameplay tweak need a ledger entry.
- **What the build check still does:** it checks names, the standing rule (now with no exceptions)
  and three.js, checks that the page is self-contained, and rejects CRLF and BOMs.
- **What it no longer compares:** the markup and CSS with the original.
- **The ledger is frozen:** `approved-edits.mjs` stays as the record of what the migration
  changed. Nothing reads it any more.
- **The rules code is untangled.** The 11 `TODO(split)` lines are gone.
  - `src/game/survival.js`: `ambientTempRule(c)` takes the conditions where the player stands
    and returns `{ T, heat }`. `survivalStepRule(gh, ctx)` takes the temperature and returns the
    blackout cause.
  - `src/game/time.js`: `advanceClock(gh, quiet, on)` and `rollWeather(quiet, on)` change only
    `G` and report a new day or a weather change through the `on` handlers, at the moment it
    happens.
  - **The bridges:** `src/player/climate.js` and `src/world/days.js` keep the old calls,
    `ambientTemp()`, `survivalStep()`, `advanceTime()`, `nextWeather()` and `onNewDay()`,
    with the same effects, so the game loop, sleeping and blackouts are unchanged.
- **Tests:**
  - `tests/survival.test.js` tests the rules straight, with no stand-ins for the world or the
    gear. It has 26 tests; the old test that `R.temp` was set moved to the bridge.
  - `tests/time.test.js` is new: the clock, the day roll-over, the weather chain and when a change
    is reported.
- **`npm run check` is new.** It's `parity.mjs --quick` plus the rules tests. The quick smoke run
  covers: new game, chop, fire, rarer finds, storm, sleep, desert.

## Step 2: smaller game file (27 Nov 2026)
**The packing:** `tools/animals/pack.mjs` packs `assets/animals/game/*.glb` into
`assets/animals/packed/*.glb`, which the game embeds.
- **Compression:** meshopt (`EXT_meshopt_compression` with `KHR_mesh_quantization`).
- **Textures:** WebP, still 1024 px.
- **Sizes:** the models went from 7.44 MB to 2.57 MB, and the game file from 11.26 MB to 4.46 MB.
- **Decoding:** three.js r128 decodes the models with the meshopt decoder that ships with three. The
  encoder (npm `meshoptimizer`, MIT) is a dev tool only.
- **The game side:** `gltf-animals.js` turns the quantised vertex data back into floats at load
  (`unquantize`), so `posedBox` still sizes the models from their vertices.
- **The name guard:** the pack fails if any material, mesh, node or clip name changes. It does not
  use `dedup()`.

**A bug it exposed, now fixed:** the bat's eyes (a plain mesh) and part of its body (a skinned mesh)
share the material "Main".
- **Before:** the game made one material per name, so that part of the body was drawn without its
  skeleton. In the old files that only froze it in place.
- **With packing:** the mesh's size moves into the skeleton, so the same mistake drew a giant bat.
- **The fix:** skinned and plain meshes now get separate copies. The bat's whole body flaps again.

**Checked:**
- **Sizes:** the posed size of all 21 animal kinds, both variants each (42), matches the old build
  to within 1 mm.
- **Screenshots:** two rows of 16 animals, plus close-ups of the bat, spider, frog, Grizzle and
  Frostclaw, look the same by eye, except that the bat now flaps properly.
- **Start-up:** time to the title screen went from 10.5 s to 9.6 s on this PC. The models load in the
  background, so the world and shader warm-up still take most of the start-up time.

## Step 3: backup saves (27 Nov 2026)
**How backups are kept:** `src/backups.js`.
- **Each new day:** when a save starts a new day, `saveGame()` first keeps the last save of the
  day before as a backup.
- **Three kept:** `stranded100_v3_bak1` (newest), `_bak2` and `_bak3`.
- **The main save key is unchanged.**

**Recovering a game:**
- **The title offers the newest backup** that reads (⏪ Load your backup), whenever:
  - there is no main save that reads, or
  - Continue failed to load it in this browser tab.
- **A save that reads but won't load:** Continue catches the error, says so and reloads. The
  title then offers the backup. The failed save's text is remembered in `sessionStorage`, so
  only that save is treated as broken.
- **Loading a backup asks first.** The save it replaces is kept as `stranded100_v3_broken`.
- **New Adventure:** after confirming, it clears the backups too.

**The Export reminder:** on every 10th day, a tip says to Export a copy. It shows once per day,
and only when no panel is open, nobody is asleep and no cutscene is playing.

**Check:** `tests/golden/backups.mjs` (part of `npm run parity`, 6 steps):
1. Days 11–14 keep 10, then 11,10, then 12,11,10, then 13,12,11; a same-day save changes nothing.
2. The Day 20 tip shows.
3. An unreadable save: the title offers the Day 14 backup, asks first, and Continue then loads
   Day 14. The broken save is kept aside.
4. A save whose structures can't be rebuilt: the message shows, and the title offers the backup.
5. New Adventure clears the backups.
6. No page errors.

**Fixed along the way:** `src/debug-exports.js` was missing `player/climate.js` and
`world/days.js`, which step 1 added, so `window.__stranded.advanceTime` was missing. Nothing had
used it until this check.

## Step 4: difficulty (27 Nov 2026)
**The levels:** `src/data/difficulty.js` has Easy, Normal and Hard. Normal is the game as it was.

| | Easy | Normal | Hard |
|---|---|---|---|
| Small finds there (share of Normal's share k) | 1 − (1 − k) × 0.3 | k | k × 0.75 |
| Missing finds on the island (of 1,071) | 116 | 392 | 555 |
| Hunted animals (cap share and chance) | × 1.5 | × 1 | × 0.7 |
| Hunger and thirst | × 0.8 | × 1 | × 1.2 |
| Damage from animals | × 0.7 | × 1 | × 1.3 |

**Saving the level:**
- **Picked on the title screen,** under the menu. The choice is remembered in this browser as
  `stranded100_v3_diff`.
- **Stored with the game** as `G.diff`, but only when it isn't Normal. Normal saves, and every
  older save, are byte for byte as before, so the save round trip is unchanged.
- **Shown on Continue** when the level isn't Normal (for example "Day 5, Level 3 · Hard").

**How finds follow the level:**
- `setFinds(level)` in `rarity.js` shows the finds for a level. Finds come and go in a fixed
  order (by index hash), so a harder level only removes more and an easier one only brings some
  back.
- It runs when a new game starts and in `applyWorldState()`, before the save's own changes.
- The island is still built at Normal, so the fingerprint is unchanged.
- Finds that Easy brings back have no terrain stamp, which is cosmetic only.

**Where the rest is applied:**
- **Hunger:** the survival rule takes `ctx.rate`.
- **Animals:** `rareCap` and `rareRoll` scale the hunted kinds.
- **Damage:** `hurtPlayer` scales damage with the source `'hurt'` (animals).

**Tests:**
- **Unit tests** cover the rates, the levels and older saves counting as Normal.
- **The smoke step "difficulty levels"** (also in the quick set):
  - finds Easy, then Hard, then back to Normal leaves exactly the same ones missing
  - a deer cap of 2: 2 on Easy, 1 on Normal
  - a bite of 10: 10 on Normal, 13 on Hard

## Step 5: Auto graphics (27 Nov 2026)
**What was there:** the original game already stepped the graphics down while it ran slowly.
- In the first minute it measured 10 s of frames. Below 30 fps it went down one level, with a
  tip, and measured again.
- Picking a level in Settings turned this off for good, and it never went below Medium.

**What changed:**
- **Auto in Settings:** Graphics now has **Auto (now High)**, shown as chosen while nothing has
  been picked by hand. Choosing it turns the step-down back on and starts a new measurement.
- **Down to Low:** the step-down carries on until the game keeps up or it reaches Low.
- **Unchanged:** the 30 fps threshold and the tip. It still never steps up on its own.

**Check:** the smoke step "auto graphics" fakes slow frames three times. The level goes from High
to Medium to Low and stays at Low, and the tip says Low. A level picked by hand is left alone, and
Settings offers Auto.

## Step 6: the animal journal (27 Nov 2026)
**Spotting:** `src/creatures/sightings.js`.
- **When an animal counts:** once a second, any living animal within 32 m and roughly in front of
  the player is spotted (within about 57° of straight ahead, or within 3 m).
- **The first time:** `G.seen[type]` records the day, and a tip says "New animal: Fox! It's in
  your journal (J)."
- **Saves:** `G.seen` only appears in a save once something has been spotted.

**The Animals tab:** J → 🐾 Animals has one card per kind (21 of them).
- **Spotted:** its icon, its name and the day it was spotted. Rare ones say ✨ Rare, bosses say
  👑 Boss.
- **Not spotted yet:** "???". Bosses say "A legend of the island".

**Badges:**
- 🔭 Keen Eye: spot 10 kinds.
- ✨ Lucky Spot: spot a fox, boar, horse, donkey, alpaca or shark.
- 🐾 Naturalist: spot every animal, not counting the bosses.

**Check:** the smoke step "animal journal" puts a deer 12 m in front and a wolf 12 m behind. Only
the deer is spotted, the tip shows, and the journal shows the Deer card, "???" cards and "1 / 21".

## Step 7: riding (27 Nov 2026)
**Taming** (`src/creatures/mount.js`):
- **Calm:** wild horses, donkeys and alpacas stay put (`c.calm`, set once a second) while you
  carry berries, walk rather than sprint, and don't yet have an animal.
- **Feeding:** E on one feeds it a berry, once per game day.
- **Tame:** on the third day you've fed one, the animal you feed becomes yours (`G.mount`), and
  you get the 🐎 Rider badge.

**Riding:**
- **Getting on and off:** E on your animal gets you on, and E again gets you off, to the side.
- **Speed:** 9 m/s, or 14 m/s galloping with Shift. Walking is 5 and sprinting 8.4. Stamina
  refills while you ride.
- **The view:** eyes are 2.4 m up instead of 1.62. You can see the horse's head and neck ahead.
- **Limits:** no tools and no jumping. Your animal stops at water deeper than 0.6 m, with a tip.
- **Getting hurt:** a hit throws you off and the animal bolts for 2 s. A blackout gets you off
  first.

**Your animal:**
- It can't be hurt by you ("That is your horse!").
- It isn't removed when far away, and it isn't counted against the herd caps.
- It waits where you left it (`G.mount.x`, `.z`, `.yaw`). If it goes missing, for example
  after a blackout clears the creatures, it comes back there within a second.

**How it hooks in:** through flags (`c.calm`, `c.tame`, `c.tameUpdate`, `c.throwOff`,
`R.riding`, `R.dismount`), not imports, so the older modules keep their start-up order.

**Check:** the smoke step "tame and ride a horse" covers:
- feeding on 3 days, aimed at the horse each time; tame, with the badge
- 17.9 m ridden in 2 s, eyes 2.37 m up, no tool swing
- at Mirror Lake: no swimming, stopped at a depth of 0.43 m, and E gets you off
- a hit throws you off
- after the creatures are cleared, the horse is back at its spot

## Step 8: Uncle Ray's model (28 Nov 2026)
**The model:** "Man" by Quaternius (CC0, `assets/animals/raw/Man.glb`, listed in
`assets/animals/sources.tsv`). `node tools/animals/build.mjs Man` keeps two clips, Idle and
Clapping (renamed Clap), and `node tools/animals/pack.mjs Man` packs it to 72 KB. Both tools now
take model names, so one model can be rebuilt without touching the others.

**In the game** (`src/models/gltf-animals.js`, kind `ray`):
- **Look:** 1.78 m tall, recoloured to the hand-built Ray's colours (green shirt, brown trousers,
  greying hair). His hat, a brim and a crown as before, is added on the Head bone (`addHat`).
- **Swap:** Ray is built with the island, before the models finish loading. `upgradeRay()` swaps
  in the animated one once it is loaded, as `upgradeScout()` does. The story code still turns him
  to face you. `armL` and `head` are stand-ins on the new model, so that code needs no change.
- **Clap:** `rayAnim()` plays Idle, and Clap twice (3.3 s) when you come within 7 m. He claps
  again after you've been more than 16 m away.
- **Hooks in:** `src/story/quests.js` imports `upgradeRay` and `rayAnim`. `creatures.js` loads
  `gltf-animals.js` earlier, so the start-up order is unchanged.
- **Fallback:** if the model doesn't load, Ray keeps his hand-built model.

**Check:** the smoke step "uncle ray" frees Ray, waits for the swap, then walks up to 4 m. It
checks the model is in the scene with its hat, faces you, and is clapping.

## The middle days, step 2: Scout's story begins (28 Nov 2026)
The story plan is `MIDDLE-DAYS-PLAN.md`, a spoiler file that isn't for Caspar. This step adds the
first slice of it.

**The rule** (`src/game/scout-story.js`, pure):
- `chapterDue()`: no chapters until Ray is free and the player chose to stay.
- **Chapter n can start** on Day 21, 31, 41, 51, 61 or 71: the morning after a Wolf Moon.
- **Each chapter after the first** waits until the one before is done, and until 3 days after it
  began. A player who stays late therefore catches up about every 3 days.
- **Only the chapters built so far are given.** That's 1 for now.
- `howlsTonight()`: every third evening, then every other evening after chapter 1.

**The story** (`src/story/scout-story.js`, called once a second from `slowTick`):
- **Chapter 1:**
  - A toast: Ray wants a word about Scout. His E prompt shows 💬.
  - Talking to him plays `DIALOGS.scoutPup`: he found Scout as a pup in the Stone Circle.
  - If you don't talk to him, a reminder comes each morning.
- **Thunderstorms:** while Scout is a friend, he shivers, follows closer (1.8 m instead of 3.2) and
  whines now and then. The first time each day, a toast says he hates thunder. **His fighting is
  unchanged.**
- **Dusk (19:00–20:00) on a howling evening:**
  - Scout stops, turns to Frostpeak and lifts his nose (`lift: 'Neck1'` in `KINDS.scout`, up to
    0.9 rad), and howls twice (the new `doghowl` sound), for 5.5 s. He doesn't start his Eating
    clip while howling.
  - **The turn's axis comes from full world matrices, not world quaternions.** A first try with
    quaternions looked wrong in the screenshots. The cause turned out to be the Eating clip, which
    the seeded test browser started every time, but the matrix version is the safer one either way.
  - Not during a storm, a Wolf Moon, riding or sleep. A fight cancels it.
- **Saves:** `G.story = { ch, day, done }`, made only when chapter 1 starts. Every other save is
  unchanged, so the round trip still gives the fixture back exactly.

**How it hooks in** (flags only):
- `scout.js` reads `howlT` and `scared` on `R.scout`.
- `ray.js` asks `R.rayTalk()` first.
- `gltf-animals.js` undoes each frame's neck lift before the mixer runs, so it can't build up.

**Checks:**
- **`tests/scout-story.test.js`** (9 tests, also in `npm run check`).
- **The smoke step "scout's story":**
  - chapter 1 on Day 25 after "stay", with the toast and the 💬
  - 4 lines mentioning the Stone Circle, then the chapter is done and the 💬 goes
  - no chapter 2 on Day 31
  - a storm makes him shiver, with the tip
  - at 19:12 on Day 32 he howls and faces Frostpeak. His head rises above the base of his neck
    (by about 3 cm; the check needs more than 1.5 cm), and he isn't eating.
- **Screenshots:** `node tools/story/scout-shots.mjs <dir>` shows him standing and howling, from the
  side.

## The middle days, step 3: Scout leads the way (28 Nov 2026)
**Chapter 2** (from Day 31, 3 days after chapter 1 began):
- **Each morning** Scout stares the way of the dig spot and whines: a toast with the compass
  direction (WEST from most of the island).
- **Within 150 m, on foot,** he leads. Once a second the story puts his target 8 m ahead of you on
  the straight line to the spot (`R.scout.lead`). He runs there and waits, looking back at you.
  Walk the wrong way and the point moves with you, so he comes back round. Riding, he just
  follows, because he can't keep up with a horse.
- **Within 6 m** he goes to the spot and digs (his Eating clip, over and over, with dirt puffs).
  "Help Scout dig" (E) gives the **Green Stone** and **Tomas's page 1** (`NOTES.tomas1`), and leaves
  a dug hole there.
- **Talking to Ray** while a chapter is under way gives that chapter's hint (`DIALOGS.scoutHint`).

**Where things are:** `src/data/story-spots.js`, found with `node tools/story/spots.mjs` on dry,
fairly flat ground clear of trees, rocks and colliders. They are not in `SITES` or `NODES`, so the
fingerprint is unchanged. Story props are only made once the story reaches them, so saves without
the story (the fixture, the screenshots) see no difference.

**Hooks added for the later steps** (flags on `R.scout`): `lead` (also `lead.far`: no teleport
back when he runs off in the Great Storm), `dig` and `limp` (slow, doesn't fight). On his E prompt,
`R.scoutLabel()` and `R.scoutAct()` go first.

**Checks:**
- **The rule tests (14)** now cover chapter 7 (the Great Storm from Day 85), the Wolf Moon twists
  (`moonKind`: from Day 60, snow, storm, snow, storm, once the story has begun; a Snow Moon is 8 snow
  wolves) and the storm hours.
- **The smoke step "story: scout leads the way":**
  - chapter 2 on Day 31, with the WEST toast and Ray's hint
  - from 50 m, he is 7.6 m ahead of you within 2.5 s
  - close by he digs (Eating), and the prompt gives the stone, the page (shown) and the chapter is done
- **`node tests/smoke.mjs --only=story`** runs just the story steps (and "new game") while working
  on them.

**A flaky save check, fixed:** `savecheck.mjs` sometimes failed with "differs in: flags". The
fixture is a Day 10 save, and on every 10th day the once-a-second tick sets the Export reminder
(`exportNudge`, from step 3 of IMPROVEMENTS.md). Whether that tick ran before the check read the
game was a race, so it failed about two runs in three on this PC. That reminder no longer counts as
a difference, and a failure now names the flags that differ.

## Choosing a tool in a hotbar slot (28 Nov 2026)
**Asked for by Caspar.** A slot always held your best tool of its kind, so once he had the
Crystal Lantern he could never pick the fire torch again.
- **Choosing the slot you already hold switches to your next tool of that kind,** with its number
  key or a click or tap. Torch slot: lantern, then torch, then lantern. Axe slot: iron, then stone.
  A hint names the tool.
- **The slot shows the tool you picked,** and a gold ⇄ marks slots holding more than one of your tools.
- **Saving:** the pick is `G.p.pick = { slot: id }`, written only once you pick something that isn't
  your best tool. Back to the best, it's removed, so other saves are unchanged.
- **Crafting a new best tool** for a slot clears the pick, so the new tool is what you hold.
- **Unchanged:** "do you have one?" checks (quests, mining prompts, the cave-in) still look at your
  best tool, through `bestTool()`. What you hold comes from `slotTool()` (`heldId()`).
- **A tip, once,** when a second tool for a slot arrives during play (not on loading a save that
  already has two, which would change the save fixture's flags).

**Check:** the smoke step "hotbar: switch tools in a slot".

**`--only` caveat:** some smoke steps depend on earlier ones. "torch and crystal lantern" run alone
fails (the snow wolf flees the torch too) on today's build and on the build before the story work
alike. Run the whole smoke test before a commit.
