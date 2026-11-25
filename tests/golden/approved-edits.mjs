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
  }
];
