import { deriveBoundedFaces, type Project } from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { GeometryEngine } from "./geometry-engine.js";
import { measureLevel } from "./architectural-measurements.js";

const project: Project = {
  id: "elevated-room-geometry",
  name: "Elevated room geometry",
  schemaVersion: "3.0.0",
  revision: 1,
  createdAt: "2026-09-04T10:00:00+02:00",
  updatedAt: "2026-09-04T10:00:00+02:00",
  units: { length: "cm", angle: "deg" },
  building: {
    id: "building",
    name: "Building",
    type: "OTHER",
    levels: [{
      id: "level",
      name: "Level",
      elevation: 0,
      rooms: [{
        id: "lower-room",
        name: "Lower Room",
        type: "LIVING_ROOM",
        boundary: ["south", "east", "north", "west"].map((wallId) => ({
          wallId,
          direction: "FORWARD" as const
        }))
      }, {
        id: "elevated-room",
        name: "Elevated Room",
        type: "STUDIO",
        elevation: 200,
        boundary: freeLoop([
          { x: 200, z: 0 },
          { x: 200, z: -250 },
          { x: 400, z: -250 },
          { x: 400, z: 0 }
        ])
      }],
      walls: [
        wall("south", 0, 0, 0, -300),
        wall("east", 0, -300, 400, -300),
        wall("north", 400, -300, 400, 0),
        wall("west", 400, 0, 0, 0)
      ],
      staircases: []
    }]
  },
  viewpoints: [],
  baseImages: [],
  designBriefs: [],
  renderRequests: [],
  renderResults: []
};

describe("elevated Room geometry", () => {
  it("builds overlapping lower and elevated polygons independently", () => {
    const result = GeometryEngine.build(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const polygons = new Map(result.model.levels[0]!.polygons.map((polygon) => [polygon.sourceRoomId, polygon]));
    expect(polygons.get("lower-room")).toMatchObject({ area: 120_000, floorElevation: 0 });
    expect(polygons.get("elevated-room")).toMatchObject({ area: 50_000, floorElevation: 200 });
    expect(polygons.get("lower-room")!.bounds).toEqual({ minX: 0, minZ: -300, maxX: 400, maxZ: 0 });
    expect(polygons.get("elevated-room")!.bounds).toEqual({ minX: 200, minZ: -250, maxX: 400, maxZ: 0 });
  });

  it("counts both walkable surfaces while wall-face discovery ignores free edges", () => {
    expect(measureLevel(project.building.levels[0]!).totalRoomArea).toBe(170_000);
    expect(deriveBoundedFaces(project, "level")).toHaveLength(1);
    expect(deriveBoundedFaces(project, "level")[0]!.area).toBe(120_000);
  });

  it("reconstructs a mixed Wall/free boundary in exact persisted order", () => {
    const mixedProject = structuredClone(project);
    const level = mixedProject.building.levels[0]!;
    level.rooms = [{
      id: "mixed-room",
      name: "Mixed Room",
      type: "OTHER",
      elevation: 220,
      boundary: [
        { wallId: "mixed-west", direction: "REVERSE" },
        { kind: "FREE", start: { x: 100, z: -200 }, end: { x: 300, z: -200 } },
        { kind: "FREE", start: { x: 300, z: -200 }, end: { x: 300, z: 0 } },
        { wallId: "mixed-north", direction: "FORWARD" }
      ]
    }];
    level.walls = [
      wallForRoom("mixed-west", "mixed-room", 100, -200, 100, 0),
      wallForRoom("mixed-north", "mixed-room", 300, 0, 100, 0)
    ];

    const result = GeometryEngine.build(mixedProject);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const polygon = result.model.levels[0]!.polygons[0]!;
    expect(polygon.outerLoop.edgeUses.map((use) => use.boundaryEdge.sourceKind)).toEqual([
      "WALL", "FREE", "FREE", "WALL"
    ]);
    expect(polygon.outerLoop.vertices.map((vertex) => ({ x: vertex.x, z: vertex.z }))).toEqual([
      { x: 100, z: 0 },
      { x: 100, z: -200 },
      { x: 300, z: -200 },
      { x: 300, z: 0 }
    ]);
    expect(polygon).toMatchObject({ area: 40_000, floorElevation: 220 });
    expect(deriveBoundedFaces(mixedProject, "level")).toEqual([]);
  });
});

function wall(id: string, startX: number, startZ: number, endX: number, endZ: number) {
  return {
    id,
    start: { x: startX, z: startZ },
    end: { x: endX, z: endZ },
    height: 300,
    thickness: 20,
    roomIds: ["lower-room"],
    openings: []
  };
}

function wallForRoom(
  id: string,
  roomId: string,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number
) {
  return { ...wall(id, startX, startZ, endX, endZ), roomIds: [roomId] };
}

function freeLoop(points: readonly { readonly x: number; readonly z: number }[]) {
  return points.map((start, index) => ({
    kind: "FREE" as const,
    start,
    end: points[(index + 1) % points.length]!
  }));
}
