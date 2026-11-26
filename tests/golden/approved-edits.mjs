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
  }
];
