# Golden reference (Phase 1)

What "the same game" means, recorded from `original/Stranded-100-Days-PC.html` (SHA-256 `F292FE87D7BFFA0EBD8E070A45CA67994509444A5462FF859A615CC61FC50B3A`) before anything was changed. Every script takes an optional target: a file path or a URL (for example `dist/index.html` or `http://localhost:5173/`). With no target it uses the original.

The scripts drive the Chrome installed on this PC through `puppeteer-core`, with a throwaway browser profile, so real saves are never touched.

| Check | Command | Pass |
|---|---|---|
| Island | `node tests/golden/fingerprint.mjs [target]` | prints `PASS` (hash identical) |
| Save | `node tests/golden/savecheck.mjs [target]` | prints `PASS` (fixture loads; day, inventory, structures match) |
| Graphics | `node tests/golden/screenshots.mjs [target]` | shots in `shots-latest/` match `shots/` by eye |

`--write` on `fingerprint.mjs` or `screenshots.mjs` re-records the golden files. Only do that from the original file.

## World fingerprint (`world-fingerprint.json`)
These are SHA-256 hashes of:
- the exact terrain heights (201 × 201)
- every node's type, position, scale, rotation and HP (2,909 nodes)
- each node's colour tint, which is drawn from the world RNG straight after placement, so it catches a change in RNG call order
- the lakes
- the landmark sites, including their flattened heights
- the start point

There's an overall hash plus one hash per part, so a failure names what changed. Checked: two runs give the same hash, and bumping `WORLD_SEED` by one fails it.

The script reads the game's top-level variables (`HGT`, `NODES`, `LAKES`, `SITES`, `NODE_MESH`, `R`). That only works while the game is a classic `<script>`. Phase 3 will need a small read-only debug hook to expose them.

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

Each view loads the fixture save, sets the position, time and weather, freezes the clock and waits 9 s for the sky and fog to settle. `Math.random` is seeded in the test browser only.

**Noise baseline:** recapturing the unchanged original gives a mean colour difference of **0.6–4.7** (out of 255) per shot, mostly from grass moving in the wind, rain and animals. The meadow and storm views are the noisiest (up to ~4.7), and the figure depends on the frame rate at capture time: the golden shots were taken at ~13 fps, later runs at ~30 fps. A real visual change shows up well above that, and you should still look at the images.

## Phase 2 result (Vite scaffold)
- `node tests/golden/compare-build.mjs` passes: both inline scripts in `dist/index.html` are byte-identical to the original, and so are the CSS text and the markup. The only extra is Vite's trailing `/*$vite$:1*/` CSS comment. Size: 959,144 bytes, against 959,102.
- The fingerprint and save check pass against `dist/index.html` opened from disk and against `npm run dev`.
- The screenshots from both match by eye. Their differences (1.5–4.7) equal a control run of the original at the same frame rate (1.5–4.5).
- On the dev server the browser asks for `/favicon.ico` and gets a 404. The original has no favicon either.
