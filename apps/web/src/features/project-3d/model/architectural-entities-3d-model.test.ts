import { reverseWallDirection, type Project, type Wall } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { demoProjectFixture } from "../../../test/demo-project-fixture";
import {
  architecturalDoorOpenAngleRadians,
  createArchitecturalScene3DModel,
  createDoor3D,
  createOpeningWorldFrame3D,
  createWall3D,
  createWindow3D,
  type Opening3D,
  type ScenePoint3D
} from "./architectural-scene-3d-model";

describe("architectural Opening entity 3D derivation", () => {
  it("derives one exact world frame from Wall3D origin, u, n, and Opening dimensions", () => {
    const wall = createWall3D(createWall({ end: { x: 300, z: 400 } }), 320, "cm");
    const frame = createOpeningWorldFrame3D(wall, opening({
      offsetFromStart: 1,
      width: 2,
      elevation: 0.9,
      height: 1.2
    }));

    expect(frame.u.x).toBeCloseTo(0.6);
    expect(frame.u.z).toBeCloseTo(-0.8);
    expect(frame.n.x).toBeCloseTo(0.8);
    expect(frame.n.z).toBeCloseTo(0.6);
    expectPointClose(frame.center, { x: 1.2, y: 4.7, z: -1.6 });
    expectPointClose(frame.start, { x: 0.6, y: 4.7, z: -0.8 });
    expectPointClose(frame.end, { x: 1.8, y: 4.7, z: -2.4 });
    expect(frame.v).toEqual({ x: 0, y: 1, z: 0 });
    expect(frame.wallThickness).toBe(0.2);
  });

  it("places START and END hinges at the canonical physical span endpoints", () => {
    const wall = createWall3D(createWall(), 0, "cm");
    const source = opening({ offsetFromStart: 1, width: 0.9, height: 2.1 });

    const start = createDoor3D(wall, source, "START", "LEFT");
    const end = createDoor3D(wall, source, "END", "LEFT");

    expect(start.hinge).toEqual(start.frame.start);
    expect(end.hinge).toEqual(end.frame.end);
    expect(start.hinge.x).toBe(1);
    expect(end.hinge.x).toBe(1.9);
  });

  it("maps LEFT and RIGHT to the established reflected 2D swing convention", () => {
    const wall = createWall3D(createWall(), 0, "cm");
    const source = opening({ offsetFromStart: 1, width: 1, height: 2.1 });

    const left = createDoor3D(wall, source, "START", "LEFT");
    const right = createDoor3D(wall, source, "START", "RIGHT");

    expect(left.leafEnd.z).toBeLessThan(left.hinge.z);
    expect(right.leafEnd.z).toBeGreaterThan(right.hinge.z);
    expect(left.leafEnd.x).toBeCloseTo(right.leafEnd.x);
  });

  it("keeps a fixed hinge, exact leaf width and height, and deterministic 45-degree pose", () => {
    const wall = createWall3D(createWall(), 0, "cm");
    const door = createDoor3D(
      wall,
      opening({ offsetFromStart: 0.5, width: 0.9, height: 2.05 }),
      "END",
      "RIGHT"
    );

    expect(door.openAngleRadians).toBe(architecturalDoorOpenAngleRadians);
    expect(door.openAngleRadians).toBeCloseTo(Math.PI / 4);
    expect(distance3D(door.hinge, door.leafEnd)).toBeCloseTo(0.9);
    expect(door.leaf.width).toBe(0.9);
    expect(door.leaf.height).toBe(2.05);
    expect(door.leaf.center.x).toBeCloseTo((door.hinge.x + door.leafEnd.x) / 2);
    expect(door.leaf.center.z).toBeCloseTo((door.hinge.z + door.leafEnd.z) / 2);
  });

  it("uses the same orthonormal Door construction on an angled Wall", () => {
    const wall = createWall3D(createWall({ end: { x: 300, z: 400 } }), 125, "cm");
    const door = createDoor3D(
      wall,
      opening({ offsetFromStart: 1.25, width: 1.5, height: 2.1 }),
      "START",
      "LEFT"
    );

    expect(distance3D(door.hinge, door.leafEnd)).toBeCloseTo(1.5);
    expect(door.leaf.u.x ** 2 + door.leaf.u.z ** 2).toBeCloseTo(1);
    expect(door.leaf.u.x * door.leaf.n.x + door.leaf.u.z * door.leaf.n.z)
      .toBeCloseTo(0);
    expect(door.hinge.y).toBe(2.3);
  });

  it("preserves the physical Door hinge and leaf pose after canonical Wall reversal", () => {
    const project = createWallOnlyProject(createWall({ openings: [{
      id: "reversible-door",
      type: "DOOR",
      offsetFromStart: 75,
      width: 90,
      height: 210,
      elevation: 0,
      hingeSide: "START",
      swingSide: "LEFT"
    }] }));
    const before = createArchitecturalScene3DModel(project).levels[0]!.walls[0]!.doors[0]!;
    const reversed = reverseWallDirection(project, "wall");
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) return;
    const after = createArchitecturalScene3DModel(reversed.project)
      .levels[0]!.walls[0]!.doors[0]!;

    expect(after.hingeSide).toBe("END");
    expect(after.swingSide).toBe("RIGHT");
    expectPointClose(after.hinge, before.hinge);
    expectPointClose(after.leafEnd, before.leafEnd);
    expectPointClose(after.leaf.center, before.leaf.center);
  });

  it("derives an exact Window footprint, four in-footprint bars, and centered glazing", () => {
    const wall = createWall3D(createWall({ end: { x: 300, z: 400 } }), 300, "cm");
    const window = createWindow3D(wall, opening({
      id: "angled-window",
      offsetFromStart: 1,
      width: 1.5,
      elevation: 0.9,
      height: 1.2
    }));

    expect(window.frame.width).toBe(1.5);
    expect(window.frame.height).toBe(1.2);
    expect(window.frame.elevation).toBe(0.9);
    expect(window.frame.center.y - window.frame.height / 2).toBeCloseTo(3.9);
    expect(window.frameBars).toHaveLength(4);
    for (const bar of window.frameBars) {
      const along = projectAlong(window.frame.center, bar.center, window.frame.u);
      expect(Math.abs(along) + bar.width / 2)
        .toBeLessThanOrEqual(window.frame.width / 2 + 1e-12);
      expect(Math.abs(bar.center.y - window.frame.center.y) + bar.height / 2)
        .toBeLessThanOrEqual(window.frame.height / 2 + 1e-12);
      expect(bar.depth).toBeLessThanOrEqual(window.frame.wallThickness);
    }
    expect(window.glazing.center).toEqual(window.frame.center);
    expect(window.glazing.width).toBeLessThan(window.frame.width);
    expect(window.glazing.height).toBeLessThan(window.frame.height);
    expect(window.glazing.thickness).toBeGreaterThan(0);
  });

  it("derives mixed Opening kinds independently and keeps OPENING as an empty passage", () => {
    const wall = createWall3D(createWall({ openings: [
      { id: "door", type: "DOOR", offsetFromStart: 25, width: 75, height: 210, elevation: 0, hingeSide: "END", swingSide: "RIGHT" },
      { id: "window", type: "WINDOW", offsetFromStart: 125, width: 75, height: 100, elevation: 100 },
      { id: "passage", type: "OPENING", offsetFromStart: 225, width: 100, height: 220, elevation: 0 }
    ] }), 0, "cm");

    expect(wall.doors.map((entity) => entity.id)).toEqual(["door"]);
    expect(wall.windows.map((entity) => entity.id)).toEqual(["window"]);
    expect(wall.wallOpenings.map((entity) => entity.id)).toEqual(["passage"]);
    expect(wall.wallOpenings[0]).not.toHaveProperty("leaf");
    expect(wall.wallOpenings[0]).not.toHaveProperty("glazing");
    expect(wall.openings).toHaveLength(3);
    expect(wall.sections.some((section) =>
      section.start <= 2.75 && section.end >= 2.75 &&
      section.bottom <= 1 && section.top >= 1
    )).toBe(false);
  });

  it("includes a partially-open Door leaf in true scene bounds", () => {
    const project = createWallOnlyProject(createWall({ openings: [{
      id: "bounds-door",
      type: "DOOR",
      offsetFromStart: 100,
      width: 100,
      height: 210,
      elevation: 0,
      hingeSide: "START",
      swingSide: "LEFT"
    }] }));
    const model = createArchitecturalScene3DModel(project);

    expect(model.bounds!.min.z).toBeLessThan(-0.7);
    expect(model.bounds!.max.y).toBe(3);
  });

  it("keeps every entity contract transitively immutable", () => {
    const wall = createWall3D(createWall({ openings: [{
      id: "door",
      type: "DOOR",
      offsetFromStart: 50,
      width: 90,
      height: 210,
      elevation: 0
    }] }), 0, "cm");
    const door = wall.doors[0]!;

    expect(Object.isFrozen(wall.doors)).toBe(true);
    expect(Object.isFrozen(door)).toBe(true);
    expect(Object.isFrozen(door.frame)).toBe(true);
    expect(Object.isFrozen(door.leaf)).toBe(true);
    expect(Object.isFrozen(door.leaf.center)).toBe(true);
  });
});

