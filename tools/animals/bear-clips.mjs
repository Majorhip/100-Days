// The bear's clips, posed frame by frame (tools/animals/rig-bear.mjs samples them).
// Each clip is { name, T (seconds), pose(rig, t, T) }. In pose():
//   rig.r(bone, pitch, yaw, roll)   local rotation from the bind pose (+pitch = nose/toe down,
//                                   +yaw = turn to its left (+x), +roll = its left side up)
//   rig.p(bone, x, y, z)            move a bone from its bind place (Hips: the whole body)
//   rig.leg('FL'|'FR'|'HL'|'HR', toe, pitch)  plant a paw: toe tip at 'toe' (world), paw pitch
//   rig.blend(bone, w, ...)         after the legs: blend a bone towards a local rotation (for
//                                   a paw lifted off the ground, e.g. the swipe)
//   rig.toe0(leg)                   where that toe is when standing
// Gaits move the paws backwards along the ground at exactly the clip's ground speed, so the
// game can scale the clip's speed to the bear's and the paws don't slide.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const frac = x => x - Math.floor(x);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** a smooth curve through keys [[t, v], ...] (Catmull-Rom; flat before the first and after the last) */
export function keys(t, K) {
  if (t <= K[0][0]) return K[0][1];
  if (t >= K[K.length - 1][0]) return K[K.length - 1][1];
  let i = 0; while (t > K[i + 1][0]) i++;
  const [t0, v0] = K[i], [t1, v1] = K[i + 1], h = t1 - t0, u = (t - t0) / h;
  const m = j => (j <= 0 || j >= K.length - 1) ? 0 : (K[j + 1][1] - K[j - 1][1]) / (K[j + 1][0] - K[j - 1][0]) * h;
  const m0 = m(i), m1 = m(i + 1), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * m1;
}
/** keys for a looping curve: the first key is repeated at T */
const loopKeys = (t, T, K) => keys(frac(t / T) * T, [...K.slice(-2).map(([a, v]) => [a - T, v]), ...K, ...K.slice(0, 2).map(([a, v]) => [a + T, v])]);

/** one paw through a stride, phase p (0..1) from touching down.
 *  duty: share of the stride on the ground; A: half the distance it travels on the ground;
 *  lift: toe height in the swing; roll: paw pitch as the heel peels off before lifting;
 *  flex: paw pitch at the top of the swing (front paws curl right back, hind ones less) */
function foot(p, { duty, A, lift, roll, flex, reach = -0.18 }) {
  if (p < duty) {
    const s = p / duty;
    return { dz: A * (1 - 2 * s), y: 0, pitch: roll * ss(0.72, 1, s) };
  }
  const u = (p - duty) / (1 - duty);
  const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);   // ease in and out
  const dz = -A + 2 * A * (0.12 * u + 0.88 * e);
  const y = lift * Math.pow(Math.sin(Math.PI * clamp(u * 1.08)), 0.9) * (u < 0.15 ? 0.6 + u / 0.15 * 0.4 : 1);
  const pitch = keys(u, [[0, roll], [0.32, flex], [0.75, reach], [1, 0]]);
  return { dz, y, pitch };
}

function gait(rig, p, legs, { duty, A, lift, roll, flex, zc = {} }) {
  for (const [n, off] of Object.entries(legs)) {
    const front = n[0] === 'F', f = foot(frac(p - off), { duty, A, lift: lift[front ? 0 : 1], roll: roll[front ? 0 : 1], flex: flex[front ? 0 : 1] });
    rig.leg(n, rig.toe0(n).add(V3(0, f.y, f.dz + (zc[n[0]] || 0))), f.pitch);
  }
}
const stand = (rig, except = [], shift = {}) => { for (const n of ['FL', 'FR', 'HL', 'HR']) if (!except.includes(n)) rig.leg(n, rig.toe0(n).add(shift[n] || V3()), 0); };

