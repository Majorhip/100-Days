// Scout's story, "The Storm Dog" (MIDDLE-DAYS-PLAN.md, a spoiler file: not for Caspar), added
// after the migration.
//
// Step 2 (this much so far):
// - the chapter engine (the rule is src/game/scout-story.js)
// - chapter 1: Ray tells how he found Scout as a pup in the Stone Circle
// - Scout is scared of thunder: he shivers, keeps close and whines (just for show: he still fights)
// - now and then at dusk, Scout stops, faces Frostpeak and howls at it
//
// The older modules don't import this one (that would change the order they start up in). They
// read flags instead:
//   scout.js   R.scout.howlT (stop and howl at Frostpeak), R.scout.scared (shiver, keep close)
//   ray.js     R.rayTalk() (Ray has something to say first)
// src/boot.js calls updateScoutStory() once a second. The story's progress is saved as
// G.story = { ch, day, done }, made only when chapter 1 starts, so other saves are unchanged.
import { G, R } from '../state.js';
import { sfx } from '../audio/audio.js';
import { DIALOGS } from '../data/story.js';
import { hearts } from '../creatures/scout.js';
import { showDialog } from '../ui/panels.js';
import { toast } from '../ui/hud.js';
import { chapterDue, howlsTonight } from '../game/scout-story.js';

const BUILT = 1;   // chapters in the game so far
const HOWL = { from: 19, to: 20, secs: 5.5 };   // dusk (game hours), and how long he howls (s)

let seenDay = null, wasFriend = false, wasStorm = false, stormDay = null, nextWhine = 0, howledDay = null;

const story = () => G.story || { ch: 0, day: 0, done: true };
const rayHasNews = () => !!(G.story && G.story.ch === 1 && !G.story.done);

/** start a chapter if one is due; true if one started */
function checkChapter() {
  const st = story();
  const n = chapterDue({
    day: G.day, stayed: !!G.flags.rayFree && G.flags.rayChoice === 'stay', scoutFriend: !!G.scout.friend,
    chapter: st.ch, chapterDay: st.day, chapterDone: st.done, built: BUILT
  });
  if (n !== 1) return false;
  G.story = { ch: 1, day: G.day, done: false };
  toast('🧔 Uncle Ray waves you over. He wants a word about Scout.', 'ok', 9000);
  return true;
}

/** Ray's E prompt shows 💬 while he has something to say */
function patchRay() {
  const poi = R.rayPoi; if (!poi || poi.storyLabel) return;
  const base = poi.label; poi.storyLabel = true;
  poi.label = () => (typeof base === 'function' ? base() : base) + (rayHasNews() ? ' 💬' : '');
}
R.rayTalk = () => {
  if (!rayHasNews()) return false;
  showDialog(DIALOGS.scoutPup, () => { G.story.done = true; if (G.scout.friend && R.scout) { hearts(R.scout); sfx('heart'); } });
  return true;
};

/** once a second (from slowTick) */
function updateScoutStory() {
  if (!R.started || !R.scout) return;
  patchRay();
  const s = R.scout, friend = !!G.scout.friend;

  // a new day, a game just loaded, or Scout a friend again: is a chapter due?
  if (G.day !== seenDay || (friend && !wasFriend)) {
    const newDay = seenDay !== null && G.day !== seenDay;
    seenDay = G.day;
    if (!checkChapter() && newDay && rayHasNews()) toast('🧔 Uncle Ray still wants a word about Scout.', 'ok', 7000);
  }
  wasFriend = friend;

  // thunder: Scout is scared of storms (just for show: he still fights)
  const storm = friend && G.weather === 'storm';
  s.scared = storm;
  if (storm && !R.sleeping) {
    if (!wasStorm && stormDay !== G.day) { stormDay = G.day; sfx('whine'); toast('🐕 Scout presses against your legs, shaking. He hates thunder.', 'ok', 6000); }
    if (R.t > nextWhine) { nextWhine = R.t + 12 + Math.random() * 14; sfx('whine'); }
  }
  wasStorm = storm;

  // dusk: now and then Scout stops, faces Frostpeak and howls at it
  if (friend && howledDay !== G.day && G.hour >= HOWL.from && G.hour < HOWL.to && howlsTonight(G.day, story().ch) &&
    !storm && !R.raid && !R.riding && !R.sleeping && !R.cinematic) {
    howledDay = G.day; s.howlT = HOWL.secs; sfx('doghowl'); setTimeout(() => { if (s.howlT > 0) sfx('doghowl'); }, 2600);
    toast('🐕 Scout stops, stares up at Frostpeak... and howls.', 'ok', 6000);
  }
}

export { updateScoutStory };
