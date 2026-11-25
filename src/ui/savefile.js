// Export / Import save: keep a copy of your game as a .json file, and load one back.
// Added after the migration (MIGRATION.md §7): saves live in the browser's localStorage, and
// whether a different copy of the game file can see them depends on the browser. A save file
// always works.
//
//   Pause menu    📤 Export save   downloads the current game as stranded-dayN-YYYY-MM-DD.json
//                 📥 Import save   loads a save file (after asking), then restarts at the title
//   Title screen  📂 Load a save file   for a copy of the game that has no save yet
//
// This module is new code, not part of the original script (see the ledger,
// tests/golden/approved-edits.mjs). src/main.js imports it after the whole game has loaded, and
// it handles clicks on its own buttons, so the game's original click handling is unchanged.
import { R } from '../state.js';
import { SAVE_KEY, SAVE_VERSION } from '../core/constants.js';
import { saveGame } from '../save.js';
import { showTitle } from '../boot.js';
import { toast } from './hud.js';

/** The current save as text: this session's latest, or the one stored in the browser. */
function currentSaveText() {
  if (R.memSave) return R.memSave;
  try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
}
/** On the title screen the HUD (and its toasts) is hidden, so use a plain message box there. */
function say(msg, kind) { if (R.started) toast(msg, kind || 'warn', 6000); else alert(msg.replace(/<[^>]+>/g, '')); }

/** A save file is accepted if it is this game's save format (same version, the basic parts). */
function parseSave(text) {
  let s; try { s = JSON.parse(text); } catch (e) { return null; }
  if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION || typeof s.day !== 'number' || !s.p || typeof s.p !== 'object' || !s.inv || typeof s.inv !== 'object') return null;
  return s;
}

function exportSave() {
  if (R.started) saveGame();   // write the latest state first (the same save the 💾 button makes)
  const text = currentSaveText();
  const s = text && parseSave(text);
  if (!s) { say('There is no saved game to export yet.'); return; }
  const name = 'stranded-day' + s.day + '-' + new Date().toISOString().slice(0, 10) + '.json';
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  say('📤 Saved to your downloads: <b>' + name + '</b>', 'ok');
}

function importSave() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = () => {
    const f = input.files && input.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => loadSaveText(String(rd.result));
    rd.onerror = () => say('Could not read that file.');
    rd.readAsText(f);
  };
  input.click();
}

function loadSaveText(text) {
  const s = parseSave(text);
  if (!s) { say('That file is not a Stranded save, or it is from a different version of the game.'); return; }
  const what = 'Day ' + s.day + ', Level ' + (s.p.level || 1);
  const replaces = R.started ? '\n\nThe game you are playing now will be replaced. Export it first if you want to keep it.'
    : currentSaveText() ? '\n\nThe saved game in this browser will be replaced.' : '';
  if (!confirm('Load the saved game from ' + what + '?' + replaces)) return;
  let stored = true;
  try { localStorage.setItem(SAVE_KEY, text); } catch (e) { stored = false; }
  R.memSave = text;
  if (R.started) {
    // restart cleanly at the title screen, where Continue picks up the loaded save
    if (!stored) { say('This browser won\'t keep saves for this file. Use <b>Save and quit to title</b>, then <b>📂 Load a save file</b>.'); return; }
    location.reload();
  } else showTitle();   // the title now offers Continue for the loaded save
}

// Buttons: pause menu (data-a="export" / "import", like the game's own panel buttons) and the
// title screen (#tLoad). Caught before the game's own handlers, which ignore these anyway.
document.addEventListener('click', e => {
  const el = e.target && e.target.closest && e.target.closest('[data-a="export"], [data-a="import"], #tLoad');
  if (!el) return;
  e.stopPropagation();
  if (el.dataset.a && performance.now() - (R.panelOpenT || 0) < 300) return;   // same guard as the game's panel buttons
  if (el.dataset.a === 'export') exportSave(); else importSave();
}, true);

export { exportSave, importSave, loadSaveText, parseSave };
