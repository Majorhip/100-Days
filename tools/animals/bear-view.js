// Browser side of tools/animals/bear-view.mjs: draws a contact sheet of a model with
// orthographic cameras (side, front, top, three-quarter), its skeleton on top and a 0.25 m grid
// on the ground, one row per moment of a clip. For checking a rig and its clips by eye.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const VIEWS = {
  side: [[-1, 0, 0], [0, 1, 0]],      // from the left: +z (forward) to the right
  right: [[1, 0, 0], [0, 1, 0]],
  front: [[0, 0, 1], [0, 1, 0]],
  back: [[0, 0, -1], [0, 1, 0]],
  top: [[0, 1, 0], [0, 0, -1]],
  under: [[0, -1, 0], [0, 0, 1]],
  three: [[-0.75, 0.45, 0.85], [0, 1, 0]],
  threeB: [[0.8, 0.5, -0.7], [0, 1, 0]]
};

const frac = x => x - Math.floor(x);
export async function sheet({ file, clip, times = [0], views = ['side', 'front', 'top'], cell = [420, 320], span = 2.6, bones = true, weights = false, dump = null, jpeg = false, center = [0, 0.7, 0], height = 1.5 }) {
  const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setScissorTest(true);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(-3, 5, 4); scene.add(sun);
  const grid = new THREE.GridHelper(6, 24, 0x667788, 0xaab4be); scene.add(grid);
  const axis = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.002, 0), 0.6, 0xff3333); scene.add(axis);
  let root, mixer = null, gltf = null;
  if (/\.obj$/i.test(file)) {
    root = await new OBJLoader().loadAsync(file);
    const map = await new THREE.TextureLoader().loadAsync(file.replace(/\.obj$/i, '_BaseColor.png'));
    root.traverse(o => { if (o.isMesh) o.material = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide }); });
    const b = new THREE.Box3().setFromObject(root), s = height / (b.max.y - b.min.y);
    root.scale.setScalar(s); root.position.y = -b.min.y * s;
  } else {
    gltf = await new GLTFLoader().loadAsync(file); root = gltf.scene;
    // as the game: no colour management (texture and colours shown as stored, sRGB)
    root.traverse(o => { if (o.isMesh) { const m = o.material; if (m.map) m.map.encoding = THREE.LinearEncoding; else m.color.convertLinearToSRGB(); o.material = new THREE.MeshLambertMaterial({ map: m.map, color: m.map ? 0xffffff : m.color, emissive: m.emissive || 0, skinning: !!o.isSkinnedMesh, side: THREE.DoubleSide }); o.frustumCulled = false; } });
    mixer = new THREE.AnimationMixer(root);
    if (weights) root.traverse(o => {
      // colour each vertex by its bones' weights (a fixed colour per bone)
      if (!o.isSkinnedMesh) return;
      const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, col = new Float32Array(si.count * 3), c = new THREE.Color();
      for (let i = 0; i < si.count; i++) for (const [k, f] of ['getX', 'getY', 'getZ', 'getW'].entries()) { const j = si[f](i), w = sw[f](i); void k; c.setHSL(frac(j * 0.618), 0.75, 0.5); col[i * 3] += c.r * w; col[i * 3 + 1] += c.g * w; col[i * 3 + 2] += c.b * w; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      o.material = new THREE.MeshLambertMaterial({ vertexColors: true, skinning: true, side: THREE.DoubleSide });
    });
  }
  scene.add(root);
  let helper = null;
  if (bones && gltf) { helper = new THREE.SkeletonHelper(root); helper.material.depthTest = false; helper.material.linewidth = 2; scene.add(helper); }
  const ac = gltf && clip ? gltf.animations.find(a => a.name === clip) : null;
  const act = ac ? mixer.clipAction(ac) : null;
  if (act) act.play();
  if (typeof times === 'number') times = times <= 1 || !ac ? [0] : Array.from({ length: times }, (_, i) => +(i * ac.duration / times).toFixed(3));
  const [cw, ch] = cell, W = cw * views.length, H = ch * times.length;
  canvas.width = W; canvas.height = H; renderer.setSize(W, H, false);
  const c = new THREE.Vector3(...center), info = [];
  for (let r = 0; r < times.length; r++) {
    if (act) { act.time = times[r]; mixer.update(0); }
    root.updateMatrixWorld(true);
    if (dump) {
      const row = { t: times[r] }; root.traverse(o => { if (o.isBone && dump.test(o.name)) row[o.name] = o.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(3)); });
      // vertices below the ground, with their bones
      const v = new THREE.Vector3(); row.under = [];
      root.traverse(o => { if (!o.isSkinnedMesh) return; const p = o.geometry.attributes.position, si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight; for (let i = 0; i < p.count; i++) { o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); if (v.y < -0.02 && row.under.length < 6) row.under.push([i, v.toArray().map(x => +x.toFixed(2)), ['getX', 'getY', 'getZ', 'getW'].map(k => o.skeleton.bones[si[k](i)].name + ':' + sw[k](i).toFixed(2)).join(' ')]); } });
      info.push(row);
    }
    for (let k = 0; k < views.length; k++) {
      const [dir, up] = VIEWS[views[k]], a = cw / ch;
      const cam = new THREE.OrthographicCamera(-span * a / 2, span * a / 2, span / 2, -span / 2, 0.01, 50);
      cam.position.copy(c).add(new THREE.Vector3(...dir).normalize().multiplyScalar(10)); cam.up.set(...up); cam.lookAt(c);
      const x = k * cw, y = H - (r + 1) * ch;
      renderer.setViewport(x, y, cw, ch); renderer.setScissor(x, y, cw, ch);
      renderer.setClearColor(r % 2 ? 0xe8ecef : 0xf4f6f8); renderer.clear();
      renderer.render(scene, cam);
    }
  }
  return { dataUrl: canvas.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.9), times, info, clips: gltf ? gltf.animations.map(a => [a.name, +a.duration.toFixed(3)]) : [] };
}