// ------------------------------------------------------------------------------------ Idle
const Idle = {
  name: 'Idle', T: 4, fps: 30,
  pose(rig, t, T) {
    const b = Math.sin(TAU * t / 2), look = TAU * t / T;
    rig.p('Hips', 0, 0.006 * b, 0);
    rig.r('Spine1', -0.012 * b); rig.r('Spine2', 0.008 * b);
    rig.r('Neck', 0.06 + 0.05 * Math.sin(look + 1), 0.16 * Math.sin(look), 0);
    rig.r('Head', 0.03 * Math.sin(TAU * t / 2 + 0.5), 0.06 * Math.sin(look - 0.6), 0.05 * Math.sin(look + 2));
    rig.r('Jaw', 0.03 + 0.025 * Math.max(0, Math.sin(TAU * t + 1)));   // sniffing
    rig.r('Tail', 0.05 * b, 0.12 * Math.sin(look * 2));
    stand(rig);
  }
};

// ------------------------------------------------------------------------------------ Walk
// four-beat lateral walk: left hind, left front, right hind, right front
const WALK = { T: 1.0, duty: 0.64, A: 0.3 };   // ground speed 2A / (duty T) = 0.94 m/s
const Walk = {
  name: 'Walk', T: WALK.T,
  pose(rig, t, T) {
    const p = t / T, c = x => Math.cos(TAU * x);
    const hb = 0.012 * Math.cos(2 * TAU * (p - 0.32)), sb = 0.014 * Math.cos(2 * TAU * (p - 0.57));
    rig.p('Hips', 0.012 * c(p - 0.32), -0.055 + hb, 0);
    rig.r('Hips', -(sb - hb) / 0.75 + 0.02, -0.05 * c(p), 0.035 * c(p - 0.32));
    rig.r('Spine1', 0, 0.03 * c(p - 0.12), -0.02 * c(p - 0.32));
    rig.r('Spine2', -0.01, 0.05 * c(p - 0.25) - 0.02 * c(p), 0.05 * c(p - 0.57) - 0.03 * c(p - 0.32));
    rig.r('Neck', 0.16 + 0.03 * c(2 * p - 0.3), 0.07 * Math.sin(TAU * (p - 0.05)), -0.03 * c(p - 0.57));
    rig.r('Head', -0.06 + 0.04 * c(2 * (p - 0.62)), 0.03 * Math.sin(TAU * (p - 0.15)));
    rig.r('Jaw', 0.03);
    rig.r('Tail', 0.05, 0.12 * Math.sin(TAU * p));
    gait(rig, p, { HL: 0, FL: 0.25, HR: 0.5, FR: 0.75 }, { duty: WALK.duty, A: WALK.A, lift: [0.06, 0.07], roll: [0.45, 0.3], flex: [0.65, 0.3], zc: { F: 0.02, H: 0.0 } });
  }
};

// ------------------------------------------------------------------------------------ Gallop
// rotary gallop: left hind, right hind, left front, right front, then a gathered leap
const GAL = { T: 0.62, duty: 0.3, A: 0.36 };   // ground speed 0.72 / (0.3 x 0.62) = 3.87 m/s
const Gallop = {
  name: 'Gallop', T: GAL.T,
  pose(rig, t, T) {
    const p = t / T, s = x => Math.sin(TAU * x), c = x => Math.cos(TAU * x);
    const flex = c(p - 0.95);             // +1 gathered (back arched), -1 stretched out
    const pitch = 0.07 * s(p - 0.15);     // nose down as the front paws land, up in the leap
    rig.p('Hips', 0, -0.08 + 0.04 * c(p - 0.88), -0.02 * flex);
    rig.r('Hips', pitch - 0.05 * flex, 0.03 * s(p), 0.03 * s(p - 0.1));
    rig.r('Spine1', 0.05 * flex, -0.02 * s(p));
    rig.r('Spine2', 0.06 * flex, -0.03 * s(p - 0.45), 0.04 * s(p - 0.5));
    rig.r('Neck', 0.12 - pitch * 0.8 - 0.04 * flex, 0.02 * s(p));
    rig.r('Head', -0.05 - 0.04 * s(p - 0.3));
    rig.r('Jaw', 0.12 + 0.06 * s(p - 0.4));   // panting
    rig.r('Tail', 0.25 * flex, 0);
    gait(rig, p, { HL: 0, HR: 0.08, FL: 0.42, FR: 0.5 }, { duty: GAL.duty, A: GAL.A, lift: [0.18, 0.16], roll: [0.6, 0.45], flex: [0.85, 0.6], zc: { F: 0.05, H: -0.06 } });
  }
};

