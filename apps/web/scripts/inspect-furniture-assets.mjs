import { URL } from "node:url";
import { log } from "node:console";
import { readFile, readdir } from 'node:fs/promises';
import { Box3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Offline resource audit using Three's actual loader, not a separate GLTF parser.
const directory = new URL('../src/features/project-3d/assets/models/', import.meta.url);
for (const name of (await readdir(directory)).filter(name => name.endsWith('.glb')).sort()) {
  const bytes = await readFile(new URL(name, directory));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const box = new Box3().setFromObject(gltf.scene, true);
  log(JSON.stringify({ name, bytes: bytes.length, min: box.min.toArray(), max: box.max.toArray(), animations: gltf.animations.length }));
}
