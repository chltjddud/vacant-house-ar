import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

const scene = new THREE.Scene();

const ghostGroup = new THREE.Group();
ghostGroup.name = "Ghost";

// Head/Body
const bodyGeometry = new THREE.SphereGeometry(1, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.7);
const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.2,
  metalness: 0.1,
  emissive: 0x00ffcc,
  emissiveIntensity: 0.2
});
const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
ghostGroup.add(bodyMesh);

// Ghost Tail
const tailGeometry = new THREE.CylinderGeometry(0.98, 0.2, 1.2, 32, 1, true);
const tailMesh = new THREE.Mesh(tailGeometry, bodyMaterial);
tailMesh.position.y = -0.6;
ghostGroup.add(tailMesh);

// Eyes
const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x080808 });
const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);

const leftEye = new THREE.Mesh(eyeGeo, eyeMaterial);
leftEye.scale.set(1, 1.3, 0.6);
leftEye.position.set(-0.3, 0.15, 0.88);

const rightEye = new THREE.Mesh(eyeGeo, eyeMaterial);
rightEye.scale.set(1, 1.3, 0.6);
rightEye.position.set(0.3, 0.15, 0.88);

ghostGroup.add(leftEye);
ghostGroup.add(rightEye);

// Cheeks
const cheekMaterial = new THREE.MeshBasicMaterial({ color: 0xff99bb });
const cheekGeo = new THREE.SphereGeometry(0.1, 16, 16);

const leftCheek = new THREE.Mesh(cheekGeo, cheekMaterial);
leftCheek.scale.set(1.4, 0.8, 0.4);
leftCheek.position.set(-0.52, -0.05, 0.82);

const rightCheek = new THREE.Mesh(cheekGeo, cheekMaterial);
rightCheek.scale.set(1.4, 0.8, 0.4);
rightCheek.position.set(0.52, -0.05, 0.82);

ghostGroup.add(leftCheek);
ghostGroup.add(rightCheek);

scene.add(ghostGroup);

const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (gltf) => {
    const outputDir = path.resolve('public');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const filePath = path.join(outputDir, 'ghost.gltf');
    fs.writeFileSync(filePath, JSON.stringify(gltf, null, 2));
    console.log('3D Ghost GLTF model successfully created at:', filePath);
  },
  (error) => {
    console.error('Error generating GLTF:', error);
  },
  { binary: false }
);
