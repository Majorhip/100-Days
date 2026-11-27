// Time and weather rules (src/game/time.js), tested in Node against the real code.
// The rules change only G and report what happened through the `on` handlers, so they can be
// checked straight. Only module loading is stubbed: G from state.js, and the load-order
// import that would pull in the whole game.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ G: null }));
vi.mock('../src/state.js', () => ({ get G() { return h.G; } }));
vi.mock('../src/save.js', () => ({}));   // load-order import: not needed in Node

const { advanceClock, rollWeather } = await import('../src/game/time.js');

let on, calls;
beforeEach(() => {
  h.G = { day: 5, hour: 12, weather: 'clear', weatherHrs: 99 };
  calls = [];
  on = { newDay: q => calls.push(['day', h.G.day, q]), weather: (n, was) => calls.push(['weather', n, was]) };
});

describe('advanceClock', () => {
  it('moves the hour on, and rolls into a new day at 24:00, once', () => {
    advanceClock(6, false, on); expect(h.G.hour).toBe(18); expect(calls).toEqual([]);
    advanceClock(7, false, on); expect(h.G.day).toBe(6); expect(h.G.hour).toBe(1);
    expect(calls).toEqual([['day', 6, false]]);
  });
  it('passes "quiet" on to the new day (sleeping)', () => {
    h.G.hour = 23.9; advanceClock(0.25, true, on); expect(calls).toEqual([['day', 6, true]]);
  });
  it('the weather runs down and rolls when it runs out', () => {
    h.G.weatherHrs = 1; advanceClock(0.5, false, on); expect(h.G.weatherHrs).toBe(0.5);
    advanceClock(0.5, false, on); expect(h.G.weatherHrs).toBeGreaterThan(0);
  });
  it('a new day comes before the weather roll in the same step', () => {
    h.G.hour = 23.5; h.G.weatherHrs = 0.5;
    const r = vi.spyOn(Math, 'random').mockReturnValue(0.1);   // clear -> cloudy
    advanceClock(1, false, on); r.mockRestore();
    expect(calls).toEqual([['day', 6, false], ['weather', 'cloudy', 'clear']]);
  });
});

describe('rollWeather', () => {
  const roll = (from, r, day = 5) => { h.G.weather = from; h.G.day = day; const s = vi.spyOn(Math, 'random').mockReturnValue(r); rollWeather(false, on); s.mockRestore(); return h.G.weather; };
  it('clear: cloudy 55%, else stays clear', () => { expect(roll('clear', 0.5)).toBe('cloudy'); expect(roll('clear', 0.6)).toBe('clear'); });
  it('cloudy: rain 42%, storm 14% (from Day 4), else clear', () => {
    expect(roll('cloudy', 0.3)).toBe('rain'); expect(roll('cloudy', 0.5)).toBe('storm'); expect(roll('cloudy', 0.6)).toBe('clear');
    expect(roll('cloudy', 0.5, 3)).toBe('clear');   // no storms before Day 4
  });
  it('no rain or storms in the first two days', () => { expect(roll('cloudy', 0.1, 2)).toBe('clear'); });
  it('rain and storms always clear to cloudy', () => { expect(roll('rain', 0.9)).toBe('cloudy'); expect(roll('storm', 0.1)).toBe('cloudy'); });
  it('reports a change, but not when quiet or unchanged', () => {
    roll('clear', 0.6); expect(calls).toEqual([]);                       // clear -> clear
    roll('clear', 0.1); expect(calls).toEqual([['weather', 'cloudy', 'clear']]);
    calls.length = 0; h.G.weather = 'clear';
    const s = vi.spyOn(Math, 'random').mockReturnValue(0.1); rollWeather(true, on); s.mockRestore();
    expect(h.G.weather).toBe('cloudy'); expect(calls).toEqual([]);
  });
});
