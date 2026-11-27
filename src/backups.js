// Backup saves (IMPROVEMENTS.md step 3), added after the migration.
//
// A 100-day game lives in one browser save. When a save starts a new day, the last save of the
// day before is kept as a backup first. The three newest are kept:
//   stranded100_v3_bak1 (newest), _bak2, _bak3
// The main save key (stranded100_v3) never changes, so older copies of the game still find it.
//
// If the main save can't be read, or loading it fails, the title offers the newest backup that
// reads (src/boot.js). Every 10 days a tip reminds the player to Export a copy.
//
// Only reads constants and G: saveGame() (src/save.js) calls keepBackup() on every save.
import { SAVE_KEY, SAVE_VERSION } from './core/constants.js';

const KEEP = 3;
const key = i => SAVE_KEY + '_bak' + i;
const BROKEN = 'stranded_broken';   // sessionStorage: the save text that failed to load

/** a save's text, parsed, if it is this game's save format; otherwise null */
function parse(raw) {
  if (!raw) return null;
  let s; try { s = JSON.parse(raw); } catch (e) { return null; }
  return s && typeof s === 'object' && s.v === SAVE_VERSION && typeof s.day === 'number' && s.p && typeof s.p === 'object' ? s : null;
}
function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } }

/**
 * Called with the save about to be replaced and the new save's day. If the new save is a later
 * day, the old one (the last save of its day) becomes backup 1 and the others move down.
 */
function keepBackup(prevRaw, day) {
  const p = parse(prevRaw); if (!p || p.day >= day) return;
  const b1 = parse(get(key(1)));
  if (!(b1 && b1.day === p.day)) for (let i = KEEP; i > 1; i--) set(key(i), get(key(i - 1)));   // (same day: just refresh it)
  set(key(1), prevRaw);
}
/** the backups that read, newest first: [{ i, raw, day, level }] */
function listBackups() {
  const out = [];
  for (let i = 1; i <= KEEP; i++) { const raw = get(key(i)), s = parse(raw); if (s) out.push({ i, raw, day: s.day, level: s.p.level || 1 }); }
  return out;
}
function clearBackups() { for (let i = 1; i <= KEEP; i++) set(key(i), null); }

/** remember that this save text failed to load (for this browser tab), so the title offers a backup */
function markBroken(raw) { try { sessionStorage.setItem(BROKEN, raw || ''); } catch (e) { } }
function isBroken(raw) { try { const b = sessionStorage.getItem(BROKEN); return b !== null && b === (raw || ''); } catch (e) { return false; } }
/** make a backup the main save. The save it replaces, if any, is kept as stranded100_v3_broken. */
function restoreBackup(b, mainRaw) {
  if (mainRaw && mainRaw !== b.raw) set(SAVE_KEY + '_broken', mainRaw);
  set(SAVE_KEY, b.raw);
  try { sessionStorage.removeItem(BROKEN); } catch (e) { }
}

/** the Export reminder is due: a 10th day, once per day */
const nudgeDue = G => G.day > 0 && G.day % 10 === 0 && G.flags.exportNudge !== G.day;

export { keepBackup, listBackups, clearBackups, markBroken, isBroken, restoreBackup, nudgeDue };
