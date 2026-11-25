# Stranded: 100 Days — Migration Plan v2: single HTML file → Vite project

**Status:** Rewritten 25 November 2026. Replaces the August draft, which assumed a menu-driven game built from plain web pages. If you still have the earlier `MIGRATION.md` handover, this plan takes precedence where they disagree; carry over anything specific from it that still applies.

**Goal:** the same game, with the same look and the same saves, split into modules with git history. One command builds it back into a single HTML file Caspar can double-click.

---

## 1. Where things stand

The game is one file, `Stranded-100-Days-PC.html` (~960 KB):

- **three.js r128**, embedded in the file (~600 KB of it). There are no add-ons, so the post-processing is hand-written.
- **~3,700 lines of game code** in one script, already divided into 14 labelled sections (see §4).
- **Two state objects:** `G` is everything saved (player, inventory, structures, world changes) and `R` is runtime only (renderer, meshes, timers, UI state).
- **Fixed 30 Hz simulation tick:** `survivalStep(gameHours, ctx)`, `structuresStep`, `advanceTime`. It's decoupled from rendering, and all rates are per game hour (`DAY_LENGTH_SECONDS = 480`).
- **Seeded world:** `mulberry32(WORLD_SEED)` builds the same island every time. `SAVE_VERSION = 3`. Settings are saved separately.
- **Graphics engine (added 25 Nov 2026):** sections `02a_gfx_core` and `02b_gfx` give HDR, bloom, sun shafts, the GPU grass field, shader sky, water and quality tiers. **These patch r128's internal shader chunks**, which is why three.js stays pinned during the migration.

**Why now:** the graphics pass had to be spliced into the file with a build script that checks every edit matches the original. That's a migration done by hand. Splitting into modules means each future change touches one part of the game, not a 960 KB file.

---

## 2. Rules for the migration

**In scope:** moving code into modules, a build system, git, tests that prove nothing changed.

**Out of scope until the migration is finished:**

- Gameplay or balance changes
- Upgrading three.js
- Imported 3D models
- Converting to TypeScript (that comes gradually afterwards, see §8)

Ideas that come up go into `IDEAS.md`, not the code. This is a feature freeze; it's what makes "did the migration break it?" answerable.

**The game must be playable at the end of every session**, and every session ends in a commit.

---

## 3. Stack

| Piece | Choice | Why |
|---|---|---|
| Build tool | **Vite** | Instant dev server with hot reload, and simple builds. |
| 3D library | **three@0.128.0 from npm, pinned** | The exact version the game uses now. The graphics code depends on its internals. |
| Single-file output | **vite-plugin-singlefile** | Inlines all JavaScript and CSS into one `dist/index.html`. Caspar still gets one file to double-click, and localStorage saves still work when it's opened locally. |
| Language | **JavaScript ES modules** first | A straight move keeps the parity check honest. TypeScript is added file by file later. |
| Tests | **Vitest** for game rules, plus a **headless Chrome smoke test** | Vitest checks the numbers. The browser test catches shader errors and crashes (the same approach used to test the graphics pass). |
| History | **git + GitHub** (private repo) | Undo, branches, backup. |
| Hosting | Optional: GitHub Pages / Netlify | Only if you want a link as well as the file. |

---

## 4. Repo layout: where each current section goes

```
stranded/
├─ CLAUDE.md                 # standing instructions for Claude Code (see §9)
├─ IDEAS.md                  # parking lot during the freeze
├─ index.html                # HUD/menu markup moved out of the script
├─ vite.config.js            # singlefile plugin, base path
├─ package.json              # three pinned to 0.128.0
├─ original/                 # the untouched 25 Nov single file, for side-by-side checks
├─ src/
│  ├─ main.js                # boot, title screen, game loop        (11_main)
│  ├─ state.js               # G and R, newGameState                (00_core)
│  ├─ save.js                # save/load, settings                  (11_main)
│  ├─ core/                  # constants, maths, rng, noise, geometry helpers (00_core)
│  ├─ data/                  # items, recipes, buildings, creatures, notes   (03_data) — content only
│  ├─ game/                  # survival, time, weather rules — no three.js, no DOM (06/11)
│  ├─ audio/                 # WebAudio synthesis                   (01_audio)
│  ├─ world/                 # terrain, biomes, nodes, gathering    (02_world, 04_nodes)
│  ├─ gfx/                   # graphics engine                      (02a_gfx_core, 02b_gfx)
│  │  ├─ shaders/            # GLSL moved into .glsl files, imported with ?raw
│  │  └─ quality.js          # Low / Medium / High / Ultra
│  ├─ models/                # procedural animals, people, tools, structures (05_models)
│  ├─ player/                # movement, targeting, tools, fishing  (06_player)
│  ├─ build/                 # placement, structures, fire, sleep, storage (07_build)
│  ├─ creatures/             # AI, bosses, Wolf Moon raids, Scout   (08_creatures)
│  ├─ story/                 # landmarks, notes, quests, endings    (09_story)
│  ├─ ui/                    # HUD, toasts, panels + styles.css     (10_ui)
│  └─ input/                 # keyboard/mouse, touch                (12_touch)
└─ tests/
   ├─ world.test.js          # island fingerprint
   ├─ survival.test.js       # balance targets
   ├─ save.test.js           # old saves load
   └─ smoke.mjs              # headless browser run-through
```

