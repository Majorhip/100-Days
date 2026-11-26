// Starts parsing the animated animal models (src/models/gltf-animals.js) as soon as the game
// file opens, so they are ready long before the first creature spawns. Imported by src/main.js
// after the whole game has loaded, so it cannot change the original start-up order.
import { loadAnimalModels } from './gltf-animals.js';

loadAnimalModels();
