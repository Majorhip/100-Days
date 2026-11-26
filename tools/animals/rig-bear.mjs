// Rigs and animates the static Poly bear ("Black bear" by Poly by Google, CC BY 3.0,
// https://poly.pizza/m/56ym_pyVnel) and writes three game models to assets/animals/game/:
//   Bear.glb       the black bear, its own texture
//   Grizzle.glb    the Grizzle boss: a new dark brown, grizzled texture, a clawed scar over one eye
//   Frostclaw.glb  the Frostclaw boss: a new white and ice-blue texture, ice spikes on the back
//
//   node tools/animals/rig-bear.mjs
//
// What it does (docs/animals/bears/README.md has the why):
//  1. reads assets/animals/raw/BlackBear/ (OBJ + PNG) and sizes it to 1.5 m tall, facing +z;
//  2. cuts a mouth along the snout so a jaw can open, with a dark inside;
//  3. builds a skeleton (spine, neck, head, jaw, tail, three bones per leg) and weights every
//     vertex by its position, then smooths the weights over the mesh;
//  4. adds eyes (a material of their own, "Eyes", so the game can make them glow);
//  5. poses the skeleton frame by frame from tools/animals/bear-clips.mjs (legs by inverse
//     kinematics, so planted paws stay put) and stores the clips;
//  6. paints the boss textures from the original, using each texel's place on the body.
// Uses three.js for the maths and glTF-Transform to write the files; both are already here.
import * as THREE from 'three';
import { Document, NodeIO } from '@gltf-transform/core';
import { prune, dedup, resample } from '@gltf-transform/functions';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readPng, writePng } from './png.mjs';
import { CLIPS } from './bear-clips.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const RAW = join(ROOT, 'assets', 'animals', 'raw', 'BlackBear'), OUT = join(ROOT, 'assets', 'animals', 'game');
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TEX = 1024;   // texture size (the original is 2048; it is mostly flat colour)

// ---------------------------------------------------------------- 1. the mesh
function loadObj() {
  const lines = readFileSync(join(RAW, 'BlackBear.obj'), 'utf8').split(/\r?\n/);
  const P = [], T = [], N = [], F = [];
  for (const l of lines) {
    const a = l.trim().split(/\s+/);
    if (a[0] === 'v') P.push(a.slice(1, 4).map(Number));
    else if (a[0] === 'vt') T.push(a.slice(1, 3).map(Number));
    else if (a[0] === 'vn') N.push(a.slice(1, 4).map(Number));
    else if (a[0] === 'f') F.push(a.slice(1).map(c => { const [p, t, n] = c.split('/').map(Number); return { p: p - 1, t: t - 1, n: n - 1 }; }));
  }
  // 1.5 m tall, feet on the ground; the file already faces +z
  const minY = Math.min(...P.map(p => p[1])), maxY = Math.max(...P.map(p => p[1])), s = 1.5 / (maxY - minY);
  return { P: P.map(p => V3(p[0] * s, (p[1] - minY) * s, p[2] * s)), T, N: N.map(n => V3(...n).normalize()), F };
}

// ---------------------------------------------------------------- 2. the mouth
// The snout is closed. Its underside (the lower jaw) is the three quads on each side whose
// outline runs corner (67) - 40 - 314 - 53 - front (57). Those vertices get a second copy for
// the jaw's faces, so the mouth can open there, and a band of "Mouth" faces joins the two lips,
// folded inwards so it is hidden while the mouth is shut.
function cutMouth(M) {
  const near = (x, y, z) => { let b = -1, bd = 1e9; M.P.forEach((p, i) => { const d = p.distanceTo(V3(x, y, z)); if (d < bd) { bd = d; b = i; } }); if (bd > 0.01) throw new Error('mouth vertex not found'); return b; };
  // the outline from the corner to the front, as in the file (right side, x < 0), metres
  const right = [[-0.169, 0.826, 1.116], [-0.096, 0.837, 1.180], [-0.025, 0.819, 1.309], [-0.063, 0.834, 1.347]].map(v => near(...v));
  const front = near(0, 0.819, 1.360);
  const left = right.map(i => near(-M.P[i].x, M.P[i].y, M.P[i].z));
  const lowFaces = new Set();
  // lower-jaw faces: every vertex at or below the lip line, from the corner forward
  const lipY = z => 0.845;   // the snout's underside is 0.78-0.84 m high
  M.F.forEach((f, k) => { if (f.every(c => M.P[c.p].z > 1.1 && M.P[c.p].y < lipY(M.P[c.p].z) && Math.abs(M.P[c.p].x) < 0.2)) lowFaces.add(k); });
  const split = [right.slice(1), left.slice(1), [front]].flat();   // the corners (67 and its mirror) stay joined
  const copy = {};
  for (const i of split) { copy[i] = M.P.length; M.P.push(M.P[i].clone()); }
  for (const k of lowFaces) for (const c of M.F[k]) if (copy[c.p] !== undefined) c.p = copy[c.p];
  // the band: each lip edge (upper a-b, lower a'-b') gets two quads meeting at a crease pushed
  // into the head, so when shut it folds away inside the snout
  const band = [];
  for (const chain of [[...right, front], [...left, front]]) for (let i = 0; i + 1 < chain.length; i++) {
    const a = chain[i], b = chain[i + 1];
    band.push([a, b, copy[a] ?? a, copy[b] ?? b]);
  }
  return { lowFaces, copy, band, corners: [right[0], left[0]], lowerVerts: new Set(Object.values(copy)) };
}

