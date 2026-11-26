// Where the new wildlife lives (ANIMALS.md step C), added after the migration. Called from
// updateSpawner() in src/creatures/spawner.js, which places the original creatures by biome.
// These go by place instead: boars in the forest, snakes in the desert, crabs on the beaches,
// frogs at the lake edges, spiders in the grotto and the mine, and bats there at night.
import { TAU, dist2, rnd } from '../core/math.js';
import { G, R } from '../state.js';
import { LAKES, SITES, biomeAt, heightAt, inSite } from '../world/terrain.js';
import { spawnCreature, removeCreature } from './creatures.js';
import { spawnPoint } from './spawner.js';

/** a point on the sea shore (sand, not snow, not a lake bank) 20–60 m from the player */
function beachPoint() {
  const p = G.p;
  for (let i = 0; i < 10; i++) {
    const a = rnd(TAU), r = rnd(20, 60), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, h = heightAt(x, z);
    if (h < 0.45 || h > 1.5 || biomeAt(x, z) === 'snow' || inSite(x, z, 4)) continue;
    if (LAKES.some(l => dist2(x, z, l.x, l.z) < l.r + 10)) continue;
    return { x, z };
  }
  return null;
}
/** a point on the bank of a lake whose edge is within 70 m of the player */
function lakeEdgePoint() {
  const p = G.p;
  for (const l of LAKES) {
    if (dist2(p.x, p.z, l.x, l.z) > l.r + 70) continue;
    // the banks are not round: walk out from the middle to where the ground leaves the water
    for (let i = 0; i < 6; i++) {
      const a = rnd(TAU), c = Math.cos(a), s = Math.sin(a);
      for (let r = l.r * 0.4; r < l.r + 20; r += 1) {
        if (heightAt(l.x + c * r, l.z + s * r) <= 0.3) continue;
        const rr = r + rnd(0.5, 3), x = l.x + c * rr, z = l.z + s * rr, h = heightAt(x, z);
        if (h > 0.3 && h < 2.2 && dist2(x, z, p.x, p.z) > 12) return { x, z };
        break;
      }
    }
  }
  return null;
}

/**
 * cnt: how many of each type roam now (not lair creatures, bosses or raiders), as
 * updateSpawner counts them; night: as updateSpawner has it
 */
function updateWildlife(cnt, night) {
  const p = G.p, b = R.biome;
  const want = (type, cap, find, o) => { if ((cnt[type] || 0) < cap) { const s = find(); if (s) spawnCreature(type, s.x, s.z, o); } };
  if (b === 'forest') want('boar', 1, () => spawnPoint('forest', 46, 72));
  if (b === 'desert') want('snake', night ? 1 : 2, () => spawnPoint('desert', 30, 60));
  if (b !== 'snow') want('crab', 3, beachPoint);
  want('frog', 3, lakeEdgePoint);
  // spiders in the grotto and the mine; bats there and at the bear's cave, at night only
  const den = (id, type, site, n, ok, ring) => {
    const s = SITES[site], d = dist2(p.x, p.z, s.x, s.z), alive = R.creatures.filter(c => c.lair === id && !c.dead);
    if (!ok) { for (const c of alive) removeCreature(c); return; }
    if (d < 90 && !alive.length && !(G.lairs[id] > G.day)) for (let i = 0; i < n; i++) { const a = i / n * TAU + 0.4; spawnCreature(type, s.x + Math.cos(a) * ring, s.z + Math.sin(a) * ring, { lair: id }); }
  };
  den('spiderGrotto', 'spider', 'grotto', 2, true, 2.5); den('spiderMine', 'spider', 'mine', 2, true, 3);
  den('batGrotto', 'bat', 'grotto', 3, night, 3); den('batMine', 'bat', 'mine', 3, night, 4); den('batCave', 'bat', 'cave2', 3, night, 4);
}

export { beachPoint, lakeEdgePoint, updateWildlife };
