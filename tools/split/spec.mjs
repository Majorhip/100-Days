// Where every part of the original game script goes (Phase 4).
//
// Each entry starts a block at the top-level statement that declares `at` (or at line 1 for
// 'START'), together with the comments and blank lines just above it. The block runs up to
// the next entry. Entries are in original order and together cover the whole script.
// `step` is the Phase 4 step that moves it (4.N -> N); anything with a later step stays in
// src/legacy.js. A file can receive several blocks (give each an `id`).
// Files under src/game/ and src/data/ follow the standing rule (MIGRATION.md §4): the
// generator marks anything there that reaches into R, the page or three.js with TODO(split).
export const SPEC = [
  // ---- 00_core ----
  { step: 2, at: 'START', file: 'src/core/math.js', id: 'helpers', what: 'Maths helpers: clamp, lerp, smoothstep, distances, random picks, angle difference.' },
  { step: 2, at: '$', file: 'src/ui/dom.js', what: 'Page helper: $(id) finds an element on the page.' },
  { step: 2, at: 'angDiff', file: 'src/core/math.js', id: 'angDiff' },
  { step: 2, at: 'mulberry32', file: 'src/core/rng.js', what: 'Seeded random numbers. wr() is the world-generation RNG: the island is built from it in a fixed order, so call order matters.' },
  { step: 2, at: 'hash2', file: 'src/core/noise.js', what: 'Value noise and fractal noise for terrain and biomes (seeded by WORLD_SEED).' },
  { step: 2, at: 'DAY_LENGTH_SECONDS', file: 'src/core/constants.js', what: 'Time, save and world constants. Every rate in the game is per game hour.' },
  { step: 2, at: '_tmpM', file: 'src/core/geometry.js', what: 'Low-poly model helpers: primitive shapes, coloured parts with per-triangle jitter, merging.' },
  // ---- 02a_gfx_core (with the game state, which sits inside it in the original) ----
  { step: 3, at: 'GU', file: 'src/gfx/core.js', what: 'Graphics core: shared shader uniforms, upgraded fog (patches three.js r128 shader chunks), the lit-material factory.' },
  { step: 2, at: 'newGameState', file: 'src/state.js', what: 'Game state. G is everything saved; R is runtime only (renderer, meshes, timers, UI state).' },
  // ---- 01_audio ----
  { step: 4, at: 'AU', file: 'src/audio/audio.js', what: 'Sound: every effect is synthesised with WebAudio (no sound files).' },
  // ---- 02_world ----
  { step: 5, at: 'PEAK', file: 'src/world/terrain.js', what: 'Kestrel Island terrain: biomes, heights, lakes, landmark sites, terrain colours.' },
  { step: 5, at: 'SH_CELL', file: 'src/world/collision.js', what: 'Spatial hash for colliders and nodes, and circle/box collision.' },
  { step: 5, at: 'SKY_KEYS', file: 'src/world/sky.js', what: 'Sky colour keys through the day, night amount, and puffs of smoke/dust.' },
  // ---- 02b_gfx ----
  { step: 6, at: 'GFXQ', file: 'src/gfx/quality.js', what: 'Graphics quality tiers: Low / Medium / High / Ultra.' },
  { step: 6, at: 'makeNoiseTex', file: 'src/gfx/textures.js', what: 'Generated textures and shared graphics state (GFX).' },
  { step: 6, at: 'terrainMaterial', file: 'src/gfx/terrain.js', what: 'Terrain mesh, material and the baked grass/height maps.' },
  { step: 6, at: 'waterMaterial', file: 'src/gfx/water.js', what: 'Water shader.' },
  { step: 6, at: 'buildSky', file: 'src/gfx/sky.js', what: 'Shader sky, sun, moon, stars and lighting through the day.' },
  { step: 6, at: 'rainField', file: 'src/gfx/weather.js', what: 'Rain, snow and lightning.' },
  { step: 6, at: 'buildFx', file: 'src/gfx/fx.js', what: 'Particle puffs and fire flames.' },
  { step: 6, at: 'gfxBuildGrass', file: 'src/gfx/grass.js', what: 'GPU grass field and wind on trees and plants.' },
  { step: 6, at: 'buildLife', file: 'src/gfx/life.js', what: 'Wildlife flourishes: small ambient animated life (visual only).' },
  { step: 6, at: 'PP', file: 'src/gfx/post.js', what: 'Post-processing: HDR, bloom, sun shafts, colour grade; the final render.' },
  { step: 6, at: 'gfxLightPool', file: 'src/gfx/update.js', what: 'Per-frame graphics update and the pool of fire/torch lights.' },
  // ---- 03_data (moved in Phase 4.1) ----
  { step: 1, at: 'ITEMS', file: 'src/data/items.js', what: 'Every item: resources, food, tools and weapons, wearables, story items. Plus the hotbar slots and bare hands.' },
  { step: 1, at: 'RECIPES', file: 'src/data/recipes.js', what: 'Crafting recipes: what each item costs and where it can be made.' },
  { step: 1, at: 'BUILDS', file: 'src/data/buildings.js', what: 'Building pieces: cost, how they snap to the grid, and what they do.' },
  { step: 1, at: 'CREATURES', file: 'src/data/creatures.js', what: 'Animals, predators and bosses: health, speed, damage, senses and loot.' },
  { step: 1, at: 'NOTES', file: 'src/data/story.js', what: 'Story text: notes, dialogue, the intro, landmark names, badges and tips.' },
  // ---- 04_nodes ----
  { step: 7, at: 'NT', file: 'src/world/nodes.js', what: 'Trees, rocks, plants and pickups: types, placement (world RNG), instanced meshes.' },
  { step: 7, at: 'nodeNear', file: 'src/world/gathering.js', what: 'Gathering: finding, hitting, picking, depleting and respawning nodes.' },
  // ---- 05_models ----
  { step: 8, at: 'UNIT_BOX', file: 'src/models/animals.js', what: 'Procedural animal models (and the box helper they share).' },
  { step: 8, at: 'humanModel', file: 'src/models/people.js', what: 'Procedural person model (Sam, Uncle Ray).' },
  { step: 8, at: 'toolModel', file: 'src/models/tools.js', what: 'Procedural tool and weapon models held in the hand.' },
  { step: 8, at: 'WOODC', file: 'src/models/structures.js', what: 'Procedural models for buildable structures.' },
  // ---- 06_player ----
  { step: 9, at: 'inv', file: 'src/player/inventory.js', what: 'Inventory, tools in hand, worn items, experience and levels.' },
  { step: 9, at: 'ambientTemp', file: 'src/game/survival.js', what: 'Survival rules: temperature, hunger, thirst, warmth and stamina per game hour.' },
  { step: 9, at: 'hurtPlayer', file: 'src/player/health.js', what: 'Damage, blackouts, eating and drinking.' },
  { step: 9, at: 'FLOORS', file: 'src/player/movement.js', what: 'Ground height (including built floors) and player movement.' },
  { step: 9, at: 'refreshViewModel', file: 'src/player/viewmodel.js', what: 'The tool held in view and the swing animation.' },
  { step: 9, at: 'POIS', file: 'src/player/targeting.js', what: 'Points of interest, proximity targeting (dot product), prompts and actions.' },
  { step: 9, at: 'shootBow', file: 'src/player/bow.js', what: 'Bow and arrows.' },
  { step: 9, at: 'startFishing', file: 'src/player/fishing.js', what: 'Fishing.' },
  { step: 9, at: 'setupInput', file: 'src/input/keyboard.js', what: 'Keyboard and mouse input, pointer lock, hotbar selection.' },
  // ---- 07_build ----
  { step: 10, at: 'STRUCT', file: 'src/build/structures.js', what: 'Built structures: colliders, spawning, removing, rebuilding from the save.' },
  { step: 10, at: 'startBuild', file: 'src/build/placement.js', what: 'Build mode: the ghost, snapping, placing and dismantling.' },
  { step: 10, at: 'isRoofed', file: 'src/build/use.js', what: 'Using structures: roofs, prompts, fire (empty / loaded / lit), fuel.' },
  { step: 10, at: 'structuresStep', file: 'src/build/update.js', what: 'Structures over time: fuel burn, new day, nearest flame, per-frame update.' },
  { step: 10, at: 'trySleep', file: 'src/build/sleep.js', what: 'Sleeping.' },
  // ---- 08_creatures ----
  { step: 11, at: 'spawnCreature', file: 'src/creatures/creatures.js', what: 'Creatures: spawning, damage, death and AI.' },
  { step: 11, at: 'spawnPoint', file: 'src/creatures/spawner.js', what: 'The spawner and Wolf Moon raids.' },
  { step: 11, at: 'initScout', file: 'src/creatures/scout.js', what: 'Scout the dog.' },
  // ---- 09_story ----
  { step: 12, at: 'CHESTS', file: 'src/story/props.js', what: 'Props, notes, points of interest and treasure chests.' },
  { step: 12, at: 'buildLandmarks', file: 'src/story/landmarks.js', what: 'Every landmark on the island.' },
  { step: 12, at: 'refreshPack', file: 'src/story/ray.js', what: 'The dropped backpack and Uncle Ray.' },
  { step: 12, at: 'checkLandmarks', file: 'src/story/quests.js', what: 'Discovering landmarks, badges, tips, quests and the story day by day.' },
  // ---- 10_ui ----
  { step: 13, at: '_dirty', file: 'src/ui/feedback.js', what: 'Hints, toasts, loot rows, banners, screen flashes and floating numbers.' },
  { step: 13, at: 'METERS', file: 'src/ui/hud.js', what: 'The HUD: meters, compass, clock, minimap label.' },
  { step: 13, at: 'FOG_N', file: 'src/ui/map.js', what: 'Fog of war, the minimap and the big map.' },
  { step: 13, at: 'openPanel', file: 'src/ui/panels.js', what: 'Panels: pack, crafting, building, fire, chest, journal, messages, dialogue, endings.' },
  { step: 13, at: 'helpHTML', file: 'src/ui/settings.js', what: 'How to play and the settings panel.' },
  { step: 13, at: 'saveSettings', file: 'src/save.js', id: 'settings', what: 'Saving and loading: settings, the game save, merging old saves, restoring the world.' },
  // ---- 11_main ----
  { step: 14, at: 'advanceTime', file: 'src/game/time.js', what: 'Time and weather rules: advancing the clock, the weather chain, a new day.' },
  { step: 14, at: 'saveGame', file: 'src/save.js', id: 'save' },
  { step: 14, at: 'setQuality', file: 'src/boot.js', what: 'Boot: renderer and scene, the title screen and intro, starting a game, the game loop.' },
  // ---- 12_touch ----
  { step: 14, at: 'IS_TOUCH', file: 'src/input/touch.js', what: 'Phone and tablet support: virtual joystick, drag-to-look, on-screen buttons, touch wording.' }
];
