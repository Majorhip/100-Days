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
import { G, R } from '../state.js';
import { shCell } from './collision.js';
import { diffOf, HUNTED } from '../data/difficulty.js';

/** the share of each kind of find that is really there */
const PICKUP_KEEP = { sticks: 0.55, stones: 0.55, flintp: 0.65, mushroom: 0.5, herb: 0.65, bush: 0.6, reed: 0.7 };
const START_SAFE = 40;   // metres around the start where every find stays

/** a number 0..1 that depends only on i */
function hash01(i) {
  let h = Math.imul(i + 1, 0x9e3779b1); h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

let _nodes = null, _setMatrix = null;
/** take out the finds that are not there (called at the end of placeNodes, at Normal) */
function thinPickups(nodes, setNodeMatrix) { _nodes = nodes; _setMatrix = setNodeMatrix; setFinds(diffOf(null)); }
/**
 * Show the finds for a difficulty level (step 4): called when a game starts or continues, before
 * the save's own changes are applied. Finds come and go by the same fixed order, so a harder
 * level only takes more away and an easier one only brings some back.
 */
function setFinds(level) {
  if (!_nodes) return;
  const st = R.start;
  _nodes.forEach((n, i) => {
    const keep = PICKUP_KEEP[n.t];
    if (keep === undefined) return;
    const out = hash01(i) >= level.finds(keep) && !(st && Math.hypot(n.x - st.x, n.z - st.z) < START_SAFE);
    if (out === !!n.absent) return;
    const c = shCell(n.x, n.z).nodes, k = c.indexOf(n);
    if (out) {
      n.absent = true; n.gone = true;
      _setMatrix(n, false, false);
      if (n.col) n.col.off = true;
      if (k >= 0) c.splice(k, 1);
    } else {
      n.absent = false; n.gone = false;
      _setMatrix(n, true, true);
      if (n.col) n.col.off = false;
      if (k < 0) c.push(n);
    }
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
/** more or fewer of the animals you hunt, by difficulty (step 4) */
const huntK = type => HUNTED.includes(type) ? diffOf(G).animals : 1;
function rareCap(type, cap) { const a = ANIMAL_RARITY[type]; return a ? Math.max(1, Math.round(cap * Math.min(1, a.cap * huntK(type)))) : cap; }
function rareRoll(type) { const a = ANIMAL_RARITY[type]; return !a || Math.random() < a.p * huntK(type); }

export { PICKUP_KEEP, START_SAFE, hash01, thinPickups, setFinds, ANIMAL_RARITY, rareCap, rareRoll };
