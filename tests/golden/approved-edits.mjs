// The ledger: every change to the original game code that is NOT a plain move.
//
// tests/golden/compare-build.mjs undoes each entry before comparing the code with the
// original script byte for byte. Anything that differs from the original and is not listed
// here makes the check fail. tools/split/split.mjs applies the same entries when it
// generates the files, so this list is the single source of truth.
//
// kinds
//   replace  the text `now` stands where the original had `was`: exactly once across all of
//            src/, in whichever file that code currently lives
//   add      `line` is a new line of code in `file`, outside moved code (exactly once)
//   remove   the original line `text` was dropped; a `// @removed: <text>` marker stands in
//            its place (in whichever file that part of the code lives)
//   module   `file` is a new module, added after the migration: no original code in it, so it
//            is not part of the map. `globals` lists browser globals it may use that the
//            original never did. Everything else in compare-build still applies to it.
//
// `when: <file>` means the entry applies only once that file exists (from the Phase 4 step
// that creates it). Every entry says why. Keep this list short: a migration that needs many
// edits is a rewrite.
export const EDITS = [
  {
    kind: 'remove', text: "'use strict';",
    why: 'ES modules are always strict. Inside a module, after the imports, this line is no longer a directive, only a stray string.'
  },
  {
    kind: 'add', when: 'src/state.js', file: 'src/state.js', line: 'function setG(v) { G = v; }',
    why: 'MIGRATION.md §7: loading a save replaces G. Other modules cannot assign to an imported binding, so the two assignments go through setG(). ES module imports are live bindings, so every module sees the new G at once.'
  },
  {
    kind: 'replace', when: 'src/state.js', was: 'G = mergeSave(s);', now: 'setG(mergeSave(s));',
    why: 'Continue: replace the game state via setG() (see the setG entry).'
  },
  {
    kind: 'replace', when: 'src/state.js', was: 'G = newGameState(); G.p.x', now: 'setG(newGameState()); G.p.x',
    why: 'New Adventure: replace the game state via setG() (see the setG entry).'
  },
  {
    kind: 'add', file: 'src/main.js', line: 'window.__stranded = ALL;',
    why: 'Read-only view of every module for the parity checks in tests/golden (a module namespace cannot be assigned to from outside).'
  },

  // ---- after the migration: Export / Import save (MIGRATION.md §7, insurance before shipping) ----
  {
    kind: 'module', file: 'src/ui/savefile.js', globals: ['Blob', 'URL', 'FileReader', 'alert', 'Date'],
    why: 'Export / Import save. New code, imported by src/main.js after the whole game has loaded (so it cannot change the original load order); it handles clicks on its own buttons, so the original click handling is untouched.'
  },
  {
    kind: 'replace', was: '<button data-a="save">💾 Save game</button>', now: '<button data-a="save">💾 Save game</button><button data-a="export">📤 Export save</button><button data-a="import">📥 Import save</button>',
    why: 'Pause menu: the Export save and Import save buttons (handled in src/ui/savefile.js).'
  },
  {
    kind: 'replace', was: '<button id="tHelp">❓ How to play</button>', now: '<button id="tHelp">❓ How to play</button><button id="tLoad">📂 Load a save file</button>',
    why: 'Title screen: load a save file, for a copy of the game that has no save yet (handled in src/ui/savefile.js).'
  },

  // ---- after the migration: swimming (the original walked the player along the lake bed) ----
  {
    kind: 'module', file: 'src/player/swim.js', globals: [],
    why: 'Swimming: in water deeper than 1.2 m the player floats at the surface (eyes ~0.4 m above it), swimming uses stamina, and running out of stamina hurts. The original stopped the player where the water got 1.25 m deep, but a lake bank, a teleport or a blackout could still put them on the bed, walking with the camera under water.'
  },
  {
    kind: 'replace', was: 'else p.stam = Math.min(100, p.stam + (moving ? 9 : 16) * dt);', now: 'else if (R.swim) swimTire(p, dt, moving); else p.stam = Math.min(100, p.stam + (moving ? 9 : 16) * dt);',
    why: 'Swimming: stamina drains instead of refilling while afloat (swimTire in src/player/swim.js).'
  },
  {
    kind: 'replace', was: "if (gh < -1.25) { if (!R.tips.deep) { R.tips.deep = 1; hint('The water is too deep to cross.');", now: "if (gh < SEA_LIMIT) { if (!R.tips.deep) { R.tips.deep = 1; hint('The sea is too rough out here. Swim back to the island!');",
    why: 'Swimming: deep water is no longer a wall. Only the open sea (deeper than 4.5 m, about 30 m past the beach) still stops the player; the lakes are at most 3.2 m deep.'
  },
  {
    kind: 'replace', was: '  p.vy -= 19 * dt; p.y += p.vy * dt;\n  if (p.y <= R.ground)', now: '  if (!swimStep(p, dt)) { p.vy -= 19 * dt; p.y += p.vy * dt; }   // afloat: src/player/swim.js\n  if (R.swim) { /* afloat */ } else if (p.y <= R.ground)',
    why: 'Swimming: while afloat, swimStep() replaces gravity and the snap to the ground (buoyancy holds the body at the float line, with a splash when jumping in).'
  },
  {
    kind: 'replace', was: 'eye = wading ? 1.25 : 1.62;', now: 'eye = wading && !R.swim ? Math.max(1.25, 0.4 - p.y) : 1.62;',
    why: 'Swimming: the eyes stay 0.4 m above the water while wading deeper and while afloat. The original crouched to 1.25 m, which put the camera at the waterline (flickering under water) in waist-deep water.'
  },
  {
    kind: 'replace', was: "const msg = { cold: 'You got too cold and blacked out.',", now: "const msg = { drown: 'You got too tired to keep swimming and blacked out.', cold: 'You got too cold and blacked out.',",
    why: 'Swimming: the blackout message for running out of stamina in the water.'
  },
  {
    kind: 'replace', was: 'G.pack = { x: p.x, z: p.z, items }; }', now: 'G.pack = Object.assign(packSpot(p.x, p.z), { items }); }',
    why: 'A blackout in deep water drops the backpack on the nearest shore instead of the lake bed, where it could not be seen or reached (packSpot in src/player/swim.js).'
  },
  // ---- after the migration: animated animal models (ANIMALS.md, step A: the wolves) ----
  {
    kind: 'module', file: 'src/models/gltf-animals.js', globals: ['Promise', 'Array'],
    why: 'Animated animal models (Quaternius, CC0), embedded in the game file. Each creature gets its own copy shaped like the hand-built models (g, legs, mats, h...) plus anim(c, dt), which plays the clip for its state. A model that is not loaded falls back to the hand-built one.'
  },
  {
    kind: 'module', file: 'src/models/posed-box.js', globals: ['isFinite'],
    why: 'The posed size of an animated model, from its vertices (shared by src/models/gltf-animals.js and tools/animals/measure.js).'
  },
  {
    kind: 'module', file: 'src/models/gltf-load.js', globals: [],
    why: 'Starts parsing the animal models when the file opens. Imported by src/main.js after the whole game has loaded, so the original start-up order is untouched.'
  },
  {
    kind: 'replace', was: 'model = ANIMALS[o.model || type]();', now: 'model = gltfAnimal(o.model || type) || ANIMALS[o.model || type]();',
    why: 'Animal models: a creature gets the animated model when there is one for it (the wolves, for now), otherwise the hand-built one.'
  },
  {
    kind: 'replace', was: 'if (o.geometry && o.geometry !== UNIT_BOX) o.geometry.dispose();', now: 'if (o.geometry && o.geometry !== UNIT_BOX && !o.geometry.userData.shared) o.geometry.dispose();',
    why: 'Animal models: every copy of an animated model shares its geometry, like the hand-built models share UNIT_BOX, so removing one creature must not dispose it.'
  },
  {
    kind: 'replace', was: 'c.dead = true; c.deadT = 0.45;', now: 'c.dead = true; c.deadT = c.model.deathT || 0.45;',
    why: 'Animal models: an animated creature plays its fall before it shrinks away (the hand-built ones shrink at once, as before). Loot, XP and the kill count still come at the moment of the kill.'
  },
  {
    kind: 'replace', was: 'if (c.dead) { c.deadT -= dt; c.g.scale.setScalar(Math.max(0.01, c.scale * c.deadT / 0.45)); if (c.deadT <= 0)', now: 'if (c.dead) { c.deadT -= dt; c.g.scale.setScalar(Math.max(0.01, c.scale * Math.min(1, c.deadT / 0.45))); if (c.model.anim) c.model.anim(c, dt); if (c.deadT <= 0)',
    why: 'Animal models: the shrink takes the last 0.45 s as before, and the death clip plays until then.'
  },
  {
    kind: 'replace', was: "c.g.rotation.z = c.state === 'stun' ? Math.sin(R.t * 9) * 0.06 : 0;", now: "c.g.rotation.z = c.state === 'stun' ? Math.sin(R.t * 9) * 0.06 : 0; if (m.anim) m.anim(c, dt);",
    why: "Animal models: play the animated model for each creature's state after it has moved (walk and gallop speed matched to how fast it goes; the bite timed to land when the game deals the damage)."
  },
  {
    kind: 'replace', was: "Made for Caspar · Built with three.js · '", now: "Made for Caspar · Built with three.js · Animals by Quaternius · '",
    why: 'Title screen credit for the animal models. They are CC0 (no credit required), but Quaternius deserves the thanks.'
  },
  // ---- after the migration: snow wolves fear only crystal light (the Crystal Lantern) ----
  {
    kind: 'module', file: 'src/models/lantern.js', globals: [],
    why: 'The Crystal Lantern model in the hand: an iron lamp with a glowing crystal.'
  },
  {
    kind: 'replace', was: "  torch: { n: 'Torch', e: ['🔥'], d: 'Lights the dark and scares wolves away while you hold it.', tool: { slot: 'torch', cls: 'torch', dmg: 6, reach: 2.6, tier: 1 } },", now: "  torch: { n: 'Torch', e: ['🔥'], d: 'Lights the dark and scares wolves away while you hold it.', tool: { slot: 'torch', cls: 'torch', dmg: 6, reach: 2.6, tier: 1 } },\n  lantern: { n: 'Crystal Lantern', e: ['🏮'], d: 'Frostpeak crystal in an iron lamp. Its blue glow scares away every wolf, even snow wolves, which laugh at torches.', tool: { slot: 'torch', cls: 'torch', dmg: 6, reach: 2.6, tier: 2, crystal: true } },",
    why: "Crystal Lantern: a torch-slot tool made from Glow Crystals (cls torch, so it lights, warms and scares wolves like the torch; tier 2, so it takes the torch's place in the hotbar). Its crystal light is the only light snow wolves fear."
  },
  {
    kind: 'replace', was: "  { id: 'crystalspear', cost: { crystal: 3, iron: 2, rope: 1 }, station: 'bench', xp: 60 },", now: "  { id: 'crystalspear', cost: { crystal: 3, iron: 2, rope: 1 }, station: 'bench', xp: 60 },\n  { id: 'lantern', cost: { crystal: 2, iron: 1, rope: 1 }, station: 'bench', xp: 40 },",
    why: "Crystal Lantern recipe: 2 Glow Crystals, 1 iron, 1 rope at the Workbench."
  },
  {
    kind: 'replace', was: "xp: 32, fearsFire: true, r: 0.6 },", now: "xp: 32, fearsFire: true, onlyCrystal: true, r: 0.6 },",
    why: "Snow wolves are not scared by a hand-held torch, only by the Crystal Lantern (campfires and torch posts still scare them)."
  },
  {
    kind: 'replace', was: "const p = G.p, torch = heldDef().tool.cls === 'torch', dawn", now: "const p = G.p, torch = heldDef().tool.cls === 'torch', crystal = !!heldDef().tool.crystal, dawn",
    why: "Snow wolves: is the held light the Crystal Lantern?"
  },
  {
    kind: 'replace', was: "if (torch && d < 12) th = p; else { const f = nearestFlame(c.x, c.z, 9); if (f) th = f.s; }", now: "if (torch && d < 12 && (crystal || !def.onlyCrystal)) th = p; else { if (torch && d < 12 && c.state === 'chase') tipOnce('snowTorch', 'Snow wolves are not scared of your torch! Only the blue glow of a Crystal Lantern keeps them away.'); const f = nearestFlame(c.x, c.z, 9); if (f) th = f.s; }",
    why: "Snow wolves ignore a hand-held torch (a tip says so the first time one comes at you anyway); the Crystal Lantern scares them. Fires and torch posts still work on them as before."
  },
  {
    kind: 'replace', was: "  if (cls === 'torch') { m = vcMesh(", now: "  if (cls === 'torch' && def.tool.crystal) m = lanternModel(hand, arm, g);\n  else if (cls === 'torch') { m = vcMesh(",
    why: "Crystal Lantern: its own model in the hand (src/models/lantern.js) instead of the wooden torch with a flame."
  },
  {
    kind: 'replace', was: "if (R.torchLight) R.torchLight.userData.on = R.vm.userData.cls === 'torch';", now: "if (R.torchLight) { R.torchLight.userData.on = R.vm.userData.cls === 'torch'; R.torchLight.color.setHex(R.vm.userData.crystal ? 0x7fdcff : 0xffa850); }",
    why: "Crystal Lantern: the held light is blue instead of the torch's orange."
  },
  {
    kind: 'replace', was: "if (id === 'torch') tipOnce('torch', 'Press <b>T</b> any time to hold your torch. Wolves hate it!');", now: "if (id === 'torch') tipOnce('torch', 'Press <b>T</b> any time to hold your torch. Wolves hate it!'); if (id === 'lantern') tipOnce('lantern', 'Press <b>T</b> to hold your Crystal Lantern. Even snow wolves keep away from it!');",
    why: "Crystal Lantern: a tip when it is crafted."
  },
  {
    kind: 'replace', was: "tipOnce('wolfFear', 'The wolf is scared of the flames and runs away!');", now: "tipOnce('wolfFear', crystal && th === p ? 'The wolf is scared of the crystal light and runs away!' : 'The wolf is scared of the flames and runs away!');",
    why: 'Crystal Lantern: the first-time tip names the crystal light, not flames, when the lantern is what scared the wolf.'
  },
  // ---- after the migration: animals step B (deer and stags, the fox, Scout) ----
  {
    kind: 'replace', was: "  deer: { n: 'Deer', hp: 28, spd: 7.0, flee: 10, loot: { rawmeat: 3, hide: 2 }, xp: 12, passive: true, r: 0.6 },", now: "  deer: { n: 'Deer', hp: 28, spd: 7.0, flee: 10, loot: { rawmeat: 3, hide: 2 }, xp: 12, passive: true, r: 0.6 },\n  fox: { n: 'Fox', hp: 14, spd: 7.4, flee: 14, loot: { rawmeat: 1, fur: 1 }, xp: 8, passive: true, r: 0.35 },",
    why: "New animal (ANIMALS.md step B): the fox. Shy (runs from 14 m, where a deer waits until 10 m) and quick; 1 raw meat and 1 fur."
  },
  {
    kind: 'replace', was: "want('rabbit', night ? 1 : 3, 'forest'); if (!night) want('deer', 2, 'forest');", now: "want('rabbit', night ? 1 : 3, 'forest'); if (!night) want('deer', 2, 'forest'); want('fox', 1, 'forest');",
    why: "The fox: one at a time in the forest, day or night."
  },
  {
    kind: 'replace', was: "want('rabbit', 2, 'snow', { model: 'hare' });", now: "want('rabbit', 2, 'snow', { model: 'hare' }); want('fox', 1, 'snow', { model: 'arcticfox' });",
    why: "The fox: a white arctic fox on Frostpeak."
  },
  {
    kind: 'replace', was: "const s = R.scout, p = G.p; if (!s) return; s.moving = 0;", now: "const s = R.scout, p = G.p; if (!s) return; upgradeScout(s); s.moving = 0;",
    why: "Scout gets the animated Shiba Inu model (red collar) once it has loaded. He is built with the island, before the models finish loading, so he starts hand-built and is swapped on his first update."
  },
  {
    kind: 'replace', was: "m.head.rotation.x = Math.sin(R.t * 1.7) * 0.07 - (s.moving ? 0 : 0.12);", now: "m.head.rotation.x = Math.sin(R.t * 1.7) * 0.07 - (s.moving ? 0 : 0.12); if (m.anim) m.anim(scoutPose(s), dt);",
    why: "Scout: play his animated model (walk and gallop matched to his speed, a bite when he bites)."
  },
  // ---- after the migration: animals step C (boar, snake, crab, spider, frog, bat) ----
  {
    kind: 'module', file: 'src/creatures/wildlife.js', globals: [],
    why: 'Where the step C animals live: places them by kind of place (beach, lake edge, cave) rather than by biome. Called from updateSpawner().'
  },
  {
    kind: 'replace', was: "  goat: { n: 'Mountain Goat', hp: 32, spd: 6.6, flee: 9, loot: { rawmeat: 2, hide: 1, fur: 1 }, xp: 12, passive: true, r: 0.55 },", now: "  // step C. calm: ignores you until you come close or hit it (does not stop you sleeping); lose: how far a chase goes\n  boar: { n: 'Wild Boar', hp: 45, spd: 6.0, dmg: 10, sense: 0, lose: 30, atk: 1.8, loot: { rawmeat: 3, hide: 1 }, xp: 18, calm: true, r: 0.5 },\n  snake: { n: 'Snake', hp: 16, spd: 3.0, dmg: 7, sense: 4, atk: 1.4, loot: { hide: 1 }, xp: 10, calm: true, hiss: true, r: 0.3 },\n  crab: { n: 'Crab', hp: 12, spd: 2.4, dmg: 4, sense: 2.5, atk: 1.1, loot: { rawmeat: 1, chitin: 1 }, xp: 6, calm: true, hiss: true, r: 0.35 },\n  spider: { n: 'Cave Spider', hp: 26, spd: 3.6, dmg: 7, sense: 12, atk: 1.5, loot: { fibre: 2 }, xp: 14, hiss: true, r: 0.55, leash: 18 },\n  frog: { n: 'Frog', hp: 4, spd: 3.2, flee: 4, loot: {}, xp: 2, passive: true, r: 0.2 },\n  bat: { n: 'Bat', hp: 4, spd: 3.0, flee: 3, loot: {}, xp: 1, passive: true, r: 0.25 },\n  goat: { n: 'Mountain Goat', hp: 32, spd: 6.6, flee: 9, loot: { rawmeat: 2, hide: 1, fur: 1 }, xp: 12, passive: true, r: 0.55 },",
    why: "New animals (ANIMALS.md step C): wild boar (peaceful until hit, then charges), snake (bites if you come within 4 m), crab (pinches if cornered), cave spider (hostile, stays near its cave), frog and bat (harmless). New fields: calm, lose, hiss."
  },
  {
    kind: 'replace', was: "if (c.dead || c.def.passive || c.state === 'flee' || c.state === 'home') continue; const dd = dist2(c.x, c.z, G.p.x, G.p.z);", now: "if (c.dead || c.def.passive || c.state === 'flee' || c.state === 'home' || (c.def.calm && c.state === 'idle')) continue; const dd = dist2(c.x, c.z, G.p.x, G.p.z);",
    why: "Calm animals (boar, snake, crab) minding their own business do not count as danger: they do not stop you sleeping or using things."
  },
  {
    kind: 'replace', was: "if (!c.raid && !c.boss && d > def.sense * 2.2) { c.state = 'idle'; break; }", now: "if (!c.raid && !c.boss && d > (def.lose || def.sense * 2.2)) { c.state = 'idle'; break; }",
    why: "A boar notices nothing (sense 0) but, once hit, chases you up to 30 m (lose), instead of giving up at once."
  },
  {
    kind: 'replace', was: "sfx(c.boss ? 'roar' : c.type === 'scorpion' ? 'hiss' : 'growl');", now: "sfx(c.boss ? 'roar' : c.type === 'scorpion' || def.hiss ? 'hiss' : 'growl');",
    why: "Snakes, crabs and spiders hiss instead of growling when they come for you."
  },
  {
    kind: 'replace', was: "  // lairs and bosses appear when you get close\n", now: "  updateWildlife(cnt, night);   // boars, snakes, crabs, frogs, spiders and bats: src/creatures/wildlife.js\n  // lairs and bosses appear when you get close\n",
    why: "Step C animals are placed by src/creatures/wildlife.js: boars in the forest, snakes in the desert, crabs on beaches, frogs at lake edges, spiders in the grotto and mine, bats there (and at the bear cave) at night."
  },
  // ---- after the migration: animals step D (herds, shark, fish) ----
  {
    kind: 'module', file: 'src/creatures/sea.js', globals: [],
    why: 'Life in the water: the shark (circles a swimmer in the deep sea, then bites; gives up in the shallows) and schools of fish in the lakes.'
  },
  {
    kind: 'replace', was: "  wolf: { n: 'Wolf', hp: 42, spd: 6.5, dmg: 9, sense: 28, atk: 2.0, loot: { fur: 1, fang: 1 }, xp: 22, fearsFire: true, r: 0.55 },", now: "  // step D. herds: wild and shy, not for hunting (no loot); sea: swims (src/creatures/sea.js)\n  horse: { n: 'Wild Horse', hp: 60, spd: 8.5, flee: 12, loot: {}, xp: 2, passive: true, r: 0.8 },\n  donkey: { n: 'Wild Donkey', hp: 45, spd: 6.8, flee: 10, loot: {}, xp: 2, passive: true, r: 0.6 },\n  alpaca: { n: 'Alpaca', hp: 40, spd: 6.6, flee: 10, loot: {}, xp: 2, passive: true, r: 0.55 },\n  shark: { n: 'Shark', hp: 90, spd: 5, dmg: 12, sense: 0, atk: 2.2, loot: { rawfish: 3 }, xp: 40, sea: true, r: 0.9 },\n  wolf: { n: 'Wolf', hp: 42, spd: 6.5, dmg: 9, sense: 28, atk: 2.0, loot: { fur: 1, fang: 1 }, xp: 22, fearsFire: true, r: 0.55 },",
    why: "New animals (ANIMALS.md step D): herds of wild horses, donkeys and alpacas (shy, not for hunting) and the shark (swims; moved by src/creatures/sea.js). Inserted before the wolf: the lines above it are already anchors of other entries."
  },
  {
    kind: 'replace', was: "    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz); c.moving = 0; c.st -= dt; if (c.atkCd > 0) c.atkCd -= dt;", now: "    if (def.sea) { updateShark(c, dt); continue; }   // swims: src/creatures/sea.js\n    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz); c.moving = 0; c.st -= dt; if (c.atkCd > 0) c.atkCd -= dt;",
    why: "The shark: land creatures refuse to enter water, so a creature that swims is moved by updateShark() in src/creatures/sea.js."
  },
  {
    kind: 'replace', was: "updatePlayer(dt); updateCreatures(dt); updateScout(dt);", now: "updatePlayer(dt); updateCreatures(dt); updateSea(dt); updateScout(dt);",
    why: "Life in the water (src/creatures/sea.js): the shark appears for swimmers in the deep sea; fish swim in the lakes."
  }
];
