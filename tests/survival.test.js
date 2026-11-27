// Survival rules (src/game/survival.js), tested in Node against the real code.
//
// The rules are pure (since 27 Nov 2026): the temperature rule takes the conditions where the
// player stands, and the survival step takes the temperature and reports a blackout by return
// value. So each rule is checked straight, with no stand-ins for the world or the player's gear.
// Only module loading is stubbed: G from state.js, and the load-order imports that would pull
// in the whole game (three.js and the page) in Node. Every number asserted below is what the
// original game does; if a rule or rate changes, these fail.
//
// "Energy" in MIGRATION.md's balance targets is the food meter (🍗): it is the only meter
// that eating restores and that a food strategy can move.
import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';

const h = vi.hoisted(() => ({ G: null }));
vi.mock('../src/state.js', () => ({ get G() { return h.G; } }));
vi.mock('../src/player/inventory.js', () => ({}));   // load-order imports: not needed in Node
vi.mock('../src/gfx/update.js', () => ({}));

const { ambientTempRule, survivalStepRule, SURV } = await import('../src/game/survival.js');
const { ITEMS } = await import('../src/data/items.js');
const { HOUR_SECONDS, TICK, DAY_LENGTH_SECONDS } = await import('../src/core/constants.js');

/** a fresh player; ctx holds what the step is given (temperature 20°, no heat, no fire) */
let ctx;
function fresh(p = {}) {
  h.G = { weather: 'clear', p: { x: 0, z: 0, y: 2, hp: 100, maxHp: 100, food: 80, water: 80, warm: 100, stam: 100, ...p } };
  ctx = { temp: 20, heat: false, nearFire: false };
  return h.G.p;
}
/** one survival step with the current ctx plus extra flags; returns the blackout cause */
const survivalStep = (gh, extra) => survivalStepRule(gh, { ...ctx, ...extra });
beforeEach(() => fresh());
const close = (a, b) => expect(a).toBeCloseTo(b, 6);

describe('time', () => {
  it('a game day is 8 real minutes; the simulation ticks 30 times a second', () => {
    expect(DAY_LENGTH_SECONDS).toBe(480);
    expect(HOUR_SECONDS).toBe(20);
    expect(TICK).toBeCloseTo(1 / 30, 12);
  });
});

describe('survivalStep: hunger and thirst (per game hour)', () => {
  it('the rates', () => { expect(SURV).toEqual({ food: 3.0, water: 3.8, comfort: 14 }); });
  it('awake: food -3.0/h, water -3.8/h', () => {
    const p = fresh(); survivalStep(1, {}); close(p.food, 77); close(p.water, 76.2);
  });
  it('sprinting: food x1.6, water x1.5', () => {
    const p = fresh(); survivalStep(1, { sprint: true }); close(p.food, 80 - 4.8); close(p.water, 80 - 5.7);
  });
  it('asleep: both at half rate', () => {
    const p = fresh(); survivalStep(1, { sleeping: true }); close(p.food, 78.5); close(p.water, 78.1);
  });
  it('desert heat doubles thirst, not hunger', () => {
    const p = fresh(); ctx.heat = true; survivalStep(1, {}); close(p.food, 77); close(p.water, 80 - 7.6);
  });
  it('meters never go below 0', () => {
    const p = fresh({ food: 1, water: 1 }); survivalStep(1, {}); expect(p.food).toBe(0); expect(p.water).toBe(0);
  });
  it('the simulation is linear: 30 ticks a second for a whole day equals one 24 h step', () => {
    const a = fresh({ food: 100, water: 100 }); for (let i = 0; i < 24 * 20 * 30; i++) survivalStep(TICK / HOUR_SECONDS, {});
    const af = a.food, aw = a.water;
    const b = fresh({ food: 100, water: 100 }); survivalStep(24, {});
    expect(af).toBeCloseTo(b.food, 6); expect(aw).toBeCloseTo(b.water, 6);
  });
});

