import { describe, expect, it } from "vitest";

import { ProjectSchema, type Project } from "../project/index.js";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  ValidationErrorCode
} from "../validation/index.js";
import {
  createRoomFromShape,
  createFreeBoundaryRoomFromShape,
  deriveRoomShapeVertices,
  validateRoomShapeDefinition,
  type RoomShapeDefinition
} from "./room-shape-authoring.js";
import { isFreeRoomBoundaryEdge } from "./room.js";
import { splitWall } from "./wall-editing.js";
import type { Wall } from "./wall.js";

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
      ["shape-room"],
      ["shape-room"],
      ["shape-room"],
      ["shape-room"]
    ]);
    expect(level.rooms[0]!.boundary).toEqual(
      level.walls.map((wall) => ({
        wallId: wall.id,
        direction: "FORWARD"
      }))
    );
    expect(measure(level.walls.map((wall) => wall.start))).toEqual({
      area: 120_000,
      perimeter: 1_400
    });
    expectCanonicalProject(result.project);
    expect(Object.keys(level.rooms[0]!)).toEqual([
      "id",
      "name",
      "type",
      "boundary"
    ]);
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
    expect(
      level.walls.every((wall) => wall.height === 300 && wall.thickness === 20)
    ).toBe(true);
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
    expect(
      commit(committed.project, {
        kind: "RECTANGLE",
        dimensions: { width: 200, depth: 200 }
      })
    ).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.STALE_ROOM_TOPOLOGY }]
    });
    expect(committed.project).toEqual(staleBefore);
  });

  it("derives deterministic top-left-anchored vertices", () => {
    expect(
      deriveRoomShapeVertices(
        { x: 25, z: 75 },
        { kind: "RECTANGLE", dimensions: { width: 40, depth: 30 } }
      )
    ).toEqual([
      { x: 25, z: 75 },
      { x: 25, z: 45 },
      { x: 65, z: 45 },
      { x: 65, z: 75 }
    ]);
  });

  it("rotates rectangular and L-shaped footprints in deterministic quarter turns", () => {
    const rectangle = {
      kind: "RECTANGLE" as const,
      dimensions: { width: 40, depth: 30 }
    };
    expect(
      deriveRoomShapeVertices({ x: 0, z: 0 }, { ...rectangle, rotation: 90 })
    ).toEqual([
      { x: 0, z: -40 },
      { x: 30, z: -40 },
      { x: 30, z: 0 },
      { x: 0, z: 0 }
    ]);
    expect(
      deriveRoomShapeVertices({ x: 0, z: 0 }, { ...rectangle, rotation: 180 })
    ).toEqual([
      { x: 40, z: -30 },
      { x: 40, z: 0 },
      { x: 0, z: 0 },
      { x: 0, z: -30 }
    ]);
    expect(
      deriveRoomShapeVertices({ x: 0, z: 0 }, { ...rectangle, rotation: 270 })
    ).toEqual([
      { x: 30, z: 0 },
      { x: 0, z: 0 },
      { x: 0, z: -40 },
      { x: 30, z: -40 }
    ]);
    const lShape = {
      kind: "L_SHAPE" as const,
      dimensions: { width: 50, depth: 40, notchWidth: 20, notchDepth: 15 },
      rotation: 90 as const
    };
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

  it("adds an overlapping elevated free-boundary Room without changing lower Room Walls", () => {
    const lower = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 400, depth: 300 }
    });
    expect(lower.ok).toBe(true);
    if (!lower.ok) return;
    const lowerBefore = structuredClone(
      lower.project.building.levels[0]!.rooms[0]
    );
    const wallsBefore = structuredClone(
      lower.project.building.levels[0]!.walls
    );
    const result = createFreeBoundaryRoomFromShape(lower.project, {
      levelId: "ground-level",
      origin: { x: 200, z: 0 },
      shape: { kind: "RECTANGLE", dimensions: { width: 200, depth: 250 } },
      room: {
        id: "elevated-room",
        name: "Studio",
        type: "STUDIO",
        elevation: 180
      }
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.rooms[0]).toEqual(lowerBefore);
    expect(level.walls).toEqual(wallsBefore);
    expect(level.rooms[1]).toMatchObject({
      id: "elevated-room",
      elevation: 180
    });
    expect(level.rooms[1]!.boundary).toHaveLength(4);
    expect(level.rooms[1]!.boundary.every(isFreeRoomBoundaryEdge)).toBe(true);
    expectCanonicalProject(result.project);
  });

  it("creates an exact elevated free-boundary L-shaped footprint without fake Walls", () => {
    const result = createFreeBoundaryRoomFromShape(createEmptyProject(), {
      levelId: "ground-level",
      origin: { x: 25, z: 475 },
      shape: {
        kind: "L_SHAPE",
        dimensions: { width: 500, depth: 400, notchWidth: 200, notchDepth: 150 }
      },
      room: {
        id: "elevated-l-room",
        name: "Upper Studio",
        type: "STUDIO",
        elevation: 220
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.walls).toEqual([]);
    expect(level.rooms[0]!.boundary).toHaveLength(6);
    expect(
      measure(
        level.rooms[0]!.boundary.map((edge) => {
          if (!("kind" in edge))
            throw new Error("Expected a free boundary edge.");
          return edge.start;
        })
      )
    ).toEqual({ area: 170_000, perimeter: 1_800 });
    expectCanonicalProject(result.project);
  });

  it("derives deterministic U- and T-shaped architecture from compact parameters", () => {
    const uShape: RoomShapeDefinition = {
      kind: "U_SHAPE",
      dimensions: {
        width: 520,
        depth: 420,
        leftWingWidth: 140,
        rightWingWidth: 140,
        notchDepth: 260
      }
    };
    const tShape: RoomShapeDefinition = {
      kind: "T_SHAPE",
      dimensions: { width: 500, depth: 420, stemWidth: 180, stemDepth: 260 }
    };
    expect(validateRoomShapeDefinition(uShape)).toBe(true);
    expect(validateRoomShapeDefinition(tShape)).toBe(true);
    expect(measure(deriveRoomShapeVertices({ x: 0, z: 0 }, uShape)!)).toEqual({
      area: 156_000,
      perimeter: 2_400
    });
    expect(measure(deriveRoomShapeVertices({ x: 0, z: 0 }, tShape)!)).toEqual({
      area: 126_800,
      perimeter: 1_840
    });
    expect(commit(createEmptyProject(), uShape).ok).toBe(true);
    expect(commit(createEmptyProject(), tShape).ok).toBe(true);
  });

  it("creates in free space on a populated Level and reuses one exact shared Wall", () => {
    const lower = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 400, depth: 300 }
    });
    expect(lower.ok).toBe(true);
    if (!lower.ok) return;

    const freeArea = createRoomFromShape(lower.project, {
      levelId: "ground-level",
      origin: { x: 1_000, z: 475 },
      shape: { kind: "RECTANGLE", dimensions: { width: 200, depth: 200 } },
      room: { id: "free-room", name: "Free room", type: "OTHER" },
      wallIds: ["free-1", "free-2", "free-3", "free-4"],
      splitWallIds: identifierPool("free-split"),
      wallHeight: 300,
      wallThickness: 20
    });
    expect(freeArea.ok).toBe(true);
    if (!freeArea.ok) return;
    expect(freeArea.project.building.levels[0]!.walls).toHaveLength(8);

    const adjacent = createRoomFromShape(lower.project, {
      levelId: "ground-level",
      origin: { x: 425, z: 475 },
      shape: { kind: "RECTANGLE", dimensions: { width: 200, depth: 300 } },
      room: { id: "adjacent-room", name: "Adjacent room", type: "BEDROOM" },
      wallIds: ["adjacent-1", "adjacent-2", "adjacent-3", "adjacent-4"],
      splitWallIds: identifierPool("adjacent-split"),
      wallHeight: 300,
      wallThickness: 20
    });
    expect(adjacent.ok).toBe(true);
    if (!adjacent.ok) return;
    const level = adjacent.project.building.levels[0]!;
    expect(level.walls).toHaveLength(7);
    const shared = level.walls.find((wall) => wall.roomIds.length === 2);
    expect(shared?.roomIds).toEqual(["shape-room", "adjacent-room"]);
    expect(level.rooms[1]!.boundary[0]).toEqual({
      wallId: shared?.id,
      direction: "REVERSE"
    });
    expectCanonicalProject(adjacent.project);
  });

  it("reuses an exact horizontal Wall when a matching Rectangle is placed above", () => {
    const baseResult = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 500, depth: 300 }
    });
    expect(baseResult.ok).toBe(true);
    if (!baseResult.ok) return;

    const baseProject = structuredClone(baseResult.project);
    const baseLevel = baseProject.building.levels[0]!;
    const sharedBoundaryWall = baseLevel.walls[3]!;
    sharedBoundaryWall.openings = [
      {
        id: "boundary-window",
        type: "WINDOW",
        offsetFromStart: 100,
        width: 120,
        height: 100,
        elevation: 90
      }
    ];

    const result = createRoomFromShape(baseProject, {
      levelId: "ground-level",
      origin: { x: 25, z: 775 },
      shape: { kind: "RECTANGLE", dimensions: { width: 500, depth: 300 } },
      room: { id: "upper-room", name: "Upper room", type: "BEDROOM" },
      wallIds: ["upper-1", "upper-2", "upper-3", "upper-4"],
      splitWallIds: identifierPool("upper-split"),
      wallHeight: 300,
      wallThickness: 20
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.walls).toHaveLength(7);
    const shared = level.walls.find(
      (wall) => wall.id === sharedBoundaryWall.id
    );
    expect(shared).toMatchObject({
      id: "shape-wall-4",
      roomIds: ["shape-room", "upper-room"]
    });
    expect(shared?.openings).toEqual([
      {
        id: "boundary-window",
        type: "WINDOW",
        offsetFromStart: 100,
        width: 120,
        height: 100,
        elevation: 90
      }
    ]);
    expect(level.rooms[1]!.boundary[1]).toEqual({
      wallId: "shape-wall-4",
      direction: "REVERSE"
    });
    expect(
      level.walls.filter((wall) => wall.id.startsWith("upper-"))
    ).toHaveLength(3);
    expectCanonicalProject(result.project);
  });

  it("blocks an ambiguous populated-Level crossing without mutating the Project", () => {
    const lower = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 400, depth: 300 }
    });
    expect(lower.ok).toBe(true);
    if (!lower.ok) return;
    const before = structuredClone(lower.project);
    const result = createRoomFromShape(lower.project, {
      levelId: "ground-level",
      origin: { x: 225, z: 575 },
      shape: { kind: "RECTANGLE", dimensions: { width: 200, depth: 300 } },
      room: { id: "crossing-room", name: "Crossing", type: "OTHER" },
      wallIds: ["cross-1", "cross-2", "cross-3", "cross-4"],
      splitWallIds: identifierPool("cross-split"),
      wallHeight: 300,
      wallThickness: 20
    });
    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.STALE_ROOM_TOPOLOGY }]
    });
    expect(lower.project).toEqual(before);
  });

  it("reuses an exact Wall in the same physical orientation", () => {
    const base = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 500, depth: 300 }
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const project = structuredClone(base.project);
    const level = project.building.levels[0]!;
    const wall = level.walls[3]!;
    [wall.start, wall.end] = [wall.end, wall.start];
    const boundary = level.rooms[0]!.boundary[3]!;
    if ("kind" in boundary) throw new Error("Expected Wall boundary.");
    boundary.direction = "REVERSE";

    const result = createAdjacentRectangle(project, {
      originX: 25,
      width: 500,
      roomId: "same-direction-room"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]!.rooms[1]!.boundary[1]).toEqual({
      wallId: wall.id,
      direction: "FORWARD"
    });
    expectCanonicalProject(result.project);
  });

  it("reuses an exact edge represented by a contiguous Wall chain", () => {
    const base = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 500, depth: 300 }
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const split = splitWall(base.project, {
      levelId: "ground-level",
      wallId: "shape-wall-4",
      splitPoint: { x: 225, z: 475 },
      newWallId: "existing-chain-left"
    });
    expect(split.ok).toBe(true);
    if (!split.ok) return;

    const result = createAdjacentRectangle(split.project, {
      originX: 25,
      width: 500,
      roomId: "chain-room"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.walls).toHaveLength(8);
    expect(level.rooms[1]!.boundary.slice(1, 3)).toEqual([
      { wallId: "existing-chain-left", direction: "REVERSE" },
      { wallId: "shape-wall-4", direction: "REVERSE" }
    ]);
    expectCanonicalProject(result.project);
  });

  it.each([
    ["exact", 1, 7],
    ["partial", 0.6, 8]
  ] as const)(
    "normalizes sub-tolerance arithmetic drift for %s Wall reuse",
    (_, width, expectedWallCount) => {
      const project = createEmptyProject();
      const base = createRoomFromShape(project, {
        levelId: "ground-level",
        origin: { x: 0, z: 0.1 },
        shape: {
          kind: "RECTANGLE",
          dimensions: { width: 1, depth: 0.2 }
        },
        room: { id: "lower-room", name: "Lower", type: "OTHER" },
        wallIds: identifierPool("lower-wall"),
        splitWallIds: identifierPool("lower-split"),
        wallHeight: 3,
        wallThickness: 0.1
      });
      expect(base.ok).toBe(true);
      if (!base.ok) return;
      expect(0.3 - 0.2).not.toBe(0.1);

      const result = createRoomFromShape(base.project, {
        levelId: "ground-level",
        origin: { x: 0, z: 0.3 },
        shape: {
          kind: "RECTANGLE",
          dimensions: { width, depth: 0.2 }
        },
        room: { id: "upper-room", name: "Upper", type: "OTHER" },
        wallIds: identifierPool("upper-wall"),
        splitWallIds: identifierPool("upper-split"),
        wallHeight: 3,
        wallThickness: 0.1
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const level = result.project.building.levels[0]!;
      expect(level.walls).toHaveLength(expectedWallCount);
      expect(
        level.walls.some(
          (wall) =>
            wall.roomIds.includes("lower-room") &&
            wall.roomIds.includes("upper-room")
        )
      ).toBe(true);
      expectCanonicalProject(result.project);
    }
  );

  it("reuses one ordered edge chain owned by different neighboring Rooms", () => {
    const project = createEmptyProject();
    const left = createRoomFromShape(project, {
      levelId: "ground-level",
      origin: { x: 0, z: 3 },
      shape: {
        kind: "RECTANGLE",
        dimensions: { width: 6, depth: 3 }
      },
      room: { id: "left-room", name: "Left", type: "OTHER" },
      wallIds: identifierPool("left-wall"),
      splitWallIds: identifierPool("left-split"),
      wallHeight: 3,
      wallThickness: 0.2
    });
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    const right = createRoomFromShape(left.project, {
      levelId: "ground-level",
      origin: { x: 6, z: 3 },
      shape: {
        kind: "RECTANGLE",
        dimensions: { width: 4, depth: 3 }
      },
      room: { id: "right-room", name: "Right", type: "OTHER" },
      wallIds: identifierPool("right-wall"),
      splitWallIds: identifierPool("right-split"),
      wallHeight: 3,
      wallThickness: 0.2
    });
    expect(right.ok).toBe(true);
    if (!right.ok) return;

    const result = createRoomFromShape(right.project, {
      levelId: "ground-level",
      origin: { x: 0, z: 5 },
      shape: {
        kind: "RECTANGLE",
        dimensions: { width: 10, depth: 2 }
      },
      room: { id: "upper-room", name: "Upper", type: "OTHER" },
      wallIds: identifierPool("upper-wall"),
      splitWallIds: identifierPool("upper-split"),
      wallHeight: 3,
      wallThickness: 0.2
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    const sharedChain = level.walls.filter((wall) =>
      wall.roomIds.includes("upper-room")
    );
    expect(sharedChain).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ roomIds: ["left-room", "upper-room"] }),
        expect.objectContaining({ roomIds: ["right-room", "upper-room"] })
      ])
    );
    expect(level.rooms.at(-1)!.boundary).toHaveLength(5);
    expectCanonicalProject(result.project);
  });

  it("splits and shares from either endpoint of a longer Wall", () => {
    const base = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 500, depth: 300 }
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;

    const left = createAdjacentRectangle(base.project, {
      originX: 25,
      width: 400,
      roomId: "left-partial-room"
    });
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    assertPartialTopology(left.project, "left-partial-room", 400, 100);
    expect(left.project.building.levels[0]!.rooms[1]!.boundary[1]).toEqual({
      wallId: "left-partial-room-split-1",
      direction: "REVERSE"
    });

    const right = createAdjacentRectangle(base.project, {
      originX: 125,
      width: 400,
      roomId: "right-partial-room"
    });
    expect(right.ok).toBe(true);
    if (!right.ok) return;
    assertPartialTopology(right.project, "right-partial-room", 400, 100);
    expect(right.project.building.levels[0]!.rooms[1]!.boundary[1]).toEqual({
      wallId: "shape-wall-4",
      direction: "REVERSE"
    });
  });

  it("splits both endpoints of a strictly contained Room edge", () => {
    const base = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 500, depth: 300 }
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;

    const result = createAdjacentRectangle(base.project, {
      originX: 75,
      width: 400,
      roomId: "contained-room"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.walls).toHaveLength(9);
    expect(
      level.walls
        .filter((wall) => wall.roomIds.includes("shape-room"))
        .map(wallLength)
        .filter((length) => [50, 400].includes(length))
        .sort((first, second) => first - second)
    ).toEqual([50, 50, 400]);
    const shared = level.walls.find((wall) => wall.roomIds.length === 2)!;
    expect(wallLength(shared)).toBe(400);
    expect(shared.id).toBe("contained-room-split-2");
    expect(level.rooms[0]!.boundary.slice(3)).toEqual([
      { wallId: "shape-wall-4", direction: "FORWARD" },
      { wallId: "contained-room-split-2", direction: "FORWARD" },
      { wallId: "contained-room-split-1", direction: "FORWARD" }
    ]);
    expect(level.rooms[1]!.boundary[1]).toEqual({
      wallId: shared.id,
      direction: "REVERSE"
    });
    expectCanonicalProject(result.project);
  });

  it("preserves reverse Room traversal through a two-split Wall", () => {
    const base = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 500, depth: 300 }
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const project = structuredClone(base.project);
    const level = project.building.levels[0]!;
    const wall = level.walls[3]!;
    [wall.start, wall.end] = [wall.end, wall.start];
    const oldUse = level.rooms[0]!.boundary[3]!;
    if ("kind" in oldUse) throw new Error("Expected Wall boundary.");
    oldUse.direction = "REVERSE";

    const result = createAdjacentRectangle(project, {
      originX: 75,
      width: 400,
      roomId: "reverse-contained-room"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const resultLevel = result.project.building.levels[0]!;
    expect(resultLevel.rooms[0]!.boundary.slice(3)).toEqual([
      { wallId: "reverse-contained-room-split-1", direction: "REVERSE" },
      { wallId: "reverse-contained-room-split-2", direction: "REVERSE" },
      { wallId: "shape-wall-4", direction: "REVERSE" }
    ]);
    expect(resultLevel.rooms[1]!.boundary[1]).toEqual({
      wallId: "reverse-contained-room-split-2",
      direction: "FORWARD"
    });
    expectCanonicalProject(result.project);
  });

  it("preserves Openings across all unaffected two-split fragments", () => {
    const base = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 500, depth: 300 }
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const project = structuredClone(base.project);
    project.building.levels[0]!.walls[3]!.openings = [
      createWindow("near-start", 10, 20),
      createWindow("middle", 100, 20),
      createWindow("near-end", 460, 20)
    ];

    const result = createAdjacentRectangle(project, {
      originX: 75,
      width: 400,
      roomId: "opening-room"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const walls = result.project.building.levels[0]!.walls;
    expect(walls.find((wall) => wall.id === "shape-wall-4")!.openings).toEqual([
      createWindow("near-start", 10, 20)
    ]);
    expect(
      walls.find((wall) => wall.id === "opening-room-split-2")!.openings
    ).toEqual([createWindow("middle", 50, 20)]);
    expect(
      walls.find((wall) => wall.id === "opening-room-split-1")!.openings
    ).toEqual([createWindow("near-end", 10, 20)]);
    expectCanonicalProject(result.project);
  });

  it("preserves and re-offsets Openings on both children of one split", () => {
    const base = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 500, depth: 300 }
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const project = structuredClone(base.project);
    project.building.levels[0]!.walls[3]!.openings = [
      createWindow("original-child", 20, 20),
      createWindow("new-child", 200, 20)
    ];

    const result = createAdjacentRectangle(project, {
      originX: 25,
      width: 400,
      roomId: "one-split-opening-room"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const walls = result.project.building.levels[0]!.walls;
    const originalChild = walls.find((wall) => wall.id === "shape-wall-4")!;
    const newChild = walls.find(
      (wall) => wall.id === "one-split-opening-room-split-1"
    )!;
    expect(originalChild).toMatchObject({ height: 300, thickness: 20 });
    expect(newChild).toMatchObject({ height: 300, thickness: 20 });
    expect(originalChild.openings).toEqual([
      createWindow("original-child", 20, 20)
    ]);
    expect(newChild.openings).toEqual([createWindow("new-child", 100, 20)]);
    expectCanonicalProject(result.project);
  });

  it("rejects a required split through an Opening atomically", () => {
    const base = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 500, depth: 300 }
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const project = structuredClone(base.project);
    project.building.levels[0]!.walls[3]!.openings = [
      createWindow("split-crossing-window", 80, 40)
    ];
    const before = structuredClone(project);

    const result = createAdjacentRectangle(project, {
      originX: 25,
      width: 400,
      roomId: "blocked-room"
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.WALL_SPLIT_INTERSECTS_OPENING }]
    });
    expect(project).toEqual(before);
  });

  it("rejects third ownership of an already shared Wall atomically", () => {
    const base = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 500, depth: 300 }
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const second = createAdjacentRectangle(base.project, {
      originX: 25,
      width: 500,
      roomId: "second-room"
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const before = structuredClone(second.project);

    const third = createAdjacentRectangle(second.project, {
      originX: 25,
      width: 500,
      roomId: "third-room"
    });

    expect(third).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.STALE_ROOM_TOPOLOGY }]
    });
    expect(second.project).toEqual(before);
  });

  it("does not reuse a nearby non-collinear Wall", () => {
    const project = createEmptyProject();
    project.building.levels[0]!.walls.push(
      createUnreferencedWall(
        "nearby-wall",
        { x: 0, z: -0.01 },
        { x: 400, z: -0.01 }
      )
    );

    const result = createRoomFromShape(project, {
      levelId: "ground-level",
      origin: { x: 0, z: 300 },
      shape: { kind: "RECTANGLE", dimensions: { width: 400, depth: 300 } },
      room: { id: "nearby-room", name: "Nearby", type: "OTHER" },
      wallIds: identifierPool("nearby-room-wall"),
      splitWallIds: identifierPool("nearby-room-split"),
      wallHeight: 300,
      wallThickness: 20
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]!.walls).toHaveLength(5);
    expect(
      result.project.building.levels[0]!.walls.find(
        (wall) => wall.id === "nearby-wall"
      )!.roomIds
    ).toEqual([]);
    expectCanonicalProject(result.project);
  });

  it("creates uncovered boundary fragments around a contained existing Wall", () => {
    const project = createEmptyProject();
    project.building.levels[0]!.walls.push(
      createUnreferencedWall(
        "contained-existing-wall",
        { x: 100, z: 0 },
        { x: 300, z: 0 }
      )
    );

    const result = createRoomFromShape(project, {
      levelId: "ground-level",
      origin: { x: 0, z: 300 },
      shape: { kind: "RECTANGLE", dimensions: { width: 400, depth: 300 } },
      room: { id: "segmented-room", name: "Segmented", type: "OTHER" },
      wallIds: identifierPool("segmented-room-wall"),
      splitWallIds: identifierPool("segmented-room-split"),
      wallHeight: 300,
      wallThickness: 20
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.walls).toHaveLength(6);
    expect(level.rooms[0]!.boundary).toHaveLength(6);
    expect(
      level.rooms[0]!.boundary.filter(
        (edge) => !("kind" in edge) && edge.wallId === "contained-existing-wall"
      )
    ).toHaveLength(1);
    expectCanonicalProject(result.project);
  });

  it("supports another adjacent Room after topology has already been split", () => {
    const base = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 500, depth: 300 }
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const first = createAdjacentRectangle(base.project, {
      originX: 25,
      width: 200,
      roomId: "first-upper-room"
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = createAdjacentRectangle(first.project, {
      originX: 225,
      width: 300,
      roomId: "second-upper-room"
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const level = second.project.building.levels[0]!;
    expect(level.rooms).toHaveLength(3);
    expect(
      level.walls.filter((wall) => wall.roomIds.length === 2)
    ).toHaveLength(3);
    expectCanonicalProject(second.project);
  });

  it("reconciles a rotated Room shape without persisting authoring metadata", () => {
    const base = commit(createEmptyProject(), {
      kind: "RECTANGLE",
      dimensions: { width: 500, depth: 300 }
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;

    const result = createRoomFromShape(base.project, {
      levelId: "ground-level",
      origin: { x: 25, z: 775 },
      shape: {
        kind: "RECTANGLE",
        dimensions: { width: 300, depth: 500 },
        rotation: 90
      },
      room: { id: "rotated-room", name: "Rotated", type: "OTHER" },
      wallIds: identifierPool("rotated-room-wall"),
      splitWallIds: identifierPool("rotated-room-split"),
      wallHeight: 300,
      wallThickness: 20
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.project.building.levels[0]!.walls.find(
        (wall) => wall.id === "shape-wall-4"
      )!.roomIds
    ).toEqual(["shape-room", "rotated-room"]);
    expect(JSON.stringify(result.project)).not.toContain("rotation");
    expectCanonicalProject(result.project);
  });

  it.each<RoomShapeDefinition>([
    {
      kind: "L_SHAPE",
      dimensions: { width: 500, depth: 400, notchWidth: 200, notchDepth: 150 }
    },
    {
      kind: "U_SHAPE",
      dimensions: {
        width: 520,
        depth: 420,
        leftWingWidth: 140,
        rightWingWidth: 140,
        notchDepth: 260
      }
    },
    {
      kind: "T_SHAPE",
      dimensions: { width: 500, depth: 420, stemWidth: 180, stemDepth: 260 }
    }
  ])("reuses canonical topology for a $kind Room boundary", (shape) => {
    const project = createEmptyProject();
    const origin = { x: 0, z: 500 };
    const vertices = deriveRoomShapeVertices(origin, shape)!;
    project.building.levels[0]!.walls.push(
      createUnreferencedWall("existing-shape-edge", vertices[0]!, vertices[1]!)
    );

    const result = createRoomFromShape(project, {
      levelId: "ground-level",
      origin,
      shape,
      room: { id: "non-rect-room", name: "Non-rect", type: "OTHER" },
      wallIds: identifierPool("non-rect-wall"),
      splitWallIds: identifierPool("non-rect-split"),
      wallHeight: 300,
      wallThickness: 20
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]!.rooms[0]!.boundary[0]).toEqual({
      wallId: "existing-shape-edge",
      direction: "FORWARD"
    });
    expectCanonicalProject(result.project);
  });
});

function commit(project: Project, shape: RoomShapeDefinition) {
  const wallCount =
    deriveRoomShapeVertices({ x: 25, z: 475 }, shape)?.length ?? 0;
  return createRoomFromShape(project, {
    levelId: "ground-level",
    origin: { x: 25, z: 475 },
    shape,
    room: { id: "shape-room", name: "Room 1", type: "OTHER" },
    wallIds: Array.from(
      { length: wallCount },
      (_, index) => `shape-wall-${index + 1}`
    ),
    splitWallIds: identifierPool("shape-split"),
    wallHeight: 300,
    wallThickness: 20
  });
}

function createAdjacentRectangle(
  project: Project,
  options: {
    readonly originX: number;
    readonly width: number;
    readonly roomId: string;
  }
) {
  return createRoomFromShape(project, {
    levelId: "ground-level",
    origin: { x: options.originX, z: 775 },
    shape: {
      kind: "RECTANGLE",
      dimensions: { width: options.width, depth: 300 }
    },
    room: { id: options.roomId, name: options.roomId, type: "OTHER" },
    wallIds: identifierPool(`${options.roomId}-wall`),
    splitWallIds: identifierPool(`${options.roomId}-split`),
    wallHeight: 300,
    wallThickness: 20
  });
}

function assertPartialTopology(
  project: Project,
  roomId: string,
  sharedLength: number,
  residualLength: number
) {
  const level = project.building.levels[0]!;
  const shared = level.walls.find((wall) => wall.roomIds.length === 2)!;
  const residual = level.walls.find(
    (wall) =>
      wall.roomIds.length === 1 &&
      wall.roomIds[0] === "shape-room" &&
      wallLength(wall) === residualLength
  );
  expect(level.walls).toHaveLength(8);
  expect(wallLength(shared)).toBe(sharedLength);
  expect(shared.roomIds).toEqual(["shape-room", roomId]);
  expect(residual).toBeTruthy();
  expect(level.rooms[0]!.boundary).toHaveLength(5);
  expect(level.rooms[1]!.boundary).toHaveLength(4);
  expect(
    level.walls.filter(
      (wall) => wall.roomIds.length === 1 && wall.roomIds[0] === roomId
    )
  ).toHaveLength(3);
  expectCanonicalProject(project);
}

function wallLength(wall: Pick<Wall, "start" | "end">): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
}

function createWindow(id: string, offsetFromStart: number, width: number) {
  return {
    id,
    type: "WINDOW" as const,
    offsetFromStart,
    width,
    height: 100,
    elevation: 90
  };
}

function createUnreferencedWall(
  id: string,
  start: Wall["start"],
  end: Wall["end"]
): Wall {
  return {
    id,
    start,
    end,
    height: 300,
    thickness: 20,
    roomIds: [],
    openings: []
  };
}

function identifierPool(prefix: string, count = 24): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

function measure(
  vertices: readonly { readonly x: number; readonly z: number }[]
) {
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
  expect(ProjectSchema.safeParse(project).success).toBe(true);
  expect(validateProjectCrossReferences(project).valid).toBe(true);
  expect(validateProjectReferenceConsistency(project).valid).toBe(true);
  expect(validateProjectGeometry(project).valid).toBe(true);
}

function createEmptyProject(): Project {
  return {
    id: "shape-authoring-project",
    name: "Shape Authoring Project",
    schemaVersion: "4.0.0",
    revision: 1,
    createdAt: "2026-08-26T10:00:00+02:00",
    updatedAt: "2026-08-26T10:00:00+02:00",
    units: { length: "cm", angle: "deg" },
    building: {
      furniture: [],
      id: "building",
      name: "Building",
      type: "HOUSE",
      levels: [
        {
          id: "ground-level",
          name: "Ground Floor",
          elevation: 0,
          rooms: [],
          walls: [],
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