**Standing rule:** `src/game/` and `src/data/` never import three.js and never touch the page. Where the current rules code reaches into `R` or the DOM, note it with a `// TODO(split)` comment during the move and fix it in a later session. Don't untangle it mid-move.

---

## 5. The phases

Each phase is one Claude Code session and one or more commits.

### Phase 0 — Prerequisites (one evening)
- [ ] Install **Node.js** (current LTS, 22 or newer) and **Git**.
- [ ] Create a **GitHub** account and an empty private repo called `stranded`.
- [ ] Make sure your Claude plan includes **Claude Code**, and install it (instructions at docs.claude.com). The desktop app's Claude Code mode works if you'd rather avoid the terminal.

### Phase 1 — Snapshot and record the "golden" reference
- [ ] Create the repo and commit `original/Stranded-100-Days-PC.html` **untouched** as the first commit.
- [ ] Record what "the same" means, before changing anything:
  - **World fingerprint:** a hash of the terrain heights, every tree/rock/pickup position, the lakes and the landmark sites. If the island changes, this changes.
  - **A real save:** play 10–15 minutes (build a fire, chop trees, open a chest) and export the save from localStorage to `tests/fixtures/save-v3.json`.
  - **Reference screenshots:** the same 6 views (meadow at noon, dusk, campfire at night, Frostpeak, Dust Flats, storm) at High.

### Phase 2 — Scaffold
- [ ] Vite project with `three@0.128.0` and `vite-plugin-singlefile`.
- [ ] Move the HTML markup and CSS out of the file into `index.html` and `src/ui/styles.css`.
- [ ] `npm run dev` serves the game; `npm run build` produces one `dist/index.html`.

### Phase 3 — Lift and shift (the safety net)
- [ ] Move the **entire game script, unchanged,** into `src/legacy.js`, importing three.js from npm instead of the embedded copy.
- [ ] **Parity check:** the built single file plays identically, and the world fingerprint and saved game match.
- [ ] Commit. From here on you're on Vite, even before anything is split.

### Phase 4 — Split by section (3–6 sessions)
Move one or two sections per session, in dependency order. Run the parity checks after every move.

1. `03_data` → `src/data/` (pure content; easiest, good warm-up)
2. `00_core` → `src/core/`, `src/state.js`
3. `01_audio` → `src/audio/`
4. `02a/02b_gfx` → `src/gfx/` (shaders into `.glsl` files)
5. `02_world`, `04_nodes` → `src/world/`
6. `05_models` → `src/models/`
7. `06_player` → `src/game/survival.js` (rules) + `src/player/`
8. `07_build` → `src/build/`
9. `08_creatures` → `src/creatures/`
10. `09_story` → `src/story/`
11. `10_ui` → `src/ui/`
12. `11_main`, `12_touch` → `src/main.js`, `src/save.js`, `src/input/`

`legacy.js` shrinks each session and is deleted at the end.

### Phase 5 — Tests worth having (1 session)
- **World fingerprint** matches Phase 1, so the island is identical.
- **Balance targets** hold. These are the numbers the game was tuned to:
  - forage only ≈ −36 energy/day (fails by Day 3–4)
  - fire + cooked forage ≈ −2
  - fire + fishing ≈ −9
  - hunting + fire ≈ 0
- **The Phase 1 save loads**, and resaving it round-trips.
- **Smoke test** in headless Chrome: new game, chop, build and light a fire, night with wolves, storm, sleep, swim, visit all three biomes, switch through all four graphics levels. Zero errors.

### Phase 6 — Ship (1 evening)
- [x] `npm run ship` builds and copies the game to `release/Stranded-100-Days-PC.html` (the same file name). Giving Caspar the file is a hand-over step.
- [x] Confirm his existing save appears in the new file (see §7, saves risk). `tests/golden/ship.mjs`, run by `npm run ship`: a game saved by the original file shows Continue (and loads) in the new file, both replacing it in the same folder and downloaded to another folder, in Chrome/Edge. Firefox and Safari may keep each local file's storage apart, and the original has no Export button, so if Caspar plays in one of those, check on his computer before deleting the old copy. From the new file on, Export / Import save covers any browser.
- [ ] Optional: GitHub Pages for a link.

