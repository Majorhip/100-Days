// Where the things in Scout's story are (MIDDLE-DAYS-PLAN.md). Found on open, fairly flat ground
// with tools/story/spots.mjs. They are fixed coordinates, never in SITES or NODES, so the island
// and its fingerprint are unchanged.
const STORY_SPOTS = {
  green: { x: -151.5, z: 72 },     // chapter 2: the Green Stone, buried in the west woods near Old Grizzle's den
  box: { x: 209, z: 95.5 },        // chapter 3: Tomas's box, by the Old Iron Mine's entrance (5 m from its chest)
  // chapter 5: the glowing paw trail, from the Frozen Lake's west shore south-west through the snowy
  // trees, ending at the cairn with the Blue Stone
  trail: [[42, -117], [31.5, -128], [19, -139], [8, -146], [-2, -151], [-12, -156]],
  blue: { x: -12, z: -156 },
  dawn: { x: 119.5, z: 140 },      // chapter 8: where Ember's family shows itself, seen from the Stone Circle
  whistle: { x: 152.5, z: 168 }    // the bonus box inside the Stone Circle
};
/** the story's stones: which standing stone of the circle each one belongs in (its angle index,
 *  0 = east, 4 = west, 6 = north, as the circle is built in src/story/landmarks.js) */
const STONES = {
  greenstone: { stone: 4, carving: 'tree', dir: 'WEST' },
  goldstone: { stone: 0, carving: 'sun over the dunes', dir: 'EAST' },
  bluestone: { stone: 6, carving: 'snowflake', dir: 'NORTH' }
};

export { STORY_SPOTS, STONES };
