// Swimming: in deep water the player floats at the surface instead of walking along the bottom.
// Added after the migration (see tests/golden/approved-edits.mjs). The original blocked the player
// where the water got 1.25 m deep, but anything that put them past that line (a lake bank, a
// teleport, a blackout spot) left them walking along the lake bed with the camera under water.
//
// Called from updatePlayer() in movement.js:
//   swimTire()  replaces the stamina refill while afloat
//   swimStep()  replaces gravity and ground contact while afloat
import { R } from '../state.js';
import { sfx } from '../audio/audio.js';
import { puff } from '../world/sky.js';
import { heightAt } from '../world/terrain.js';
import { hint } from '../ui/hud.js';
import { hurtPlayer } from './health.js';

const FLOAT = 1.2;           // the body floats this far below the surface; the eyes (1.62 m up) sit ~0.4 m above it
const SEA_LIMIT = -4.5;      // open sea deeper than this is too rough to swim in (the lakes are at most 3.2 m deep)
const BUOY = 26, DRAG = 5.5; // spring that holds the body at the float line, and the drag that stops it bouncing
const TIRE_MOVE = 2.5, TIRE_IDLE = 1.0;  // stamina per second: ~40 s of steady swimming from full
const DROWN_DPS = 4;         // health per second once stamina runs out

function waterY() { return R.water ? R.water.position.y : 0; }
function swimLevel() { return waterY() - FLOAT; }

/** stamina while afloat: swimming tires you, and running out hurts until you reach the shore */
function swimTire(p, dt, moving) {
  p.stam = Math.max(0, p.stam - (moving ? TIRE_MOVE : TIRE_IDLE) * dt);
  if (!R.tips.swim) { R.tips.swim = 1; hint('You are swimming! It uses up your ⚡ stamina, so head for the shore before it runs out.', 5); }
  if (p.stam < 25 && p.stam > 0 && !R.tips.swimTired) { R.tips.swimTired = 1; hint('You are getting tired. Swim to the shore!', 4); setTimeout(() => R.tips.swimTired = 0, 15000); }
  if (p.stam > 0) { R.drownAcc = 0; return; }
  if (R.cinematic || R.sleeping) return;
  R.drownAcc = (R.drownAcc || 0) + dt;
  if (R.drownAcc >= 1) {                // one hit a second, so the damage flash and sound are not constant
    R.drownAcc -= 1;
    hint('You are too tired to swim! Get to the shore!', 2);
    hurtPlayer(DROWN_DPS, 'drown');
  }
}

/** where a blackout drops the backpack: here, or the nearest shore if here is under water */
function packSpot(x, z) { return heightAt(x, z) < 0.3 ? dryLandNear(x, z) : { x, z }; }

/** vertical motion while afloat. Returns false on land, where the original gravity and ground contact apply. */
function swimStep(p, dt) {
  const lvl = swimLevel(), surf = waterY();
  if (R.ground >= lvl) { R.swim = false; return false; }
  const y0 = p.y;
  if (p.y > lvl) p.vy -= 19 * dt;                                 // still dropping into the water
  else p.vy += ((lvl - p.y) * BUOY - p.vy * DRAG) * dt;           // buoyancy lifts the body back to the float line
  p.y += p.vy * dt;
  if (p.y < R.ground) { p.y = R.ground; p.vy = Math.max(0, p.vy); }
  if (y0 > surf - 0.6 && p.y <= surf - 0.6 && p.vy < -3) {        // jumped in: splash
    sfx('splash'); puff(p.x, surf + 0.1, p.z, 0xd8f0ff, 12, { size: 0.22, up: 2.2 }); R.shake = Math.max(R.shake, 0.12);
  }
  if (R.stepAcc > 2.8) { R.stepAcc = 0; sfx('step', 'water'); }   // swim strokes instead of footsteps
  R.swim = true;
  return true;
}

/** the nearest spot of dry land, searching outward in rings */
function dryLandNear(x, z) {
  for (let r = 2; r < 120; r += 2) for (let a = 0; a < 24; a++) {
    const ang = a / 24 * Math.PI * 2, nx = x + Math.cos(ang) * r, nz = z + Math.sin(ang) * r;
    if (heightAt(nx, nz) > 0.6) return { x: nx, z: nz };
  }
  return { x, z };
}

export { FLOAT, SEA_LIMIT, waterY, swimLevel, swimTire, swimStep, dryLandNear, packSpot };