// ---------------------------------------------------------------- 3. the skeleton
// bind positions in metres (the mesh: 1.5 m tall, nose at z 1.44, rump at z -0.93); every bone
// is unrotated in the bind pose, so a rotation in a clip is a rotation from standing
const BONES = [
  ['Root', null, 0, 0, 0],
  ['Hips', 'Root', 0, 1.0, -0.5],
  ['Tail', 'Hips', 0, 1.0, -0.84],
  ['Spine1', 'Hips', 0, 1.02, -0.12],
  ['Spine2', 'Spine1', 0, 1.03, 0.25],
  ['Neck', 'Spine2', 0, 1.05, 0.56],
  ['Head', 'Neck', 0, 1.06, 0.82],
  ['Jaw', 'Head', 0, 0.86, 1.1],
  ...['L', 'R'].flatMap(s => {
    const x = s === 'L' ? 1 : -1;
    return [
      ['UpperArm' + s, 'Spine2', 0.27 * x, 0.98, 0.47],
      ['ForeArm' + s, 'UpperArm' + s, 0.28 * x, 0.48, 0.43],
      ['FrontPaw' + s, 'ForeArm' + s, 0.28 * x, 0.15, 0.48],
      ['FrontToe' + s, 'FrontPaw' + s, 0.28 * x, 0.03, 0.80],
      ['Thigh' + s, 'Hips', 0.24 * x, 0.92, -0.56],
      ['Shin' + s, 'Thigh' + s, 0.26 * x, 0.48, -0.50],
      ['HindPaw' + s, 'Shin' + s, 0.26 * x, 0.17, -0.60],
      ['HindToe' + s, 'HindPaw' + s, 0.26 * x, 0.03, -0.28]
    ];
  })
];
function makeSkeleton() {
  const B = {}, list = [];
  const arm = new THREE.Object3D(); arm.name = 'Armature';
  for (const [name, parent, x, y, z] of BONES) {
    const b = new THREE.Bone(); b.name = name; b.userData.bind = V3(x, y, z);
    (parent ? B[parent] : arm).add(b);
    b.position.copy(parent ? V3(x, y, z).sub(B[parent].userData.bind) : V3(x, y, z));
    b.userData.rest = b.position.clone();
    B[name] = b; list.push(b);
  }
  arm.updateMatrixWorld(true);
  return { arm, B, list };
}

