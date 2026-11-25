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
  }
];
