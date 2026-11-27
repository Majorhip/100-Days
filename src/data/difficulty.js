// Difficulty levels (IMPROVEMENTS.md step 4), added after the migration.
// Normal is the game as it is. A game keeps the level it was started with (G.diff, saved only
// when it isn't Normal, so Normal saves are exactly as before). Starting points for Caspar to try.
//   finds    the share of each kind of small find that is there, from Normal's share k
//            (Easy: close to the original island, where every find was there)
//   animals  how many animals you can hunt: their cap and how often one turns up
//   hunger   how fast food and water drop
//   hurt     damage from animals
// Standing rule: no three.js, no page.
const DIFFICULTY = {
  easy: { n: 'Easy', d: 'More to find and hunt, slower hunger, softer bites.', finds: k => 1 - (1 - k) * 0.3, animals: 1.5, hunger: 0.8, hurt: 0.7 },
  normal: { n: 'Normal', d: 'The island as it is.', finds: k => k, animals: 1, hunger: 1, hurt: 1 },
  hard: { n: 'Hard', d: 'Less to find, fewer animals, faster hunger, harder bites.', finds: k => k * 0.75, animals: 0.7, hunger: 1.2, hurt: 1.3 }
};
/** the animals that are hunted for food and hides: the difficulty changes how many there are */
const HUNTED = ['rabbit', 'goat', 'deer', 'fox', 'boar', 'horse', 'donkey', 'alpaca', 'crab', 'frog'];
/** a game's level: G.diff, or Normal (older saves, and Normal games, have none) */
const levelOf = g => DIFFICULTY[g && g.diff] ? g.diff : 'normal';
const diffOf = g => DIFFICULTY[levelOf(g)];

export { DIFFICULTY, HUNTED, levelOf, diffOf };