// ---------------------------------------------------------------- weights
function weigh(M, mouth, B, list) {
  const idx = Object.fromEntries(list.map((b, i) => [b.name, i]));
  const W = M.P.map(() => new Float64Array(list.length));
  M.P.forEach((p, i) => {
    const w = W[i], { x, y, z } = p, ax = Math.abs(x), s = x >= 0 ? 'L' : 'R';
    // the trunk: piecewise linear along the spine, the head taking over behind the ears
    const knots = [['Hips', -0.5], ['Spine1', -0.12], ['Spine2', 0.25], ['Neck', 0.56]];
    const trunk = {};
    if (z <= knots[0][1]) trunk.Hips = 1;
    else if (z >= knots[3][1]) trunk.Neck = 1;
    else for (let k = 0; k < 3; k++) if (z >= knots[k][1] && z <= knots[k + 1][1]) { const t = ss(knots[k][1], knots[k + 1][1], z); trunk[knots[k][0]] = 1 - t; trunk[knots[k + 1][0]] = t; }
    const head = ss(0.68, 0.9, z + (y - 1.05) * 0.25);
    for (const k in trunk) trunk[k] *= 1 - head;
    trunk.Head = head;
    // the tail: the little bump on the rump
    const tail = ss(-0.83, -0.9, z) * ss(0.16, 0.06, Math.hypot(x, y - 1.0));
    for (const k in trunk) trunk[k] *= 1 - tail;
    trunk.Tail = tail;
    // the legs: a column under each shoulder and hip, reaching up into the body
    const lat = ss(0.04, 0.17, ax);
    // (distance from the column in z; the paws reach forward from it, up to the toes)
    const off = (zc, toes) => { const d = z - zc; return y < 0.14 && d > 0 ? Math.max(0, d - toes) : Math.abs(d); };
    const fl = ss(0.4, 0.22, off(0.47, 0.38)) * ss(0.98, 0.5, y) * lat;
    const hl = ss(0.42, 0.24, off(-0.57, 0.33)) * ss(0.95, 0.52, y) * lat;
    const chain = {};
    if (fl > 0) {
      const paw = ss(0.165, 0.1, y), lo = ss(0.53, 0.41, y) * (1 - paw);
      chain['FrontPaw' + s] = paw * fl; chain['ForeArm' + s] = lo * fl; chain['UpperArm' + s] = (1 - paw - lo) * fl;
    }
    if (hl > 0) {
      const paw = ss(0.2, 0.125, y), lo = ss(0.55, 0.4, y) * (1 - paw);
      chain['HindPaw' + s] = paw * hl; chain['Shin' + s] = lo * hl; chain['Thigh' + s] = (1 - paw - lo) * hl;
    }
    const legW = Math.min(1, fl + hl);
    for (const k in trunk) w[idx[k]] += trunk[k] * (1 - legW);
    for (const k in chain) w[idx[k]] += chain[k];
  });
  // smooth over the mesh (not across the mouth)
  const adj = M.P.map(() => new Set());
  for (const f of M.F) for (const a of f) for (const b of f) if (a.p !== b.p) adj[a.p].add(b.p);
  for (let it = 0; it < 2; it++) {
    const nw = W.map((w, i) => {
      if (!adj[i].size) return w;
      const avg = new Float64Array(w.length);
      for (const j of adj[i]) for (let k = 0; k < w.length; k++) avg[k] += W[j][k] / adj[i].size;
      return w.map((v, k) => v * 0.6 + avg[k] * 0.4);
    });
    nw.forEach((w, i) => W[i] = w);
  }
  // the jaw, after smoothing so it doesn't spread into the upper lip
  M.P.forEach((p, i) => {
    let j = 0;
    if (mouth.lowerVerts.has(i)) j = 1;
    else if (mouth.copy[i] !== undefined) j = 0;   // the upper lip
    else if (p.z > 1.0 && p.z < 1.25 && p.y < 0.83 && Math.abs(p.x) < 0.12 && !mouth.corners.includes(i)) j = ss(1.02, 1.15, p.z);   // the chin and throat under it
    else if (mouth.corners.includes(i)) j = 0.35;
    if (j) { const h = idx.Head, n = idx.Neck; const take = W[i][h] + W[i][n]; W[i][h] *= 1 - j; W[i][n] *= 1 - j; W[i][idx.Jaw] += take * j; }
  });
  // four strongest, normalised
  return W.map(w => {
    const top = [...w].map((v, k) => [k, v]).filter(e => e[1] > 0.004).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((a, e) => a + e[1], 0) || 1;
    while (top.length < 4) top.push([0, 0]);
    return top.map(([k, v]) => [k, v / sum]);
  });
}

// ---------------------------------------------------------------- the eyes
// The texture has the eyes as two small dark dots; find where they sit on the mesh.
function eyeSpots(M) {
  const spots = [];
  for (const [u, v] of [[204 / 2048, 1 - 218 / 2048], [251 / 2048, 1 - 571 / 2048]]) {
    for (const f of M.F) for (let k = 1; k + 1 < f.length; k++) {
      const c = [f[0], f[k], f[k + 1]], t = c.map(q => M.T[q.t]);
      const d = (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1]);
      const b1 = ((u - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (v - t[0][1])) / d;
      const b2 = ((t[1][0] - t[0][0]) * (v - t[0][1]) - (u - t[0][0]) * (t[1][1] - t[0][1])) / d;
      if (b1 >= 0 && b2 >= 0 && b1 + b2 <= 1) {
        const p = c.map(q => M.P[q.p]), pos = p[0].clone().multiplyScalar(1 - b1 - b2).addScaledVector(p[1], b1).addScaledVector(p[2], b2);
        const n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize();
        spots.push({ pos, n });
      }
    }
  }
  // both dots (one per side of the head); use their average, mirrored, so the eyes match
  const a = spots.find(s => s.pos.x > 0) || spots[0], b = spots.find(s => s.pos.x < 0) || spots[1];
  const pos = V3((Math.abs(a.pos.x) + Math.abs(b.pos.x)) / 2, (a.pos.y + b.pos.y) / 2, (a.pos.z + b.pos.z) / 2);
  const n = V3((Math.abs(a.n.x) + Math.abs(b.n.x)) / 2, (a.n.y + b.n.y) / 2, (a.n.z + b.n.z) / 2).normalize();
  return [{ pos, n }, { pos: V3(-pos.x, pos.y, pos.z), n: V3(-n.x, n.y, n.z) }];
}

/** a little flattened ball; returns flat-shaded triangles [pos, normal] */
function ball(center, normal, r, flat) {
  const g = new THREE.IcosahedronGeometry(r, 1);   // (already one vertex per corner)
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), normal);
  const out = [], p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i) * flat).applyQuaternion(q).add(center); out.push(v); }
  return out;
}

/** an ice shard: a slanted, faceted spike; base at 'at', leaning by 'lean' (radians about x),
 *  'side' (about z), 'turn' about its own axis */