describe('survivalStep: warmth', () => {
  it('comfortable (>= 14°): +11/h, or +34/h next to a fire', () => {
    let p = fresh({ warm: 50 }); ctx.temp = 14; survivalStep(1, {}); close(p.warm, 61);
    p = fresh({ warm: 50 }); ctx.temp = 30; ctx.nearFire = true; survivalStep(1, {}); close(p.warm, 84);
  });
  it('cold: loses 0.85 x (14 - temperature) per hour', () => {
    const p = fresh({ warm: 50 }); ctx.temp = -6; survivalStep(1, {}); close(p.warm, 50 - 20 * 0.85);
  });
  it('warmth is capped at 100', () => {
    const p = fresh({ warm: 99 }); ctx.temp = 30; survivalStep(1, {}); expect(p.warm).toBe(100);
  });
});

describe('survivalStep: health', () => {
  it('well fed, watered and warm (all > 25): +2.5/h awake', () => {
    const p = fresh({ hp: 50 }); survivalStep(1, {}); close(p.hp, 52.5);
  });
  it('asleep: +4/h in a shelter, +7/h in a bed (ctx.rest)', () => {
    let p = fresh({ hp: 50 }); survivalStep(1, { sleeping: true }); close(p.hp, 54);
    p = fresh({ hp: 50 }); survivalStep(1, { sleeping: true, rest: 7 }); close(p.hp, 57);
  });
  it('starving -5/h, dehydrated -7/h, frozen -9/h, and they add up', () => {
    let p = fresh({ food: 0, hp: 50 }); survivalStep(1, {}); close(p.hp, 45);
    p = fresh({ water: 0, hp: 50 }); survivalStep(1, {}); close(p.hp, 43);
    p = fresh({ warm: 0, hp: 50 }); ctx.temp = 0; survivalStep(1, {}); close(p.hp, 41);
    p = fresh({ food: 0, water: 0, warm: 0, hp: 50 }); ctx.temp = 0; survivalStep(1, {}); close(p.hp, 29);
  });
  it('no healing while any meter is 25 or below (but no damage either if none is empty)', () => {
    const p = fresh({ hp: 50, food: 20 }); survivalStep(1, {}); close(p.hp, 50);
  });
  it('health reaching 0 while awake blacks you out; the cause is cold, then thirst, then hunger', () => {
    fresh({ hp: 1, food: 0, water: 0, warm: 0 }); ctx.temp = 0; expect(survivalStep(1, {})).toBe('cold');
    fresh({ hp: 1, food: 0, water: 0 }); expect(survivalStep(1, {})).toBe('thirst');
    fresh({ hp: 1, food: 0 }); expect(survivalStep(1, {})).toBe('hunger');
    fresh(); expect(survivalStep(1, {})).toBe(null);
  });
  it('asleep, health never drops below 5 and you do not black out', () => {
    const p = fresh({ hp: 6, food: 0, water: 0 });
    expect(survivalStep(1, { sleeping: true })).toBe(null); expect(p.hp).toBe(5);
  });
});

