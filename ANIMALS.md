# Animals: better models and more of them

The next stage after the migration (MIGRATION.md §8, item 2), widened by Caspar's request for a larger variety of animals.

## 1. What we have

**22 free animated models by Quaternius**, all CC0 (public domain: no credit required), in `assets/animals/raw/`. `assets/animals/sources.tsv` lists the source page of each.
- They come from Poly Pizza. Quaternius's own Google Drive download refused with "quota exceeded".
- `node tools/animals/inspect.mjs` lists what is inside each one.
- `node tools/animals/lineup.mjs <dir>` renders them on the island, in the game's own lighting and materials, next to the hand-built models. The shots are in `docs/animals/`.

| Model | Animations we'd use | Verdict |
|---|---|---|
| Wolf, Fox, Husky, Shiba Inu | Idle, Walk, Gallop, Attack, Death, hit reacts, Eating | ✅ same style as the game, a big step up |
| Deer, Stag | Idle, Walk, Gallop, Headbutt, Kick, Death, Eating | ✅ |
| Horse (brown, white), Donkey, Alpaca, Bull, Cow | the same set as the deer | ✅ |
| Frog, Rat, Spider, Snake, Crab, Bat | Idle, Walk/Jump/Fly, Attack, Death | ✅ match each other; a little cartoonier |
| Pig | Idle, Walk, Run, Headbutt, Death | ✅ (textured, but fits) |
| Shark, Fish | Swim, Swim_Fast, Swim_Bite | ✅ |
| Bunny | Wave, Punch, Yes/No… | ❌ a standing cartoon character, not an animal. **Dropped**: the rabbit and hare keep their box models. |

**No animated match** (until the bears were made, see 4a) for the bear (and the Grizzle and Frostclaw bosses), the goat, or the scorpion (and the Dune King). They keep their hand-built models.

Two notes from the inspection:
- Every Ultimate-pack model stores each animation twice (`Walk` and `AnimalArmature|Walk`). Dropping the copies and the unused clips roughly halves the size.
- glTF colours are linear, and the game uses its hex colours as they are, so colours must be converted to sRGB on load. Without that, everything renders nearly black.

## 2. Where they go

| Creature | Model | Where | Behaviour | Loot |
|---|---|---|---|---|
| Wolf | Wolf | forest | as today | as today |
| Red wolf (Wolf Moon) | Wolf, dark grey, red eyes | raids | as today | as today |
| Snow wolf | Wolf, white, blue eyes | Frostpeak | as today | as today |
| Deer | Deer (does) and Stag (bucks) | forest | as today; a stag sometimes headbutts if cornered | as today |
| Ray's dog (scout) | Shiba Inu, red collar | Ray's camp | as today | — |
| **Fox** | Fox (white in the snow) | forest, Frostpeak | shy, very fast, flees early | 1 raw meat, 1 fur |
| **Wild boar** | Pig, recoloured brown | forest | peaceful until hit, then charges | 3 raw meat, 1 hide |
| **Snake** | Snake | desert, long grass | bites only if you come close | 1 hide |
| **Crab** | Crab | beaches | pinches if cornered | 1 raw meat, 1 chitin |
| **Spider** | Spider | caves, the mine, the grotto | hostile | 2 fibre |
| **Frog** | Frog | lake edges | hops away | — |
| **Bat** | Bat | caves, at night | flutters about, harmless | — |
| **Horse, Donkey, Alpaca** | their models | grassland, desert edge | wild herds, peaceful, flee when chased | none: not for hunting |
| **Shark** | Shark | the open sea | circles a player swimming in deep sea water and bites. A reason to watch your stamina; it gives up when you reach the shallows | — |
| **Fish** | Fish | lakes | small schools you can see from the shore, where fishing is good | — |

Not used for now: Bull, Cow and Rat. A farm or a pet for Ray's camp could use them later.

All numbers (health, speed, damage) will be set in `src/data/creatures.js` next to the existing ones and explained there. The new creatures use existing items, so there are no new recipes.

## 3. How it's built

