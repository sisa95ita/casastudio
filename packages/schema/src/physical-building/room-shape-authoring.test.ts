import { describe, expect, it } from "vitest";

import type { Project } from "../project/index.js";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  ValidationErrorCode
} from "../validation/index.js";
import {
  createRoomFromShape,
  deriveRoomShapeVertices,
  validateRoomShapeDefinition,
  type RoomShapeDefinition
} from "./room-shape-authoring.js";

describe("Room shape authoring", () => {
  it("creates one exact reciprocal rectangular Room without mutating its source", () => {
    const project = createEmptyProject();
    const before = structuredClone(project);
    const result = commit(project, {
      kind: "RECTANGLE",
      dimensions: { width: 400, depth: 300 }
    });

    expect(result.ok).toBe(true);
    expect(project).toEqual(before);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.walls).toHaveLength(4);
    expect(level.rooms).toHaveLength(1);
    expect(level.walls.map((wall) => wall.roomIds)).toEqual([
      ["shape-room"], ["shape-room"], ["shape-room"], ["shape-room"]
    ]);
    expect(level.rooms[0]!.boundary).toEqual(level.walls.map((wall) => ({
      wallId: wall.id,
      direction: "FORWARD"
    })));
    expect(measure(level.walls.map((wall) => wall.start))).toEqual({
      area: 120_000,
      perimeter: 1_400
    });
    expectCanonicalProject(result.project);
    expect(Object.keys(level.rooms[0]!)).toEqual(["id", "name", "type", "boundary"]);
  });

  it("creates one exact six-segment top-right-notched L-shaped Room", () => {
    const result = commit(createEmptyProject(), {
      kind: "L_SHAPE",
      dimensions: {
        width: 500,
        depth: 400,
        notchWidth: 200,
        notchDepth: 150
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.walls).toHaveLength(6);
    expect(level.rooms[0]!.boundary).toHaveLength(6);
    expect(level.walls.every((wall) => wall.height === 300 && wall.thickness === 20))
      .toBe(true);
    expect(measure(level.walls.map((wall) => wall.start))).toEqual({
      area: 170_000,
      perimeter: 1_800
    });
    expectCanonicalProject(result.project);
  });

  it("rejects invalid dimensions and a stale non-empty Level atomically", () => {
    const project = createEmptyProject();
    const invalidDefinitions: RoomShapeDefinition[] = [
      { kind: "RECTANGLE", dimensions: { width: 0, depth: 300 } },
      {
        kind: "L_SHAPE",
        dimensions: { width: 500, depth: 400, notchWidth: 500, notchDepth: 100 }
      },
      {
        kind: "L_SHAPE",
        dimensions: { width: 500, depth: 400, notchWidth: 100, notchDepth: 400 }
      }
    ];
    for (const definition of invalidDefinitions) {
      expect(validateRoomShapeDefinition(definition)).toBe(false);
      expect(commit(project, definition)).toMatchObject({
        ok: false,
        errors: [{ code: ValidationErrorCode.INVALID_ROOM_BOUNDARY }]
      });
    }
    expect(project.building.levels[0]!.walls).toEqual([]);

    const committed = commit(project, {
      kind: "RECTANGLE",
      dimensions: { width: 400, depth: 300 }
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    const staleBefore = structuredClone(committed.project);
    expect(commit(committed.project, {
      kind: "RECTANGLE",
      dimensions: { width: 200, depth: 200 }
    })).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.STALE_ROOM_TOPOLOGY }]
    });
    expect(committed.project).toEqual(staleBefore);
  });

  it("derives deterministic top-left-anchored vertices", () => {
    expect(deriveRoomShapeVertices(
      { x: 25, z: 75 },
      { kind: "RECTANGLE", dimensions: { width: 40, depth: 30 } }
    )).toEqual([
      { x: 25, z: 75 },
      { x: 25, z: 45 },
      { x: 65, z: 45 },
      { x: 65, z: 75 }
    ]);
  });

  it("rotates rectangular and L-shaped footprints in deterministic quarter turns", () => {
    const rectangle = { kind: "RECTANGLE" as const, dimensions: { width: 40, depth: 30 } };
    expect(deriveRoomShapeVertices({ x: 0, z: 0 }, { ...rectangle, rotation: 90 })).toEqual([
      { x: 0, z: -40 }, { x: 30, z: -40 }, { x: 30, z: 0 }, { x: 0, z: 0 }
    ]);
    expect(deriveRoomShapeVertices({ x: 0, z: 0 }, { ...rectangle, rotation: 180 })).toEqual([
      { x: 40, z: -30 }, { x: 40, z: 0 }, { x: 0, z: 0 }, { x: 0, z: -30 }
    ]);
    expect(deriveRoomShapeVertices({ x: 0, z: 0 }, { ...rectangle, rotation: 270 })).toEqual([
      { x: 30, z: 0 }, { x: 0, z: 0 }, { x: 0, z: -40 }, { x: 30, z: -40 }
    ]);
    const lShape = { kind: "L_SHAPE" as const, dimensions: { width: 50, depth: 40, notchWidth: 20, notchDepth: 15 }, rotation: 90 as const };
    expect(deriveRoomShapeVertices({ x: 0, z: 0 }, lShape)).toHaveLength(6);
    expect(validateRoomShapeDefinition(lShape)).toBe(true);
  });

  it("commits rotated shapes without persisting rotation metadata", () => {
    const result = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 400, depth: 300 },
      rotation: 90
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]!.walls).toHaveLength(4);
    expect(JSON.stringify(result.project)).not.toContain("rotation");
    expectCanonicalProject(result.project);
  });
});

function commit(project: Project, shape: RoomShapeDefinition) {
  const wallCount = shape.kind === "RECTANGLE" ? 4 : 6;
  return createRoomFromShape(project, {
    levelId: "ground-level",
    origin: { x: 25, z: 475 },
    shape,
    room: { id: "shape-room", name: "Room 1", type: "OTHER" },
    wallIds: Array.from({ length: wallCount }, (_, index) => `shape-wall-${index + 1}`),
    wallHeight: 300,
    wallThickness: 20
  });
}

function measure(vertices: readonly { readonly x: number; readonly z: number }[]) {
  let twiceArea = 0;
  let perimeter = 0;
  vertices.forEach((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length]!;
    twiceArea += vertex.x * next.z - next.x * vertex.z;
    perimeter += Math.hypot(next.x - vertex.x, next.z - vertex.z);
  });
  return { area: twiceArea / 2, perimeter };
}

function expectCanonicalProject(project: Project) {
  expect(validateProjectCrossReferences(project).valid).toBe(true);
  expect(validateProjectReferenceConsistency(project).valid).toBe(true);
  expect(validateProjectGeometry(project).valid).toBe(true);
}

function createEmptyProject(): Project {
  return {
    id: "shape-authoring-project",
    name: "Shape Authoring Project",
    schemaVersion: "2.0.0",
    revision: 1,
    createdAt: "2026-08-26T10:00:00+02:00",
    updatedAt: "2026-08-26T10:00:00+02:00",
    units: { length: "cm", angle: "deg" },
    building: {
      id: "building",
      name: "Building",
      type: "HOUSE",
      levels: [{
        id: "ground-level",
        name: "Ground Floor",
        elevation: 0,
        rooms: [],
        walls: [],
        staircases: []
      }]
    },
    viewpoints: [],
    baseImages: [],
    designBriefs: [],
    renderRequests: [],
    renderResults: []
  };
}
