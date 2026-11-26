// Life in the water (ANIMALS.md step D), added after the migration:
// - the shark: swim out into deep sea water and, after a few seconds, a shark finds you. It
//   circles closer, then charges and bites. It gives up when you reach the shallows (or land).
//   It is a creature in R.creatures (so it can be hit, shot and killed: 3 raw fish), but
//   updateCreatures() hands it to updateShark(), because land creatures won't enter water.
// - fish: a small school swims in each lake near the player, just under the surface over the
//   shallower water by the bank (deep water is too dark to see into), and now and then one leaps
//   out with a splash. They are only scenery (fishing works as before).
// updateSea() runs every frame, from the game loop in src/boot.js.
import { TAU, dist2, rnd, angDiff } from '../core/math.js';
import { G, R } from '../state.js';
import { sfx } from '../audio/audio.js';
import { LAKES, heightAt } from '../world/terrain.js';
import { puff } from '../world/sky.js';
import { waterY } from '../player/swim.js';
import { hurtPlayer } from '../player/health.js';
import { tipOnce } from '../story/quests.js';
import { gltfAnimal, isLoaded } from '../models/gltf-animals.js';
import { spawnCreature, removeCreature } from './creatures.js';

const SEA_DEEP = -2.6;      // ground this far under the water counts as deep sea (the lakes are not sea)
const SHALLOW = -1.6;       // ground above this: the shark gives up
const nearLake = (x, z, m) => LAKES.some(l => dist2(x, z, l.x, l.z) < l.r + m);
const deepSea = (x, z) => heightAt(x, z) < SEA_DEEP && !nearLake(x, z, 12);

let seaT = 0;               // seconds the player has been swimming in deep sea water
const schools = {};         // lake id -> [fish]

function updateSea(dt) {
  const p = G.p;
  // the shark comes for a swimmer who stays out in the deep sea for 5 s
  if (R.swim && deepSea(p.x, p.z)) seaT += dt; else seaT = Math.max(0, seaT - dt * 2);
  if (seaT > 5 && !R.creatures.some(c => c.type === 'shark' && !c.dead) && isLoaded('shark')) {
    const out = Math.hypot(p.x, p.z) || 1, x = p.x + p.x / out * 22, z = p.z + p.z / out * 22;   // from further out to sea
    const c = spawnCreature('shark', x, z); c.state = 'circle'; c.ang = Math.atan2(z - p.z, x - p.x); c.rad = 16; c.st = rnd(7, 10);
    tipOnce('shark', 'A <b>shark</b> fin! Swim back to the shallows, quick!');
    sfx('splash');
  }
  updateFish(dt);
}

/** the shark's own movement and attack (called by updateCreatures instead of its land AI) */
function updateShark(c, dt) {
  const p = G.p, w = waterY(), dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
  c.moving = 0; c.st -= dt;
  const safe = !R.swim || heightAt(p.x, p.z) > SHALLOW;
  if (safe && c.state !== 'leave' && c.state !== 'wind') { c.state = 'leave'; c.st = 12; }
  const swimTo = (tx, tz, spd) => {
    const ax = tx - c.x, az = tz - c.z, l = Math.hypot(ax, az) || 1;
    c.yaw += angDiff(c.yaw, Math.atan2(ax, az)) * Math.min(1, dt * 4);
    const nx = c.x + Math.sin(c.yaw) * spd * dt, nz = c.z + Math.cos(c.yaw) * spd * dt;
    if (heightAt(nx, nz) < -1.0) { c.x = nx; c.z = nz; c.moving = spd; } else c.yaw += dt * 2;   // never beach itself
    return l;
  };
  switch (c.state) {
    case 'circle': {   // round and round, closer each lap
      c.rad = Math.max(6, c.rad - dt * 0.8); c.ang += dt * 5 / c.rad;
      swimTo(p.x + Math.cos(c.ang) * c.rad, p.z + Math.sin(c.ang) * c.rad, 5);
      if (c.st <= 0) { c.state = 'charge'; c.st = 4; sfx('splash'); }
      break;
    }
    case 'chase':      // hit: it turns on you at once
    case 'charge':
      if (swimTo(p.x, p.z, 8.5) < 3.3) { c.state = 'wind'; c.st = 0.3; }   // (3 m long: its nose is 1.5 m ahead of its middle)
      else if (c.st <= 0) { c.state = 'circle'; c.rad = 12; c.st = rnd(6, 9); }
      break;
    case 'wind':
      swimTo(p.x, p.z, 1);
      if (c.st <= 0) {
        if (d < 4.2 && R.swim) { hurtPlayer(c.def.dmg, 'hurt'); puff((p.x + c.x) / 2, w + 0.1, (p.z + c.z) / 2, 0xffffff, 6, { size: 0.18, speed: 2.5, up: 3 }); }
        else sfx('swish');
        c.state = safe ? 'leave' : 'circle'; c.rad = 13; c.ang = Math.atan2(c.z - p.z, c.x - p.x); c.st = rnd(7, 11);
      }
      break;
    case 'leave': default:
      swimTo(c.x - dx, c.z - dz, 6);
      if (d > 55 || c.st <= 0) { removeCreature(c); return; }
      if (!safe && c.st < 9) { c.state = 'circle'; c.rad = 14; c.st = rnd(5, 8); }   // back out in the deep: it returns
  }
  if (c.hp < c.maxHp * 0.35 && c.state !== 'leave') { c.state = 'leave'; c.st = 15; }   // badly hurt: it swims off
  c.y = w - 0.55;      // the fin breaks the surface
  c.g.position.set(c.x, c.y, c.z); c.g.rotation.y = c.yaw;
  if (Math.random() < dt * 3 * (c.moving > 6 ? 2 : 1)) puff(c.x, w + 0.05, c.z, 0xffffff, 1, { size: 0.18, speed: 0.6 });
  if (c.model.anim) c.model.anim(c, dt);
  if (c.flash > 0) { c.flash -= dt; for (const mt of c.model.mats) mt.emissive.setHex(c.flash > 0 ? 0x999999 : 0); }
}

