import { describe, expect, it } from "vitest";
import {
  builtinFurnitureDefinitions,
  createFurnitureItemFromDefinition
} from "@casastudio/schema";
import {
  createFurniturePlan2D,
  createFurniturePresentation2D
} from "./furniture-presentation-model-2d";
import { furnitureProjectFixture } from "../../../test/furniture-project-fixture";

describe("Furniture presentation", () => {
  const item = createFurnitureItemFromDefinition(
    builtinFurnitureDefinitions[2]!,
    { id: "sofa", roomId: "living", position: { x: 100, z: 100 } }
  );
  it("builds centered effective footprints and arbitrary positive-Y rotation", () => {
    const model = createFurniturePresentation2D({
      ...item,
      width: 240,
      depth: 100
    });
    expect(model.footprint).toEqual([
      { x: -20, z: 50 },
      { x: 220, z: 50 },
      { x: 220, z: 150 },
      { x: -20, z: 150 }
    ]);
    const rotated = createFurniturePresentation2D({ ...item, rotation: 37 });
    expect(rotated.footprint[0]!.x).toBeCloseTo(
      100 -
        100 * Math.cos((37 * Math.PI) / 180) -
        45 * Math.sin((37 * Math.PI) / 180)
    );
    expect(rotated.footprint[0]!.z).toBeCloseTo(
      100 +
        100 * Math.sin((37 * Math.PI) / 180) -
        45 * Math.cos((37 * Math.PI) / 180)
    );
    expect(Object.isFrozen(rotated.footprint[0])).toBe(true);
  });
  it("provides distinct semantic vector templates and unknown definition fallback", () => {
    for (const definition of builtinFurnitureDefinitions) {
      const model = createFurniturePresentation2D({
        ...item,
        definitionId: definition.id
      });
      expect(model.category).toBe(definition.category);
      expect(model.lines.length > 0).toBe(definition.category !== "GENERIC");
    }
    const fallback = createFurniturePresentation2D({
      ...item,
      definitionId: "unknown:chair",
      rotation: 41,
      width: 80
    });
    expect(fallback).toMatchObject({
      category: "GENERIC",
      width: 80,
      rotation: 41,
      definitionId: "unknown:chair"
    });
    expect(fallback.lines).toEqual([]);
  });
  it("derives Level through Room and keeps deterministic persisted overlap order", () => {
    const project = furnitureProjectFixture();
    project.building.furniture = [
      item,
      { ...item, id: "desk", roomId: "study", definitionId: "generic-desk" }
    ];
    expect(
      createFurniturePlan2D(project, "ground").map((entry) => entry.id)
    ).toEqual(["sofa", "desk"]);
    expect(createFurniturePlan2D(project, "absent")).toEqual([]);
  });
});
