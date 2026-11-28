# Stranded: 100 Days

A low-poly 3D survival game built with three.js. It is made for Caspar (11), who plays it as one
HTML file on a Windows PC in Chrome. It started as a single hand-written HTML file
(`original/Stranded-100-Days-PC.html`, never edited) and is now a Vite project that builds back
into one file. The migration is finished (MIGRATION.md). Since then, new features have been added
(ANIMALS.md, `tests/golden/README.md`).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run check` | The quick set: build, build check, rules tests, island, save, core smoke steps. About 1–2 min. |
| `npm test` | Build, then Vitest: survival and time rules, island fingerprint, save. Takes about 3 min. |
| `npm run parity` | Build, then every browser check, screenshots included. Takes about 7 min. |
| `npm run smoke` | Headless Chrome play-through of `dist/index.html` (24 steps, zero page errors) |
| `npm run ship` | Build, copy to `release/Stranded-100-Days-PC.html`, prove a save from the original shows up |

- **While working:** run `npm run check` after each change.
- **Before each commit:** run `npm test` and `npm run parity`. Read `tests/golden/README.md` before
  changing any check.
- **Before handing over:** run `npm run ship`.
- **Slow commands:** run anything over ~2 minutes in the background.

## How the code is laid out

- **`src/main.js` is the entry point and the map.**
  - It has one `// @moved-to:` line per block of the original script.
  - New feature modules are imported after the chain tail.
- **Load order is the original order.** Each moved module's first import is the previous module,
  so start-up code runs top to bottom as in the original. This matters because the world RNG and
  the model colour jitter are shared counters. Never reorder these imports.
- **The world is built in `src/boot.js`.** Boot, title and the game loop live there.
  `initWorld()` builds the world step by step behind the loading bar (`src/ui/loading.js`).
- **State lives in `src/state.js`.**
  - `G` is the saved game state. Replace it only with `setG()`.
  - `R` is runtime state.
- **The game script is exposed as `window.__stranded`.** The browser checks use it
  (`src/debug-exports.js`).
- **Folders:**
  - `core/`, `gfx/`, `audio/`, `world/`, `data/`, `models/`, `player/`, `game/`, `build/`,
    `creatures/`, `story/`, `ui/`, `input/`
  - `src/world/rarity.js`: how often finds and animals appear
  - `src/data/difficulty.js`: Easy, Normal and Hard. Saved as `G.diff` only when it isn't Normal,
    so Normal saves are exactly as before.
  - `src/models/gltf-animals.js`: the animated animal models
  - `assets/animals/game/`: the working models. `assets/animals/packed/`: what the game embeds.
    After changing a model, run `node tools/animals/pack.mjs`.
  - `src/ui/about.js`: the credits
  - `src/story/scout-story.js` and `src/game/scout-story.js`: Scout's story for the middle days.
    The plan is `MIDDLE-DAYS-PLAN.md`, a spoiler file: never show it to Caspar or repeat it in the
    game.

## Build check and the old ledger

`tests/golden/compare-build.mjs` checks four things on every build:
- **LF only:** every source file has LF line endings and no byte-order mark.
- **Names resolve:** every name is declared, imported or a known browser global. A new browser
  global goes in its `EXTRA_GLOBALS` list.
- **The rules code is pure:** `src/game/` and `src/data/` never import three.js, never touch the
  page and never use `R`. There are no exceptions.
- **The page:** three.js is r128 from npm, and the page is one self-contained file.

Until 27 Nov 2026 the check also rebuilt the original script from `src/` byte for byte, using the
ledger (`tests/golden/approved-edits.mjs`). That part is retired.

- **The ledger is frozen** as the record of what the migration changed. Don't add entries.
- **Edit modules directly.** The tests, the island fingerprint, the save checks, the smoke test
  and the screenshots guard the game now.
- **No CRLF or BOM in `src/`.** Don't write source files with PowerShell `Set-Content` or
  `Add-Content`. Use the editor tools, or `[IO.File]::WriteAllText` with UTF-8 and no BOM.
- **Don't regenerate `src/`.** `tools/split/split.mjs` refuses to run on purpose.
- **Rules and bridges:** pure rules live in `src/game/`. Modules elsewhere connect them to the
  game:
  - `src/player/climate.js` for survival
  - `src/world/days.js` for time and weather

  Keep new rules pure the same way: plain values in, results out.

## Ways of working

- **Plan first.** One system at a time, with a written plan before any code. Test it before moving
  on.
- **Explain numbers.** Never change a balance number silently. Say what it was, what it is now and
  why.
