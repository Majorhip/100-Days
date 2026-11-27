// Survival rules: temperature, hunger, thirst, warmth and health per game hour.
// Moved from the original game script in the migration. Since 27 Nov 2026 these are pure rules:
// everything they need comes in as arguments, and they report back by return value.
// src/player/climate.js connects them to the game (runtime state, the world, the inventory).
// Standing rule: no three.js, no page, no R (tests/golden/compare-build.mjs).

import '../player/inventory.js';   // load order: runs after the previous part of the original script
import { clamp, lerp } from '../core/math.js';
import { G } from '../state.js';

/* ---------- temperature + the one survival step (used for play AND sleep) ---------- */
/**
 * The temperature where the player stands, and whether the desert heat is on.
 * c: { w: biome weights {forest, desert, snow}, night: 0..1, weather, sheltered,
 *      fireDist: metres to the nearest fire (null if none), torch, wearWarm, armor, y }
 */
function ambientTempRule(c) {
  const w = c.w, n = c.night;
  let T = w.forest * lerp(21, 9, n) + w.desert * lerp(35, 7, n) + w.snow * lerp(-5, -15, n);
  const heat = w.desert > 0.5 && n < 0.3 && !c.sheltered;
  const wet = c.weather === 'rain' || c.weather === 'storm';
  if (wet && !c.sheltered) T -= c.weather === 'storm' ? 9 : 7;
  if (c.sheltered) T += 7;
  if (c.fireDist != null) T += c.fireDist < 6 ? 26 : 26 * (1 - (c.fireDist - 6) / 4);
  if (c.torch) T += 6;
  T += c.wearWarm + (c.armor > 0 ? 4 : 0);
  if (c.y < -0.5) T -= 6;
  return { T, heat };
}
const SURV = { food: 3.0, water: 3.8, comfort: 14 };
/**
 * Advance the survival meters by gh game-hours.
 * ctx: { sleeping, sprint, rest, temp, heat, nearFire }
 * Returns the blackout cause ('cold', 'thirst' or 'hunger') if health ran out while awake,
 * otherwise null.
 */
function survivalStepRule(gh, ctx) {
  const p = G.p, T = ctx.temp, sl = ctx.sleeping ? 0.5 : 1;
  p.food = Math.max(0, p.food - SURV.food * gh * sl * (ctx.sprint ? 1.6 : 1));
  p.water = Math.max(0, p.water - SURV.water * gh * sl * (ctx.sprint ? 1.5 : 1) * (ctx.heat ? 2 : 1));
  if (T >= SURV.comfort) p.warm = Math.min(100, p.warm + (ctx.nearFire ? 34 : 11) * gh);
  else p.warm = Math.max(0, p.warm - (SURV.comfort - T) * 0.85 * gh);
  let dh = 0;
  if (p.food <= 0) dh -= 5; if (p.water <= 0) dh -= 7; if (p.warm <= 0) dh -= 9;
  if (dh === 0 && p.food > 25 && p.water > 25 && p.warm > 25) dh = ctx.sleeping ? (ctx.rest || 4) : 2.5;
  p.hp = clamp(p.hp + dh * gh, 0, p.maxHp);
  let out = null;
  if (p.hp <= 0 && !ctx.sleeping) out = p.warm <= 0 ? 'cold' : p.water <= 0 ? 'thirst' : 'hunger';
  if (ctx.sleeping && p.hp < 5) p.hp = 5;
  return out;
}

export { ambientTempRule, SURV, survivalStepRule };
