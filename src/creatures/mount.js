// Riding (IMPROVEMENTS.md step 7), added after the migration.
//
// Taming: wild horses, donkeys and alpacas run from you, unless you walk up (no sprinting) with
// berries in your pack. Then they stay, and E feeds one a berry. Feed them on 3 different days
// and the one you feed on the third day is yours.
// Riding: E on your animal gets you on, E again gets you off. Riding is fast and costs no
// stamina. You can't use tools or jump while riding, and your animal won't go into deep water.
// If something hurts you, you're thrown off and it bolts a short way.
// Your animal is saved (G.mount) and waits where you left it. If it goes missing (a blackout
// clears the creatures), it comes back at the same spot.
//
// The older modules don't import this one (that would change the order they start up in).
// They read flags on the creature (c.calm, c.tame, c.tameUpdate, c.throwOff) and on R
// (R.riding, R.dismount) instead. src/boot.js calls updateMount() once a second.
import { G, R } from '../state.js';
import { angDiff } from '../core/math.js';
import { inv, take } from '../player/inventory.js';
import { POIS } from '../player/targeting.js';
import { groundAt } from '../player/movement.js';
import { spawnCreature, moveCreature } from './creatures.js';
import { badge } from '../story/quests.js';
import { toast, hint } from '../ui/hud.js';
import { sfx } from '../audio/audio.js';
import { puff } from '../world/sky.js';

const MOUNTS = ['horse', 'donkey', 'alpaca'];
const NAME = { horse: 'horse', donkey: 'donkey', alpaca: 'alpaca' };
const FOOD = 'berries', DAYS = 3;
const WALK = 9, GALLOP = 14;   // m/s while riding (walking is 5, sprinting 8.4)

let cand = null;   // the animal the E prompt is about: a wild one to feed, or your own
const mine = () => R.creatures.find(c => c.tame && !c.dead) || null;

/** once a second: calm the wild ones while you carry berries, find the nearest one to talk to,
 *  and make sure your own animal is there */
function updateMount() {
  if (!R.started) return;
  const p = G.p, tame = !!(G.mount && G.mount.tame);
  const calm = !tame && inv(FOOD) > 0 && !R.sprinting && !R.riding;
  let best = null, bd = 4.2;
  for (const c of R.creatures) {
    if (c.dead || !MOUNTS.includes(c.type)) continue;
    if (!c.tame) c.calm = calm;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bd && (c.tame || calm)) { bd = d; best = c; }
  }
  cand = best;
  if (tame && !mine()) {   // gone missing (a blackout clears the creatures): back where you left it
    const m = G.mount, c = spawnCreature(m.type, m.x, m.z); makeTame(c); c.yaw = m.yaw || 0;
  }
  const own = mine(); if (own && !R.riding) { G.mount.x = +own.x.toFixed(2); G.mount.z = +own.z.toFixed(2); G.mount.yaw = +own.yaw.toFixed(2); }
}
function makeTame(c) {
  c.tame = true; c.calm = true; c.herd = null; c.state = 'idle'; c.tx = null;
  c.tameUpdate = tameUpdate; c.throwOff = throwOff;
}
/** your animal, every frame (from updateCreatures): under you while riding, else standing by */
function tameUpdate(c, dt) {
  const p = G.p;
  if (R.riding === c) {
    const v = c.lastX === undefined ? 0 : Math.hypot(p.x - c.lastX, p.z - c.lastZ) / Math.max(dt, 1e-3);
    c.lastX = p.x; c.lastZ = p.z;
    c.x = p.x; c.z = p.z; c.yaw += angDiff(c.yaw, p.yaw + Math.PI) * Math.min(1, dt * 12);
    c.moving = v > 0.3 ? v : 0; c.state = 'idle';
    return;
  }
  c.lastX = undefined;
  if (c.bolt > 0) {   // thrown you off: run a short way, then stop
    c.bolt -= dt; moveCreature(c, c.x - p.x, c.z - p.z, c.def.spd * 0.8, dt);
  }
}
function feed(c) {
  const m = G.mount || (G.mount = { fed: [] });
  if (m.fed.includes(G.day)) { hint('It has had its berries today. Come back tomorrow!'); return; }
  take(FOOD, 1); m.fed.push(G.day); sfx('eat');
  puff(c.x, c.y + c.model.h + 0.2, c.z, 0xff6b9a, 6, { size: 0.12, up: 1.5, g: 0 });
  if (m.fed.length >= DAYS) {
    m.tame = true; m.type = c.type; makeTame(c); m.x = c.x; m.z = c.z; m.yaw = c.yaw;
    toast('🐎 The ' + NAME[c.type] + ' trusts you! Press <b>E</b> on it to ride.', 'gold', 7000); sfx('quest'); badge('rider');
  } else toast('🫐 The ' + NAME[c.type] + ' eats from your hand. (Fed on ' + m.fed.length + ' of ' + DAYS + ' days.)', 'ok', 5000);
}
function mountUp(c) {
  R.riding = c; c.calm = true; c.bolt = 0; G.p.x = c.x; G.p.z = c.z; G.p.vy = 0;
  sfx('step', 'grass'); hint('Riding! <b>Shift</b> to gallop, <b>E</b> to get off.');
}
function dismount() {
  const c = R.riding; if (!c) return;
  R.riding = null;
  const p = G.p, side = p.yaw + Math.PI / 2, x = p.x + Math.cos(side) * 1.3, z = p.z - Math.sin(side) * 1.3;
  if (groundAt(x, z) > -0.3) { p.x = x; p.z = z; }
  p.y = groundAt(p.x, p.z); p.vy = 0;
  G.mount.x = c.x; G.mount.z = c.z; G.mount.yaw = c.yaw;
}
function throwOff() {
  const c = R.riding; if (!c) return;
  dismount(); c.bolt = 2.2; R.shake = Math.max(R.shake, 0.4);
  toast('💥 You were thrown off! Your ' + NAME[c.type] + ' bolts.', 'warn', 4000);
}
R.dismount = dismount;

// the E prompt: one point of interest that follows the animal
POIS.push({
  id: 'mount', reach: 3.6, tall: 1.4,
  get x() { return cand ? cand.x : 1e9; }, get z() { return cand ? cand.z : 1e9; }, get y() { return cand ? cand.y + 0.6 : 0; },
  on: () => !!cand && !R.riding,
  label: () => {
    const c = cand, n = NAME[c.type];
    if (c.tame) return 'Ride your ' + n;
    const fed = (G.mount && G.mount.fed) || [];
    return fed.includes(G.day) ? 'The ' + n + ' is full (fed ' + fed.length + '/' + DAYS + ')' : 'Feed the wild ' + n + ' a berry (' + fed.length + '/' + DAYS + ')';
  },
  act: () => { const c = cand; if (!c) return; if (c.tame) mountUp(c); else feed(c); }
});

export { MOUNTS, updateMount, dismount, mountUp, feed };
