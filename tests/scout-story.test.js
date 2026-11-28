// Scout's story (src/game/scout-story.js): when chapters are due, and which evenings Scout howls.
// The rules are pure, so they are tested straight, with no stand-ins.
import { describe, it, expect } from 'vitest';
import { CHAPTER_DAY, chapterDue, howlsTonight, moonKind, SNOW_MOON_WOLVES, LOCK_DIALS, LOCK_PICTURES, lockRight, isStormHour } from '../src/game/scout-story.js';

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
    expect(due({ chapter: 7, chapterDay: 85, chapterDone: true, day: 99, built: 99 })).toBe(0);
  });
  it('the chapters land on the mornings after the Wolf Moons from Day 20 to Day 70', () => {
    expect(CHAPTER_DAY.slice(1, 7)).toEqual([21, 31, 41, 51, 61, 71]);
  });
  it('the Great Storm (chapter 7) comes from Day 85, the day after the stones are back', () => {
    const after6 = { chapter: 6, chapterDay: 71, chapterDone: true, built: 7 };
    expect(due({ ...after6, day: 84 })).toBe(0);
    expect(due({ ...after6, day: 85 })).toBe(7);
    expect(due({ chapter: 6, chapterDay: 90, chapterDone: true, day: 91, built: 7 })).toBe(7);   // a late player: the next day
    expect(due({ chapter: 6, chapterDay: 90, chapterDone: true, day: 90, built: 7 })).toBe(0);
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

describe('moonKind', () => {
  it('ordinary Wolf Moons until the story begins, and on days that are not Wolf Moons', () => {
    expect(moonKind(60, 0)).toBe('red');
    expect(moonKind(61, 3)).toBe('red');
    expect([20, 30, 40, 50].map(d => moonKind(d, 2))).toEqual(['red', 'red', 'red', 'red']);
  });
  it('from Day 60: snow, storm, snow, storm', () => {
    expect([60, 70, 80, 90].map(d => moonKind(d, 4))).toEqual(['snow', 'storm', 'snow', 'storm']);
  });
  it('a Snow Moon brings 8 snow wolves', () => { expect(SNOW_MOON_WOLVES).toBe(8); });
});

describe('isStormHour', () => {
  it('the Great Storm blows from 20:00 until dawn', () => {
    expect([19.9, 20, 23, 2, 5.4, 5.5, 12].map(isStormHour)).toEqual([false, true, true, true, true, false, false]);
  });
});

describe("Tomas's box (the guardians' lock)", () => {
  it('three dials, each turning through five pictures', () => {
    expect(LOCK_DIALS.map(d => d[0])).toEqual(['tree', 'dunes', 'snowflake']);
    expect(LOCK_PICTURES).toHaveLength(5);
  });
  it('opens with the guardians: bear, scorpion, white bear', () => {
    expect(lockRight(['bear', 'scorpion', 'whitebear'])).toBe(3);
  });
  it('says how many dials are right, not which', () => {
    expect(lockRight(['bear', 'wolf', 'whitebear'])).toBe(2);
    expect(lockRight(['whitebear', 'scorpion', 'bear'])).toBe(1);
    expect(lockRight(['rabbit', 'rabbit', 'rabbit'])).toBe(0);
  });
});
