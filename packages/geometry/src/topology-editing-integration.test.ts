import {
  createConnectedWall,
  createRoom,
  classifyLevelRoomTopology,
  discoverRoomCandidates,
  moveJunction,
  partitionRoom,
  reconcileRoomSubdivision,
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

  it("builds explicit candidate Rooms and coherent partition polygons", () => {
    const empty = createProject([
      wall("south", 0, 0, 100, 0),
      wall("east", 100, 0, 100, 100),
      wall("north", 100, 100, 0, 100),
      wall("west", 0, 100, 0, 0)
    ]);
    const candidate = discoverRoomCandidates(empty, "ground-floor")[0]!;
    const created = createRoom(empty, {
      levelId: "ground-floor",
      room: { id: "room", name: "Room", type: "OTHER", boundary: [...candidate.boundary] }
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(GeometryEngine.build(created.project)).toMatchObject({ ok: true });

    const connected = createConnectedWall(created.project, {
      levelId: "ground-floor",
      wall: wall("partition", 50, 0, 50, 100),
      startConnection: { wallId: "south", newWallId: "south-second" },
      endConnection: { wallId: "north", newWallId: "north-second" }
    });
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;
    const partitioned = partitionRoom(connected.project, {
      levelId: "ground-floor",
      roomId: "room",
      partitionWallId: "partition",
      newRoom: { id: "room-two", name: "Room Two", type: "OTHER" }
    });
    expect(partitioned.ok).toBe(true);
    if (!partitioned.ok) return;
    const geometry = GeometryEngine.build(partitioned.project);
    expect(geometry.ok).toBe(true);
    if (!geometry.ok) return;
    expect(geometry.model.levels[0]?.polygons.map((polygon) => polygon.area)).toEqual([5_000, 5_000]);
    expect(
      geometry.model.levels[0]?.boundaryEdges.find((edge) => edge.sourceWallId === "partition")
    ).toBeDefined();
  });

  it("rebuilds one shared runtime junction after a semantic junction move", () => {
    const project = createRectangleProject();
    const connected = createConnectedWall(project, {
      levelId: "ground-floor",
      wall: wall("partition", 50, 0, 50, 100),
      startConnection: { wallId: "south", newWallId: "south-second" },
      endConnection: { wallId: "north", newWallId: "north-second" }
    });
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;
    const moved = moveJunction(connected.project, {
      levelId: "ground-floor",
      position: { x: 50, z: 0 },
      destination: { x: 40, z: 10 },
      incidentWallIds: ["south", "south-second", "partition"]
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    const geometry = GeometryEngine.build(moved.project);
    expect(geometry.ok).toBe(true);
    if (!geometry.ok) return;
    const junction = geometry.model.levels[0]?.vertices.find(
      (vertex) => vertex.x === 40 && vertex.z === 10
    );
    expect(junction?.incidentEdges).toHaveLength(3);
    expect(geometry.model.levels[0]?.polygons[0]?.area).toBe(9_500);
  });

  it("builds distinct polygons and centroids from a multi-Wall Room reconciliation", () => {
    const project = createMultiWallPartitionProject();
    project.building.levels[0]!.walls.find((wall) => wall.id === "north")!.openings.push({
      id: "outer-door",
      type: "DOOR",
      offsetFromStart: 10,
      width: 20,
      height: 200,
      elevation: 0,
      connectedRoomIds: ["room"]
    });
    project.viewpoints.push({
      id: "upper-view",
      levelId: "ground-floor",
      roomId: "room",
      cameraPosition: { x: 80, y: 160, z: 90 },
      cameraTarget: { x: 60, y: 100, z: 80 },
      fieldOfView: 60,
      projection: "PERSPECTIVE"
    });
    const subdivision = classifyLevelRoomTopology(project, "ground-floor").subdivisions[0]!;
    expect(subdivision.faces).toHaveLength(2);
    expect(subdivision.faces.every((face) =>
      ["path-one", "path-two", "path-three"].every((wallId) =>
        face.boundary.some((edge) => edge.wallId === wallId)
      )
    )).toBe(true);
    const reconciled = reconcileRoomSubdivision(project, {
      levelId: "ground-floor",
      roomId: "room",
      expectedFaceKeys: subdivision.faces.map((face) => face.key),
      newRoomAssignments: subdivision.faces
        .filter((face) => face.key !== subdivision.preservedFaceKey)
        .map((face) => ({
          faceKey: face.key,
          room: { id: "room-two", name: "Room Two", type: "OTHER" }
        }))
    });
    expect(reconciled.ok).toBe(true);
    if (!reconciled.ok) return;
    const sourceLevel = reconciled.project.building.levels[0]!;
    const sourceRoomsById = new Map(sourceLevel.rooms.map((room) => [room.id, room]));
    const faceRoomIds = new Map(
      subdivision.faces.map((face) => [
        face.key,
        face.key === subdivision.preservedFaceKey ? "room" : "room-two"
      ])
    );
    for (const face of subdivision.faces) {
      expect(sourceRoomsById.get(faceRoomIds.get(face.key)!)?.boundary).toEqual(face.boundary);
    }
    expect(sourceRoomsById.get("room")?.boundary).toEqual([
      { wallId: "east", direction: "FORWARD" },
      { wallId: "path-three", direction: "REVERSE" },
      { wallId: "path-two", direction: "REVERSE" },
      { wallId: "path-one", direction: "REVERSE" },
      { wallId: "west-lower", direction: "FORWARD" },
      { wallId: "south", direction: "FORWARD" }
    ]);
    expect(sourceRoomsById.get("room-two")?.boundary).toEqual([
      { wallId: "east-upper", direction: "FORWARD" },
      { wallId: "north", direction: "FORWARD" },
      { wallId: "west", direction: "FORWARD" },
      { wallId: "path-one", direction: "FORWARD" },
      { wallId: "path-two", direction: "FORWARD" },
      { wallId: "path-three", direction: "FORWARD" }
    ]);
    for (const wallId of ["path-one", "path-two", "path-three"]) {
      expect(sourceLevel.walls.find((wall) => wall.id === wallId)?.roomIds).toEqual([
        "room",
        "room-two"
      ]);
    }
    expect(sourceLevel.walls.find((wall) => wall.id === "east")?.roomIds).toEqual(["room"]);
    expect(sourceLevel.walls.find((wall) => wall.id === "east-upper")?.roomIds).toEqual(["room-two"]);
    expect(sourceLevel.walls.find((wall) => wall.id === "west")?.roomIds).toEqual(["room-two"]);
    expect(sourceLevel.walls.find((wall) => wall.id === "west-lower")?.roomIds).toEqual(["room"]);
    expect(reconciled.project.building.levels[0]?.walls.find((wall) => wall.id === "north")?.openings[0])
      .toMatchObject({ connectedRoomIds: ["room-two"] });
    expect(reconciled.project.viewpoints[0]?.roomId).toBe("room-two");
    const geometry = GeometryEngine.build(reconciled.project);
    expect(geometry.ok).toBe(true);
    if (!geometry.ok) return;
    const level = geometry.model.levels[0]!;
    expect(level.polygons.map((polygon) => polygon.area).sort((a, b) => a - b)).toEqual([
      3_800, 6_200
    ]);
    expect(new Set(level.polygons.map((polygon) => `${polygon.centroid.x}:${polygon.centroid.z}`)).size)
      .toBe(2);
    const centroids = [...level.polygons].sort((first, second) => first.centroid.z - second.centroid.z)
      .map((polygon) => polygon.centroid);
    expect(centroids[0]?.x).toBeCloseTo(53.8709677419);
    expect(centroids[0]?.z).toBeCloseTo(31.7741935484);
    expect(centroids[1]?.x).toBeCloseTo(43.6842105263);
    expect(centroids[1]?.z).toBeCloseTo(79.7368421053);
    expect(level.boundaryEdges.filter((edge) => edge.sourceWallId === "path-two")).toHaveLength(1);
    const polygonsByRoomId = new Map(level.polygons.map((polygon) => [polygon.sourceRoomId, polygon]));
    expect(polygonsByRoomId.get("room")?.edgeUses.map((edgeUse) => ({
      wallId: edgeUse.boundaryEdge.sourceWallId,
      direction: edgeUse.direction
    }))).toEqual(sourceRoomsById.get("room")?.boundary);
    expect(polygonsByRoomId.get("room-two")?.edgeUses.map((edgeUse) => ({
      wallId: edgeUse.boundaryEdge.sourceWallId,
      direction: edgeUse.direction
    }))).toEqual(sourceRoomsById.get("room-two")?.boundary);
    expect(polygonsByRoomId.get("room")?.vertices.map((vertex) => ({ x: vertex.x, z: vertex.z })))
      .toEqual([
        { x: 100, z: 0 },
        { x: 100, z: 70 },
        { x: 40, z: 70 },
        { x: 40, z: 50 },
        { x: 0, z: 50 },
        { x: 0, z: 0 }
      ]);
    expect(polygonsByRoomId.get("room-two")?.vertices.map((vertex) => ({ x: vertex.x, z: vertex.z })))
      .toEqual([
        { x: 100, z: 70 },
        { x: 100, z: 100 },
        { x: 0, z: 100 },
        { x: 0, z: 50 },
        { x: 40, z: 50 },
        { x: 40, z: 70 }
      ]);
    for (const wallId of ["path-one", "path-two", "path-three"]) {
      const uses = level.boundaryEdgeUses.filter((edgeUse) =>
        edgeUse.boundaryEdge.sourceWallId === wallId
      );
      expect(uses).toHaveLength(2);
      expect(new Set(uses.map((edgeUse) => edgeUse.direction))).toEqual(
        new Set(["FORWARD", "REVERSE"])
      );
    }
    for (const face of subdivision.faces) {
      const polygon = polygonsByRoomId.get(faceRoomIds.get(face.key)!);
      expect(polygon?.area).toBeCloseTo(face.area);
      expect(polygon?.centroid.x).toBeCloseTo(face.centroid.x);
      expect(polygon?.centroid.z).toBeCloseTo(face.centroid.z);
    }

    const oldCentroids = level.polygons.map((polygon) => polygon.centroid);
    const moved = moveJunction(reconciled.project, {
      levelId: "ground-floor",
      position: { x: 40, z: 50 },
      destination: { x: 30, z: 40 },
      incidentWallIds: ["path-one", "path-two"]
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    const rebuilt = GeometryEngine.build(moved.project);
    expect(rebuilt.ok).toBe(true);
    if (!rebuilt.ok) return;
    expect(rebuilt.model.levels[0]?.polygons.map((polygon) => polygon.centroid))
      .not.toEqual(oldCentroids);
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

function createMultiWallPartitionProject(): Project {
  const roomIds = ["room"];
  let project = createProject(
    [
      wall("south", 0, 0, 100, 0, roomIds),
      wall("east", 100, 0, 100, 100, roomIds),
      wall("north", 100, 100, 0, 100, roomIds),
      wall("west", 0, 100, 0, 0, roomIds)
    ],
    [{
      id: "room",
      name: "Room",
      type: "OTHER",
      boundary: ["south", "east", "north", "west"].map((wallId) => ({
        wallId,
        direction: "FORWARD" as const
      }))
    }]
  );
  project = requireConnectedWall(project, wall("path-one", 0, 50, 40, 50), {
    startConnection: { wallId: "west", newWallId: "west-lower" }
  });
  project = requireConnectedWall(project, wall("path-two", 40, 50, 40, 70));
  return requireConnectedWall(project, wall("path-three", 40, 70, 100, 70), {
    endConnection: { wallId: "east", newWallId: "east-upper" }
  });
}

function requireConnectedWall(
  project: Project,
  newWall: Wall,
  connections: Pick<
    Parameters<typeof createConnectedWall>[1],
    "startConnection" | "endConnection"
  > = {}
): Project {
  const result = createConnectedWall(project, {
    levelId: "ground-floor",
    wall: newWall,
    ...connections
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.project;
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
    schemaVersion: "3.0.0",
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
