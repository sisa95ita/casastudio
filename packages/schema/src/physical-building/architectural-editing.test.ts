import { describe, expect, it } from "vitest";

import type { Project } from "../project/index.js";
import { ValidationErrorCode } from "../validation/index.js";
import { createConnectedWall } from "./wall-editing.js";
import {
  classifyLevelRoomTopology,
  createRoom,
  deleteRoom,
  deriveBoundedFaces,
  discoverRoomCandidates,
  moveJunction,
  partitionRoom,
  reconcileRoomSubdivision,
  type RoomSubdivision
} from "./architectural-editing.js";
import type { Room } from "./room.js";
import type { Wall } from "./wall.js";

describe("explicit Room authoring", () => {
  it("discovers a rectangle without persisting it and creates a canonical reciprocal Room", () => {
    const project = createProject(rectangleWalls());
    const before = structuredClone(project);
    const candidates = discoverRoomCandidates(project, "ground-level");

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.area).toBe(10_000);
    expect(project).toEqual(before);
    const result = createRoom(project, {
      levelId: "ground-level",
      room: createRoomEntity("room-one", [...candidates[0]!.boundary].reverse().map(invert))
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project).not.toBe(project);
    expect(result.project.building.levels[0]?.rooms[0]?.boundary).toEqual(candidates[0]?.boundary);
    expect(result.project.building.levels[0]?.walls.map((wall) => wall.roomIds)).toEqual([
      ["room-one"],
      ["room-one"],
      ["room-one"],
      ["room-one"]
    ]);
    expect(discoverRoomCandidates(result.project, "ground-level")).toEqual([]);
  });

  it("accepts differently oriented and split boundary Walls", () => {
    const walls = rectangleWalls();
    walls[1] = { ...walls[1]!, start: { x: 100, z: 100 }, end: { x: 100, z: 0 } };
    walls.splice(
      2,
      1,
      wall("top-right", 100, 100, 50, 100),
      wall("top-left", 50, 100, 0, 100)
    );
    const project = createProject(walls);
    const candidate = discoverRoomCandidates(project, "ground-level")[0]!;
    const result = createRoom(project, {
      levelId: "ground-level",
      room: createRoomEntity("split-room", candidate.boundary)
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.project.building.levels[0]?.rooms[0]?.boundary).toHaveLength(5);
  });

  it("rejects open, disconnected, repeated, self-intersecting, and duplicate boundaries", () => {
    const project = createProject(rectangleWalls());
    const invalidBoundaries = [
      [use("bottom"), use("right"), use("top")],
      [use("bottom"), use("right"), use("left")],
      [use("bottom"), use("right"), use("top"), use("bottom")]
    ];
    for (const [index, boundary] of invalidBoundaries.entries()) {
      const result = createRoom(project, {
        levelId: "ground-level",
        room: createRoomEntity(`invalid-${index}`, boundary)
      });
      expect(result.ok).toBe(false);
    }

    const bowTie = createProject([
      wall("a", 0, 0, 100, 100),
      wall("b", 100, 100, 0, 100),
      wall("c", 0, 100, 100, 0),
      wall("d", 100, 0, 0, 0)
    ]);
    expect(discoverRoomCandidates(bowTie, "ground-level")).toEqual([]);
    expect(
      createRoom(bowTie, {
        levelId: "ground-level",
        room: createRoomEntity("bow-tie", [use("a"), use("b"), use("c"), use("d")])
      })
    ).toMatchObject({ ok: false });

    const candidate = discoverRoomCandidates(project, "ground-level")[0]!;
    const created = createRoom(project, {
      levelId: "ground-level",
      room: createRoomEntity("first-room", candidate.boundary)
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const duplicate = createRoom(created.project, {
      levelId: "ground-level",
      room: createRoomEntity("second-room", candidate.boundary)
    });
    expect(duplicate).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.DUPLICATE_ROOM_BOUNDARY }]
    });
  });

  it("supports a Wall shared by two explicitly created Rooms", () => {
    const project = createProject([
      wall("left-bottom", 0, 0, 100, 0),
      wall("shared", 100, 0, 100, 100),
      wall("left-top", 100, 100, 0, 100),
      wall("left-side", 0, 100, 0, 0),
      wall("right-bottom", 100, 0, 200, 0),
      wall("right-side", 200, 0, 200, 100),
      wall("right-top", 200, 100, 100, 100)
    ]);
    const candidates = discoverRoomCandidates(project, "ground-level");
    expect(candidates).toHaveLength(2);
    const first = createRoom(project, {
      levelId: "ground-level",
      room: createRoomEntity("room-a", candidates[0]!.boundary)
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const secondCandidate = discoverRoomCandidates(first.project, "ground-level")[0]!;
    const second = createRoom(first.project, {
      levelId: "ground-level",
      room: createRoomEntity("room-b", secondCandidate.boundary)
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.project.building.levels[0]?.walls.find((item) => item.id === "shared")?.roomIds)
        .toEqual(["room-a", "room-b"]);
    }
  });
});

describe("Room partitioning", () => {
  it("splits a Room with deterministic identity fallback and updates reciprocity", () => {
    const project = createPartitionProject();
    const before = structuredClone(project);
    const result = partitionRoom(project, {
      levelId: "ground-level",
      roomId: "whole-room",
      partitionWallId: "partition",
      newRoom: { id: "new-room", name: "New Room", type: "OTHER" }
    });

    expect(result.ok).toBe(true);
    expect(project).toEqual(before);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.rooms.map((room) => room.id)).toEqual(["whole-room", "new-room"]);
    expect(level.walls.find((item) => item.id === "partition")?.roomIds).toEqual([
      "whole-room",
      "new-room"
    ]);
    expect(level.rooms.find((room) => room.id === "whole-room")?.boundary.map((edge) => edge.wallId))
      .toContain("bottom");
  });

  it("retains shared outer-wall references and rejects a non-partition without partial mutation", () => {
    const project = createPartitionProject();
    const level = project.building.levels[0]!;
    level.rooms.push(createRoomEntity("neighbor", [
      use("bottom", "REVERSE"),
      use("neighbor-left"),
      use("neighbor-bottom"),
      use("neighbor-right")
    ]));
    level.walls.push(
      { ...wall("neighbor-left", 0, 0, 0, -100), roomIds: ["neighbor"] },
      { ...wall("neighbor-bottom", 0, -100, 100, -100), roomIds: ["neighbor"] },
      { ...wall("neighbor-right", 100, -100, 100, 0), roomIds: ["neighbor"] }
    );
    level.walls.find((item) => item.id === "bottom")!.roomIds = ["whole-room", "neighbor"];
    const neighborBefore = structuredClone(level.rooms.find((room) => room.id === "neighbor"));
    const result = partitionRoom(project, {
      levelId: level.id,
      roomId: "whole-room",
      partitionWallId: "partition",
      newRoom: { id: "new-room", name: "New Room", type: "OTHER" }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.building.levels[0]?.walls.find((item) => item.id === "bottom")?.roomIds)
        .toContain("neighbor");
      expect(result.project.building.levels[0]?.rooms.find((room) => room.id === "neighbor"))
        .toEqual(neighborBefore);
    }

    const before = structuredClone(project);
    const failed = partitionRoom(project, {
      levelId: level.id,
      roomId: "whole-room",
      partitionWallId: "bottom",
      newRoom: { id: "failed-room", name: "Failed", type: "OTHER" }
    });
    expect(failed).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.WALL_DOES_NOT_PARTITION_ROOM }]
    });
    expect(project).toEqual(before);
  });

  it("derives and classifies a multi-Wall separating path as one Room subdivision", () => {
    const project = createMultiWallPartitionProject();
    const before = structuredClone(project);
    const faces = deriveBoundedFaces(project, "ground-level");
    const classification = classifyLevelRoomTopology(project, "ground-level");

    expect(faces).toHaveLength(2);
    expect(faces.map((face) => face.boundary)).toEqual([
      [
        use("bottom"), use("right"), use("path-three", "REVERSE"),
        use("path-two", "REVERSE"), use("path-one", "REVERSE"), use("left-lower")
      ],
      [
        use("left"), use("path-one"), use("path-two"), use("path-three"),
        use("right-upper"), use("top")
      ]
    ]);
    expect(faces[0]?.vertices).toEqual([
      { x: 0, z: 0 },
      { x: 100, z: 0 },
      { x: 100, z: 70 },
      { x: 40, z: 70 },
      { x: 40, z: 50 },
      { x: 0, z: 50 }
    ]);
    expect(faces[1]?.vertices).toEqual([
      { x: 0, z: 100 },
      { x: 0, z: 50 },
      { x: 40, z: 50 },
      { x: 40, z: 70 },
      { x: 100, z: 70 },
      { x: 100, z: 100 }
    ]);
    for (const face of faces) {
      expect(face.boundary.filter((edge) => edge.wallId.startsWith("path-"))).toHaveLength(3);
    }
    expect(faces.map((face) => face.centroid.x)).not.toContain(undefined);
    expect(classification.represented).toEqual([]);
    expect(classification.unassigned).toEqual([]);
    expect(classification.subdivisions).toHaveLength(1);
    expect(classification.subdivisions[0]?.roomId).toBe("whole-room");
    expect(classification.subdivisions[0]?.faces.map((face) => face.key)).toEqual(
      faces.map((face) => face.key)
    );
    expect(project).toEqual(before);
  });

  it("reconciles a multi-Wall path atomically and preserves the centroid-containing identity", () => {
    const project = createMultiWallPartitionProject();
    const before = structuredClone(project);
    const subdivision = classifyLevelRoomTopology(project, "ground-level").subdivisions[0]!;
    const result = reconcileRoomSubdivision(project, {
      levelId: "ground-level",
      roomId: "whole-room",
      expectedFaceKeys: subdivision.faces.map((face) => face.key),
      newRoomAssignments: assignNewRooms(subdivision, [
        { id: "new-room", name: "New Room", type: "OTHER" }
      ])
    });

    expect(result.ok).toBe(true);
    expect(project).toEqual(before);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    const preserved = level.rooms.find((room) => room.id === "whole-room")!;
    const additional = level.rooms.find((room) => room.id === "new-room")!;
    expect(preserved.name).toBe("whole-room");
    const facesByKey = new Map(subdivision.faces.map((face) => [face.key, face]));
    expect(preserved.boundary).toEqual(facesByKey.get(subdivision.preservedFaceKey)?.boundary);
    expect(additional.boundary).toEqual(
      subdivision.faces.find((face) => face.key !== subdivision.preservedFaceKey)?.boundary
    );
    expect(preserved.boundary).toEqual([
      use("bottom"),
      use("right"),
      use("path-three", "REVERSE"),
      use("path-two", "REVERSE"),
      use("path-one", "REVERSE"),
      use("left-lower")
    ]);
    expect(additional.boundary).toEqual([
      use("left"),
      use("path-one"),
      use("path-two"),
      use("path-three"),
      use("right-upper"),
      use("top")
    ]);
    for (const wallId of ["path-one", "path-two", "path-three"]) {
      expect(level.walls.find((item) => item.id === wallId)?.roomIds).toEqual([
        "whole-room",
        "new-room"
      ]);
    }
    expect(level.walls.find((item) => item.id === "left")?.roomIds).toEqual(["new-room"]);
    expect(level.walls.find((item) => item.id === "left-lower")?.roomIds).toEqual(["whole-room"]);
    expect(level.walls.find((item) => item.id === "right")?.roomIds).toEqual(["whole-room"]);
    expect(level.walls.find((item) => item.id === "right-upper")?.roomIds).toEqual(["new-room"]);
    for (const wall of level.walls) {
      expect(wall.roomIds).toEqual(
        level.rooms.filter((room) => room.boundary.some((edge) => edge.wallId === wall.id))
          .map((room) => room.id)
      );
    }
  });

  it("reconciles one Room into three deterministic bounded faces", () => {
    const project = createThreeFacePartitionProject();
    const classification = classifyLevelRoomTopology(project, "ground-level");
    expect(classification.subdivisions[0]?.faces).toHaveLength(3);
    const assignments = [...assignNewRooms(classification.subdivisions[0]!, [
      { id: "new-room-a", name: "New A", type: "OTHER" },
      { id: "new-room-b", name: "New B", type: "OTHER" }
    ])].reverse();
    const result = reconcileRoomSubdivision(project, {
      levelId: "ground-level",
      roomId: "whole-room",
      expectedFaceKeys: classification.subdivisions[0]!.faces.map((face) => face.key),
      newRoomAssignments: assignments
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]?.rooms.map((room) => room.id)).toEqual([
      "whole-room", "new-room-a", "new-room-b"
    ]);
    expect(result.project.building.levels[0]?.walls.find((wall) => wall.id === "partition-a")?.roomIds)
      .toHaveLength(2);
    expect(result.project.building.levels[0]?.walls.find((wall) => wall.id === "partition-b")?.roomIds)
      .toHaveLength(2);
    for (const assignment of assignments) {
      const face = classification.subdivisions[0]!.faces.find(
        (candidate) => candidate.key === assignment.faceKey
      );
      expect(result.project.building.levels[0]?.rooms.find(
        (room) => room.id === assignment.room.id
      )?.boundary).toEqual(face?.boundary);
    }
  });

  it("uses deterministic geometric fallback when the old centroid lies on a partition path", () => {
    const project = createCentroidBoundaryPartitionProject();
    const subdivision = classifyLevelRoomTopology(project, "ground-level").subdivisions[0]!;
    const largest = [...subdivision.faces].sort((first, second) =>
      second.area - first.area || first.key.localeCompare(second.key)
    )[0]!;
    const result = reconcileRoomSubdivision(project, {
      levelId: "ground-level",
      roomId: "whole-room",
      expectedFaceKeys: subdivision.faces.map((face) => face.key),
      newRoomAssignments: assignNewRooms(subdivision, [
        { id: "new-room", name: "New Room", type: "OTHER" }
      ])
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]?.rooms.find((room) => room.id === "whole-room")?.boundary)
      .toEqual(largest.boundary);
  });

  it("reconciles Door ownership and uniquely contained Viewpoints atomically", () => {
    const project = createMultiWallPartitionProject();
    project.building.levels[0]!.walls.find((wall) => wall.id === "bottom")!.openings.push({
      id: "preserved-door",
      type: "DOOR",
      offsetFromStart: 10,
      width: 20,
      height: 200,
      elevation: 0,
      connectedRoomIds: ["whole-room"]
    });
    project.building.levels[0]!.walls.find((wall) => wall.id === "top")!.openings.push({
      id: "reassigned-door",
      type: "DOOR",
      offsetFromStart: 10,
      width: 20,
      height: 200,
      elevation: 0,
      connectedRoomIds: ["whole-room"]
    });
    project.building.levels[0]!.walls.find((wall) => wall.id === "path-two")!.openings.push({
      id: "partition-door",
      type: "DOOR",
      offsetFromStart: 5,
      width: 5,
      height: 200,
      elevation: 0,
      connectedRoomIds: ["whole-room"]
    });
    project.viewpoints.push({
      id: "upper-room-view",
      levelId: "ground-level",
      roomId: "whole-room",
      cameraPosition: { x: 80, y: 160, z: 90 },
      cameraTarget: { x: 60, y: 100, z: 80 },
      fieldOfView: 60,
      projection: "PERSPECTIVE"
    }, {
      id: "lower-room-view",
      levelId: "ground-level",
      roomId: "whole-room",
      cameraPosition: { x: 20, y: 160, z: 20 },
      cameraTarget: { x: 30, y: 100, z: 30 },
      fieldOfView: 60,
      projection: "PERSPECTIVE"
    });
    project.building.levels[0]!.staircases.push({
      id: "unrelated-staircase",
      fromLevelId: "ground-level",
      toLevelId: "ground-level",
      width: 80,
      flights: [],
      landings: []
    });
    const before = structuredClone(project);
    const subdivision = classifyLevelRoomTopology(project, "ground-level").subdivisions[0]!;
    const reconciled = reconcileRoomSubdivision(project, {
      levelId: "ground-level",
      roomId: "whole-room",
      expectedFaceKeys: subdivision.faces.map((face) => face.key),
      newRoomAssignments: assignNewRooms(subdivision, [
        { id: "new-room", name: "New Room", type: "OTHER" }
      ])
    });
    expect(reconciled.ok).toBe(true);
    expect(project).toEqual(before);
    if (!reconciled.ok) return;
    const level = reconciled.project.building.levels[0]!;
    expect(level.walls.find((wall) => wall.id === "bottom")?.openings[0])
      .toMatchObject({ connectedRoomIds: ["whole-room"] });
    expect(level.walls.find((wall) => wall.id === "top")?.openings[0])
      .toMatchObject({ connectedRoomIds: ["new-room"] });
    const partitionDoor = level.walls.find((wall) => wall.id === "path-two")?.openings[0];
    expect([...(partitionDoor?.type === "DOOR" ? partitionDoor.connectedRoomIds ?? [] : [])].sort())
      .toEqual(["new-room", "whole-room"]);
    expect(reconciled.project.viewpoints[0]?.roomId).toBe("new-room");
    expect(reconciled.project.viewpoints[1]?.roomId).toBe("whole-room");
    expect(level.staircases).toEqual(project.building.levels[0]?.staircases);
  });

  it("rejects stale faces, boundary Viewpoints, and unresolved Staircases atomically", () => {
    const project = createMultiWallPartitionProject();
    const subdivision = classifyLevelRoomTopology(project, "ground-level").subdivisions[0]!;
    const staleBefore = structuredClone(project);
    const stale = reconcileRoomSubdivision(project, {
      levelId: "ground-level",
      roomId: "whole-room",
      expectedFaceKeys: ["stale-face"],
      newRoomAssignments: assignNewRooms(subdivision, [
        { id: "new-room", name: "New Room", type: "OTHER" }
      ])
    });
    expect(stale).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.STALE_ROOM_TOPOLOGY }]
    });
    expect(project).toEqual(staleBefore);

    const doorProject = createMultiWallPartitionProject();
    doorProject.building.levels[0]!.walls.push({
      ...wall("unrelated-door-wall", 200, 0, 250, 0),
      openings: [{
        id: "ambiguous-door",
        type: "DOOR",
        offsetFromStart: 5,
        width: 10,
        height: 200,
        elevation: 0,
        connectedRoomIds: ["whole-room"]
      }]
    });
    expectReconciliationReferenceFailure(
      doorProject,
      ValidationErrorCode.ROOM_SUBDIVISION_DOOR_REFERENCE_AMBIGUOUS
    );

    const viewpointProject = createMultiWallPartitionProject();
    viewpointProject.viewpoints.push({
      id: "room-view",
      levelId: "ground-level",
      roomId: "whole-room",
      cameraPosition: { x: 40, y: 160, z: 60 },
      cameraTarget: { x: 40, y: 100, z: 40 },
      fieldOfView: 60,
      projection: "PERSPECTIVE"
    });
    expectReconciliationReferenceFailure(
      viewpointProject,
      ValidationErrorCode.ROOM_SUBDIVISION_VIEWPOINT_REFERENCE_AMBIGUOUS
    );

    const staircaseProject = createMultiWallPartitionProject();
    staircaseProject.building.levels[0]!.staircases.push({
      id: "room-stair",
      fromLevelId: "ground-level",
      toLevelId: "ground-level",
      fromRoomId: "whole-room",
      width: 80,
      flights: [],
      landings: []
    });
    expectReconciliationReferenceFailure(
      staircaseProject,
      ValidationErrorCode.ROOM_SUBDIVISION_STAIRCASE_REFERENCE_AMBIGUOUS
    );
  });

  it("derives and classifies faces independently of Wall array order", () => {
    const project = createMultiWallPartitionProject();
    const reversed = structuredClone(project);
    reversed.building.levels[0]!.walls.reverse();
    expect(deriveBoundedFaces(reversed, "ground-level")).toEqual(
      deriveBoundedFaces(project, "ground-level")
    );
    expect(classifyLevelRoomTopology(reversed, "ground-level")).toEqual(
      classifyLevelRoomTopology(project, "ground-level")
    );
  });
});

