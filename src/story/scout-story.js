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
// - chapter 5: paws in the dark. Glowing paw prints, only at night, from the Frozen Lake to a cairn
//   with the Blue Stone and Tomas's page 3; then Ray realises where Scout came from
// - chapter 6: the stones go back. Three standing stones in the Stone Circle are carved with a tree
//   (west), a sun over the dunes (east) and a snowflake (north), each with a hole for its stone
// - the lights over Frostpeak (the northern aurora, R.auroraBoost read by gfx/sky.js) grow
//   stronger with each chapter
// - from Day 60, some Wolf Moons have a twist (R.raidKind(), read by spawner.js): a Snow Moon or a
//   Storm Moon, which Scout senses the day before
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
import { SITES, heightAt } from '../world/terrain.js';
import { puff } from '../world/sky.js';
import { box, cyl, ico, part } from '../core/geometry.js';
import { MAT_GLOW, litMat } from '../gfx/core.js';
import * as THREE from 'three';
import { ITEMS } from '../data/items.js';
import { addCollider } from '../world/collision.js';
import { DIALOGS } from '../data/story.js';
import { STORY_SPOTS, STONES } from '../data/story-spots.js';
import { inv, give, take, addXP } from '../player/inventory.js';
import { POIS } from '../player/targeting.js';
import { hearts, compassWord } from '../creatures/scout.js';
import { prop, readNote } from './props.js';
import { showDialog, showChoice } from '../ui/panels.js';
import { toast, banner, hint } from '../ui/hud.js';
import { chapterDue, howlsTonight, moonKind, LOCK_DIALS, LOCK_PICTURES, lockRight } from '../game/scout-story.js';

const BUILT = 6;   // chapters in the game so far
const HOWL = { from: 19, to: 20, secs: 5.5 };   // dusk (game hours), and how long he howls (s)
const LEAD = { near: 150, ahead: 8, dig: 6 };   // he leads within 150 m; runs 8 m ahead; digs when you're within 6 m

let seenDay = null, wasFriend = false, wasStorm = false, stormDay = null, nextWhine = 0, howledDay = null;

