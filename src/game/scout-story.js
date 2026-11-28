// Scout's story, "The Storm Dog" (MIDDLE-DAYS-PLAN.md): when each chapter is due, which evenings
// Scout howls at Frostpeak, and which Wolf Moons have a twist. Pure rules: plain values in, a
// result out (no three.js, page or R).

/** the first day each chapter can start (index = chapter). Chapters 1-6: the morning after a Wolf
 *  Moon. Chapter 7 is the Great Storm, from Day 85. (Chapter 8, the dawn after it, follows the
 *  storm itself: src/story/scout-story.js.) */
const CHAPTER_DAY = [0, 21, 31, 41, 51, 61, 71, 85];
/** the fewest days between the start of one chapter and the next, for a player who is catching
 *  up; the Great Storm can come the day after the stones are back */
const MIN_GAP = 3, STORM_GAP = 1;

/**
 * The chapter that is due now, or 0.
 *   s.day          today
 *   s.stayed       Ray is free and the player chose to stay until Day 100
 *   s.scoutFriend  Scout is with the player
 *   s.chapter      the last chapter started (0 for none)
 *   s.chapterDay   the day it started
 *   s.chapterDone  whether its goal is done
 *   s.built        how many chapters exist in the game so far
 */
function chapterDue(s) {
  if (!s.stayed || !s.scoutFriend) return 0;
  const n = s.chapter + 1;
  if (n > s.built || n >= CHAPTER_DAY.length) return 0;
  if (s.day < CHAPTER_DAY[n]) return 0;
  if (s.chapter > 0 && (!s.chapterDone || s.day - s.chapterDay < (n === 7 ? STORM_GAP : MIN_GAP))) return 0;
  return n;
}

/** does Scout howl at Frostpeak this evening? Every third evening at first, every other one once
 *  Ray has told the story of how he found him */
function howlsTonight(day, chapter) {
  return chapter >= 1 ? day % 2 === 0 : day % 3 === 0;
}

/** what tonight's Wolf Moon is like, once the story has begun: from Day 60 the mountain stirs. A
 *  Snow Moon brings snow wolves down from Frostpeak; a Storm Moon brings a thunderstorm too */
function moonKind(day, chapter) {
  if (chapter < 1 || day % 10 !== 0) return 'red';
  return day === 60 || day === 80 ? 'snow' : day === 70 || day === 90 ? 'storm' : 'red';
}
/** a Snow Moon's pack: 8 snow wolves, against 14 red wolves on an ordinary Wolf Moon from Day 50
 *  (a snow wolf has 66 health and bites for 13; a Wolf Moon red wolf about 48 and 9) */
const SNOW_MOON_WOLVES = 8;

/** Tomas's box (chapter 3): three picture dials, marked with a tree, dunes and a snowflake. The
 *  answer is the three guardians Caspar fought himself: Old Grizzle in the woods, the Dune King in
 *  the sands and Frostclaw on the ice */
const LOCK_DIALS = [['tree', '🌲'], ['dunes', '🏜️'], ['snowflake', '❄️']];
const LOCK_PICTURES = [['bear', '🐻', 'Bear'], ['scorpion', '🦂', 'Scorpion'], ['whitebear', '🐻‍❄️', 'White bear'], ['wolf', '🐺', 'Wolf'], ['rabbit', '🐇', 'Rabbit']];
const LOCK_ANSWER = ['bear', 'scorpion', 'whitebear'];
/** how many of the three dials are right */
const lockRight = picks => LOCK_ANSWER.filter((a, i) => picks[i] === a).length;

/** the Great Storm blows from 20:00 until dawn */
const isStormHour = hour => hour >= 20 || hour < 5.5;

export { CHAPTER_DAY, MIN_GAP, STORM_GAP, chapterDue, howlsTonight, moonKind, SNOW_MOON_WOLVES, LOCK_DIALS, LOCK_PICTURES, LOCK_ANSWER, lockRight, isStormHour };
