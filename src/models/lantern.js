// The Crystal Lantern in the hand (added after the migration): an iron lamp with a glowing
// Frostpeak crystal inside. It is a torch-slot tool (cls 'torch', tool.crystal), so it lights,
// warms and scares wolves like the torch, and it is the only light snow wolves fear.
// Called from toolModel() in src/models/tools.js.
import * as THREE from 'three';
import { box, cone, ico, part } from '../core/geometry.js';
import { vcMesh } from '../gfx/core.js';

const CRYSTAL = 0x8fefff, FRAME = 0x4a4f55, WOOD = 0x7a5632;

function lanternModel(hand, arm, g) {
  const ps = [
    part(box(0.04, 0.3, 0.04), WOOD, [0, 0.1, 0]),             // grip
    part(box(0.2, 0.035, 0.2), FRAME, [0, 0.27, 0]),           // base
    part(box(0.2, 0.035, 0.2), FRAME, [0, 0.58, 0]),           // lid
    part(cone(0.13, 0.12, 4), FRAME, [0, 0.66, 0], [0, Math.PI / 4, 0]),
    hand, arm
  ];
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) ps.push(part(box(0.025, 0.3, 0.025), FRAME, [x * 0.085, 0.425, z * 0.085]));
  const m = vcMesh(ps);
  const glow = new THREE.Mesh(ico(0.075, 0), new THREE.MeshBasicMaterial({ color: CRYSTAL }));
  glow.scale.set(1, 1.7, 1); glow.position.y = 0.43; m.add(glow);
  g.userData.crystal = true;
  return m;
}

export { lanternModel };
