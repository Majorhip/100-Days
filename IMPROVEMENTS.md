# Stranded: 100 Days — Improvements Plan

**Status:** written 27 November 2026. Nothing here is built yet.

**What it covers:** the suggestions list items 2, 3, 4, 5, 7, 8, 10, 11 and 12. Item 6 (the story
for the middle of the game) waits for Caspar's picks; see the end.

**Every step works the same way:**
- one step per session, with a written plan before any code
- `npm test` and `npm run parity` before each commit
- a smoke step for each new feature
- Caspar plays it before the next step starts

## Recommended order

| # | Step | Item | Why here |
|---|---|---|---|
| 1 | Faster checks, and lighter ledger rules | 12, 11 | Every later step gets quicker and cheaper. |
| 2 | Smaller, faster file | 4 | Independent of the rest. Faster start-up helps every play test. |
| 3 | Backup saves | 3 | Protects Caspar's game before the bigger changes land. |
| 4 | Difficulty setting | 2 | Turns the rarity guesses into a choice. |
| 5 | Auto graphics level | 5 | Small. Best judged once step 2 has made start-up lighter. |
| 6 | Animal journal | 7 | Rewards the rarer animals. |
| 7 | Ride the horse | 8 | The biggest gameplay piece. |
| 8 | Matching models | 10 | Needs downloads, so it needs your OK first. |

Steps 2 and 3 touch different files, so they could run side by side in separate sessions.

---

## Step 1 — Faster checks, and lighter ledger rules (items 12 and 11)

**Status: done 27 Nov 2026.** See the last section of `tests/golden/README.md`.

**Problem:** the full checks take about 7 minutes. Also, every gameplay tweak needs a ledger entry
that matches the original byte for byte, which made sense for the migration but slows down new
work.

**Plan:**
1. **`npm run check`, a quick set of 1–2 minutes** for small changes:
   - build, `compare-build`
   - the Vitest unit tests (survival, save)
   - the island fingerprint
   - a short smoke run: new game, chop, fire, one biome
   - no screenshots

   The full `npm run parity` stays the check before a release and before anything changes world
   building.
2. **Untangle the 11 `// TODO(split)` lines** in `src/game/survival.js` and `src/game/time.js`.
   They read or write `R` and reach into the HUD, sound and saving. Pass what they need in through
   the `ctx` argument instead, and return events (such as "show this toast") for the caller to act
   on. `tests/survival.test.js` then needs no stand-ins.
3. **Retire the byte-for-byte part of `compare-build.mjs`.**
   - Keep: the name check (every name declared or imported) and the standing rule (`src/game/` and
     `src/data/` never touch three.js or the page).
   - Freeze `approved-edits.mjs` as the record of the migration.
   - From then on, changes are guarded by the tests, the fingerprint and the screenshots, not the
     ledger.

**Decision for you:** item 3 changes a standing rule from the migration. It's my recommendation,
but it's your call.

**Done when:**
- `npm run check` passes in under 2 minutes.
- The survival tests use no stand-ins.
- `compare-build` checks names and the standing rule only.
- CLAUDE.md and `tests/golden/README.md` describe the new rules.

## Step 2 — Smaller, faster file (item 4)

**Status: done 27 Nov 2026.** The game file went from 11.26 MB to 4.46 MB, and the models from 7.44 MB
to 2.57 MB. Time to the title screen on this PC went from 10.5 s to 9.6 s; the models load in the
background, so most of the start-up time is building the world and warming up shaders. One bear
instead of three wasn't needed. See the last section of `tests/golden/README.md`.

**Measured:** the 20 animal model files total 7.8 MB:
- about 5.3 MB of meshes and skins
- 1.65 MB of animation
- 0.83 MB of textures

The single-file build stores them as text, which adds a third, so they make up about 10.4 MB of the
11.25 MB game.

**Plan:**
1. **Compress the meshes:** quantise them and apply meshopt compression
   (`EXT_meshopt_compression`) with the `@gltf-transform` tools already in the project.
   three.js r128's loader supports it through `setMeshoptDecoder`, and the decoder ships with three
   (`examples/jsm/libs/meshopt_decoder.module.js`), so no download is needed.
2. **Trim animation keyframes** where nobody can see the difference (gltf-transform `resample`).
3. **Shrink textures** where they're larger than the models need.
4. **One bear instead of three, if it fits:**
   - The bear, Grizzle and Frostclaw are 1.94 MB together.
   - Where the mesh is the same, load one bear and recolour it, as the wolves already do.
   - Frostclaw's ice parts may need it to stay separate.
5. **Build-time only:** do this in the asset build (`tools/animals/`), so the source models are
   unchanged and the compressed copies are what gets bundled.

**Done when:**
- The game file is well under half its current size. I'll report the real number.
- Time to the title screen is measured before and after on this PC.
- The animals look the same: `tools/animals/bosses.mjs` and the other model screenshots before and
  after, judged by eye.
- All checks pass.

## Step 3 — Backup saves (item 3)

**Status: done 27 Nov 2026.** `src/backups.js`; checked by `tests/golden/backups.mjs`. See the
last section of `tests/golden/README.md`.

**Problem:** a 100-day game lives in one browser save.

