// Time and weather rules: advancing the clock, the weather chain, a new day.
// Moved from the original game script in the migration. Since 27 Nov 2026 these are pure rules:
// they change only G, and tell the caller what happened through the `on` handlers.
// src/world/days.js connects them to the game (new-day jobs, banners, toasts, sound, saving).
// Standing rule: no three.js, no page, no R (tests/golden/compare-build.mjs).

import '../save.js';   // load order: runs after the previous part of the original script
import { rnd } from '../core/math.js';
import { G } from '../state.js';

/* ---------- time and weather (game hours) ---------- */
/**
 * Advance the clock by gh game hours.
 * on: { newDay(quiet), weather(now, was, quiet) }, called at the moment each happens.
 */
function advanceClock(gh, quiet, on) {
  G.hour += gh;
  if (G.hour >= 24) { G.hour -= 24; G.day++; on.newDay(quiet); }
  G.weatherHrs -= gh;
  if (G.weatherHrs <= 0) rollWeather(quiet, on);
}
/** pick the next weather and how long it lasts; tells on.weather when it changes */
function rollWeather(quiet, on) {
  const w = G.weather, r = Math.random(), early = G.day < 3;
  let n, h;
  if (w === 'clear') { if (r < 0.55) { n = 'cloudy'; h = rnd(3, 6); } else { n = 'clear'; h = rnd(5, 10); } }
  else if (w === 'cloudy') {
    if (!early && r < 0.42) { n = 'rain'; h = rnd(2.5, 5); }
    else if (!early && G.day >= 4 && r < 0.56) { n = 'storm'; h = rnd(2, 3.5); }
    else { n = 'clear'; h = rnd(6, 12); }
  } else { n = 'cloudy'; h = rnd(2, 4); }
  const was = G.weather; G.weather = n; G.weatherHrs = h;
  if (!quiet && n !== was) on.weather(n, was);
}

export { advanceClock, rollWeather };
