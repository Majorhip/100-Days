// Building pieces: cost, how they snap to the grid, and what they do.
// Content only: no three.js, no page, no game code (see MIGRATION.md, standing rule).
// Moved verbatim from the original game script in Phase 4.1.

// @moved-from: legacy.js

/* place: 'free' anywhere, 'cell' snaps to the 3m build grid, 'edge' snaps to a grid edge */
const BUILDS = [
  { id: 'campfire', n: 'Campfire', e: ['🔥'], cost: { stone: 3, stick: 4 }, place: 'free', d: 'Warmth, light, cooking. Wolves stay away from a lit fire.' },
  { id: 'shelter', n: 'Lean-to Shelter', e: ['⛺'], cost: { stick: 6, fibre: 4 }, place: 'free', d: 'Sleep here to skip the night. Keeps the rain off.' },
  { id: 'bench', n: 'Workbench', e: ['🛠️', '🔨'], cost: { wood: 6, stone: 2 }, place: 'free', d: 'Unlocks bows, armour and iron tools.' },
  { id: 'chest', n: 'Storage Chest', e: ['📦'], cost: { wood: 6, rope: 1 }, place: 'free', d: 'Keeps your things safe if you black out.' },
  { id: 'floor', n: 'Wood Floor', e: ['🟫', '⬛'], cost: { wood: 2 }, place: 'cell', d: 'A flat floor. Start your cabin here.' },
  { id: 'wall', n: 'Wood Wall', e: ['🧱'], cost: { wood: 3 }, place: 'edge', d: 'Keeps creatures out.' },
  { id: 'door', n: 'Doorway', e: ['🚪'], cost: { wood: 3 }, place: 'edge', d: 'A wall with a door-sized gap.' },
  { id: 'roof', n: 'Thatch Roof', e: ['🏠'], cost: { wood: 2, fibre: 2 }, place: 'cell', d: 'Shelter from rain and cold. Fires stay lit under it.' },
  { id: 'bed', n: 'Bed', e: ['🛏️'], cost: { wood: 4, fibre: 3, hide: 2 }, place: 'free', d: 'The best sleep. You wake up here if you black out.' },
  { id: 'spikes', n: 'Spike Barricade', e: ['🗡️'], cost: { stick: 6, wood: 1 }, place: 'free', d: 'Hurts any creature that runs into it.' },
  { id: 'torchpost', n: 'Torch Post', e: ['🕯️'], cost: { stick: 3, fibre: 2 }, place: 'free', d: 'A standing torch. Lights your base and scares wolves.' },
  { id: 'furnace', n: 'Furnace', e: ['🏭', '🧱'], cost: { stone: 10, wood: 2 }, place: 'free', d: 'Smelts iron ore into iron bars.' },
  { id: 'collector', n: 'Rain Collector', e: ['🪣', '💧'], cost: { wood: 4, hide: 1 }, place: 'free', d: 'Fills with rain and dew. Fresh water at home.' },
  { id: 'garden', n: 'Berry Garden', e: ['🌱'], cost: { wood: 3, berries: 6 }, place: 'free', d: 'Grows berries every day.' },
  { id: 'flag', n: 'Camp Flag', e: ['🚩'], cost: { stick: 2, hide: 1 }, place: 'free', d: 'Marks your base on the map.' }
];
const BUILD_BY_ID = {}; BUILDS.forEach(b => BUILD_BY_ID[b.id] = b);
// @end-moved

export { BUILDS, BUILD_BY_ID };