/** where a school can be seen: water about 1.5 m deep, near the bank of lake l */
function schoolSpot(l) {
  for (let i = 0; i < 8; i++) {
    const a = rnd(TAU), c = Math.cos(a), s = Math.sin(a);
    for (let r = l.r * 0.3; r < l.r + 20; r += 0.5) if (heightAt(l.x + c * r, l.z + s * r) > -1.3) { const rr = r - 2.5; if (heightAt(l.x + c * rr, l.z + s * rr) < -1.2) return { x: l.x + c * rr, z: l.z + s * rr }; break; }
  }
  return null;
}

/** a school of fish in each lake within 70 m of its edge; gone again when you leave */
function updateFish(dt) {
  const p = G.p, w = waterY();
  for (const l of LAKES) {
    const near = dist2(p.x, p.z, l.x, l.z) < l.r + 70;
    let s = schools[l.id];
    if (near && !s && isLoaded('fish')) {
      const at = schoolSpot(l); if (!at) continue;
      s = schools[l.id] = []; s.leapT = rnd(2, 5);
      const n = Math.round(rnd(5, 8));
      for (let i = 0; i < n; i++) {
        const m = gltfAnimal('fish'); if (!m) break;
        const f = { m, cx: at.x + rnd(-1, 1), cz: at.z + rnd(-1, 1), rad: rnd(1.2, 3), ang: rnd(TAU), spd: rnd(0.9, 1.5) * (Math.random() < 0.5 ? -1 : 1), depth: rnd(0.18, 0.32), leap: 0, pose: { state: 'idle', st: 0, moving: 1, flash: 0, dead: false } };
        R.scene.add(m.g); s.push(f);
      }
    } else if (!near && s) { for (const f of s) R.scene.remove(f.m.g); delete schools[l.id]; s = null; }
    if (!s) continue;
    // now and then one fish leaps out and falls back with a splash
    s.leapT -= dt;
    if (s.leapT <= 0 && s.length) { s.leapT = rnd(4, 9); const f = s[Math.floor(rnd(s.length))]; if (!f.leap) { f.leap = 0.9; puff(f.m.g.position.x, w + 0.05, f.m.g.position.z, 0xffffff, 4, { size: 0.12, speed: 1.5, up: 2 }); } }
    for (const f of s) {
      const step = dt * f.spd / f.rad, x = f.cx + Math.cos(f.ang + step) * f.rad, z = f.cz + Math.sin(f.ang + step) * f.rad;
      if (heightAt(x, z) > -0.6) f.spd = -f.spd; else f.ang += step;   // too shallow ahead: turn back
      const px = f.cx + Math.cos(f.ang) * f.rad, pz = f.cz + Math.sin(f.ang) * f.rad, sg = Math.sign(f.spd);
      let y = w - f.depth, pitch = 0;
      if (f.leap > 0) { f.leap -= dt; const k = 1 - Math.max(0, f.leap) / 0.9; y = w - f.depth + Math.sin(k * Math.PI) * (0.7 + f.depth); pitch = (0.5 - k) * 1.6; if (f.leap <= 0) { f.leap = 0; puff(px, w + 0.05, pz, 0xffffff, 5, { size: 0.12, speed: 1.6, up: 2 }); } }
      f.m.g.position.set(px, y, pz); f.m.g.rotation.set(-pitch, Math.atan2(-Math.sin(f.ang) * sg, Math.cos(f.ang) * sg), 0, 'YXZ');
      f.m.anim(f.pose, dt);
    }
  }
}

/** how many fish swim near the player now (for the checks) */
const fishCount = () => Object.values(schools).reduce((n, s) => n + s.length, 0);

export { deepSea, updateSea, updateShark, schoolSpot, updateFish, fishCount };
