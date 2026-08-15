import {
  createConnectedWall,
  type Project,
  type Room,
  type Wall
} from "@casastudio/schema";
import { describe, expect, it } from "vitest";

import { GeometryEngine } from "./geometry-engine.js";

describe("topology-aware editing integration", () => {
  it("derives one shared runtime Vertex from exact connected Wall endpoints", () => {
    const project = createProject([
      wall("wall-ab", 0, 0, 100, 0)
    ]);
    const result = createConnectedWall(project, {
      levelId: "ground-floor",
      wall: wall("wall-bc", 100, 0, 100, 100)
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const geometry = GeometryEngine.build(result.project);
    expect(geometry.ok).toBe(true);
    if (!geometry.ok) return;
    const level = geometry.model.levels[0]!;
    const junction = level.vertices.find(
      (vertex) => vertex.x === 100 && vertex.z === 0
    );
    expect(level.vertices).toHaveLength(3);
    expect(junction?.incidentEdges.map((edge) => edge.sourceWallId).sort()).toEqual([
      "wall-ab",
      "wall-bc"
    ]);
  });

  it("splits opposite Room boundaries, connects the junctions, and preserves one explicit Room", () => {
    const project = createRectangleProject();
    const result = createConnectedWall(project, {
      levelId: "ground-floor",
      wall: wall("partition", 50, 0, 50, 100),
      startConnection: { wallId: "south", newWallId: "south-second" },
      endConnection: { wallId: "north", newWallId: "north-second" }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sourceLevel = result.project.building.levels[0]!;
    expect(sourceLevel.rooms).toHaveLength(1);
    expect(sourceLevel.rooms[0]?.boundary.map((edge) => edge.wallId)).toEqual([
      "south",
      "south-second",
      "east",
      "north",
      "north-second",
      "west"
    ]);
    expect(sourceLevel.rooms[0]?.boundary).not.toContainEqual(
      expect.objectContaining({ wallId: "partition" })
    );

    const geometry = GeometryEngine.build(result.project);
    expect(geometry.ok).toBe(true);
    if (!geometry.ok) return;
    const level = geometry.model.levels[0]!;
    expect(level.polygons).toHaveLength(1);
    expect(level.polygons[0]?.sourceRoomId).toBe("room");
    expect(level.polygons[0]?.area).toBe(10_000);
    expect(level.boundaryEdges).toHaveLength(7);
    expect(
      level.vertices.find((vertex) => vertex.x === 50 && vertex.z === 0)
        ?.incidentEdges
    ).toHaveLength(3);
    expect(
      level.vertices.find((vertex) => vertex.x === 50 && vertex.z === 100)
        ?.incidentEdges
    ).toHaveLength(3);
  });
});

function createRectangleProject(): Project {
  const roomIds = ["room"];
  return createProject(
    [
      wall("south", 0, 0, 100, 0, roomIds),
      wall("east", 100, 0, 100, 100, roomIds),
      wall("north", 100, 100, 0, 100, roomIds),
      wall("west", 0, 100, 0, 0, roomIds)
    ],
    [
      {
        id: "room",
        name: "Room",
        type: "OTHER",
        boundary: ["south", "east", "north", "west"].map((wallId) => ({
          wallId,
          direction: "FORWARD" as const
        }))
      }
    ]
  );
}

function wall(
  id: string,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  roomIds: string[] = []
): Wall {
  return {
    id,
    start: { x: startX, z: startZ },
    end: { x: endX, z: endZ },
    height: 280,
    thickness: 18,
    roomIds,
    openings: []
  };
}

function createProject(walls: Wall[], rooms: Room[] = []): Project {
  return {
    id: "geometry-topology-project",
    name: "Geometry Topology Project",
    schemaVersion: "2.0.0",
    revision: 3,
    createdAt: "2026-08-13T08:00:00.000Z",
    updatedAt: "2026-08-13T08:30:00.000Z",
    units: { length: "cm", angle: "deg" },
    building: {
      id: "building",
      name: "Building",
      type: "HOUSE",
      levels: [
        {
          id: "ground-floor",
          name: "Ground Floor",
          elevation: 0,
          rooms,
          walls,
          staircases: []
        }
      ]
    },
    viewpoints: [],
    baseImages: [],
    designBriefs: [],
    renderRequests: [],
    renderResults: []
  };
}
