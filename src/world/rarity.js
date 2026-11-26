// Rarer finds (added after the migration, for a harder game where a find is a surprise).
//
// Pickups: the island is still laid out exactly as in the original (same NODES, same order,
// same save indices), but only a share of each kind of small find is really there; the rest
// are left out for good. Which ones is fixed by their index (no random numbers), so every game
// and every save sees the same island. Around the shipwreck (the start) everything stays, for
// a fair first day.
//
// Animals: each kind has a cap (how many roam near you at once, as a share of the original
// cap) and a chance per second that one turns up while there are fewer. The original
// refilled every kind the moment one was gone, so the island always felt full.
import { R } from '../state.js';
import { shCell } from './collision.js';

/** the share of each kind of find that is really there */
const PICKUP_KEEP = { sticks: 0.55, stones: 0.55, flintp: 0.65, mushroom: 0.5, herb: 0.65, bush: 0.6, reed: 0.7 };
const START_SAFE = 40;   // metres around the start where every find stays

/** a number 0..1 that depends only on i */
function hash01(i) {
  let h = Math.imul(i + 1, 0x9e3779b1); h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** take out the finds that are not there (called at the end of placeNodes) */
function thinPickups(nodes, setNodeMatrix) {
  const st = R.start;
  nodes.forEach((n, i) => {
    const keep = PICKUP_KEEP[n.t];
    if (keep === undefined || hash01(i) < keep) return;
    if (st && Math.hypot(n.x - st.x, n.z - st.z) < START_SAFE) return;
    n.absent = true; n.gone = true;
    setNodeMatrix(n, false, false);
    if (n.col) n.col.off = true;
    const c = shCell(n.x, n.z).nodes, k = c.indexOf(n); if (k >= 0) c.splice(k, 1);
  });
}

/** per kind: cap = share of the original cap (at least 1), p = chance per second that one
 *  turns up. Common, uncommon, rare; the night hunters still come, but one at a time. */
const ANIMAL_RARITY = {
  rabbit: { cap: 0.67, p: 0.06 }, goat: { cap: 0.67, p: 0.04 }, crab: { cap: 0.67, p: 0.05 }, frog: { cap: 0.67, p: 0.05 },
  scorpion: { cap: 0.75, p: 0.04 }, deer: { cap: 0.5, p: 0.02 }, snake: { cap: 0.5, p: 0.02 },
  boar: { cap: 1, p: 0.012 }, fox: { cap: 1, p: 0.008 },
  horse: { cap: 1, p: 0.005 }, donkey: { cap: 1, p: 0.006 }, alpaca: { cap: 1, p: 0.006 },
  wolf: { cap: 1, p: 0.05 }, snowwolf: { cap: 1, p: 0.03 }
};
function rareCap(type, cap) { const a = ANIMAL_RARITY[type]; return a ? Math.max(1, Math.round(cap * a.cap)) : cap; }
function rareRoll(type) { const a = ANIMAL_RARITY[type]; return !a || Math.random() < a.p; }

export { PICKUP_KEEP, START_SAFE, hash01, thinPickups, ANIMAL_RARITY, rareCap, rareRoll };