// ------------------------------------------------------------------------------------ Attack
// rears its chest, raises the right paw and rakes it down and across while the head lunges
// in to bite; the head is furthest forward (the game's bite moment) at about 0.5 s
const Attack = {
  name: 'Attack', T: 1.1,
  pose(rig, t) {
    const K = k => keys(t, k);
    rig.p('Hips', K([[0, 0], [0.3, 0.03], [0.5, 0.02], [1.0, 0]]), K([[0, 0], [0.3, -0.045], [0.5, -0.06], [0.75, -0.02], [1.1, 0]]), K([[0, 0], [0.3, -0.04], [0.5, 0.09], [0.75, 0.04], [1.1, 0]]));
    rig.r('Hips', K([[0, 0], [0.3, -0.06], [0.5, 0.05], [1.1, 0]]), 0, K([[0, 0], [0.28, -0.05], [0.5, -0.03], [0.9, 0]]));
    rig.r('Spine2', K([[0, 0], [0.3, -0.1], [0.5, 0.08], [0.8, 0], [1.1, 0]]), K([[0, 0], [0.3, -0.12], [0.5, 0.16], [0.75, 0.04], [1.1, 0]]), K([[0, 0], [0.3, 0.02], [0.5, -0.04], [1.0, 0]]));
    rig.p('Neck', 0, 0, K([[0, 0], [0.3, -0.03], [0.5, 0.07], [0.75, 0.01], [1.1, 0]]));
    rig.r('Neck', K([[0, 0.05], [0.3, -0.3], [0.5, 0.2], [0.75, 0.08], [1.1, 0.05]]), K([[0, 0], [0.3, 0.1], [0.5, -0.06], [1.1, 0]]));
    rig.r('Head', K([[0, 0], [0.3, -0.12], [0.5, 0.06], [1.1, 0]]), 0, K([[0, 0], [0.3, -0.08], [0.5, 0.06], [1.1, 0]]));
    rig.r('Jaw', K([[0, 0.02], [0.22, 0.3], [0.44, 0.55], [0.54, 0.04], [0.7, 0.02], [1.1, 0.02]]));
    rig.r('Tail', K([[0, 0], [0.3, -0.2], [0.6, 0.1], [1.1, 0]]));
    // the right paw: lifted and posed by hand for the swipe, then it lands forward of where it
    // stood (planted, by the legs' solver) and steps back
    const back = clamp((t - 0.78) / 0.22);
    stand(rig, [], { FR: V3(0.03 * (1 - ss(0, 1, back)), 0.06 * Math.sin(Math.PI * back), 0.15 * (1 - ss(0, 1, back)) * ss(0.3, 0.5, t)) });
    const w = K([[0.06, 0], [0.18, 1], [0.46, 1], [0.57, 0]]);
    rig.blend('UpperArmR', w, K([[0.06, -0.3], [0.33, -1.55], [0.46, -1.15]]), K([[0.06, 0], [0.33, 0.15], [0.46, -0.2]]), K([[0.06, -0.05], [0.33, -0.35], [0.46, 0.25]]));
    rig.blend('ForeArmR', w, K([[0.06, 0.5], [0.33, -0.2], [0.46, 0.15]]));
    rig.blend('FrontPawR', w, K([[0.06, 0.6], [0.33, -0.6], [0.46, 0.6]]));
  }
};

