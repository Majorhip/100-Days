# The bears: rigged and animated

The free animal packs had no animated bear, so the static **"Black bear" by Poly by Google** (CC BY 3.0, <https://poly.pizza/m/56ym_pyVnel>, in `assets/animals/raw/BlackBear/`) was given a skeleton and clips here. It also serves the two bear bosses.

| File | What it is |
|---|---|
| `assets/animals/game/Bear.glb` | the black bear, with its own texture |
| `assets/animals/game/Grizzle.glb` | Old Grizzle: a new dark-brown texture with lighter, grizzled fur on the hump and back, darker legs, three pale claw marks across his left eye; orange eyes |
| `assets/animals/game/Frostclaw.glb` | Frostclaw: a new white and ice-blue texture (painted, not tinted), a dark slate nose, glowing blue eyes, and 10 ice shards along the spine as separate meshes, each on the back bone under it |

All three share one skeleton and the same clips. Forward is +z, as for the Wolf. They are 1.5 m tall at scale 1 (Frostclaw's ice reaches 1.82 m).

## Credit

> Black bear by Poly by Google, CC BY 3.0 (https://poly.pizza/m/56ym_pyVnel). Rigged, animated and retextured for this game.

CC BY needs this credit in the game, for example on the title screen next to the Quaternius thanks, and it asks that changes are mentioned (the last sentence).

## How to rebuild

```
node tools/animals/rig-bear.mjs                 # writes the three .glb files (about 10 s)
node tools/animals/bears.mjs docs/animals/bears  # in-game screenshots (about 3 min)
node tools/animals/bear-view.mjs --jobs "out.png|/assets/animals/game/Bear.glb|Walk|8|side,front,three|2.6|0"
node tools/animals/measure.mjs "Bear=1.5@Toe[LR]$"
```

| Script | What it does |
|---|---|
| `tools/animals/rig-bear.mjs` | reads the OBJ and PNG, cuts a mouth, builds the skeleton and skin weights, adds eyes, poses every clip frame by frame, paints the boss textures, writes the files with glTF-Transform. It warns when a planted paw can't reach its spot (see below). `--textures <dir>` also saves the three textures as PNGs. |
| `tools/animals/bear-clips.mjs` | the clips, as code: body curves plus where each paw goes |
| `tools/animals/png.mjs` | a small PNG reader and writer (Node's zlib), so no new dependency was needed |
| `tools/animals/bears.mjs` | the in-game screenshots in this folder: the line-ups and each clip at a few moments, in the game's own lighting and materials (uses `lineup.js`, which now also loads `game:<File>@<clip>@<seconds>`) |
| `tools/animals/bear-view.mjs` | contact sheets with orthographic side, front and 3/4 views, one row per moment; `bones` 1 draws the skeleton, `w` colours vertices by bone; `DUMP=<regex>` prints bone positions and any vertex below the ground. The sheets in `sheets/` come from it. |

## What was chosen, and why

- **No Blender here**, so everything is done in Node with what the project already had: three.js (`0.128.0`) for the maths and glTF-Transform 4.5.1 to write the files. Nothing new was downloaded or installed.
- **The skeleton** (24 bones, all unrotated in the bind pose so a clip's rotation is simply "from standing"): Root, Hips, Spine1, Spine2, Neck, Head, Jaw, Tail; per leg UpperArm/ForeArm/FrontPaw (front) or Thigh/Shin/HindPaw (hind), plus a Toe tip bone with no weights that marks the claws, for the solver and for measuring. The shoulder and hip pivots sit high in the body, so the shoulders roll as a bear's do.
- **Skin weights from position:** a smooth blend along the spine by distance along the body; each leg is a column under its shoulder or hip that reaches up into the body and fades out towards the belly, with the elbow, wrist, knee and ankle blended over a few centimetres; then two passes of smoothing over the mesh's neighbours. At most four bones per vertex.
- **The mouth:** the mesh's snout was closed. The underside of the snout (the lower jaw) was cut free along the lip line and a dark band of "Mouth" faces joins the two lips, folded into the head so it is hidden while the mouth is shut. The jaw opens about 35 degrees for the roar.
- **Eyes** are small flattened balls on the head, placed where the texture's eye dots are, with a material of their own named `Eyes` so the game can recolour them and make them glow (as it does for the wolves' `Eyes_Black`).
- **Clips are posed by code, frame by frame (60 fps, 30 for Idle and Eating), with the legs placed by inverse kinematics.** For walking and galloping each paw follows a path: on the ground it moves backwards in a straight line at exactly the clip's ground speed, then it peels off heel first, swings forward with the wrist curled and lands toe up. The solver bends the elbow back and the knee forward. So the paws do not slide, and the game can speed the clip up or slow it down to match how fast the bear moves (as it does for the wolf). A lifted paw, such as in the swipe or the rearing, is posed by hand and blended back to the solver as it lands.
- **The boss textures are painted from the original** at 1024 x 1024, using where each texel lies on the body (every face is rasterised in texture space). This keeps the original's shading and edge lines, but lets the Grizzle have grizzled tips only on the hump and back and darker legs, the claw marks follow the curve of his face, and Frostclaw have bluer shadows and legs, a frosty back and a dark nose. The original 2048 texture is halved too, since it is mostly flat colour.

## Clips

Measured with `tools/animals/measure.mjs` (feet regex `Toe[LR]$`) at the bear's height of 1.5 m. Speeds scale with height.

| Clip | Length | Loops | What it does | Numbers |
|---|---|---|---|---|
| Idle | 4.0 s | yes | breathes, looks about, sniffs | |
| Walk | 1.0 s | yes | four-beat walk: left hind, left front, right hind, right front; head low and swinging, shoulders rolling | **ground speed 0.92 m/s** (designed 0.94) |
| Gallop | 0.62 s | yes | rotary gallop: both hind paws, both front paws, then a gathered leap; the back arches and stretches | **ground speed 3.58 m/s** |
| Attack | 1.1 s | no | rears the chest, raises the right paw, rakes it down and across while the head lunges in and bites; the paw lands forward and steps back | **bite (head furthest forward) at 0.517 s** |
| Death | 2.0 s | no | head up in pain, the legs fold and it sinks onto its belly, then it rolls onto its right side, the top legs going limp; ends lying still (the root ends back near where it stood) | |
| Idle_HitReact_Left / Right | 0.6 s | no | flinches away from the side that was hit, head turned away, mouth open | |
| Roar | 1.6 s | no | for the boss's wind-up ('tele', 0.95 s): head down to draw breath, then up with the mouth wide, shaking its head | mouth widest from 0.48 s |
| Slam | 1.8 s | no | for Frostclaw's jump: rears up on its hind legs with its arms out, crashes down onto its front paws, then steps back to standing | **front paws hit the ground at 0.95 s**, the length of 'tele', so started at the start of 'tele' it lands when the game shakes the ground |
| Eating | 3.2 s | no | nose to the ground, nuzzling and chewing, then back up (the game plays Eating now and then when idle) | |

Facing is +z (measured `facing: 1`).

### For wiring it into the game (the main session's call)

These are suggestions; nothing in `src/` was changed.

- `KINDS` (`src/models/gltf-animals.js`):
  - `bear: { file: 'Bear', height: 1.5, scale: 1, colors: {} }`
  - `grizzle: { file: 'Grizzle', height: 1.5, scale: 1.55, colors: { Eyes: { c: 0xff9a2a, glow: true } } }`
  - `frostclaw: { file: 'Frostclaw', height: 1.82, scale: 1.7, colors: { Eyes: { c: 0x39d0ff, glow: true }, Ice: { c: 0x8fdcff, glow: true } } }`. The game sizes each model by its whole height in the Idle pose, ice included, so 1.82 keeps Frostclaw's body the same size as the other two.
- `CLIP_INFO`: `Bear` and `Grizzle`: `{ at: 1.5, walk: 0.92, run: 3.58, bite: 0.517, runAt: 2.4, attack: 'Attack' }`. `Frostclaw` is measured at its whole height of 1.82 m, where its body is the same size as the others, so its numbers are the same: `{ at: 1.82, walk: 0.92, run: 3.58, bite: 0.517, runAt: 2.4, attack: 'Attack' }`. (`runAt` is a suggestion: the bear wanders at 1.6 m/s and goes home at 2.7.)
- `anim()` would need two more states for the bosses: 'tele' plays Roar, or Slam from its start when `c.mode === 'slam'` (both once, clamped); 'charge' plays Gallop; 'stun' could play a hit react or Idle (the game already wobbles the bear).
- Bosses' attack wind-up is 0.55 s, so their Attack clip starts at 0 s rather than 0.517 − 0.55; the swipe's wind-up then is a little shorter than the clip's, which looks fine.

## Checking it

- `00-lineup-bear.jpg`: hand-built bear, the new bear, and the new wolf for scale. `00-lineup-bosses.jpg`: hand-built and new Grizzle, hand-built and new Frostclaw.
- `01`–`09`: each clip at a few moments, the three bears side by side: walk at four quarter-strides, gallop at four moments, the attack wind-up, **full reach (0.44 s)**, bite and recovery, the death, both hit reacts, the roar, the slam (top of the rear-up, the impact), eating. `-3q` shots are three-quarter views. `10-grizzle-face.jpg` is the Grizzle's scarred side.
- `sheets/`: orthographic contact sheets (side, front, 3/4) of walk, gallop, attack, death, slam, hit react and the open mouth.
- The build warns when a planted paw cannot reach where it should be. In the final build the walk and gallop paws always reach (the gallop at most 0.9 cm short at a touchdown), Idle and Roar under 1 cm, and the hit reacts 1.9 cm for a moment. Attack, Death and Slam show bigger numbers, but those are paws lifted and posed by hand at the time, so they don't matter.

## What I'd still improve

- **The low-poly mesh has few edge loops at the joints**, so a front leg raised high (the swipe's wind-up) pinches the shoulder a little, and the haunch creases in the gallop's gathered phase. Adding a loop at the shoulder and hip in a modelling tool would fix it.
- **The open mouth** shows the snout's pale underside as the lower jaw, and there are no teeth. Fine at play distance; a close look at the roar shows it.
- **Death**: the legs on top end straight out to the side, a little stiff. A softer, more varied final pose would read better.
- **Gallop**: the gathered moment looks hunched; a real bear's gallop rolls more. It reads well in motion.
- **Hand-tuned, not motion-captured**: the gaits are built from smooth curves, so they are regular. A little per-stride variation would make a herd less uniform (only one bear is usually on screen).
- The three files repeat the clips and the mesh; only the texture and the ice differ. One file with three textures would save about 100 KB, but the game's loader works per file, so they are separate for now. Together they are about 1.9 MB (mostly the three 1024 textures), which adds about 2.5 MB to the single-file game.