describe("junction movement", () => {
  it.each([2, 3, 5])("moves all %s incident Walls immutably", (count) => {
    const incident = Array.from({ length: count }, (_, index) =>
      wall(`wall-${index}`, 0, 0, 100 + index * 10, 100 - index * 20)
    );
    const project = createProject(incident);
    const before = structuredClone(project);
    const result = moveJunction(project, {
      levelId: "ground-level",
      position: { x: 0, z: 0 },
      destination: { x: 20, z: 30 },
      incidentWallIds: incident.map((item) => item.id)
    });
    expect(result.ok).toBe(true);
    expect(project).toEqual(before);
    if (result.ok) {
      expect(result.project.building.levels[0]?.walls.every((item) =>
        item.start.x === 20 && item.start.z === 30
      )).toBe(true);
    }
  });

  it("moves Room and shared-Room junctions while preserving boundary references", () => {
    const project = createProject(rectangleWalls());
    const candidate = discoverRoomCandidates(project, "ground-level")[0]!;
    const created = createRoom(project, {
      levelId: "ground-level",
      room: createRoomEntity("room-one", candidate.boundary)
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const result = moveJunction(created.project, {
      levelId: "ground-level",
      position: { x: 100, z: 0 },
      destination: { x: 120, z: 10 },
      incidentWallIds: ["bottom", "right"]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.building.levels[0]?.rooms[0]?.boundary).toEqual(candidate.boundary);
    }
  });

  it("validates Door and Window spans atomically across incident Walls", () => {
    const first = wall("door-wall", 0, 0, 200, 0);
    first.openings = [{ id: "door", type: "DOOR", offsetFromStart: 100, width: 80, height: 210, elevation: 0, hingeSide: "START", swingSide: "LEFT" }];
    const second = wall("window-wall", 0, 0, 0, 200);
    second.openings = [{ id: "window", type: "WINDOW", offsetFromStart: 100, width: 80, height: 100, elevation: 80 }];
    const project = createProject([first, second]);
    const valid = moveJunction(project, {
      levelId: "ground-level",
      position: { x: 0, z: 0 },
      destination: { x: 10, z: 10 },
      incidentWallIds: ["door-wall", "window-wall"]
    });
    expect(valid.ok).toBe(true);

    const before = structuredClone(project);
    const invalid = moveJunction(project, {
      levelId: "ground-level",
      position: { x: 0, z: 0 },
      destination: { x: 150, z: 0 },
      incidentWallIds: ["door-wall", "window-wall"]
    });
    expect(invalid).toMatchObject({ ok: false, errors: [{ code: ValidationErrorCode.OPENING_OUTSIDE_WALL }] });
    expect(project).toEqual(before);
  });

  it("rejects stale topology, zero-length Walls, and invalid Room polygons", () => {
    const project = createPartitionProject();
    expect(moveJunction(project, {
      levelId: "ground-level",
      position: { x: 0, z: 0 },
      destination: { x: 50, z: 0 },
      incidentWallIds: ["bottom"]
    })).toMatchObject({ ok: false, errors: [{ code: ValidationErrorCode.STALE_JUNCTION_TOPOLOGY }] });

    expect(moveJunction(project, {
      levelId: "ground-level",
      position: { x: 0, z: 0 },
      destination: { x: 100, z: 0 },
      incidentWallIds: ["bottom", "left-lower"]
    })).toMatchObject({ ok: false, errors: [{ code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED }] });

    expect(moveJunction(project, {
      levelId: "ground-level",
      position: { x: 0, z: 0 },
      destination: { x: 120, z: 120 },
      incidentWallIds: ["bottom", "left-lower"]
    })).toMatchObject({ ok: false });
  });
});

describe("Room deletion", () => {
  it("removes an explicit Room and clears Wall reciprocity", () => {
    const project = createPartitionProject();
    const result = deleteRoom(project, { levelId: "ground-level", roomId: "whole-room" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.building.levels[0]?.rooms).toEqual([]);
      expect(result.project.building.levels[0]?.walls.every((wall) => wall.roomIds.length === 0)).toBe(true);
    }
  });
});

function createPartitionProject(): Project {
  const walls = [
    wall("bottom", 0, 0, 100, 0),
    wall("right-lower", 100, 0, 100, 50),
    wall("right-upper", 100, 50, 100, 100),
    wall("top", 100, 100, 0, 100),
    wall("left-upper", 0, 100, 0, 50),
    wall("left-lower", 0, 50, 0, 0),
    wall("partition", 0, 50, 100, 50)
  ];
  const room = createRoomEntity("whole-room", [
    use("bottom"),
    use("right-lower"),
    use("right-upper"),
    use("top"),
    use("left-upper"),
    use("left-lower")
  ]);
  return createProject(
    walls.map((item) => ({
      ...item,
      roomIds: item.id === "partition" ? [] : [room.id]
    })),
    [room]
  );
}

function createMultiWallPartitionProject(): Project {
  const walls = rectangleWalls().map((item) => ({ ...item, roomIds: ["whole-room"] }));
  const room = createRoomEntity("whole-room", [
    use("bottom"), use("right"), use("top"), use("left")
  ]);
  let project = createProject(walls, [room]);
  project = expectConnectedWall(project, wall("path-one", 0, 50, 40, 50), {
    startConnection: { wallId: "left", newWallId: "left-lower" }
  });
  project = expectConnectedWall(project, wall("path-two", 40, 50, 40, 70));
  return expectConnectedWall(project, wall("path-three", 40, 70, 100, 70), {
    endConnection: { wallId: "right", newWallId: "right-upper" }
  });
}

function expectConnectedWall(
  project: Project,
  newWall: Wall,
  connections: Pick<
    Parameters<typeof createConnectedWall>[1],
    "startConnection" | "endConnection"
  > = {}
): Project {
  const result = createConnectedWall(project, {
    levelId: "ground-level",
    wall: newWall,
    ...connections
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.project;
}

function createThreeFacePartitionProject(): Project {
  const walls = [
    wall("south-a", 0, 0, 40, 0),
    wall("south-b", 40, 0, 80, 0),
    wall("south-c", 80, 0, 120, 0),
    wall("east", 120, 0, 120, 100),
    wall("north-c", 120, 100, 80, 100),
    wall("north-b", 80, 100, 40, 100),
    wall("north-a", 40, 100, 0, 100),
    wall("west", 0, 100, 0, 0),
    wall("partition-a", 40, 0, 40, 100),
    wall("partition-b", 80, 0, 80, 100)
  ];
  const room = createRoomEntity("whole-room", [
    use("south-a"), use("south-b"), use("south-c"), use("east"),
    use("north-c"), use("north-b"), use("north-a"), use("west")
  ]);
  return createProject(walls.map((item) => ({
    ...item,
    roomIds: item.id.startsWith("partition-") ? [] : [room.id]
  })), [room]);
}

function createCentroidBoundaryPartitionProject(): Project {
  const walls = [
    wall("bottom", 0, 0, 100, 0),
    wall("right-lower", 100, 0, 100, 60),
    wall("right-upper", 100, 60, 100, 100),
    wall("top", 100, 100, 0, 100),
    wall("left-upper", 0, 100, 0, 10),
    wall("left-lower", 0, 10, 0, 0),
    wall("path-a", 0, 10, 50, 50),
    wall("path-b", 50, 50, 100, 60)
  ];
  const room = createRoomEntity("whole-room", [
    use("bottom"), use("right-lower"), use("right-upper"), use("top"),
    use("left-upper"), use("left-lower")
  ]);
  return createProject(walls.map((item) => ({
    ...item,
    roomIds: item.id.startsWith("path-") ? [] : [room.id]
  })), [room]);
}

function expectReconciliationReferenceFailure(
  project: Project,
  code: ValidationErrorCode
): void {
  const before = structuredClone(project);
  const subdivision = classifyLevelRoomTopology(project, "ground-level").subdivisions[0]!;
  expect(reconcileRoomSubdivision(project, {
    levelId: "ground-level",
    roomId: "whole-room",
    expectedFaceKeys: subdivision.faces.map((face) => face.key),
    newRoomAssignments: assignNewRooms(subdivision, [
      { id: "new-room", name: "New Room", type: "OTHER" }
    ])
  })).toMatchObject({
    ok: false,
    errors: [{ code }]
  });
  expect(project).toEqual(before);
}

function rectangleWalls(): Wall[] {
  return [
    wall("bottom", 0, 0, 100, 0),
    wall("right", 100, 0, 100, 100),
    wall("top", 100, 100, 0, 100),
    wall("left", 0, 100, 0, 0)
  ];
}

function wall(id: string, startX: number, startZ: number, endX: number, endZ: number): Wall {
  return {
    id,
    start: { x: startX, z: startZ },
    end: { x: endX, z: endZ },
    height: 280,
    thickness: 20,
    roomIds: [],
    openings: []
  };
}

function use(wallId: string, direction: "FORWARD" | "REVERSE" = "FORWARD") {
  return { wallId, direction } as const;
}

function invert(edge: ReturnType<typeof use>) {
  return use(edge.wallId, edge.direction === "FORWARD" ? "REVERSE" : "FORWARD");
}

function createRoomEntity(id: string, boundary: readonly ReturnType<typeof use>[]): Room {
  return { id, name: id, type: "OTHER", boundary: [...boundary] };
}

function assignNewRooms(
  subdivision: RoomSubdivision,
  rooms: readonly Omit<Room, "boundary">[]
) {
  return subdivision.faces
    .filter((face) => face.key !== subdivision.preservedFaceKey)
    .map((face, index) => ({ faceKey: face.key, room: rooms[index]! }));
}

function createProject(walls: Wall[], rooms: Room[] = []): Project {
  return {
    id: "authoring-project",
    name: "Authoring Project",
    schemaVersion: "2.0.0",
    revision: 1,
    createdAt: "2026-08-21T10:00:00+02:00",
    updatedAt: "2026-08-21T10:00:00+02:00",
    units: { length: "cm", angle: "deg" },
    building: {
      id: "building",
      name: "Building",
      type: "HOUSE",
      levels: [{
        id: "ground-level",
        name: "Ground",
        elevation: 0,
        rooms,
        walls,
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