describe('ambientTemp', () => {
  // the conditions in a forest at noon, clear sky, holding an axe, nothing worn, on dry land
  let c;
  beforeEach(() => { c = { w: { forest: 1, desert: 0, snow: 0 }, night: 0, weather: 'clear', sheltered: false, fireDist: null, torch: false, wearWarm: 0, armor: 0, y: 2 }; });
  const T = () => ambientTempRule(c).T, heat = () => ambientTempRule(c).heat;
  it('by biome, day and night: forest 21/9, desert 35/7, Frostpeak -5/-15', () => {
    c.night = 0; expect(T()).toBe(21); c.night = 1; expect(T()).toBe(9);
    c.w = { forest: 0, desert: 1, snow: 0 }; c.night = 0; expect(T()).toBe(35); c.night = 1; expect(T()).toBe(7);
    c.w = { forest: 0, desert: 0, snow: 1 }; c.night = 0; expect(T()).toBe(-5); c.night = 1; expect(T()).toBe(-15);
  });
  it('desert heat: by day in the desert, not under shelter', () => {
    c.w = { forest: 0, desert: 1, snow: 0 }; c.night = 0; expect(heat()).toBe(true);
    c.sheltered = true; expect(heat()).toBe(false);
    c.sheltered = false; c.night = 0.5; expect(heat()).toBe(false);
    c.night = 0; c.w = { forest: 1, desert: 0, snow: 0 }; expect(heat()).toBe(false);
  });
  it('rain -7, storm -9 when unsheltered; shelter +7', () => {
    c.weather = 'rain'; expect(T()).toBe(14); c.weather = 'storm'; expect(T()).toBe(12);
    c.sheltered = true; expect(T()).toBe(28);
  });
  it('a fire: +26 within 6 m, fading to nothing at 10 m', () => {
    c.fireDist = 3; expect(T()).toBe(47);
    c.fireDist = 8; expect(T()).toBe(21 + 13); c.fireDist = 10; expect(T()).toBe(21);
  });
  it('holding a torch +6; a fur coat +24; any armour +4; in water -6', () => {
    c.torch = true; expect(T()).toBe(27); c.torch = false;
    c.wearWarm = 24; expect(T()).toBe(45); c.wearWarm = 0;
    c.armor = 0.25; expect(T()).toBe(25); c.armor = 0;
    c.y = -1; expect(T()).toBe(15);
  });
});

describe('balance: energy (the food meter) over a day', () => {
  // A standard day: awake 06:00-21:00 (15 h), asleep 21:00-06:00 (9 h). Beds let you sleep
  // from 19:00, so an early sleeper uses a little less.
  const day = () => { const p = fresh({ food: 100, water: 100 }); survivalStep(15, {}); survivalStep(9, { sleeping: true }); return 100 - p.food; };
  const DRAIN = 15 * 3.0 + 9 * 1.5;
  it(`a standard day costs ${DRAIN} energy (15 h awake at 3.0, 9 h asleep at 1.5)`, () => { close(day(), DRAIN); });

  const food = id => ITEMS[id].food.food;
  it('cooking: mushrooms x3, fish x4, meat x3.8; raw meat and fish also cost health', () => {
    expect([food('mushroom'), food('roastshroom')]).toEqual([5, 15]);
    expect([food('rawfish'), food('fish')]).toEqual([8, 32]);
    expect([food('rawmeat'), food('meat')]).toEqual([10, 38]);
    expect(ITEMS.rawmeat.food.hp).toBe(-8); expect(ITEMS.rawfish.food.hp).toBe(-5);
    expect(food('berries')).toBe(6); expect(food('stew')).toBe(65);
  });
  it('to break even on a standard day you eat: 9.8 berries, or 3.9 roast mushrooms, or 1.8 fish, or 1.5 cooked meat', () => {
    const need = id => +(DRAIN / food(id)).toFixed(1);
    expect({ berries: need('berries'), mushroomRaw: need('mushroom'), roastshroom: need('roastshroom'), fish: need('fish'), meat: need('meat'), stew: need('stew') })
      .toEqual({ berries: 9.8, mushroomRaw: 11.7, roastshroom: 3.9, fish: 1.8, meat: 1.5, stew: 0.9 });
  });
  it('with nothing to eat, a new player (food 80) is empty after 26.7 awake hours, then loses 5 health an hour', () => {
    close(80 / 3.0, 26.666666667);
  });
  // MIGRATION.md's four targets (forage only ≈ -36/day, fire + cooked forage ≈ -2, fire + fishing
  // ≈ -9, hunting + fire ≈ 0) depend on what a typical forage / fishing / hunting day contains:
  // how many bushes, mushrooms, fish or hunts. That day model is not in the repository, and
  // inventing one to land on these numbers would prove nothing. The rules above are what they
  // rest on; checking the targets themselves needs the original day model.
  it.todo('MIGRATION.md balance targets (needs the original "typical day" model: what each strategy gathers per day)');
});