function shard(at, h, r, lean, side, turn, sides = 5) {
  const pts = [], q = new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, turn, side, 'XYZ'));
  const ring = k => { const a = k / sides * Math.PI * 2; const rr = r * (k % 2 ? 0.8 : 1); return V3(Math.cos(a) * rr, 0, Math.sin(a) * rr); };
  const mid = k => ring(k).multiplyScalar(0.72).add(V3(0, h * 0.42, 0));
  const tip = V3(r * 0.08, h, 0), bottom = V3(0, -h * 0.25, 0);
  for (let k = 0; k < sides; k++) {
    const a = ring(k), b = ring(k + 1), ma = mid(k), mb = mid(k + 1);
    pts.push(a, ma, b, b, ma, mb, ma, tip, mb, a, b, bottom);
  }
  return pts.map(p => p.clone().applyQuaternion(q).add(at));   // (tip and bottom are shared)
}

// ---------------------------------------------------------------- textures
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
function bakePositions(M) {
  // where on the body each texel is: rasterise every face in uv space
  const pos = new Float32Array(TEX * TEX * 3), nrm = new Float32Array(TEX * TEX * 3), has = new Uint8Array(TEX * TEX);
  for (const f of M.F) for (let k = 1; k + 1 < f.length; k++) {
    const c = [f[0], f[k], f[k + 1]], t = c.map(q => [M.T[q.t][0] * TEX, (1 - M.T[q.t][1]) * TEX]), p = c.map(q => M.P[q.p]);
    const n = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize();
    const d = (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1]);
    if (Math.abs(d) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(...t.map(a => a[0])) - 1)), x1 = Math.min(TEX - 1, Math.ceil(Math.max(...t.map(a => a[0])) + 1));
    const y0 = Math.max(0, Math.floor(Math.min(...t.map(a => a[1])) - 1)), y1 = Math.min(TEX - 1, Math.ceil(Math.max(...t.map(a => a[1])) + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const u = x + 0.5, v = y + 0.5;
      const b1 = ((u - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (v - t[0][1])) / d;
      const b2 = ((t[1][0] - t[0][0]) * (v - t[0][1]) - (u - t[0][0]) * (t[1][1] - t[0][1])) / d;
      const e = -1.2 / Math.sqrt(Math.abs(d));   // a texel of slack, so edges are covered
      if (b1 < e || b2 < e || b1 + b2 > 1 - e) continue;
      const i = y * TEX + x, w0 = 1 - b1 - b2;
      if (has[i] === 2) continue;
      const inside = b1 >= 0 && b2 >= 0 && b1 + b2 <= 1;
      for (let a = 0; a < 3; a++) { pos[i * 3 + a] = p[0].getComponent(a) * w0 + p[1].getComponent(a) * b1 + p[2].getComponent(a) * b2; nrm[i * 3 + a] = n.getComponent(a); }
      has[i] = inside ? 2 : 1;
    }
  }
  // spread into the gaps between uv islands, so filtering at an edge finds a sensible colour
  for (let it = 0; it < 6; it++) {
    const nh = has.slice();
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const i = y * TEX + x; if (has[i]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= TEX || yy >= TEX) continue;
        const j = yy * TEX + xx; if (!has[j]) continue;
        for (let a = 0; a < 3; a++) { pos[i * 3 + a] = pos[j * 3 + a]; nrm[i * 3 + a] = nrm[j * 3 + a]; }
        nh[i] = 1; break;
      }
    }
    has.set(nh);
  }
  return { pos, nrm, has };
}

