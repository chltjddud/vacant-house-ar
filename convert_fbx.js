import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

// Convert FBX buffer to ArrayBuffer
const fbxPath = path.resolve('public/nintendo-ghost/Nintendoghost.FBX');
const fbxBuffer = fs.readFileSync(fbxPath);

const loader = new FBXLoader();
const fbxScene = loader.parse(fbxBuffer.buffer, '');

// Adjust material & rotation for WebGL
fbxScene.traverse((child) => {
  if (child.isMesh) {
    child.material.side = THREE.DoubleSide;
  }
});

// Write to GLTF / GLB JSON
const exporter = new GLTFExporter();
exporter.parse(
  fbxScene,
  (gltf) => {
    const outputPath = path.resolve('public/nintendo_ghost.gltf');
    fs.writeFileSync(outputPath, JSON.stringify(gltf, null, 2));
    console.log('Nintendo Ghost successfully converted to GLTF:', outputPath);
  },
  (err) => console.error('GLTF Export Error:', err),
  { binary: false }
);
