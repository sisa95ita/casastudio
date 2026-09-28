import { builtinFurnitureDefinitions, createFurnitureItemFromDefinition } from "@casastudio/schema";
import { describe, expect, it } from "vitest";
import { demoProjectFixture } from "../../../test/demo-project-fixture";
import { rectangleRoom } from "../../../test/vertical-architecture-fixture";
import { createFurniturePresentation2D } from "../../geometry-2d/presentation/furniture-presentation-model-2d";
import { collectVisibleSceneBounds3D, createArchitecturalScene3DModel, getVisibleLevelReferences3D, projectPointToThree } from "./architectural-scene-3d-model";
import { createFurnitureModels3D, furnitureAssetTransform } from "./furniture-3d-model";
import { furnitureAssetRegistry, resolveFurnitureAsset } from "../assets/furniture-asset-registry";
import { collectArchitecturalSelectionTargets3D, resolveArchitecturalSelection3D } from "../interaction/architectural-selection-3d";
import { createArchitecturalCameraPose3D } from "../camera/architectural-camera-3d";

function fixture() {
  const project = structuredClone(demoProjectFixture);
  project.building.levels = [{ id: "lower-level", name: "Lower", elevation: 0, walls: [], staircases: [], rooms: [rectangleRoom("lower", -500, -500, 500, 500, 0), rectangleRoom("raised", -500, -500, 500, 500, 270)] },
    { id: "upper-level", name: "Upper", elevation: 300, walls: [], staircases: [], rooms: [rectangleRoom("upper", -500, -500, 500, 500, 40)] }];
  project.building.furniture = [createFurnitureItemFromDefinition(builtinFurnitureDefinitions[0]!, { id: "item", roomId: "lower", position: { x: 10, z: 30 } })];
  return project;
}