- **Keep the island identical.** The world fingerprint must match the original. Thin or change
  things in ways that leave `NODES` and node indices unchanged (see `rarity.js`), because saves
  record changes by node index.
- **No random draws in pauses.** Anything that pauses during world building must not draw from
  `Math.random` (see `loadStep`).
- **Check `git status` first.** Another Claude session may be working in this folder. Commit only
  your own hunks.
- **Commits:**
  - Commit as `Simon Sullivan <majorhip@users.noreply.github.com>`.
  - Push to `origin main` (https://github.com/Majorhip/100-Days).
  - If Git asks for a sign-in, push from the Terminal panel.
- **Downloads and size:**
  - Ask before downloading anything; give the file, the source and the size.
  - File size is not a limit. The built game is about 4.5 MB, with the animal models compressed.
- **Credits:** third-party assets need credits in `src/ui/about.js` (the Poly bear is CC BY 3.0).

## Technical rules (from the original game)

- **three.js is pinned at r128 (0.128.0).** The graphics engine patches r128's internal shaders.
  An upgrade is a separate project.
- **Rates are per game hour,** run on a fixed 30 Hz tick. `tests/survival.test.js` pins them, for
  example hunger 3.0/h and thirst 3.8/h.
- **The fire has three states:** empty, loaded and lit.
- **Food:** raw food is edible, but cooking multiplies its value (mushrooms ×3, fish ×4, meat
  ×3.8).
- **Saves:** they store only changed nodes (`nodeState`), and the format is version 3.
  - The save key `stranded100_v3` must never change, or Caspar's save disappears.
  - Every `localStorage` call is wrapped in try/catch.
  - Backups (`src/backups.js`): each new day keeps the day before as `stranded100_v3_bak1`–`3`.
    The title offers the newest one if the save can't be loaded.
- **Rules code stays pure:** `src/game/` and `src/data/` never import three.js, touch the page or
  use `R`. The build check enforces it.
- **Touch controls:** the phone and tablet code (`src/input/touch.js`) stays in the build, and
  `touchcheck.mjs` covers it.

## What "the same" means (parity checklist)

| Check | How | Pass |
|---|---|---|
| Island | World fingerprint (`tests/world.test.js`) | Hash identical to the original |
| Balance | `tests/survival.test.js`, `tests/time.test.js` | Rates and the weather chain pinned. The four MIGRATION.md energy targets are a `todo` until the original "typical day" model turns up. |
| Saves | `tests/fixtures/save-v3.json` loads and round-trips; Export / Import (`savefile.mjs`) | Inventory, structures and day match |
| Graphics | Smoke test and reference screenshots | No shader errors. The screenshot score is noisy with frame rate (storm ~3.5–4.7), so compare against a control run of the original. |
| Feel | Play the original and the new file side by side for 10 minutes | Same movement, day length and difficulty. Not done by a person yet. |

## Gotchas

- **Animal model clips:** the Quaternius Ultimate-pack clips appear twice and share accessors.
  `build.mjs` must dispose samplers and channels before `prune()`.
- **Bone names:** three.js drops dots from node names, so `FF.L` becomes `FFL`.
- **Model sizes:** `_end` bones get pruned, so size models from the posed vertices, not the bones.
- **Animal materials:** `gltfAnimal()` makes one game material per material name, with separate
  copies for skinned and plain meshes. The bat's eyes and body share "Main", and a skinned mesh
  drawn with a plain material ignores its skeleton. Packed models make that mistake show up huge.
- **Packed models:** they store vertex data as scaled whole numbers. `unquantize()` in
  `gltf-animals.js` turns them back into floats at load, because r128's CPU-side reads (`getX`,
  `boneTransform`) don't scale them. `pack.mjs` must not `dedup()`, because it would merge
  materials the game looks up by name.
- **Start-up stalls:** r128 compiles shaders on first use and blocks the page. New materials are
  warmed up behind the loading bar (`warmUp` in `src/ui/loading.js`).
- **New features hook in through flags, not imports.** Older chain modules (creatures, movement,
  targeting, health) must not import new modules that import later ones, because that would
  change the start-up order. Riding talks to them through `c.calm`, `c.tame`, `c.tameUpdate`,
  `c.throwOff`, `R.riding` and `R.dismount` (`src/creatures/mount.js`).
- **New buttons in panels:** handle them with a capture-phase document click listener that calls
  `stopPropagation`, as `savefile.js` and `about.js` do, so the panels' own handlers are untouched.