// ------------------------------------------------------------------------------------ Death
// rears its head, the front legs fold, and it rolls onto its right side
const Death = {
  name: 'Death', T: 2.0,
  pose(rig, t) {
    const K = k => keys(t, k);
    // 1. pain: head up, mouth open (0-0.35)
    // 2. the legs fold under it, front first, with the paws still planted, so it sinks onto
    //    its belly (0.35-0.95)
    // 3. it tips over onto its right side, rolling about its right-hand edge on the ground,
    //    and the legs go limp (0.85-1.5)
    const roll = K([[0.85, 0], [1.3, 1.45], [1.42, 1.56], [1.55, 1.5], [2, 1.5]]);
    const pivot = V3(-0.45, 0, 0), q = new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), roll);
    const pos = pivot.clone().add(pivot.clone().negate().applyQuaternion(q));
    rig.p('Root', pos.x + 0.5 * ss(0.9, 1.4, t), pos.y, 0);
    rig.B.Root.quaternion.copy(q);
    rig.p('Hips', 0, K([[0.3, 0.01], [0.6, -0.12], [0.95, -0.42], [2, -0.43]]), K([[0, 0], [0.3, -0.04], [0.95, 0.02]]));
    rig.r('Hips', K([[0.3, -0.03], [0.6, 0.14], [0.95, 0.04], [2, 0.03]]));
    rig.r('Spine2', K([[0, 0], [0.3, -0.12], [0.7, 0.05], [1.3, 0]]));
    rig.r('Neck', K([[0, 0], [0.3, -0.5], [0.7, 0.05], [1.0, 0.3], [1.5, 0.2], [2, 0.22]]), K([[0, 0], [0.3, 0.15], [1.0, 0], [1.5, -0.2]]), K([[0.9, 0], [1.5, 0.25]]));
    rig.r('Head', K([[0, 0], [0.3, -0.2], [0.9, 0.1], [1.4, 0.12]]), 0, K([[0.9, 0], [1.5, 0.15]]));
    rig.r('Jaw', K([[0, 0], [0.25, 0.45], [0.6, 0.3], [1.2, 0.12], [2, 0.14]]));
    rig.r('Tail', K([[0, 0], [0.5, -0.3], [1.4, 0.2]]));
    // the right legs (underneath) stay on the ground, sliding out to the side and folding as
    // it goes over; the left ones (on top) go limp
    const out = K([[0.85, 0], [1.35, 1]]);
    stand(rig, [], { FR: V3(-0.45 * out, 0, -0.05 * out), HR: V3(-0.4 * out, 0, 0.05 * out) });
    const w = K([[1.02, 0], [1.32, 1]]);
    for (const s of ['L']) {
      rig.blend('UpperArm' + s, w, -0.55);
      rig.blend('ForeArm' + s, w, 0.95);
      rig.blend('FrontPaw' + s, w, 0.45);
      rig.blend('Thigh' + s, w, -0.65);
      rig.blend('Shin' + s, w, 0.85);
      rig.blend('HindPaw' + s, w, 0.35);
    }
  }
};

// ------------------------------------------------------------------------------------ hit reacts
// flinch away from a blow on the left (or right) side, and recover
const hit = side => ({
  name: 'Idle_HitReact_' + side, T: 0.6,
  pose(rig, t) {
    const o = side === 'Left' ? 1 : -1, K = k => keys(t, k);
    const f = K([[0, 0], [0.09, 1], [0.22, 0.75], [0.6, 0]]);
    rig.p('Hips', -0.03 * o * f, -0.07 * f, -0.02 * f);
    rig.r('Hips', -0.04 * f, -0.05 * o * f, 0.07 * o * f);
    rig.r('Spine2', -0.06 * f, -0.14 * o * f, 0.05 * o * f);
    rig.r('Neck', -0.28 * f, -0.3 * o * f, -0.1 * o * f);
    rig.r('Head', -0.1 * f, -0.1 * o * f, -0.15 * o * f);
    rig.r('Jaw', K([[0, 0], [0.08, 0.4], [0.3, 0.15], [0.6, 0]]));
    rig.r('Tail', 0.2 * f, -0.2 * o * f);
    stand(rig);
  }
});

