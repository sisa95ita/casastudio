import type { Project } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { demoProjectFixture } from "../test/demo-project-fixture";
import {
  collectVisibleSceneBounds3D,
  createArchitecturalScene3DModel,
  getLevelReferenceOrientation3D,
  getVisibleLevelReferences3D,
  projectPointToThree,
  toThreeLength
} from "./architectural-scene-3d-model";

describe("architectural 3D presentation model", () => {
  it("converts canonical centimeters and explicit meters to meter-scaled world lengths", () => {
    expect(toThreeLength(100, "cm")).toBe(1);
    expect(toThreeLength(250, "cm")).toBe(2.5);
    expect(toThreeLength(2.5, "m")).toBe(2.5);
  });

  it("maps Project plan axes to the 2D-aligned Three convention and elevation to Y", () => {
    expect(projectPointToThree({ x: 250, z: -125 }, 320, "cm")).toEqual({
      x: 2.5,
      y: 3.2,
      z: 1.25
    });
  });

  it("derives a deliberately asymmetric footprint through one plan-axis boundary", () => {
    const project = createAsymmetricProject();
    const sourcePoints = project.building.levels[0]!.walls.map((wall) => wall.start);
    const model = createArchitecturalScene3DModel(project);
    const level = model.levels[0]!;
    const derivedPoints = level.segments.map((segment) => segment.start);

    expect(signedArea(sourcePoints)).toBeGreaterThan(0);
    expect(signedArea(derivedPoints)).toBeLessThan(0);
    expect(level.segments[0]?.start.x).toBeLessThan(model.bounds!.center.x);
    expect(level.segments[0]?.start.z).toBe(4);
    expect(level.y).toBe(2.75);
    expect(getLevelReferenceOrientation3D(level)).toBe("clockwise");
  });

  it("derives immutable bounds from canonical wall endpoints", () => {
    const model = createArchitecturalScene3DModel(demoProjectFixture);

    expect(model.worldLengthUnit).toBe("m");
    expect(model.hasArchitecturalGeometry).toBe(true);
    expect(model.bounds).toEqual({
      min: { x: 0, y: 0, z: -3 },
      max: { x: 8, y: 0, z: 0 },
      center: { x: 4, y: 0, z: -1.5 },
      size: { x: 8, y: 0, z: 3 }
    });
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.levels[0]?.segments)).toBe(true);
  });

  it("returns no physical bounds for an empty Project", () => {
    const project = structuredClone(demoProjectFixture);
    project.building.levels = project.building.levels.map((level) => ({
      ...level,
      walls: [],
      rooms: [],
      staircases: []
    }));

    const model = createArchitecturalScene3DModel(project);

    expect(model.hasArchitecturalGeometry).toBe(false);
    expect(model.bounds).toBeUndefined();
    expect(model.levels[0]?.segments).toEqual([]);
  });

  it("uses actual multi-Level elevations in vertical scene bounds", () => {
    const project = createMultiLevelProject();
    const model = createArchitecturalScene3DModel(project);

    expect(model.levels.map((level) => level.y)).toEqual([-0.5, 0, 3.2]);
    expect(model.bounds?.min.y).toBe(-0.5);
    expect(model.bounds?.max.y).toBe(3.2);
    expect(model.bounds?.size.y).toBe(3.7);
  });

  it("filters Active Level references and refits only visible physical content", () => {
    const model = createArchitecturalScene3DModel(createMultiLevelProject());

    expect(getVisibleLevelReferences3D(model, "all", "level-upper")).toHaveLength(3);
    expect(getVisibleLevelReferences3D(model, "active", "level-upper").map((level) => level.id))
      .toEqual(["level-upper"]);
    expect(collectVisibleSceneBounds3D(model, "active", "level-upper")).toMatchObject({
      min: { y: 3.2 },
      max: { y: 3.2 },
      size: { y: 0 }
    });
    expect(getVisibleLevelReferences3D(model, "active", "missing")).toEqual([]);
    expect(collectVisibleSceneBounds3D(model, "active", "missing")).toBeUndefined();
  });
});

function createMultiLevelProject(): Project {
  const project = structuredClone(demoProjectFixture);
  const ground = project.building.levels[0]!;
  project.building.levels = [
    { ...structuredClone(ground), id: "level-lower", name: "Lower", elevation: -50 },
    { ...structuredClone(ground), id: "level-ground", name: "Ground", elevation: 0 },
    { ...structuredClone(ground), id: "level-upper", name: "Upper", elevation: 320 }
  ];
  return project;
}

function createAsymmetricProject(): Project {
  const project = structuredClone(demoProjectFixture);
  const points = [
    { x: 0, z: -400 },
    { x: 600, z: -400 },
    { x: 600, z: -100 },
    { x: 400, z: -100 },
    { x: 400, z: 0 },
    { x: 0, z: 0 }
  ];
  project.building.levels = [{
    ...project.building.levels[0]!,
    elevation: 275,
    rooms: [],
    staircases: [],
    walls: points.map((start, index) => ({
      id: `asymmetric-wall-${index}`,
      start,
      end: points[(index + 1) % points.length]!,
      height: 280,
      thickness: 18,
      roomIds: [],
      openings: []
    }))
  }];
  return project;
}

function signedArea(points: readonly { readonly x: number; readonly z: number }[]) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return area + point.x * next.z - next.x * point.z;
  }, 0) / 2;
}