---

## 6. What "the same" means (the parity checklist)

| Check | How | Pass |
|---|---|---|
| Island | World fingerprint test | Hash identical |
| Balance | Vitest survival tests | Energy/day within ±1 of targets |
| Saves | Load `save-v3.json` | Loads; inventory, structures and day match |
| Graphics | Smoke test + reference screenshots | No shader errors; views match by eye |
| Feel | Play both files side by side for 10 minutes | Same movement, same day length, same difficulty |
| Size | Built file | Roughly the same size as the original (~1 MB) |

---

## 7. Risks and how to dodge them

| Risk | Why it matters | Mitigation |
|---|---|---|
| **The island changes** | World generation draws numbers from one seeded RNG in sequence. If modules run world-building code in a different order, every tree moves, and old saves (which record changes by node) break. | Keep the call order exactly as in the original; the world fingerprint test catches it instantly. |
| **`G` gets replaced on load** | Loading a save does `G = mergeSave(...)`. Other modules can't reassign an imported variable, so they'd keep pointing at the old state. | Hold state in one exported object (e.g. `state.G`) or provide a `setG()` function; decide this in Phase 4 step 2. |
| **Circular imports / load order** | Today every function can call every other, and some top-level code (materials, geometry, the world RNG) runs at load. Modules run in import order. | Plain function calls are fine across modules. Move load-time setup into explicit `init()` functions called from `main.js`. |
| **Graphics break on a three.js update** | The graphics engine patches r128's internal shaders. | three.js pinned at 0.128.0; any upgrade is a separate project after the migration. |
| **Caspar's save doesn't appear in the new file** | Saves live in the browser's localStorage. Whether a different HTML file can see them depends on the browser and where the file is opened from. | Keep the save key unchanged and test in Caspar's browser. As insurance, add a small **Export / Import save** button in the pause menu before shipping. |
| **Feature creep** | Mixing new features into the move makes breakages untraceable. | `IDEAS.md`; feature freeze until Phase 6 is done. |

---

## 8. After the migration (separate projects, in this order)

1. **TypeScript, gradually.** Start with `src/data/` and `src/game/`, where types act as the design document and catch "wrong stat" bugs. Rendering code can stay JavaScript as long as it likes.
2. **Animated creature models — wolf pilot first.**
   - **Source:** Quaternius's free CC0 low-poly packs. The flat-shaded style matches the game.
   - **Known coverage:** animated wolf, plus packs with idle/walk/run/jump/death clips. Still to confirm: animated bear, goat, rabbit, deer and scorpion. Anything without a match keeps its hand-built model.
   - **Not recommended:** Kenney's animated animals are cube-style pets that would clash. Kenney's animated human characters could work for Uncle Ray.
   - **The real work is rewiring the creatures, not loading the files:**
     - link idle/walk/run/attack/death clips to creature behaviour
     - time damage to the bite animation
     - keep the hit-flash
     - match model size to collision radius
     - make the bosses scaled and recoloured versions
   - **Scope check:** pilot the wolf, play it, then decide on the rest.
3. **three.js upgrade** — only if a feature needs it. Expect to rework the graphics engine's shader patches.

---

## 9. Working with Claude Code

**`CLAUDE.md` should contain** (keep it under 200 lines):

- **Project basics:** what the game is, who it's for (Caspar, 11), and how to run, test and build it.
- **Ways of working:** one system at a time, tested before moving on. A written plan before any code. Numbers are explained, never silently changed.
- **Technical rules:**
  - rates per game hour
  - fixed 30 Hz tick
  - `src/game/` and `src/data/` never import three.js
  - only cooked food restores energy
  - fire has three states (empty / loaded / lit)
  - proximity targeting uses dot product
  - saves store only changed nodes
  - localStorage is wrapped in try/catch
  - three.js pinned at r128
- **The parity checklist from §6.**
- **Correction rule:** anything you've had to correct twice.

**Each session:** state the one thing being moved or built → Claude proposes a plan → you approve → it builds → `npm test` + smoke test → play for five minutes → commit.

---

## 10. Realistic time

| Phase | Effort |
|---|---|
| 0–2: setup, snapshot, scaffold | One evening |
| 3: lift and shift | One session |
| 4: split by section | Three to six sessions |
| 5–6: tests and ship | One evening |

**About two weeks of evenings.** After that, every change touches one module instead of the whole file.

---

## 11. Open questions

- **TypeScript:** start straight after the migration, or only when a part of the game gets reworked?
- **Delivery:** single file only, or also a web link?
- **Touch support:** the PC file still contains the phone/tablet controls (`12_touch`). Keep maintaining them, or drop them from the PC build?
- **Who codes:** is Caspar going to edit anything himself (e.g. adding items in `src/data/`)? If so, the README and data files should be written for him.
