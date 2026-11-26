// Bounding box of a (skinned) model in its current pose, from its vertices. Used to size the
// animated animals (src/models/gltf-animals.js) and by tools/animals/measure.js. Only three.js
// is imported, so the tools can load it without starting the game. Added after the migration.
import * as THREE from 'three';

function posedBox(scene) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3(), v = new THREE.Vector3();
  scene.traverse(o => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (o.isSkinnedMesh) o.boneTransform(i, v); else v.fromBufferAttribute(pos, i);
      v.applyMatrix4(o.matrixWorld);
      if (isFinite(v.x) && isFinite(v.y) && isFinite(v.z)) box.expandByPoint(v);   // (the Crab has a few vertices with broken weights)
    }
  });
  return box;
}

export { posedBox };
