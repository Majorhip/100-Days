// Scout's story, "The Storm Dog" (MIDDLE-DAYS-PLAN.md): when each chapter is due, and which evenings
// Scout howls at Frostpeak. Pure rules: plain values in, a result out (no three.js, page or R).

/** the first day each chapter can start (index = chapter): the morning after a Wolf Moon */
const CHAPTER_DAY = [0, 21, 31, 41, 51, 61, 71];
/** the fewest days between the start of one chapter and the next, for a player who is catching up */
const MIN_GAP = 3;

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
  if (s.chapter > 0 && (!s.chapterDone || s.day - s.chapterDay < MIN_GAP)) return 0;
  return n;
}

/** does Scout howl at Frostpeak this evening? Every third evening at first, every other one once
 *  Ray has told the story of how he found him */
function howlsTonight(day, chapter) {
  return chapter >= 1 ? day % 2 === 0 : day % 3 === 0;
}

export { CHAPTER_DAY, MIN_GAP, chapterDue, howlsTonight };
