// The animal journal (IMPROVEMENTS.md step 6), added after the migration.
//
// The first time an animal is close and in front of the player, it is written into the journal
// (J -> Animals): G.seen[type] = the day. Until then its card is a "???". A tip says so, and three
// badges reward spotting: 10 kinds, a rare one, and every animal (bosses not counted).
// G.seen is only in saves once something has been spotted, so older saves are unchanged.
import { G, R } from '../state.js';
import { CREATURES } from '../data/creatures.js';
import { badge } from '../story/quests.js';
import { toast } from '../ui/hud.js';
import { sfx } from '../audio/audio.js';

const ICON = {
  rabbit: '🐇', deer: '🦌', fox: '🦊', boar: '🐗', snake: '🐍', crab: '🦀', spider: '🕷️', frog: '🐸', bat: '🦇', goat: '🐐',
  horse: '🐎', donkey: '🐴', alpaca: '🦙', shark: '🦈', wolf: '🐺', snowwolf: '🐺', scorpion: '🦂',
  bear: '🐻', grizzle: '🐻', duneking: '🦂', frostclaw: '🐻'
};
/** rare ones: a badge for spotting any of them */
const RARE = ['fox', 'boar', 'horse', 'donkey', 'alpaca', 'shark'];
const KINDS = Object.keys(CREATURES).filter(k => ICON[k]);
const SPOT_DIST = 32, SPOT_DOT = 0.55;   // metres; how squarely in front (cosine of the angle)

/** called once a second (src/boot.js slowTick): note any new animal the player can see */
function checkSightings() {
  if (!R.started || R.sleeping || R.cinematic) return;
  const p = G.p, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);   // facing (yaw 0 looks along -z)
  for (const c of R.creatures) {
    if (c.dead || !ICON[c.type] || (G.seen && G.seen[c.type])) continue;
    if (c.g && c.g.visible === false) continue;
    const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz);
    if (d > SPOT_DIST || (d > 3 && (dx * fx + dz * fz) / d < SPOT_DOT)) continue;
    spot(c.type);
  }
}
function spot(type) {
  if (!G.seen) G.seen = {};
  if (G.seen[type]) return;
  G.seen[type] = G.day;
  const def = CREATURES[type];
  toast('🐾 New animal: <b>' + def.n + '</b>! It\'s in your journal (<b>J</b>).', 'ok', 5000); sfx('discover');
  const wild = KINDS.filter(k => !CREATURES[k].boss), got = wild.filter(k => G.seen[k]);
  if (got.length >= 10) badge('spot10');
  if (RARE.includes(type)) badge('spotrare');
  if (got.length === wild.length) badge('spotall');
}
/** the Animals tab of the journal: a card for each animal, "???" until spotted */
function animalsHTML() {
  const seen = G.seen || {}, n = KINDS.filter(k => seen[k]).length;
  return '<p class="dim">Animals spotted: <b>' + n + ' / ' + KINDS.length + '</b>. Get close and look at one to add it.</p><div class="badges">' + KINDS.map(k => {
    const d = CREATURES[k], day = seen[k];
    if (!day) return '<div class="badge"><span>❔</span><b>???</b><small>' + (d.boss ? 'A legend of the island' : 'Not spotted yet') + '</small></div>';
    return '<div class="badge got"><span>' + ICON[k] + '</span><b>' + d.n + '</b><small>' + (d.boss ? '👑 Boss · ' : RARE.includes(k) ? '✨ Rare · ' : '') + 'Day ' + day + '</small></div>';
  }).join('') + '</div>';
}

export { checkSightings, animalsHTML, RARE as RARE_ANIMALS };
