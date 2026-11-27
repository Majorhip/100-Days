// A faceted, near-black low-poly scorpion, in the look of "Black Scorpion" by Google's Data
// Arts Team (3 Dreams of Black, poly.pizza/m/KNyBkzAocc): the tall near-vertical tail tapering
// to a sharp stinger, two big forward pincers, eight splayed legs. Built by hand, not from that
// model: its glTF has no skeleton and only a single "skitter" morph clip, so it can't drive the
// game's walk/chase/attack/death animation the way the rigged animals (wolves, bears...) do.
//
// Returns the same shape as scorpionModel() in animals.js ({ g, legs, head, tail, mats, stride,
// scorp: true, h }), so the creature code animates it exactly as before: the leg groups skitter
// (rotation.y), the tail raises to strike (rotation.x), and the body materials take the hit flash.
// gltfAnimal() in gltf-animals.js returns this for the 'scorpion' and 'duneking' kinds, so the
// hand-built scorpionModel() stays untouched as the fallback.
import * as THREE from 'three';
import { cone, cyl, ico } from '../core/geometry.js';
import { litMat } from '../gfx/core.js';
import { bx, lam } from './animals.js';

/** a cone / cyl / ico mesh at a pose (bx handles boxes; this handles the faceted shapes) */
function sh(parent, geo, mat, x, y, z, rx, ry, rz) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
  m.castShadow = true; parent.add(m); return m;
}

/** scale: the creature's size (duneking is bigger); king: the Dune King boss (crown, gold glow) */
function scorpion(scale, king) {
  const g = new THREE.Group();
  const main = lam(king ? 0x2a211a : 0x24242c);     // body: warm black (king) / cool charcoal
  const dark = lam(king ? 0x150f0a : 0x131319);     // shadowed plates
  const mid = lam(king ? 0x3b2c1d : 0x34343f);      // joints / lit facets
  const eye = new THREE.MeshLambertMaterial({ color: king ? 0xffd24a : 0xd83418, emissive: king ? 0xb07a00 : 0x6a1405 });
  const glow = new THREE.MeshLambertMaterial({ color: king ? 0xffcf5a : 0x6effb0, emissive: king ? 0xb07a00 : 0x1f8f54 });

  // ---- body: faceted cephalothorax in front, a tapering tail-root behind ----
  bx(g, main, 0.56, 0.24, 0.52, 0, 0.32, 0.12);                         // cephalothorax
  sh(g, cone(0.28, 0.22, 6), dark, 0, 0.42, 0.1, 0, Math.PI / 6);       // faceted back ridge
  bx(g, mid, 0.5, 0.1, 0.46, 0, 0.21, 0.12);                           // under-plate (lit edge)
  bx(g, main, 0.44, 0.22, 0.2, 0, 0.33, -0.2);                         // mesosoma seg 1
  bx(g, main, 0.36, 0.2, 0.18, 0, 0.34, -0.4);                        // seg 2
  bx(g, main, 0.28, 0.18, 0.16, 0, 0.35, -0.56);                     // seg 3 (tail root)

  // ---- head: a small faceted snout with two glowing eyes ----
  bx(g, dark, 0.26, 0.16, 0.18, 0, 0.3, 0.46);
  sh(g, cone(0.05, 0.09, 4), eye, 0.1, 0.36, 0.55, Math.PI / 2);
  sh(g, cone(0.05, 0.09, 4), eye, -0.1, 0.36, 0.55, Math.PI / 2);

  // ---- eight legs: a hip group each (rotation.y skitters them), angular femur + tibia + foot ----
  const legs = [];
  const legZ = [0.3, 0.12, -0.06, -0.24];
  for (const z of legZ) for (const s of [1, -1]) {
    const p = new THREE.Group(); p.position.set(s * 0.27, 0.33, z); g.add(p);
    bx(p, dark, 0.3, 0.06, 0.06, s * 0.16, -0.02, 0, 0, 0, -s * 0.7);   // femur: out and down
    bx(p, dark, 0.05, 0.34, 0.05, s * 0.3, -0.2, 0);                    // tibia: straight down
    bx(p, mid, 0.06, 0.05, 0.11, s * 0.3, -0.36, 0.02);                // foot
    legs.push(p);
  }

  // ---- two big forward pincers: upper arm, a chunky hand, and a two-pronged claw reaching ahead ----
  for (const s of [1, -1]) {
    bx(g, main, 0.12, 0.12, 0.42, s * 0.28, 0.3, 0.6, 0, s * 0.16);     // upper arm, forward and a little out
    bx(g, mid, 0.16, 0.14, 0.16, s * 0.35, 0.3, 0.84, 0, s * 0.08);     // elbow joint
    bx(g, main, 0.22, 0.18, 0.32, s * 0.37, 0.3, 1.08, 0, s * 0.04);    // hand (claw base)
    bx(g, main, 0.09, 0.14, 0.36, s * 0.3, 0.33, 1.34, 0.08);           // fixed prong (upper)
    bx(g, main, 0.09, 0.14, 0.32, s * 0.44, 0.27, 1.32, -0.08);         // movable finger (lower)
    sh(g, cone(0.04, 0.14, 4), glow, s * 0.3, 0.35, 1.54, Math.PI / 2); // glinting claw tip
  }

  // ---- tail: a connected arch, each segment starting at the last one's tip, curling forward to
  //      the stinger. The creature code raises the whole group (tail.rotation.x) to strike. ----
  const tail = new THREE.Group(); tail.position.set(0, 0.42, -0.55); g.add(tail);
  let py = 0, pz = 0, a = -0.5;                                         // tip height/depth, segment tilt (from +Y toward +Z)
  for (let i = 0; i < 6; i++) {
    const len = 0.32 - i * 0.012, w = 0.24 - i * 0.025;
    const dy = Math.cos(a), dz = Math.sin(a);
    bx(tail, main, w, len, w, 0, py + dy * len / 2, pz + dz * len / 2, a);
    py += dy * len; pz += dz * len; a += 0.42;
  }
  sh(tail, ico(0.13, 0), mid, 0, py - 0.02, pz + 0.04);                 // venom bulb at the tip
  sh(tail, cone(0.08, 0.36, 4), glow, 0, py - 0.08, pz + 0.22, a + 0.5); // stinger, hooking forward-down

  // ---- the Dune King's crown of golden spines ----
  if (king) { const cm = new THREE.MeshLambertMaterial({ color: 0xffd24a, emissive: 0x7a5200 }); for (let i = 0; i < 5; i++) sh(g, cone(0.06, 0.26, 4), cm, -0.2 + i * 0.1, 0.58, 0.28); }

  g.scale.setScalar(scale);
  return { g, legs, head: null, tail, mats: [main, dark, mid], stride: 14, scorp: true, h: 1.5 * scale };
}

export { scorpion };
