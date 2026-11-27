// Connects the pure survival rules (src/game/survival.js) to the running game.
// The rules take plain values and return results. This module reads them from the world, the
// runtime state R and the player's gear, and acts on what comes back. It keeps the two calls
// the game loop and sleeping always made, with the same names and the same effects:
//   ambientTemp()            sets R.temp and R.heat, returns the temperature
//   survivalStep(gh, ctx)    advances the meters; blacks the player out if health runs out
import { G, R } from '../state.js';
import { biomeW } from '../world/terrain.js';
import { nightAmount } from '../world/sky.js';
import { heldDef, wearStat, armorValue } from './inventory.js';
import { blackout } from './health.js';
import { ambientTempRule, survivalStepRule } from '../game/survival.js';
import { diffOf } from '../data/difficulty.js';

/** the conditions where the player stands, as the temperature rule needs them */
function climateHere() {
  const p = G.p;
  return {
    w: biomeW(p.x, p.z), night: nightAmount(), weather: G.weather, sheltered: !!R.sheltered,
    fireDist: R.nearFire ? R.nearFireDist : null,
    torch: heldDef().tool.cls === 'torch', wearWarm: wearStat('warm', 0, Math.max), armor: armorValue(), y: p.y
  };
}
function ambientTemp() {
  const { T, heat } = ambientTempRule(climateHere());
  R.heat = heat; R.temp = T; return T;
}
/** ctx: { sleeping, sprint, rest }; hunger and thirst run at the game's difficulty */
function survivalStep(gh, ctx) {
  const why = survivalStepRule(gh, { ...ctx, temp: R.temp, heat: R.heat, nearFire: !!R.nearFire, rate: diffOf(G).hunger });
  if (why) blackout(why);
}

export { climateHere, ambientTemp, survivalStep };