// ------------------------------------------------------------------------------------ Roar
// the boss's wind-up ('tele', 0.95 s): head down to draw breath, then up with the mouth wide,
// shaking its head; the chest lifts on the front legs
const Roar = {
  name: 'Roar', T: 1.6,
  pose(rig, t) {
    const K = k => keys(t, k), on = K([[0.3, 0], [0.45, 1], [1.15, 1], [1.45, 0]]);
    const shake = on * Math.sin(TAU * 4.5 * t);
    rig.p('Hips', 0, K([[0, 0], [0.3, -0.045], [0.5, -0.05], [1.2, -0.05], [1.6, 0]]), K([[0, 0], [0.3, -0.05], [0.5, 0.0], [1.6, 0]]));
    rig.r('Hips', K([[0, 0], [0.3, 0.03], [0.5, -0.04], [1.2, -0.04], [1.6, 0]]));
    rig.r('Spine2', K([[0, 0], [0.3, 0.04], [0.5, -0.06], [1.2, -0.05], [1.6, 0]]), 0.03 * shake);
    rig.p('Neck', 0, 0, K([[0, 0], [0.3, -0.03], [0.5, 0.05], [1.2, 0.05], [1.6, 0]]));
    rig.r('Neck', K([[0, 0.05], [0.3, 0.35], [0.5, -0.3], [1.2, -0.25], [1.6, 0.05]]), 0.1 * shake, 0.05 * shake);
    rig.r('Head', K([[0, 0], [0.3, 0.2], [0.5, -0.2], [1.2, -0.15], [1.6, 0]]), 0.05 * shake, 0.12 * shake);
    rig.r('Jaw', K([[0, 0.02], [0.3, 0.1], [0.48, 0.68], [1.15, 0.62], [1.4, 0.05], [1.6, 0.02]]) + 0.04 * on * Math.sin(TAU * 9 * t));
    rig.r('Tail', K([[0, 0], [0.5, 0.3], [1.2, 0.3], [1.6, 0]]));
    stand(rig);
  }
};

