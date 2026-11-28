// Scout's story, "The Storm Dog" (MIDDLE-DAYS-PLAN.md, a spoiler file: not for Caspar), added
// after the migration.
//
// Built so far:
// - the chapter engine (the rule is src/game/scout-story.js)
// - chapter 1: Ray tells how he found Scout as a pup in the Stone Circle
// - chapter 2: Scout leads the way to the west woods and digs up the Green Stone and Tomas's page 1
// - chapter 3: Tomas's box at the Old Iron Mine, with the guardians' lock (the Gold Stone, page 2)
// - chapter 4: the scare. Scout limps (slow, no fighting) until a bandage and his meat heal him, or
//   2 days pass; that evening, something far up Frostpeak howls back at him
// - Scout is scared of thunder: he shivers, keeps close and whines (just for show: he still fights)
// - now and then at dusk, Scout stops, faces Frostpeak and howls at it
// - Ray gives a hint for the chapter under way when you talk to him
//
// The older modules don't import this one (that would change the order they start up in). They
// read flags instead:
//   scout.js   R.scout.howlT (stop and howl at Frostpeak), .scared (shiver, keep close),
//              .lead (run ahead to a point, then wait), .dig (nose down, digging), .limp;
//              R.scoutLabel() and R.scoutAct() go first on his E prompt
//   ray.js     R.rayTalk() (Ray has something to say first)
// src/boot.js calls updateScoutStory() once a second. The story's progress is saved as
// G.story = { ch, day, done, ... }, made only when chapter 1 starts, so other saves are unchanged.
import { G, R } from '../state.js';
import { sfx } from '../audio/audio.js';
import { heightAt } from '../world/terrain.js';
import { puff } from '../world/sky.js';
import { box, cyl, part } from '../core/geometry.js';
import { addCollider } from '../world/collision.js';
import { DIALOGS } from '../data/story.js';
import { STORY_SPOTS } from '../data/story-spots.js';
import { inv, give, take, addXP } from '../player/inventory.js';
import { POIS } from '../player/targeting.js';
import { hearts, compassWord } from '../creatures/scout.js';
import { prop, readNote } from './props.js';
import { showDialog, showChoice } from '../ui/panels.js';
import { toast, banner, hint } from '../ui/hud.js';
import { chapterDue, howlsTonight, LOCK_DIALS, LOCK_PICTURES, lockRight } from '../game/scout-story.js';

const BUILT = 4;   // chapters in the game so far
const HOWL = { from: 19, to: 20, secs: 5.5 };   // dusk (game hours), and how long he howls (s)
const LEAD = { near: 150, ahead: 8, dig: 6 };   // he leads within 150 m; runs 8 m ahead; digs when you're within 6 m

let seenDay = null, wasFriend = false, wasStorm = false, stormDay = null, nextWhine = 0, howledDay = null;

const story = () => G.story || { ch: 0, day: 0, done: true };
const active = n => !!(G.story && G.story.ch === n && !G.story.done);
const rayHasNews = () => active(1);
const dist = (x, z) => Math.hypot(x - G.p.x, z - G.p.z);
const dirTo = (x, z) => compassWord(x - G.p.x, z - G.p.z);

/* ---------- Scout leads the way ---------- */
/** once a second while a chapter wants Scout to show the way to (x, z): within LEAD.near m and on
 *  foot, he runs ahead of you towards it and waits, looking back; at the spot he waits nose to it
 *  (or to (lx, lz)). Returns how far you are from it */
function leadTo(x, z, lx = x, lz = z) {
  const s = R.scout, p = G.p, d = dist(x, z);
  if (!G.scout.friend || R.riding || d > LEAD.near) return d;
  if (d <= LEAD.ahead) s.lead = { x, z, lookX: lx, lookZ: lz };
  else { const k = LEAD.ahead / d; s.lead = { x: p.x + (x - p.x) * k, z: p.z + (z - p.z) * k }; }
  if (Math.hypot(s.x - p.x, s.z - p.z) > 5 && d > LEAD.ahead && Math.random() < 0.2) sfx('bark');
  return d;
}
/** Scout digs at (x, z) once he's there and you're close */
function digAt(x, z) {
  const s = R.scout;
  s.dig = G.scout.friend && dist(x, z) < LEAD.dig && Math.hypot(s.x - x, s.z - z) < 1.6;
  if (s.dig) { puff(s.x + Math.sin(s.yaw) * 0.5, s.y + 0.1, s.z + Math.cos(s.yaw) * 0.5, 0x6b4a2b, 3, { size: 0.1, up: 1.2 }); if (Math.random() < 0.5) sfx('step', 'sand'); }
  return s.dig;
}

