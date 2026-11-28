// Scout's story (src/game/scout-story.js): when chapters are due, and which evenings Scout howls.
// The rules are pure, so they are tested straight, with no stand-ins.
import { describe, it, expect } from 'vitest';
import { CHAPTER_DAY, chapterDue, howlsTonight } from '../src/game/scout-story.js';

const base = { day: 25, stayed: true, scoutFriend: true, chapter: 0, chapterDay: 0, chapterDone: false, built: 6 };
const due = o => chapterDue({ ...base, ...o });

describe('chapterDue', () => {
  it('nothing before the player chooses to stay, or without Scout', () => {
    expect(due({ stayed: false })).toBe(0);
    expect(due({ scoutFriend: false })).toBe(0);
  });
  it('chapter 1 waits for the morning after the Day 20 Wolf Moon', () => {
    expect(CHAPTER_DAY[1]).toBe(21);
    expect(due({ day: 20 })).toBe(0);
    expect(due({ day: 21 })).toBe(1);
  });
  it('a player who stays late gets chapter 1 at once', () => {
    expect(due({ day: 46 })).toBe(1);
  });
  it('the next chapter needs the last one done, its own first day, and 3 days since the last began', () => {
    const after1 = { chapter: 1, chapterDay: 21, chapterDone: true };
    expect(due({ ...after1, day: 30 })).toBe(0);   // chapter 2 starts on Day 31
    expect(due({ ...after1, day: 31 })).toBe(2);
    expect(due({ ...after1, day: 31, chapterDone: false })).toBe(0);
  });
  it('a late player catches up about every 3 days', () => {
    const after1 = { chapter: 1, chapterDay: 60, chapterDone: true };
    expect(due({ ...after1, day: 62 })).toBe(0);
    expect(due({ ...after1, day: 63 })).toBe(2);
    expect(due({ chapter: 2, chapterDay: 63, chapterDone: true, day: 66 })).toBe(3);
  });
  it('only chapters that exist are given, and none after the last', () => {
    expect(due({ chapter: 1, chapterDay: 21, chapterDone: true, day: 40, built: 1 })).toBe(0);
    expect(due({ chapter: 6, chapterDay: 71, chapterDone: true, day: 90, built: 99 })).toBe(0);
  });
  it('the chapters land on the mornings after the Wolf Moons from Day 20 to Day 70', () => {
    expect(CHAPTER_DAY.slice(1)).toEqual([21, 31, 41, 51, 61, 71]);
  });
});

describe('howlsTonight', () => {
  it('every third evening before chapter 1', () => {
    expect([3, 4, 5, 6].map(d => howlsTonight(d, 0))).toEqual([true, false, false, true]);
  });
  it('every other evening once Ray has told the story', () => {
    expect([20, 21, 22].map(d => howlsTonight(d, 1))).toEqual([true, false, true]);
  });
});