function createWall(overrides: Partial<Wall> = {}): Wall {
  return {
    id: "wall",
    start: { x: 0, z: 0 },
    end: { x: 400, z: 0 },
    height: 300,
    thickness: 20,
    roomIds: [],
    openings: [],
    ...overrides
  };
}

function opening(overrides: Partial<Opening3D> = {}): Opening3D {
  return {
    id: "opening",
    kind: "DOOR",
    offsetFromStart: 1,
    width: 1,
    elevation: 0,
    height: 2,
    ...overrides
  };
}

function createWallOnlyProject(wall: Wall): Project {
  const project = structuredClone(demoProjectFixture);
  project.building.levels = [{
    ...project.building.levels[0]!,
    rooms: [],
    walls: [wall],
    staircases: []
  }];
  return project;
}

function distance3D(first: ScenePoint3D, second: ScenePoint3D): number {
  return Math.hypot(second.x - first.x, second.y - first.y, second.z - first.z);
}

function expectPointClose(actual: ScenePoint3D, expected: ScenePoint3D): void {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.z).toBeCloseTo(expected.z);
}

function projectAlong(
  origin: ScenePoint3D,
  point: ScenePoint3D,
  axis: Readonly<{ x: number; z: number }>
): number {
  return (point.x - origin.x) * axis.x + (point.z - origin.z) * axis.z;
}
