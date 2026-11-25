// Entry point. In Phase 3 the whole game still lives in legacy.js, which starts itself
// on the window 'load' event exactly as the single-file version did.
import * as game from './legacy.js';

// Read-only view for the parity checks in tests/golden (world fingerprint, save check,
// screenshots). A module namespace can't be reassigned from outside, and its bindings are
// live, so __stranded.G always shows the current game state even after a save is loaded.
window.__stranded = game;