1. **Asset step** (`tools/animals/build.mjs`): from `raw/`, keep only the clips we use, remove the duplicates and write compact `.glb` files to `assets/animals/game/`. This would use **glTF-Transform**, an MIT-licensed development tool that isn't shipped in the game.
2. **Embedding:** the game stays one HTML file. The models are inlined into it, adding about 3–5 MB, which is fine (you said a bigger file is fine for graphics and playability).
3. **Loading:** all models are parsed during the loading screen, before the island is built (the island and its random numbers don't change). Each creature gets a `SkeletonUtils.clone`. **If any model fails to load, that animal falls back to its hand-built model**, so the game always starts.
4. **One adapter** (`src/models/gltf-animals.js`) gives each model the same shape the creature code uses today (`g`, `h`, `mats`, …), plus an `AnimationMixer`:
   - The behaviour state picks the clip: idle → Idle, wander → Walk, chase/flee → Gallop, wind-up → Attack, hit → HitReact, dead → Death.
   - Clips blend over 0.2 s, and walking speed sets the playback rate, so feet don't slide.
   - **The bite lands when the attack animation's head is furthest forward.** (Step A did this the other way round: the clip is timed to the game's existing bite, so the fight's timing and balance are unchanged. The models have no jaw bone, so the lunge is the bite.)
   - The red hit flash stays, using the game's material.
   - Each model is scaled to the creature's collision radius.
   - Recolours (red and snow wolves, arctic fox, boar) only change material colours.
5. **Spawning:** the spawner gets per-place tables (beach, lake edge, cave, sea, night) for the new creatures. Herds spawn in groups of 2–4.

## 4. Order of work (each step tested, then you or Caspar play it before the next)

| Step | What | Done when |
|---|---|---|
| **A. Wolf pilot** ✅ done | asset step, loader, adapter, fallback; wolf, red wolf, snow wolf | wolves look and fight right in a night with wolves and a Wolf Moon; no page errors; you've played it |
| **B. Familiar faces** ✅ done | deer/stag, fox, Ray's dog | |
| **C. New wildlife** ✅ done | boar, snake, crab, spider, frog, bat | each spawns in its place, behaves and drops loot |
| **D. Herds and water** ✅ built, waiting for a play test | horse, donkey, alpaca; shark; fish | |

**Tests for every step:**
- The island fingerprint: its "models" part is re-recorded on purpose. Everything else (terrain, trees, nodes, sites) must stay identical.
- The smoke test: spawn each new creature, check its clips play and it can be hit and killed, with zero page errors.
- New reference screenshots of the line-up.

## 4a. Changes along the way
- **Snow wolves** ignore the hand-held torch; only the new **Crystal Lantern** (2 Glow Crystals, 1 iron, 1 rope at the Workbench) scares them. Campfires and torch posts still do.
- **Bears:** the free packs had no animated bear. The user sent a static one ("Black bear" by Poly by Google, CC BY 3.0, in `assets/animals/raw/BlackBear/`). It has to serve the Grizzle and Frostclaw too, so it was rigged and animated in Node (`tools/animals/rig-bear.mjs`; see `docs/animals/bears/README.md`), with a dark grizzled Grizzle (orange eyes, a scar) and a white Frostclaw with ice shards. **Done:** all three are in the game. The bosses roar before a charge (and gallop into it), and Frostclaw rears up and crashes down for its jump. The title screen carries the CC BY credit. Screenshots: `docs/animals/bosses/`.
- **Scorpion & Dune King:** at Caspar's request, a new look based on "Black Scorpion" by Google's Data Arts Team (3 Dreams of Black, [poly.pizza/m/KNyBkzAocc](https://poly.pizza/m/KNyBkzAocc)): a faceted near-black body, a tall tail arching forward to a hooked stinger, big forward pincers, eight legs. That glTF can't be used in the game — it has no skeleton and only one "skitter" morph clip, so it can't drive walk/chase/attack/death — so the look was rebuilt by hand in `src/models/scorpion.js`, returning the same shape as the old `scorpionModel()` (the leg skitter, the tail raise and the hit flash are unchanged). `gltfAnimal()` returns it for the scorpion and the Dune King (bigger, with a golden crown and gold glow); the original `scorpionModel()` stays as the fallback. No asset of theirs ships, so no credit is required. **Done.**

## 5. Credits

All models: **Quaternius** (quaternius.com), CC0, via poly.pizza. CC0 needs no credit, but the game's credits line will thank him anyway.