const story = () => G.story || { ch: 0, day: 0, done: true };
const active = n => !!(G.story && G.story.ch === n && !G.story.done);
const pupsNews = () => !!(G.story && G.story.pupsNews && !G.story.pupsHeard);   // after page 3
const rayHasNews = () => active(1) || pupsNews();
const night = () => G.hour >= 19.5 || G.hour < 5.5;   // when the paw prints glow
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
  6: {
    start: () => {
      if (G.story.allPlaced) { done(); return; }   // put back already
      toast('✨ The lights over Frostpeak are brighter than ever. Tomas wrote: put the stones back in the <b>STONE CIRCLE</b>.', 'ok', 10000);
    },
    daily: () => toast('✨ The lights over Frostpeak blazed again last night. The stones belong in the Stone Circle.', 'ok', 7000),
    tick: () => circleTick()
  },
  5: {
    start: () => {
      if (G.story.blueFound) { done(); return; }   // found already
      sfx('whine'); toast("🐕 Scout sniffs Tomas's second page and looks " + dirTo(T[0][0], T[0][1]) + '. Start at the FROZEN LAKE, it said... at NIGHT.', 'ok', 10000);
    },
    daily: () => toast('🐕 Scout looks towards the Frozen Lake again.', 'ok', 7000),
    tick: () => pawsTick()
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
const T = STORY_SPOTS.trail, BL = STORY_SPOTS.blue;

/** what the next Wolf Moons are like (from src/game/scout-story.js), for the spawner */
R.raidKind = () => moonKind(G.day, story().ch);
const MOON_SOON = {
  snow: "🐕 Scout keeps sniffing the north wind, his fur standing up. Tomorrow's Wolf Moon will be a ❄️ <b>SNOW MOON</b>: snow wolves, and they laugh at torches!",
  storm: "🐕 The air smells of rain, and Scout won't stop shaking. Tomorrow's Wolf Moon will be a ⛈️ <b>STORM MOON</b>: keep your fire under a roof!"
};
const MOON_TONIGHT = { snow: '❄️ Tonight is the <b>SNOW MOON</b>. Only a Crystal Lantern keeps snow wolves away.', storm: '⛈️ Tonight is the <b>STORM MOON</b>. Roof over your fire, roof over your bed!' };

function healPaw(msg) {
  G.story.limp = false; done(); sfx('bark'); sfx('heart'); toast(msg, 'ok', 8000);
  if (R.scout) { R.scout.limp = false; hearts(R.scout); }
}
/** chapter 5, once a second: by day Scout leads to where the trail starts and sniffs the snow;
 *  at night the paw prints glow, and he leads along them, one bend at a time, to the cairn */
function pawsTick() {
  const st = G.story;
  if (!night()) {
    const d = leadTo(T[0][0], T[0][1]); digAt(T[0][0], T[0][1]);
    if (d < 8 && st.sniffDay !== G.day) { st.sniffDay = G.day; toast("🐕 Scout sniffs the snow and whines. Paw prints? There's nothing to see here... in the daylight.", 'ok', 8000); }
    return;
  }
  let i = st.trailI || 0;
  for (let k = i; k < T.length; k++) if (dist(T[k][0], T[k][1]) < 7) i = k;
  st.trailI = i;
  const [x, z] = T[Math.min(i + 1, T.length - 1)];
  leadTo(x, z, BL.x, BL.z);
}
/* ---------- the Stone Circle (chapter 6): three carved stones, each with a hole for its stone ---------- */
const CI = SITES.circle;
const NOTCH = {};   // standing-stone index -> { id, name, x, z, ry } (the hole's spot, on the stone's inner face)
for (const id in STONES) {
  const w = STONES[id].stone, a = w / 8 * Math.PI * 2;
  NOTCH[w] = { id, carving: STONES[id].carving, x: CI.x + Math.cos(a) * 7.5, z: CI.z + Math.sin(a) * 7.5, ry: Math.atan2(-Math.cos(a), -Math.sin(a)) };
}
const GLOW_C = { greenstone: 0x6fe08a, goldstone: 0xffd24a, bluestone: 0x7fdcff };
const placed = id => !!(G.story && G.story.placed && G.story.placed[id]);
/** once a second in chapter 6: Scout leads to the circle, then to the stone that fits one you carry */
function circleTick() {
  const d = dist(CI.x, CI.z);
  if (d > 12) { leadTo(CI.x, CI.z); return; }
  const id = Object.keys(STONES).find(k => !placed(k) && inv(k) > 0);
  if (id) { const n = NOTCH[STONES[id].stone]; leadTo(n.x + Math.sin(n.ry) * 1.2, n.z + Math.cos(n.ry) * 1.2, n.x, n.z); }
}
function tryNotch(w) {
  const n = NOTCH[w], st = G.story;
  if (placed(n.id)) { hint('The ' + ITEMS[n.id].n + ' glows softly in the ' + n.carving + ' stone.'); return; }
  const have = Object.keys(STONES).filter(k => !placed(k) && inv(k) > 0);
  if (!have.length) { hint('There is a round hole in this stone, about the size of an egg. Something belongs here...', 4); return; }
  showChoice('This stone is carved with a <b>' + n.carving.toUpperCase() + '</b>. Which stone goes in the hole?',
    have.map(k => [ITEMS[k].e[0] + ' ' + ITEMS[k].n, '', () => placeStone(k, w)]).concat([['✋ Nothing', 'Step back', () => { }]]));
}
function placeStone(id, w) {
  const n = NOTCH[w], st = G.story;
  if (STONES[id].stone !== w) { sfx('deny'); hint("It doesn't fit. This stone is carved with a <b>" + n.carving + '</b>.', 4); return; }
  take(id, 1); (st.placed || (st.placed = {}))[id] = true; showPlaced(); sfx('zap'); sfx('chest');
  toast('✨ The ' + ITEMS[id].n + ' slides into the ' + n.carving + ' stone and glows!', 'ok', 7000);
  if (Object.keys(STONES).every(placed)) {
    st.allPlaced = true; if (active(6)) done(150); else addXP(150);
    banner('THE STONES ARE HOME', 'All three glow in the Stone Circle. Far away, the lights over Frostpeak flare.');
  }
}
function showPlaced() { for (const k in STONES) if (made['glow_' + k]) made['glow_' + k].visible = placed(k); }

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
  if (st.ch >= 5 && !made.paws) {   // the glowing paw trail (seen only at night) and the cairn at its end
    const [ox, oz] = T[0], oy = heightAt(ox, oz), ps = []; let side = 1;
    for (let k = 0; k < T.length - 1; k++) {
      const [ax, az] = T[k], [bx, bz] = T[k + 1], len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az), sn = Math.sin(ry), cs = Math.cos(ry);
      for (let d = 0.7; d < len; d += 1.4) {
        const cx = ax + (bx - ax) * d / len + cs * 0.18 * side, cz = az + (bz - az) * d / len - sn * 0.18 * side, cy = heightAt(cx, cz) + 0.06; side = -side;
        const pad = (lx, lz, r) => part(cyl(r, r, 0.02, 6), 0xdaf7ff, [cx - ox + sn * lz + cs * lx, cy - oy, cz - oz + cs * lz - sn * lx], null, null, 0);
        ps.push(pad(0, 0, 0.1), pad(-0.095, 0.12, 0.042), pad(-0.034, 0.17, 0.042), pad(0.034, 0.17, 0.042), pad(0.095, 0.12, 0.042));   // a pad and four toes
      }
    }
    made.paws = prop(ps, ox, oy, oz, 0, MAT_GLOW); made.paws.castShadow = false; made.paws.visible = night();
    const by = heightAt(BL.x, BL.z);
    made.cairn = prop([part(ico(0.42, 0), 0x8a8f96, [0, 0.2, 0], null, [1, 0.6, 1], 0), part(ico(0.3, 0), 0x9aa0a8, [0.15, 0.48, -0.05], null, [1, 0.7, 1], 0), part(ico(0.2, 0), 0x7d828a, [-0.1, 0.7, 0.05], null, null, 0)], BL.x, by, BL.z);
    made.blue = prop([part(ico(0.11, 0), 0x7fdcff, [0.28, 0.32, 0.22], null, null, 0)], BL.x, by, BL.z, 0, MAT_GLOW);
    made.blue.visible = !st.blueFound;
    addCollider({ x: BL.x, z: BL.z, r: 0.45 });
  }
  if (st.ch >= 2 && !made.notches) {   // the carvings and holes in three of the circle's stones
    made.notches = true;
    const cy = heightAt(CI.x, CI.z), cc = 0xa39e94, sh = 0x26231f;
    const CARVE = {
      tree: () => [part(cyl(0.035, 0.035, 0.14, 5), cc, [0, 1.75, 0.03], null, null, 0), part(cyl(0.001, 0.16, 0.3, 6), cc, [0, 1.95, 0.04], null, null, 0)],
      'sun over the dunes': () => [part(cyl(0.11, 0.11, 0.03, 10), cc, [0, 2.0, 0.03], [Math.PI / 2, 0, 0], null, 0), part(box(0.4, 0.06, 0.04), cc, [0, 1.8, 0.03], null, null, 0), part(box(0.22, 0.05, 0.04), cc, [0.1, 1.86, 0.03], [0, 0, 0.3], null, 0)],
      snowflake: () => [0, 1, 2].map(i => part(box(0.34, 0.04, 0.03), cc, [0, 1.9, 0.03], [0, 0, i * Math.PI / 3], null, 0))
    };
    for (const w in NOTCH) {
      const n = NOTCH[w];
      prop([...CARVE[n.carving](), part(cyl(0.12, 0.12, 0.03, 10), sh, [0, 1.35, 0.02], [Math.PI / 2, 0, 0], null, 0)], n.x, cy, n.z, n.ry);
      const g = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), litMat({ color: GLOW_C[n.id], emissive: GLOW_C[n.id], emissiveIntensity: 0.85 }));
      g.position.set(n.x + Math.sin(n.ry) * 0.04, cy + 1.35, n.z + Math.cos(n.ry) * 0.04); R.scene.add(g); made['glow_' + n.id] = g;
    }
    showPlaced();
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
  for (const w in NOTCH) {
    const n = NOTCH[w];
    POIS.push({
      id: 'storyNotch' + w, x: n.x, z: n.z, get y() { return heightAt(CI.x, CI.z) + 1.35; }, reach: 3.4,
      on: () => !!made.notches && (placed(n.id) || Object.keys(STONES).some(k => inv(k) > 0)),
      label: () => placed(n.id) ? 'The ' + ITEMS[n.id].n + ' glows in the ' + n.carving + ' stone' : 'A stone carved with a ' + n.carving.toUpperCase() + ', with a round hole',
      act: () => tryNotch(+w)
    });
  }
  POIS.push({
    id: 'storyCairn', x: BL.x, z: BL.z, get y() { return heightAt(BL.x, BL.z) + 0.6; }, reach: 2.8,
    on: () => !!made.cairn && !G.story.blueFound, label: 'Look inside the little pile of stones',
    act: () => {
      const st = G.story; st.blueFound = true; st.pupsNews = true; made.blue.visible = false;
      sfx('chest'); give('bluestone', 1);
      if (active(5)) done(); else addXP(60);
      if (G.scout.friend && R.scout) hearts(R.scout);
      banner('THE BLUE STONE', 'At the end of the glowing paw prints, under a little pile of stones.');
      readNote('tomas3');
    }
  });
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
  if (active(1)) { showDialog(DIALOGS.scoutPup, () => { done(30); if (G.scout.friend && R.scout) { hearts(R.scout); sfx('heart'); } }); return true; }
  if (pupsNews()) { showDialog(DIALOGS.scoutPups, () => { G.story.pupsHeard = true; if (G.scout.friend && R.scout) { hearts(R.scout); sfx('heart'); } }); return true; }
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
    if (newDay && friend) {   // Scout senses a Snow Moon or Storm Moon the day before
      const soon = MOON_SOON[moonKind(G.day + 1, story().ch)], tonight = MOON_TONIGHT[moonKind(G.day, story().ch)];
      if (soon) setTimeout(() => toast(soon, 'warn', 11000), 2500);
      if (tonight) setTimeout(() => toast(tonight, 'warn', 9000), 2500);
    }
  }
  wasFriend = friend;

  // the chapter under way
  const st = story(), ch = CHAPTERS[st.ch];
  if (st.ch && !st.done && ch && ch.tick) ch.tick();
  s.limp = !!(G.story && G.story.limp && friend);   // (after the chapters: from the moment the scare starts)
  if (made.paws) made.paws.visible = night();
  R.auroraBoost = st.ch >= 8 ? 0 : st.ch === 7 ? 0.9 : Math.min(0.8, Math.max(0, st.ch - 1) * 0.16);   // the lights over Frostpeak

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

/** what the story has made in the world so far (for the checks) */
const storyMade = () => made;

export { updateScoutStory, leadTo, storyMade, buildProps };