function makeTextures(M) {
  const src = readPng(readFileSync(join(RAW, 'BlackBear_BaseColor.png')));
  const k = src.width / TEX;
  // the original, halved (2x2 average)
  const base = new Float32Array(TEX * TEX * 3);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) for (let a = 0; a < 3; a++) {
    let s = 0; for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) s += src.data[((y * k + dy) * src.width + x * k + dx) * 4 + a];
    base[(y * TEX + x) * 3 + a] = s / (k * k);
  }
  const { pos, nrm } = bakePositions(M);
  const FUR = lum(49, 42, 30), MUZ = lum(208, 192, 160);
  const paint = fn => {
    const data = new Uint8Array(TEX * TEX * 4);
    for (let i = 0; i < TEX * TEX; i++) {
      const c = [base[i * 3], base[i * 3 + 1], base[i * 3 + 2]], L = lum(...c);
      const p = V3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), n = V3(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
      const out = fn ? fn({ c, L, shade: L / FUR, muzzle: ss(70, 150, L), mshade: L / MUZ, p, n }) : c;
      for (let a = 0; a < 3; a++) data[i * 4 + a] = Math.max(0, Math.min(255, Math.round(out[a])));
      data[i * 4 + 3] = 255;
    }
    return writePng({ width: TEX, height: TEX, data });
  };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const mul = (a, s) => a.map(v => v * s);
  // Grizzle: dark brown, lighter grizzled tips on the hump and back, darker legs, a pale scar
  // of three claw marks across his left eye (as the hand-built Grizzle had)
  const eye = eyeSpots(M)[0];
  const scar = [-1, 0, 1].map(o => {
    const d = V3(0, -0.62, 0.78).normalize();   // from above the brow, down and forwards to the cheek
    const c = eye.pos.clone().addScaledVector(eye.n.clone().cross(d).normalize(), 0.026 * o);   // side by side
    return [c.clone().addScaledVector(d, -0.09 - o * 0.012), c.clone().addScaledVector(d, 0.075 + o * 0.015)];
  });
  // (measured across the face: flattened along the eye's normal, so the marks follow the
  // curve of the head)
  const flat = p => p.clone().addScaledVector(eye.n, -p.clone().sub(eye.pos).dot(eye.n));
  const segDist = (p, [a, b]) => {
    if (Math.abs(p.clone().sub(eye.pos).dot(eye.n)) > 0.1) return 1;
    const q = flat(p), A = flat(a), ab = flat(b).sub(A), t = Math.max(0, Math.min(1, q.clone().sub(A).dot(ab) / ab.lengthSq()));
    return q.distanceTo(A.clone().addScaledVector(ab, t));
  };
  const grizzle = ({ c, shade, muzzle, mshade, p, n }) => {
    const sh = Math.min(1.6, shade);
    let fur = mul([54, 35, 21], sh);
    const tips = ss(1.18, 1.42, p.y) * ss(0.2, 0.75, n.y) * ss(0.95, 0.6, p.z);   // the hump and back
    fur = mix(fur, mul([120, 94, 70], sh), tips * 0.5);
    fur = mul(fur, 0.72 + 0.28 * ss(0.15, 0.6, p.y));                                // darker legs
    let out = mix(fur, mul([150, 118, 88], Math.min(1.2, mshade)), muzzle);
    if (p.x > 0) { const d = Math.min(...scar.map(s => segDist(p, s))); const m = ss(0.011, 0.007, d); out = mix(out, [226, 186, 170], m); }
    return out;
  };
  // Frostclaw: white fur, ice-blue in the shadows and on the legs, a pale grey-blue muzzle
  const frost = ({ c, shade, muzzle, mshade, p, n }) => {
    const sh = Math.min(1.25, shade), lit = 1 - (1 - sh) * 0.55;
    let fur = mix([118, 160, 200], [240, 246, 252], ss(0.45, 1.05, lit));
    fur = mix(fur, mul(fur, 0.9).map((v, i) => v + [0, 6, 18][i]), ss(0.55, 0.2, p.y));   // bluer legs
    fur = mix(fur, [214, 236, 252], ss(1.3, 1.48, p.y) * 0.5);                          // frosty back
    let out = mix(fur, mul([196, 210, 224], Math.min(1.15, mshade)), muzzle);
    if (p.z > 1.385 && p.y > 0.835) out = mix(out, [64, 76, 96], ss(1.385, 1.41, p.z));   // nose
    return out;
  };
  return { Bear: paint(null), Grizzle: paint(grizzle), Frostclaw: paint(frost) };
}

