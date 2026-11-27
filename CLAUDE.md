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
| `npm test` | Build, then Vitest: survival rules, island fingerprint, save. Takes about 3 min. |
| `npm run parity` | Build, then every browser check, screenshots included. Takes about 7 min. |
| `npm run smoke` | Headless Chrome play-through of `dist/index.html` (24 steps, zero page errors) |
| `npm run ship` | Build, copy to `release/Stranded-100-Days-PC.html`, prove a save from the original shows up |

- **After any change:** run `npm test` and `npm run parity`. Read `tests/golden/README.md` before
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
  - `src/models/gltf-animals.js`: the animated animal models
  - `src/ui/about.js`: the credits

## The ledger (most important rule)

`tests/golden/compare-build.mjs` rebuilds the original script from the `@moved-to` map. It requires
the result to match the original byte for byte, except for changes listed in
`tests/golden/approved-edits.mjs`.

- **Changing original code:** every change needs a ledger entry with its reason, or the build
  check fails.
- **New files:** need a `module` entry that lists the browser globals they use, such as `Promise`
  or `Date`.
- **Overlapping entries:** two `replace` entries can't overlap. Anchor a new one on a line no other
  entry touches.
- **No CRLF or BOM in `src/`:** they are rejected. Don't write source files with PowerShell
  `Set-Content` or `Add-Content`. Use the editor tools, or `[IO.File]::WriteAllText` with UTF-8
  and no BOM.
- **Don't regenerate `src/`:** `tools/split/split.mjs` refuses to run on purpose, because it would
  delete everything added after the migration.

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
  - File size is not a limit. The built game is about 11 MB with the animal models.
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
- **Rules code stays pure:** `src/game/` and `src/data/` never import three.js or touch the page.
  The `// TODO(split)` notes mark the 11 places that still reach into `R`.
- **Touch controls:** the phone and tablet code (`src/input/touch.js`) stays in the build, and
  `touchcheck.mjs` covers it.

## What "the same" means (parity checklist)

| Check | How | Pass |
|---|---|---|
| Island | World fingerprint (`tests/world.test.js`) | Hash identical to the original |
| Balance | `tests/survival.test.js` | Rates pinned. The four MIGRATION.md energy targets are a `todo` until the original "typical day" model turns up. |
| Saves | `tests/fixtures/save-v3.json` loads and round-trips; Export / Import (`savefile.mjs`) | Inventory, structures and day match |
| Graphics | Smoke test and reference screenshots | No shader errors. The screenshot score is noisy with frame rate (storm ~3.5–4.7), so compare against a control run of the original. |
| Feel | Play the original and the new file side by side for 10 minutes | Same movement, day length and difficulty. Not done by a person yet. |

## Gotchas

- **Animal model clips:** the Quaternius Ultimate-pack clips appear twice and share accessors.
  `build.mjs` must dispose samplers and channels before `prune()`.
- **Bone names:** three.js drops dots from node names, so `FF.L` becomes `FFL`.
- **Model sizes:** `_end` bones get pruned, so size models from the posed vertices, not the bones.
- **Start-up stalls:** r128 compiles shaders on first use and blocks the page. New materials are
  warmed up behind the loading bar (`warmUp` in `src/ui/loading.js`).
- **New buttons in panels:** handle them with a capture-phase document click listener that calls
  `stopPropagation`, as `savefile.js` and `about.js` do, so the panels' own handlers are untouched.