/* ---------- the chapters: start (that morning), daily (a reminder each later morning), tick (once a second) ---------- */
const CHAPTERS = {
  1: {
    start: () => toast('🧔 Uncle Ray waves you over. He wants a word about Scout.', 'ok', 9000),
    daily: () => toast('🧔 Uncle Ray still wants a word about Scout.', 'ok', 7000)
  },
  2: {
    start: () => { sfx('whine'); toast('🐕 Scout keeps staring ' + dirTo(STORY_SPOTS.green.x, STORY_SPOTS.green.z) + ' and whining. He wants to show you something!', 'ok', 9000); },
    daily: () => { sfx('whine'); toast('🐕 Scout looks ' + dirTo(STORY_SPOTS.green.x, STORY_SPOTS.green.z) + ' again and whines.', 'ok', 7000); },
    tick: () => { const g = STORY_SPOTS.green; leadTo(g.x, g.z); digAt(g.x, g.z); }
  },
  3: {
    start: () => {
      if (G.story.boxOpen) { done(); return; }   // opened already: page 1 told of it
      sfx('whine'); toast('🐕 Scout sniffs Tomas\'s page and looks ' + dirTo(B.x, B.z) + '. The page said: a box at the OLD MINE.', 'ok', 9000);
    },
    daily: () => toast('🐕 Scout looks ' + dirTo(B.x, B.z) + ' again. Tomas\'s box is waiting at the Old Iron Mine.', 'ok', 7000),
    tick: () => leadTo(B.x, B.z + 1.3, B.x, B.z)   // he waits in front of the box
  },
  4: {
    start: () => {
      G.story.limp = true; sfx('whine');
      toast('🐕 Oh no, Scout is <b>LIMPING</b>! He hurt his paw' + (G.day % 10 === 1 ? ' fighting the wolves last night' : ' in the night') + '. He can\'t fight like this.', 'warn', 10000);
    },
    daily: () => { sfx('whine'); toast('🐕 Scout is still limping. Ray might know what to do.', 'ok', 7000); },
    tick: () => {
      const st = G.story;
      if (st.bandaged && G.scout.fed >= G.day) healPaw('🐕 Scout\'s paw is better! He jumps up and licks your face.');
      else if (!st.bandaged && G.day >= st.day + 2) healPaw('🐕 Scout\'s paw has healed by itself. He\'s running about again, and he stays extra close to you.');
    }
  }
};
function healPaw(msg) {
  G.story.limp = false; done(); sfx('bark'); sfx('heart'); toast(msg, 'ok', 8000);
  if (R.scout) { R.scout.limp = false; hearts(R.scout); }
}
/** Scout's E prompt while his paw is hurt: wrap it */
R.scoutLabel = () => {
  const st = G.story; if (!st || !st.limp || st.bandaged || !G.scout.friend) return null;
  return inv('bandage') ? 'Wrap Scout\'s sore paw' : 'Scout\'s paw is hurt. He needs a BANDAGE';
};
R.scoutAct = () => {
  const st = G.story; if (!st || !st.limp || st.bandaged || !G.scout.friend) return false;
  if (!inv('bandage')) { sfx('whine'); hint('Scout\'s paw is hurt. Make a <b>Bandage</b> (2 fibre and a healing herb), then wrap it.', 4.5); return true; }
  take('bandage', 1); st.bandaged = true; hearts(R.scout); sfx('heart');
  toast('🩹 You wrap Scout\'s paw. He licks your hand. Now he needs his meat and a rest.', 'ok', 8000);
  return true;
};
const B = STORY_SPOTS.box;