// ---------------------------------------------------------------- 5. the clips
function sampleClips(arm, B, list) {
  const X = V3(1, 0, 0);
  const wq = o => o.getWorldQuaternion(new THREE.Quaternion());
  const setWorld = (b, q) => { b.quaternion.copy(wq(b.parent).invert().multiply(q)); b.updateMatrixWorld(true); };
  const LEGS = {};
  for (const s of ['L', 'R']) {
    LEGS['F' + s] = { up: B['UpperArm' + s], lo: B['ForeArm' + s], paw: B['FrontPaw' + s], toe: B['FrontToe' + s], pole: V3(0, 0.15, -1).normalize() };
    LEGS['H' + s] = { up: B['Thigh' + s], lo: B['Shin' + s], paw: B['HindPaw' + s], toe: B['HindToe' + s], pole: V3(0, -0.1, 1).normalize() };
  }
  for (const L of Object.values(LEGS)) {
    const h = L.up.userData.bind, k = L.lo.userData.bind, a = L.paw.userData.bind, t = L.toe.userData.bind;
    Object.assign(L, { l1: k.distanceTo(h), l2: a.distanceTo(k), restU: k.clone().sub(h).normalize(), restL: a.clone().sub(k).normalize(), pawVec: t.clone().sub(a), toe0: t.clone() });
  }
  const stretch = {};   // clip -> [most a leg was asked to over-reach (m), where]
  const rig = {
    B, LEGS, toe0: n => LEGS[n].toe0.clone(),
    rest() { for (const b of list) { b.position.copy(b.userData.rest); b.quaternion.identity(); } arm.updateMatrixWorld(true); },
    /** local rotation (yaw, then pitch, then roll: Euler YXZ), radians; +x pitch = nose/toe down */
    r(name, x = 0, y = 0, z = 0) { B[name].quaternion.setFromEuler(new THREE.Euler(x, y, z, 'YXZ')); },
    /** move a bone from its bind place (in its parent's frame) */
    p(name, x = 0, y = 0, z = 0) { B[name].position.copy(B[name].userData.rest).add(V3(x, y, z)); },
    /** plant a leg: toe target (world), paw pitch (world, +x = toe down), with the knee or elbow
     *  bending the natural way */
    leg(n, toe, pitch = 0, padY = 0) {
      const L = LEGS[n]; arm.updateMatrixWorld(true);
      const qp = new THREE.Quaternion().setFromAxisAngle(X, pitch);
      const A = toe.clone().sub(L.pawVec.clone().applyQuaternion(qp));
      const H = L.up.getWorldPosition(V3());
      const d = A.clone().sub(H); let dist = d.length();
      const max = (L.l1 + L.l2) * 0.9995;
      if (dist > max) { if (dist - max > (stretch[rig.clip]?.[0] || 0)) stretch[rig.clip] = [dist - max, rig.at + ' ' + n]; dist = max; }
      const dir = d.normalize(), pole = L.pole.clone().applyQuaternion(wq(L.up.parent));
      const perp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
      const a = (L.l1 * L.l1 - L.l2 * L.l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, L.l1 * L.l1 - a * a));
      const K = H.clone().addScaledVector(dir, a).addScaledVector(perp, h), A2 = H.clone().addScaledVector(dir, dist);
      setWorld(L.up, new THREE.Quaternion().setFromUnitVectors(L.restU, K.clone().sub(H).normalize()));
      setWorld(L.lo, new THREE.Quaternion().setFromUnitVectors(L.restL, A2.clone().sub(K).normalize()));
      setWorld(L.paw, qp);
    },
    /** blend a bone towards a local rotation (after the legs are placed) */
    blend(name, w, x = 0, y = 0, z = 0) { if (w <= 0) return; const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ')); B[name].quaternion.slerp(q, Math.min(1, w)); arm.updateMatrixWorld(true); },
    update() { arm.updateMatrixWorld(true); }
  };
  const out = [];
  for (const clip of CLIPS) {
    const fps = clip.fps || 60, n = Math.round(clip.T * fps), times = [], tracks = list.map(() => ({ q: [], p: [] }));
    for (let i = 0; i <= n; i++) {
      const t = i / fps; rig.at = clip.name + '@' + t.toFixed(3); rig.clip = clip.name;
      rig.rest(); clip.pose(rig, t, clip.T); arm.updateMatrixWorld(true);
      times.push(t);
      list.forEach((b, k) => {
        const q = b.quaternion.clone(), prev = tracks[k].q.at(-1);
        if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        tracks[k].q.push(q); tracks[k].p.push(b.position.clone());
      });
    }
    out.push({ name: clip.name, times, tracks, T: clip.T, notes: clip.notes });
  }
  // (a leg lifted and posed by hand, as in the swipe or the slam, is asked to reach its standing
  // spot too, and that doesn't matter; for a planted paw it would mean sliding)
  for (const [c, [d, at]] of Object.entries(stretch)) if (d > 0.005) console.warn(`  ${c}: a leg is short of its target by up to ${(d * 100).toFixed(1)} cm (${at})`);
  rig.rest();
  return out;
}

// ---------------------------------------------------------------- 6. writing a model
const toLinear = c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const hexLinear = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255].map(toLinear);

