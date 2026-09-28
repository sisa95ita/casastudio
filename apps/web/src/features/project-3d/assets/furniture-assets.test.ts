// @vitest-environment node
import { readFile } from "node:fs/promises";
import { Box3, Group, Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { furnitureAssetRegistry } from "./furniture-asset-registry";
import { furnitureAssetTransform } from "../model/furniture-3d-model";

describe("shipped Furniture GLBs", () => {
  for (const [id, asset] of Object.entries(furnitureAssetRegistry)) if (asset) {
    it(`${id} loads locally with audited bounds and isolated instance transforms`, async () => {
      const bytes = await readFile(new URL(`./models/${asset.resource.split("/").at(-1)}`, import.meta.url));
      const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const gltf = await new GLTFLoader().parseAsync(data, "");
      expect(gltf.animations).toHaveLength(0);
      const json = gltf.parser.json;
      expect(json.images ?? []).toHaveLength(0);
      expect(json.skins ?? []).toHaveLength(0);
      expect(json.extensionsRequired ?? []).toHaveLength(0);
      expect(json.buffers.every((buffer: { uri?: string }) => !buffer.uri)).toBe(true);
      const bounds = new Box3().setFromObject(gltf.scene, true);
      bounds.min.toArray().forEach((value, axis) => expect(value).toBeCloseTo(asset.nativeMin[axis]!, 7));
      bounds.max.toArray().forEach((value, axis) => expect(value).toBeCloseTo(asset.nativeMax[axis]!, 7));
      for (const target of [{ width: 1.2, height: 0.8, depth: 2.1 }, { width: 2, height: 3, depth: 0.1 }]) {
        const transform = furnitureAssetTransform(asset, target);
        const scale = new Group(), offset = new Group(), yaw = new Group();
        scale.scale.set(...transform.scale); offset.position.set(...transform.offset); yaw.rotation.y = transform.yaw;
        scale.add(offset); offset.add(yaw); yaw.add(gltf.scene.clone(true));
        const actual = new Box3().setFromObject(scale, true);
        expect(actual.min.x).toBeCloseTo(-target.width / 2, 7);
        expect(actual.max.x).toBeCloseTo(target.width / 2, 7);
        expect(actual.min.y).toBeCloseTo(0, 7);
        expect(actual.max.y).toBeCloseTo(target.height, 7);
        expect(actual.min.z).toBeCloseTo(-target.depth / 2, 7);
        expect(actual.max.z).toBeCloseTo(target.depth / 2, 7);
      }
      const a = gltf.scene.clone(true), b = gltf.scene.clone(true);
      a.position.x = 100;
      expect(b.position.x).toBe(0);
      const meshes: Mesh[] = []; gltf.scene.traverse(node => { if (node instanceof Mesh) meshes.push(node); });
      expect(meshes.length).toBeGreaterThan(0);
      for (const source of meshes) {
        const clone = a.getObjectByName(source.name) as Mesh;
        expect(clone).not.toBe(source);
        expect(clone.geometry).toBe(source.geometry);
        expect(clone.material).toBe(source.material);
      }
    });
  }
});