/* ---------- Tomas's box: three picture dials (chapter 3) ---------- */
/** turn dial i of 3 (one choice each), then try the lid */
function turnDials(i, picks) {
  if (i === LOCK_DIALS.length) { tryLock(picks); return; }
  const [name, e] = LOCK_DIALS[i];
  showChoice('Dial ' + (i + 1) + ' of 3 has a ' + e + ' <b>' + name.toUpperCase() + '</b> on it. Turn it to...',
    LOCK_PICTURES.map(([id, pe, pn]) => [pe + ' ' + pn, '', () => { sfx('click'); turnDials(i + 1, picks.concat(id)); }]));
}
function tryLock(picks) {
  const n = lockRight(picks), st = G.story;
  if (n < 3) {
    st.lockTries = (st.lockTries || 0) + 1; sfx('deny');
    hint(n ? 'Clunk. <b>' + n + ' of the 3</b> dials click into place... but the box stays shut.' : 'Clunk. None of the dials click. The box stays shut.', 4.5);
    if (st.lockTries >= 2 && G.scout.friend) setTimeout(() => toast('🐕 Scout sniffs the dials and growls softly, as if he remembers a big fight.', 'ok', 7000), 1600);
    return;
  }
  st.boxOpen = true; openLid(); sfx('chest'); give('goldstone', 1);
  if (active(3)) done(); else addXP(60);
  if (G.scout.friend && R.scout) hearts(R.scout);
  banner('THE GOLD STONE', 'Click, click, click: the box opens!');
  readNote('tomas2');
}
function openLid() { if (made.lid) { made.lid.rotation.x = -1.25; made.lid.position.y += 0.22; made.lid.position.z -= 0.24; } }

/** start a chapter if one is due; true if one started */
function checkChapter() {
  const st = story();
  const n = chapterDue({
    day: G.day, stayed: !!G.flags.rayFree && G.flags.rayChoice === 'stay', scoutFriend: !!G.scout.friend,
    chapter: st.ch, chapterDay: st.day, chapterDone: st.done, built: BUILT
  });
  if (!n) return false;
  G.story = Object.assign(G.story || {}, { ch: n, day: G.day, done: false });
  CHAPTERS[n].start(); buildProps();
  return true;
}
function done(xp) { G.story.done = true; addXP(xp || 60); }

/* ---------- things in the world: made only once the story reaches them ---------- */
const made = {};
function buildProps() {
  const st = story();
  if ((st.ch >= 3 || G.notes.includes('tomas1')) && !made.box) {   // Tomas's box, by the Old Iron Mine
    const y = heightAt(B.x, B.z), dial = x => part(cyl(0.07, 0.07, 0.04, 8), 0xd9a520, [x, 0.25, 0.29], [Math.PI / 2, 0, 0], null, 0);
    made.box = prop([part(box(0.8, 0.45, 0.55), 0x6e4a2c, [0, 0.225, 0], null, null, 0), part(box(0.84, 0.06, 0.59), 0x555a60, [0, 0.1, 0], null, null, 0),
      part(box(0.84, 0.06, 0.59), 0x555a60, [0, 0.36, 0], null, null, 0), dial(-0.22), dial(0), dial(0.22)], B.x, y, B.z);
    made.lid = prop([part(box(0.84, 0.1, 0.59), 0x7a5232, [0, 0, 0], null, null, 0), part(box(0.86, 0.04, 0.12), 0x555a60, [0, 0.05, 0], null, null, 0)], B.x, y + 0.5, B.z);
    addCollider({ x: B.x, z: B.z, r: 0.5 });
    if (G.story.boxOpen) openLid();
  }
  if (st.ch >= 2 && !made.hole && (st.ch > 2 || st.done)) {   // where Scout dug up the Green Stone
    const g = STORY_SPOTS.green, y = heightAt(g.x, g.z);
    made.hole = prop([part(cyl(0.55, 0.6, 0.06, 8), 0x2e2116, [0, 0.03, 0], null, null, 0), part(cyl(0.25, 0.5, 0.22, 7), 0x6b4a2b, [0.85, 0.08, 0.2], null, null, 0)], g.x, y, g.z);
  }
}
/** the E prompts for the story (once) */
function addPois() {
  if (made.pois) return; made.pois = true;
  const g = STORY_SPOTS.green;
  POIS.push({
    id: 'storyBox', x: B.x, z: B.z, get y() { return heightAt(B.x, B.z) + 0.5; }, reach: 2.8,
    on: () => !!made.box, label: () => G.story && G.story.boxOpen ? 'Tomas\'s box (read the page again)' : 'Tomas\'s box: three picture dials',
    act: () => { if (G.story.boxOpen) readNote('tomas2'); else turnDials(0, []); }
  });
  POIS.push({
    id: 'storyDig', x: g.x, z: g.z, get y() { return heightAt(g.x, g.z) + 0.4; }, reach: 3.2,
    on: () => active(2) && !!R.scout.dig, label: 'Help Scout dig',
    act: () => {
      const s = R.scout; s.dig = false;
      for (let i = 0; i < 3; i++) setTimeout(() => sfx('step', 'sand'), i * 140);
      puff(g.x, heightAt(g.x, g.z) + 0.2, g.z, 0x6b4a2b, 14, { size: 0.16, up: 2 });
      give('greenstone', 1); done(); buildProps(); hearts(s); sfx('discover');
      banner('THE GREEN STONE', 'Scout dug up an old tin box. Inside: a glowing stone and a page from a journal.');
      readNote('tomas1');
    }
  });
}

