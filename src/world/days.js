// Connects the pure time and weather rules (src/game/time.js) to the running game.
// It keeps the three calls the game always made, with the same names and the same effects:
//   advanceTime(gh, quiet)   moves the clock; a new day and a weather change happen as before
//   nextWeather(quiet)       rolls the next weather now
//   onNewDay(quiet)          the new-day jobs (also used when a blackout skips to morning)
import { saveGame } from '../save.js';   // first, as time.js imported it: keeps the modules' start-up order
import { G, R } from '../state.js';
import { sfx } from '../audio/audio.js';
import { respawnNodes } from './gathering.js';
import { structuresNewDay } from '../build/update.js';
import { storyNewDay } from '../story/quests.js';
import { toast, banner } from '../ui/hud.js';
import { advanceClock, rollWeather } from '../game/time.js';

function onNewDay(quiet) {
  respawnNodes(); structuresNewDay(); storyNewDay();
  if (!quiet && R.started) { banner('DAY ' + G.day, (100 - G.day > 0 ? (100 - G.day) + ' days until the ship comes' : 'The ship is coming!')); sfx('quest'); saveGame(); }
}
function weatherChanged(n, was) {
  if (!R.started) return;
  const snow = R.biome === 'snow';
  if (n === 'rain') toast(snow ? '🌨️ Heavy snow is falling.' : '🌧️ It\'s starting to rain. Fires without a roof will go out!', 'warn');
  if (n === 'storm') { toast('⛈️ A thunderstorm! Find shelter.', 'warn'); sfx('thunder'); }
  if (n === 'clear' && (was === 'cloudy')) toast('☀️ The sky is clearing.', 'ok', 3000);
}
const ON = { newDay: onNewDay, weather: weatherChanged };

function advanceTime(gh, quiet) { advanceClock(gh, quiet, ON); }
function nextWeather(quiet) { rollWeather(quiet, ON); }

export { advanceTime, nextWeather, onNewDay };