**Plan:**
1. **Daily backup:** at each dawn, copy the current save to a backup before writing the new one.
   - Keep three: `stranded100_v3_bak1` to `_bak3`.
   - The main save key `stranded100_v3` never changes.
2. **Recovery:** if Continue fails, because the save won't read or loading it throws, the title
   offers "Load the day before" from the newest backup that works.
3. **Export reminder:** every 10 days, a quiet toast reminds Caspar to use 📤 Export save.

**Checks:**
- New steps in `savefile.mjs`: break the main save, and the title offers the backup, which loads.
- The backups rotate.
- The save round-trip test is unchanged.

## Step 4 — Difficulty setting (item 2)

**Status: done 27 Nov 2026.** `src/data/difficulty.js`; the picker sits under the title menu. With
Easy about 11% of the small finds are missing, with Normal 37%, with Hard 52%. See the last
section of `tests/golden/README.md`.

**Plan:** Easy, Normal and Hard.
- **Normal is today's game**, with today's numbers.
- **Chosen with each New Adventure, and stored in the save**, so a game keeps its difficulty. Old
  saves become Normal.
- **What it scales:**

| | Easy | Normal | Hard |
|---|---|---|---|
| Finds (sticks, stones, mushrooms, berries…) | close to the original amount | today's rarer amount | rarer still |
| Animals you can hunt | more | today | fewer |
| Hunger and thirst rates | ×0.8 | ×1.0 | ×1.2 |
| Damage from animals | ×0.7 | ×1.0 | ×1.3 |

These numbers are starting points for Caspar to try. Every change is stated, never slipped in
quietly.

**Design note:** the rarer finds are hidden by index today, while the world is built and before the
save is read. Difficulty comes from the save, so hiding moves to the moment a game starts or
continues. The island itself, `NODES` and the fingerprint stay the same.

**Checks:**
- The survival tests at Normal are unchanged.
- New tests for the multipliers.
- A smoke step that starts a game at each level and checks the share of finds and the caps.

## Step 5 — Auto graphics level (item 5)

**Plan:**
1. **A new graphics option, Auto,** the default for new players.
2. **Watch the frame rate:** after the first 30 seconds of play, watch it for 20 seconds. Below about
   20 fps, step down one level and say so in a toast. Check again after each step, down to Low.
3. **Never step up on its own.** That avoids flip-flopping.
4. **The player's choice wins:** choosing a level by hand turns Auto off.

**Checks:** a smoke step that fakes a low frame rate and expects one step down; and a hand-picked
level is never changed.

## Step 6 — Animal journal (item 7)

**Plan:**
1. **A journal page** in the pause menu, with one card per kind of animal.
   - An animal Caspar hasn't met is a dark silhouette with "???".
   - The first time one is on screen and close enough to see, its card fills in, with the day and
     the biome.
2. **A toast for each first sighting:** "New animal: Fox!"
3. **Badges:** one for spotting every animal in a biome, and one each for the rare ones (fox, boar,
   the herds, the shark, the bears).
4. **Saving:** sightings go in the save (`G.seen`). Old saves start with an empty journal.

**Checks:** a smoke step spawns an animal in view, and the card, the toast and the save all fill in.

## Step 7 — Ride the horse (item 8)

**Plan:**
1. **Taming:** wild horses (and the donkey and alpaca) are skittish. Feed one by hand a few times, on
   different days, and it lets you ride it.
2. **Riding:** press E to get on and E to get off.
   - Riding is much faster than walking, and uses the horse's walk and gallop animations.
   - No tools or fighting while riding. The horse won't go into deep water, so you get off at the
     shore.
3. **The horse stays tame and is saved,** like Scout, and waits where you left it.
4. **Animals react:** wolves still chase. If the horse is hurt it throws you off and runs a short way.

**Open questions for play-testing:**
- How fast should riding be?
- Does the horse get hungry?
- Can Scout keep up?

**Checks:**
- Smoke steps: tame, ride across a biome, get off at a lake, save and continue with the horse still
  tame.
- The island fingerprint is unchanged.

## Step 8 — Matching models (item 10)

**Problem:** these still use hand-built models next to the new animated animals:
- the goat and the rabbit
- Uncle Ray
- the player

The scorpion and the Dune King are being done in the separate "Scopian model update" session, so
they're left out here.

**Plan:**
1. **Find matching models** in the Quaternius CC0 packs: animated people for Ray and the player;
   goat and rabbit if the packs have them.
2. **Ask before downloading,** with each file's name, source and size.
3. **Wire them in the same way as the animals:** clips linked to behaviour, the hit-flash kept, size
   matched to the collision radius.
4. **Credit any new source** in the About box.

**Checks:** model screenshots, the smoke steps that involve them, and a play test.

---

## Item 6 — The story for the middle of the game (waiting for Caspar)

Caspar is choosing the flavour in the doc made for him. It has five high-level choices plus his own
ideas, and gives no spoilers.

**Plan:**
- **Once his picks are in,** write the story plan somewhere he won't see it: a separate file he
  agrees not to open.
- **Then build it** as its own set of steps.
- **Keep it secret:** nothing in this file, or in the doc he reads, says what will actually happen.