/** Ray: the story first, then a hint for the chapter under way */
R.rayTalk = () => {
  if (rayHasNews()) { showDialog(DIALOGS.scoutPup, () => { done(30); if (G.scout.friend && R.scout) { hearts(R.scout); sfx('heart'); } }); return true; }
  const st = story(), hint = !st.done && DIALOGS.scoutHint[st.ch];
  if (hint) { showDialog(hint); return true; }
  return false;
};
/** Ray's E prompt shows 💬 while he has something to say */
function patchRay() {
  const poi = R.rayPoi; if (!poi || poi.storyLabel) return;
  const base = poi.label; poi.storyLabel = true;
  poi.label = () => (typeof base === 'function' ? base() : base) + (rayHasNews() ? ' 💬' : '');
}

/** once a second (from slowTick) */
function updateScoutStory() {
  if (!R.started || !R.scout) return;
  patchRay(); addPois();
  const s = R.scout, friend = !!G.scout.friend;
  s.lead = null; s.dig = false;

  // a new day, a game just loaded, or Scout a friend again: is a chapter due? If not, a reminder
  if (G.day !== seenDay || (friend && !wasFriend)) {
    const newDay = seenDay !== null && G.day !== seenDay;
    if (seenDay === null) buildProps();
    seenDay = G.day;
    const st = story();
    if (!checkChapter() && newDay && st.ch && !st.done && friend && CHAPTERS[st.ch].daily) CHAPTERS[st.ch].daily();
  }
  wasFriend = friend;

  // the chapter under way
  const st = story(), ch = CHAPTERS[st.ch];
  if (st.ch && !st.done && ch && ch.tick) ch.tick();
  s.limp = !!(G.story && G.story.limp && friend);   // (after the chapters: from the moment the scare starts)

  // the evening after he hurt his paw: something far up the mountain answers his whimper (once)
  if (st.ch >= 4 && !G.story.answered && friend && G.hour >= 20 && G.hour < 23.5 && !R.sleeping && !R.raid) {
    G.story.answered = true; sfx('whine'); setTimeout(() => sfx('doghowl', 'far'), 1500); setTimeout(() => sfx('doghowl', 'far'), 3800);
    setTimeout(() => toast('🐕 Scout whimpers... and far up on Frostpeak, something <b>HOWLS</b> back.', 'ok', 9000), 1500);
  }

  // thunder: Scout is scared of storms (just for show: he still fights)
  const storm = friend && G.weather === 'storm';
  s.scared = storm;
  if (storm && !R.sleeping) {
    if (!wasStorm && stormDay !== G.day) { stormDay = G.day; sfx('whine'); toast('🐕 Scout presses against your legs, shaking. He hates thunder.', 'ok', 6000); }
    if (R.t > nextWhine) { nextWhine = R.t + 12 + Math.random() * 14; sfx('whine'); }
  }
  wasStorm = storm;

  // dusk: now and then Scout stops, faces Frostpeak and howls at it
  if (friend && !s.lead && howledDay !== G.day && G.hour >= HOWL.from && G.hour < HOWL.to && howlsTonight(G.day, st.ch) &&
    !storm && !R.raid && !R.riding && !R.sleeping && !R.cinematic) {
    howledDay = G.day; s.howlT = HOWL.secs; sfx('doghowl'); setTimeout(() => { if (s.howlT > 0) sfx('doghowl'); }, 2600);
    toast('🐕 Scout stops, stares up at Frostpeak... and howls.', 'ok', 6000);
  }
}

export { updateScoutStory, leadTo };