// ------------------------------------------------------------------------------------ Slam
// Frostclaw's jump ('slam'): rears up on its hind legs, arms raised, and crashes down on its
// front paws at 0.95 s (when the game shakes the ground), then steps back to standing
const SLAM_AT = 0.95;
const Slam = {
  name: 'Slam', T: 1.8,
  pose(rig, t) {
    const K = k => keys(t, k);
    rig.p('Hips', 0, K([[0, 0], [0.22, -0.05], [0.6, -0.05], [0.8, -0.02], [0.95, -0.13], [1.15, -0.07], [1.6, 0], [1.8, 0]]), K([[0, 0], [0.22, -0.05], [0.6, -0.13], [0.8, -0.1], [0.95, 0.1], [1.3, 0.06], [1.65, 0], [1.8, 0]]));
    rig.r('Hips', K([[0, 0], [0.22, 0.0], [0.55, -0.85], [0.78, -0.98], [0.89, -0.35], [0.95, 0.14], [1.05, 0.1], [1.4, 0.02], [1.8, 0]]));
    rig.r('Spine1', K([[0, 0], [0.55, 0.06], [0.78, 0.04], [0.95, 0.04], [1.3, 0]]));
    rig.r('Spine2', K([[0, 0], [0.55, 0.16], [0.78, 0.12], [0.95, 0.06], [1.3, 0]]));
    rig.r('Neck', K([[0, 0.05], [0.22, 0.2], [0.55, 0.45], [0.8, 0.4], [0.95, 0.12], [1.1, 0.16], [1.6, 0.05]]));
    rig.r('Head', K([[0, 0], [0.55, 0.1], [0.8, 0.05], [0.95, -0.05], [1.2, 0], [1.8, 0]]));
    rig.r('Jaw', K([[0, 0.02], [0.3, 0.1], [0.55, 0.6], [0.85, 0.55], [0.97, 0.3], [1.25, 0.04], [1.8, 0.02]]));
    rig.r('Tail', K([[0, 0], [0.6, 0.4], [0.95, -0.2], [1.3, 0]]));
    // hind paws stay planted; front paws land forward of standing, then step back one by one
    const step = (t0, t1) => { const u = clamp((t - t0) / (t1 - t0)); return { z: 0.2 * (1 - ss(0, 1, u)), y: 0.1 * Math.sin(Math.PI * u), pitch: 0.5 * Math.sin(Math.PI * u) }; };
    const sl = step(1.15, 1.42), sr = step(1.32, 1.6);
    rig.leg('HL', rig.toe0('HL'), 0); rig.leg('HR', rig.toe0('HR'), 0);
    rig.leg('FL', rig.toe0('FL').add(V3(0.03, sl.y, sl.z)), sl.pitch);
    rig.leg('FR', rig.toe0('FR').add(V3(-0.03, sr.y, sr.z)), sr.pitch);
    // arms up and out, elbows bent, claws hanging; then swung down onto the ground
    const w = K([[0.2, 0], [0.42, 1], [0.86, 1], [SLAM_AT, 0]]);
    for (const s of ['L', 'R']) {
      const o = s === 'L' ? 1 : -1;
      rig.blend('UpperArm' + s, w, K([[0.2, -0.2], [0.55, -0.95], [0.8, -1.1], [0.9, -0.3]]), o * K([[0.2, 0], [0.6, -0.15], [0.9, 0]]), o * K([[0.2, 0], [0.55, 0.3], [0.8, 0.4], [0.9, 0.1]]));
      rig.blend('ForeArm' + s, w, K([[0.2, 0.3], [0.55, 0.85], [0.8, 0.8], [0.9, 0.2]]));
      rig.blend('FrontPaw' + s, w, K([[0.2, 0.3], [0.55, 0.6], [0.8, 0.5], [0.9, -0.2]]));
    }
  }
};

// ------------------------------------------------------------------------------------ Eating
// nose to the ground, nuzzling and chewing, then back up
const Eating = {
  name: 'Eating', T: 3.2, fps: 30,
  pose(rig, t) {
    const K = k => keys(t, k), down = K([[0, 0], [0.6, 1], [2.5, 1], [3.2, 0]]);
    rig.p('Hips', 0, -0.015 * down, 0);
    rig.r('Hips', 0.03 * down);
    rig.r('Spine2', 0.1 * down);
    rig.r('Neck', 0.05 + 0.75 * down, 0.12 * down * Math.sin(TAU * 0.6 * t));
    rig.r('Head', 0.32 * down + 0.05 * down * Math.sin(TAU * 1.3 * t), 0, 0.06 * down * Math.sin(TAU * 0.6 * t + 1));
    rig.r('Jaw', 0.02 + 0.16 * K([[0.7, 0], [0.8, 1], [2.3, 1], [2.4, 0]]) * (0.5 - 0.5 * Math.cos(TAU * 2.4 * t)));
    rig.r('Tail', 0.06 * Math.sin(TAU * t / 1.6));
    stand(rig);
  }
};

export const CLIPS = [Idle, Walk, Gallop, Attack, Death, hit('Left'), hit('Right'), Roar, Slam, Eating];
export const TIMING = { walkSpeed: 2 * WALK.A / (WALK.duty * WALK.T), gallopSpeed: 2 * GAL.A / (GAL.duty * GAL.T), slamAt: SLAM_AT };