function writeModel(name, { M, mouth, W, sk, clips, png, eyeColor, mouthColor, spikes }) {
  const doc = new Document(), buf = doc.createBuffer('data');
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  const { arm, B, list } = sk;
  const nodes = {};
  for (const b of list) nodes[b.name] = doc.createNode(b.name).setTranslation(b.userData.rest.toArray());
  for (const b of list) for (const c of b.children) if (c.isBone) nodes[b.name].addChild(nodes[c.name]);
  // eyes as skinned parts of the mesh (all on the head bone), so they follow it exactly
  const headI = list.indexOf(B.Head);
  const tex = doc.createTexture('fur').setImage(png).setMimeType('image/png');
  const mat = (n, hex, rough = 1) => doc.createMaterial(n).setBaseColorFactor([...hexLinear(hex), 1]).setRoughnessFactor(rough).setMetallicFactor(0);
  const furMat = doc.createMaterial('Fur').setBaseColorTexture(tex).setRoughnessFactor(1).setMetallicFactor(0);
  const mesh = doc.createMesh(name);
  // fur: one vertex per distinct (position, uv, normal) corner
  const prim = (material, tris) => {
    // tris: [{p: Vector3, n: Vector3, uv: [u,v]|null, w: [[bone, weight] x4]}] x3 per triangle
    const P = [], N = [], T = [], J = [], WW = [], I = [], key = new Map();
    for (const c of tris) {
      const k = [c.key ?? '', c.p.x, c.p.y, c.p.z, c.n.x, c.n.y, c.n.z, c.uv ? c.uv.join() : ''].join('|');
      let i = key.get(k);
      if (i === undefined) {
        i = P.length / 3; key.set(k, i);
        P.push(c.p.x, c.p.y, c.p.z); N.push(c.n.x, c.n.y, c.n.z); if (c.uv) T.push(c.uv[0], 1 - c.uv[1]);
        J.push(...c.w.map(e => e[0])); WW.push(...c.w.map(e => e[1]));
      }
      I.push(i);
    }
    const p = doc.createPrimitive().setMaterial(material).setIndices(acc('SCALAR', new Uint16Array(I)))
      .setAttribute('POSITION', acc('VEC3', new Float32Array(P))).setAttribute('NORMAL', acc('VEC3', new Float32Array(N)))
      .setAttribute('JOINTS_0', acc('VEC4', new Uint16Array(J))).setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array(WW)));
    if (T.length) p.setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(T)));
    mesh.addPrimitive(p);
  };
  const furTris = [];
  for (const f of M.F) for (let k = 1; k + 1 < f.length; k++) for (const c of [f[0], f[k], f[k + 1]]) furTris.push({ p: M.P[c.p], n: M.N[c.n], uv: M.T[c.t], w: W[c.p], key: c.p });
  prim(furMat, furTris);
  // the inside of the mouth: two quads per lip edge, creased inwards
  const mouthTris = [], center = V3(0, 0.82, 1.2);
  const flatTri = (a, b, c, wa, wb, wc) => { const n = b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p)).normalize(); for (const v of [a, b, c]) mouthTris.push({ p: v.p, n, uv: null, w: v.w }); };
  for (const [a, b, la, lb] of mouth.band) {
    const mid = (u, l) => { const p = M.P[u].clone().add(M.P[l]).multiplyScalar(0.5); p.add(V3(-p.x * 0.35, 0.012, -0.025)); const w = [...W[u], ...W[l]].reduce((m, [k, v]) => (m[k] = (m[k] || 0) + v / 2, m), {}); return { p, w: Object.entries(w).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => [+k, v]).concat([[0, 0], [0, 0], [0, 0], [0, 0]]).slice(0, 4) }; };
    const U = i => ({ p: M.P[i], w: W[i] });
    const ma = mid(a, la), mb = mid(b, lb);
    // wind them to face outwards (away from the snout's middle)
    const quad = (q) => { const n = q[1].p.clone().sub(q[0].p).cross(q[2].p.clone().sub(q[0].p)); const c = q.reduce((s, v) => s.add(v.p), V3()).multiplyScalar(1 / 4); const out = c.clone().sub(center); out.y = 0; if (n.dot(out) < 0) q.reverse(); flatTri(q[0], q[1], q[2]); flatTri(q[0], q[2], q[3]); };
    quad([U(a), U(b), mb, ma]); quad([ma, mb, U(lb), U(la)]);
  }
  prim(mat('Mouth', mouthColor), mouthTris);
  // eyes
  const eyeTris = [];
  for (const e of eyeSpots(M)) {
    const pts = ball(e.pos.clone().addScaledVector(e.n, 0.005), e.n, 0.024, 0.5);
    for (let i = 0; i < pts.length; i += 3) { const n = pts[i + 1].clone().sub(pts[i]).cross(pts[i + 2].clone().sub(pts[i])).normalize(); for (let j = 0; j < 3; j++) eyeTris.push({ p: pts[i + j], n, uv: null, w: [[headI, 1], [0, 0], [0, 0], [0, 0]] }); }
  }
  prim(mat('Eyes', eyeColor, 0.3), eyeTris);
  // skin
  const ibm = new Float32Array(list.length * 16);
  list.forEach((b, i) => new THREE.Matrix4().makeTranslation(-b.userData.bind.x, -b.userData.bind.y, -b.userData.bind.z).toArray(ibm, i * 16));
  const skin = doc.createSkin('Armature').setSkeleton(nodes.Root).setInverseBindMatrices(acc('MAT4', ibm));
  for (const b of list) skin.addJoint(nodes[b.name]);
  const meshNode = doc.createNode(name + 'Mesh').setMesh(mesh).setSkin(skin);
  const armNode = doc.createNode('Armature').addChild(nodes.Root).addChild(meshNode);
  doc.createScene(name).addChild(armNode);
  // ice spikes: separate meshes, each on the back bone under it
  if (spikes) {
    const ice = mat('Ice', 0x8fdcff, 0.4), iceDark = mat('IceDeep', 0x4aa8e0, 0.4);
    spikes.forEach((s, i) => {
      const bone = B[s.bone], pts = shard(s.at, s.h, s.r, s.lean, s.side, s.turn, s.sides);
      const P = [], N = [];
      for (let k = 0; k < pts.length; k += 3) {
        const n = pts[k + 1].clone().sub(pts[k]).cross(pts[k + 2].clone().sub(pts[k])).normalize();
        for (let j = 0; j < 3; j++) { const v = pts[k + j].clone().sub(bone.userData.bind); P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z); }
      }
      const m = doc.createMesh('Spike' + i).addPrimitive(doc.createPrimitive().setMaterial(s.deep ? iceDark : ice)
        .setAttribute('POSITION', acc('VEC3', new Float32Array(P))).setAttribute('NORMAL', acc('VEC3', new Float32Array(N))));
      nodes[s.bone].addChild(doc.createNode('Spike' + i).setMesh(m));
    });
  }
  // clips
  for (const c of clips) {
    const anim = doc.createAnimation(c.name), input = acc('SCALAR', new Float32Array(c.times));
    list.forEach((b, k) => {
      const tr = c.tracks[k];
      const moved = tr.p.some(p => p.distanceTo(b.userData.rest) > 1e-5), turned = tr.q.some(q => Math.abs(q.w) < 0.99999);
      if (turned || b.name === 'Hips') {
        const s = doc.createAnimationSampler().setInput(input).setOutput(acc('VEC4', new Float32Array(tr.q.flatMap(q => [q.x, q.y, q.z, q.w])))).setInterpolation('LINEAR');
        anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(nodes[b.name]).setTargetPath('rotation').setSampler(s));
      }
      if (moved) {
        const s = doc.createAnimationSampler().setInput(input).setOutput(acc('VEC3', new Float32Array(tr.p.flatMap(p => p.toArray())))).setInterpolation('LINEAR');
        anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(nodes[b.name]).setTargetPath('translation').setSampler(s));
      }
    });
  }
  return doc;
}