describe("Furniture resources and physical model", () => {
  it("covers every canonical definition without duplicating semantic defaults", () => {
    const ids = builtinFurnitureDefinitions.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(furnitureAssetRegistry).sort()).toEqual([...ids].sort());
    for (const entry of Object.values(furnitureAssetRegistry)) if (entry) {
      expect(entry.resource).toMatch(/\.glb$/);
      expect(entry.deformation.maxAnisotropy).toBeGreaterThan(1);
      expect(["free-axes", "bounded-proportions"]).toContain(entry.deformation.kind);
      expect(entry.nativeMax.every((value, axis) => value > entry.nativeMin[axis]!)).toBe(true);
    }
    expect(resolveFurnitureAsset("custom:missing")).toBeUndefined();
    expect(resolveFurnitureAsset("toString")).toBeUndefined();
    expect(resolveFurnitureAsset("generic-furniture")).toBeUndefined();
  });

  for (const definition of builtinFurnitureDefinitions) {
    it.each([[1, 1, 1], [1.3, 1, 1], [1, 1.2, 1], [1, 1, 1.4], [1.2, 0.8, 1.1], [20, 0.05, 3]])(
      `${definition.id} preserves effective envelope at scale %s/%s/%s`, (w, d, h) => {
        const project = fixture();
        const item = createFurnitureItemFromDefinition(definition, { id: "item", roomId: "lower", position: { x: 10, z: 30 } });
        item.width *= w; item.depth *= d; item.height *= h;
        project.building.furniture = [item];
        const model = createFurnitureModels3D(project)[0]!;
        expect(model.bounds.size.x).toBeCloseTo(item.width / 100, 10);
        expect(model.bounds.size.z).toBeCloseTo(item.depth / 100, 10);
        expect(model.bounds.size.y).toBeCloseTo(item.height / 100, 10);
        if (w === 20) expect(model.asset).toBeUndefined();
        if (model.asset) {
          const transform = furnitureAssetTransform(model.asset, model);
          expect(transform.scale[0] * (model.asset.nativeMax[0] - model.asset.nativeMin[0])).toBeCloseTo(model.width, 10);
          expect(transform.scale[1] * (model.asset.nativeMax[1] - model.asset.nativeMin[1])).toBeCloseTo(model.height, 10);
          expect(transform.scale[2] * (model.asset.nativeMax[2] - model.asset.nativeMin[2])).toBeCloseTo(model.depth, 10);
        }
      });
  }

  it.each([0, 90, 180, 37, -397, 757])("matches canonical 2D rotation at %s degrees", (rotation) => {
    const project = fixture(); const item = project.building.furniture[0]!; item.rotation = rotation;
    const model = createFurnitureModels3D(project)[0]!;
    const footprint = createFurniturePresentation2D(item).footprint.map((point) => projectPointToThree(point, 0, "cm"));
    expect(model.rotation).toBe(rotation);
    expect(model.bounds.min.x).toBeCloseTo(Math.min(...footprint.map(p => p.x)), 10);
    expect(model.bounds.max.z).toBeCloseTo(Math.max(...footprint.map(p => p.z)), 10);
    expect(model.bounds.center.x).toBeCloseTo(model.position.x, 10);
    expect(model.bounds.center.z).toBeCloseTo(model.position.z, 10);
    // Asymmetric head cue: Project local +Z must point toward normalized Three -Z.
    const angle = rotation * Math.PI / 180;
    expect(-Math.sin(model.yaw)).toBeCloseTo(Math.sin(angle), 10);
    expect(-Math.cos(model.yaw)).toBeCloseTo(-Math.cos(angle), 10);
  });

  it("normalizes a native quarter-turn and offset pivot before canonical instance rotation", () => {
    const native = { ...resolveFurnitureAsset("generic-chair")!, nativeMin: [2, -1, 4] as const, nativeMax: [3, 2, 6] as const, yaw: Math.PI / 2 };
    const transform = furnitureAssetTransform(native, { width: 1.2, depth: 0.8, height: 1.5 });
    expect(transform.scale[0]).toBeCloseTo(0.6);
    expect(transform.scale[1]).toBeCloseTo(0.5);
    expect(transform.scale[2]).toBeCloseTo(0.8);
    expect(transform.offset[0]).toBeCloseTo(-5);
    expect(transform.offset[1]).toBe(1);
    expect(transform.offset[2]).toBeCloseTo(2.5);
  });

  it("places overlapping plan items on independent Room floor tops and derives Level visibility", () => {
    const project = fixture(); const base = project.building.furniture[0]!;
    project.building.furniture.push({ ...base, id: "raised-item", roomId: "raised" }, { ...base, id: "upper-item", roomId: "upper" });
    const before = JSON.stringify(project);
    const scene = createArchitecturalScene3DModel(project);
    const all = scene.levels.flatMap(level => level.furniture);
    expect(all.map(item => item.position.y)).toEqual([0, 2.7, 3.4]);
    expect(all.every(item => item.position.x === 0.1 && item.position.z === -0.3)).toBe(true);
    expect(getVisibleLevelReferences3D(scene, "active", "upper-level").flatMap(level => level.furniture).map(item => item.id)).toEqual(["upper-item"]);
    expect(JSON.stringify(project)).toBe(before);
    expect(base).not.toHaveProperty("levelId"); expect(base).not.toHaveProperty("y");
  });

  it("keeps unknown definitions selectable at exact elevated, rotated bounds and extends camera Fit", () => {
    const project = fixture(); const item = project.building.furniture[0]!;
    Object.assign(item, { definitionId: "custom:unknown", roomId: "raised", rotation: 37, position: { x: 2000, z: 1000 }, height: 800 });
    const scene = createArchitecturalScene3DModel(project);
    const identity = { kind: "furniture" as const, id: item.id, levelId: "lower-level" };
    const selection = resolveArchitecturalSelection3D(scene, identity)!;
    expect(selection.furniture).toMatchObject({ asset: undefined, category: "GENERIC", rotation: 37, position: { y: 2.7 } });
    expect(collectArchitecturalSelectionTargets3D(scene.levels).map(target => target.identity)).toContainEqual(identity);
    const bounds = collectVisibleSceneBounds3D(scene, "all")!;
    expect(bounds.max.x).toBe(selection.furniture!.bounds.max.x);
    expect(bounds.max.y).toBeCloseTo(10.7);
    expect(JSON.stringify(createArchitecturalCameraPose3D(bounds, 1.5))).not.toMatch(/NaN|Infinity/);
  });
});