// ---------------------------------------------------------------- run
// the Frostclaw's ice: a ridge of shards along the spine, tallest over the shoulders, with a
// few small ones beside them; each is parented to the bone under it
const SPIKES = [
  { bone: 'Neck', at: V3(0, 1.36, 0.66), h: 0.2, r: 0.05, lean: -0.5 },
  { bone: 'Spine2', at: V3(0, 1.39, 0.44), h: 0.34, r: 0.075, lean: -0.42, turn: 0.4 },
  { bone: 'Spine2', at: V3(0.09, 1.36, 0.36), h: 0.17, r: 0.045, lean: -0.3, side: -0.55, deep: true },
  { bone: 'Spine2', at: V3(-0.09, 1.36, 0.36), h: 0.15, r: 0.045, lean: -0.3, side: 0.55, deep: true, turn: 1 },
  { bone: 'Spine1', at: V3(0, 1.43, 0.16), h: 0.42, r: 0.085, lean: -0.36, turn: 0.9 },
  { bone: 'Spine1', at: V3(0.1, 1.4, 0.03), h: 0.2, r: 0.05, lean: -0.25, side: -0.6, deep: true, turn: 0.3 },
  { bone: 'Spine1', at: V3(0, 1.46, -0.1), h: 0.38, r: 0.08, lean: -0.34, turn: 2.1 },
  { bone: 'Spine1', at: V3(-0.1, 1.42, -0.2), h: 0.18, r: 0.05, lean: -0.25, side: 0.6, deep: true, turn: 0.6 },
  { bone: 'Hips', at: V3(0, 1.45, -0.36), h: 0.3, r: 0.07, lean: -0.36, turn: 1.3 },
  { bone: 'Hips', at: V3(0, 1.38, -0.58), h: 0.2, r: 0.055, lean: -0.42, turn: 0.2 }
].map(s => Object.assign({ side: 0, turn: 0, sides: 5 }, s));

const M = loadObj();
const mouth = cutMouth(M);
const sk = makeSkeleton();
const W = weigh(M, mouth, sk.B, sk.list);
const clips = sampleClips(sk.arm, sk.B, sk.list);
const tex = makeTextures(M);
mkdirSync(OUT, { recursive: true });
const io = new NodeIO();
const VARIANTS = {
  Bear: { eyeColor: 0x141010, mouthColor: 0x3a1a1a },
  Grizzle: { eyeColor: 0xff9a2a, mouthColor: 0x3a1a1a },
  Frostclaw: { eyeColor: 0x39d0ff, mouthColor: 0x2a2440, spikes: SPIKES }
};
for (const [name, v] of Object.entries(VARIANTS)) {
  const doc = writeModel(name, { M, mouth, W, sk, clips, png: tex[name], ...v });
  await doc.transform(resample({ tolerance: 1e-4 }), dedup(), prune());
  const file = join(OUT, name + '.glb');
  await io.write(file, doc);
  console.log(`${name.padEnd(10)} ${(statSync(file).size / 1024).toFixed(0).padStart(5)} KB`);
}
if (process.argv.includes('--textures')) for (const [n, png] of Object.entries(tex)) writeFileSync(join(process.argv[process.argv.indexOf('--textures') + 1] || '.', n + '.png'), png);
console.log('clips:', clips.map(c => `${c.name} ${c.T}s`).join(', '));
