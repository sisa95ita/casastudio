import { describe, expect, it } from "vitest";

import type { Project } from "../project/index.js";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  ValidationErrorCode
} from "../validation/index.js";
import {
  collapseWallJunction,
  createConnectedWall,
  deleteWallAndCollapseRedundantTopology,
  splitWall,
  type WallInteriorConnection
} from "./wall-editing.js";
import type { Room } from "./room.js";
import type { Wall } from "./wall.js";

describe("splitWall", () => {
  it("splits a standalone Wall immutably and preserves stable identity, properties, and server fields", () => {
    const project = createProject([createWall("target", 0, 0, 100, 0)]);
    const before = structuredClone(project);
    const result = splitWall(project, {
      levelId: "ground-floor",
      wallId: "target",
      splitPoint: { x: 40, z: 0 },
      newWallId: "target-second"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(project).toEqual(before);
    expect(result.project).toMatchObject({
      id: project.id,
      revision: project.revision,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    });
    expect(result.project.building.levels[0]?.walls).toEqual([
      expect.objectContaining({
        id: "target",
        start: { x: 0, z: 0 },
        end: { x: 40, z: 0 },
        height: 280,
        thickness: 18
      }),
      expect.objectContaining({
        id: "target-second",
        start: { x: 40, z: 0 },
        end: { x: 100, z: 0 },
        height: 280,
        thickness: 18
      })
    ]);
    expectCanonicalValidity(result.project);
  });

  it.each([
    ["missing-level", "target", { x: 50, z: 0 }, ValidationErrorCode.LEVEL_NOT_FOUND],
    ["ground-floor", "missing", { x: 50, z: 0 }, ValidationErrorCode.WALL_NOT_FOUND],
    ["ground-floor", "target", { x: Number.NaN, z: 0 }, ValidationErrorCode.INVALID_WALL_ENDPOINT],
    ["ground-floor", "target", { x: 50, z: 1 }, ValidationErrorCode.WALL_SPLIT_POINT_NOT_ON_WALL],
    ["ground-floor", "target", { x: 0, z: 0 }, ValidationErrorCode.WALL_SPLIT_AT_ENDPOINT],
    ["ground-floor", "target", { x: 100, z: 0 }, ValidationErrorCode.WALL_SPLIT_AT_ENDPOINT]
  ] as const)(
    "rejects invalid split input for level %s and wall %s",
    (levelId, wallId, splitPoint, code) => {
      const project = createProject([createWall("target", 0, 0, 100, 0)]);
      const before = structuredClone(project);
      const result = splitWall(project, {
        levelId,
        wallId,
        splitPoint,
        newWallId: "target-second"
      });

      expect(result).toMatchObject({ ok: false, errors: [{ code }] });
      expect(project).toEqual(before);
    }
  );

  it("rewrites a forward Room boundary in place without changing its area", () => {
    const project = createRectangleProject();
    const result = splitWall(project, {
      levelId: "ground-floor",
      wallId: "south",
      splitPoint: { x: 40, z: 0 },
      newWallId: "south-second"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.rooms).toHaveLength(1);
    expect(level.rooms[0]?.boundary).toEqual([
      { wallId: "south", direction: "FORWARD" },
      { wallId: "south-second", direction: "FORWARD" },
      { wallId: "east", direction: "FORWARD" },
      { wallId: "north", direction: "FORWARD" },
      { wallId: "west", direction: "FORWARD" }
    ]);
    expect(level.walls.slice(0, 2).map((wall) => wall.roomIds)).toEqual([
      ["room"],
      ["room"]
    ]);
    expect(polygonArea(level.rooms[0]!, level.walls)).toBe(10_000);
    expectCanonicalValidity(result.project);
  });

  it("preserves reverse traversal order and orientation", () => {
    const project = createRectangleProject();
    const level = project.building.levels[0]!;
    level.walls[0] = {
      ...level.walls[0]!,
      start: { x: 100, z: 0 },
      end: { x: 0, z: 0 }
    };
    level.rooms[0]!.boundary[0] = {
      wallId: "south",
      direction: "REVERSE"
    };

    const result = splitWall(project, {
      levelId: "ground-floor",
      wallId: "south",
      splitPoint: { x: 40, z: 0 },
      newWallId: "south-second"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]?.rooms[0]?.boundary.slice(0, 2)).toEqual([
      { wallId: "south-second", direction: "REVERSE" },
      { wallId: "south", direction: "REVERSE" }
    ]);
    expectCanonicalValidity(result.project);
  });

  it("updates both orientations and reciprocal roomIds for a shared Wall", () => {
    const project = createSharedWallProject();
    const result = splitWall(project, {
      levelId: "ground-floor",
      wallId: "shared",
      splitPoint: { x: 100, z: 40 },
      newWallId: "shared-second"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.rooms[0]?.boundary.slice(1, 3)).toEqual([
      { wallId: "shared", direction: "FORWARD" },
      { wallId: "shared-second", direction: "FORWARD" }
    ]);
    expect(level.rooms[1]?.boundary.slice(-2)).toEqual([
      { wallId: "shared-second", direction: "REVERSE" },
      { wallId: "shared", direction: "REVERSE" }
    ]);
    expect(
      level.walls
        .filter((wall) => wall.id.startsWith("shared"))
        .map((wall) => wall.roomIds)
    ).toEqual([
      ["left-room", "right-room"],
      ["left-room", "right-room"]
    ]);
    expectCanonicalValidity(result.project);
  });

  it("redistributes Openings by wall-relative distance while preserving IDs", () => {
    const wall = createWall("target", 0, 0, 100, 0);
    wall.openings = [
      createOpening("first-opening", 10, 20),
      createOpening("second-opening", 70, 15)
    ];
    const result = splitWall(createProject([wall]), {
      levelId: "ground-floor",
      wallId: "target",
      splitPoint: { x: 50, z: 0 },
      newWallId: "target-second"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [first, second] = result.project.building.levels[0]!.walls;
    expect(first?.openings).toEqual([
      expect.objectContaining({ id: "first-opening", offsetFromStart: 10 })
    ]);
    expect(second?.openings).toEqual([
      expect.objectContaining({ id: "second-opening", offsetFromStart: 20 })
    ]);
    expectCanonicalValidity(result.project);
  });

  it("rejects a split through an Opening without mutating the Project", () => {
    const wall = createWall("target", 0, 0, 100, 0);
    wall.openings = [createOpening("crossing-opening", 40, 20)];
    const project = createProject([wall]);
    const before = structuredClone(project);
    const result = splitWall(project, {
      levelId: "ground-floor",
      wallId: "target",
      splitPoint: { x: 50, z: 0 },
      newWallId: "target-second"
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.WALL_SPLIT_INTERSECTS_OPENING }]
    });
    expect(project).toEqual(before);
  });
});

describe("createConnectedWall", () => {
  it.each([
    ["free-to-free", { x: 0, z: 50 }, { x: 50, z: 50 }, undefined, undefined],
    ["free-to-vertex", { x: 0, z: 50 }, { x: 100, z: 100 }, undefined, undefined],
    ["vertex-to-free", { x: 0, z: 0 }, { x: 50, z: 50 }, undefined, undefined],
    ["vertex-to-vertex", { x: 0, z: 0 }, { x: 100, z: 100 }, undefined, undefined],
    ["free-to-interior", { x: 0, z: 50 }, { x: 50, z: 0 }, undefined, connection("base-a-second")],
    ["interior-to-free", { x: 50, z: 0 }, { x: 50, z: 50 }, connection("base-a-second"), undefined],
    ["interior-to-vertex", { x: 50, z: 0 }, { x: 100, z: 100 }, connection("base-a-second"), undefined],
    ["vertex-to-interior", { x: 100, z: 100 }, { x: 50, z: 0 }, undefined, connection("base-a-second")]
  ] as const)("creates %s topology in one immutable result", (_name, start, end, startConnection, endConnection) => {
    const project = createProject([
      createWall("base-a", 0, 0, 100, 0),
      createWall("base-b", 100, 100, 150, 100)
    ]);
    const before = structuredClone(project);
    const result = createConnectedWall(project, {
      levelId: "ground-floor",
      wall: createWall("connected", start.x, start.z, end.x, end.z),
      startConnection,
      endConnection
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(project).toEqual(before);
    expect(result.project.building.levels[0]?.walls.at(-1)?.id).toBe("connected");
    expect(result.project.building.levels[0]?.walls).toHaveLength(
      startConnection || endConnection ? 4 : 3
    );
    expectCanonicalValidity(result.project);
  });

  it("returns the original aggregate unchanged when creation fails after a valid split", () => {
    const project = createProject([createWall("base-a", 0, 0, 100, 0)]);
    const before = structuredClone(project);
    const result = createConnectedWall(project, {
      levelId: "ground-floor",
      wall: createWall("connected", 50, 0, 50, 0),
      startConnection: connection("base-a-second")
    });

    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: ValidationErrorCode.WALL_ZERO_LENGTH }]
    });
    expect(project).toEqual(before);
  });
});

describe("collapseWallJunction", () => {
  it("restores the original Wall identity and Opening offsets after a split", () => {
    const wall = createWall("target", 0, 0, 100, 0);
    wall.openings = [
      createOpening("first-opening", 10, 20),
      createOpening("second-opening", 70, 15)
    ];
    const split = splitWall(createProject([wall]), {
      levelId: "ground-floor",
      wallId: "target",
      splitPoint: { x: 50, z: 0 },
      newWallId: "target-second"
    });
    expect(split.ok).toBe(true);
    if (!split.ok) return;

    const result = collapseWallJunction(split.project, {
      levelId: "ground-floor",
      junction: { x: 50, z: 0 }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]?.walls).toEqual([
      expect.objectContaining({
        id: "target",
        start: { x: 0, z: 0 },
        end: { x: 100, z: 0 },
        openings: [
          expect.objectContaining({ id: "first-opening", offsetFromStart: 10 }),
          expect.objectContaining({ id: "second-opening", offsetFromStart: 70 })
        ]
      })
    ]);
    expectCanonicalValidity(result.project);
  });

  it("preserves Opening offsets when the surviving Wall orientation is reversed", () => {
    const wall = createWall("target", 100, 0, 0, 0);
    wall.openings = [
      createOpening("near-start", 10, 10),
      createOpening("near-end", 70, 10)
    ];
    const split = splitWall(createProject([wall]), {
      levelId: "ground-floor",
      wallId: "target",
      splitPoint: { x: 40, z: 0 },
      newWallId: "target-second"
    });
    expect(split.ok).toBe(true);
    if (!split.ok) return;

    const result = collapseWallJunction(split.project, {
      levelId: "ground-floor",
      junction: { x: 40, z: 0 }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]?.walls[0]).toMatchObject({
      id: "target",
      start: { x: 100, z: 0 },
      end: { x: 0, z: 0 },
      openings: [
        { id: "near-start", offsetFromStart: 10 },
        { id: "near-end", offsetFromStart: 70 }
      ]
    });
    expectCanonicalValidity(result.project);
  });

  it("preserves forward and reverse Room traversal while restoring area", () => {
    const forward = splitWall(createRectangleProject(), {
      levelId: "ground-floor",
      wallId: "south",
      splitPoint: { x: 40, z: 0 },
      newWallId: "south-second"
    });
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    const forwardResult = collapseWallJunction(forward.project, {
      levelId: "ground-floor",
      junction: { x: 40, z: 0 }
    });
    expect(forwardResult.ok).toBe(true);
    if (!forwardResult.ok) return;
    expect(forwardResult.project.building.levels[0]?.rooms[0]?.boundary[0]).toEqual({
      wallId: "south",
      direction: "FORWARD"
    });
    expect(forwardResult.project.building.levels[0]?.rooms[0]?.boundary).toHaveLength(4);
    expect(
      polygonArea(
        forwardResult.project.building.levels[0]!.rooms[0]!,
        forwardResult.project.building.levels[0]!.walls
      )
    ).toBe(10_000);

    const reverseProject = createRectangleProject();
    reverseProject.building.levels[0]!.walls[0] = {
      ...reverseProject.building.levels[0]!.walls[0]!,
      start: { x: 100, z: 0 },
      end: { x: 0, z: 0 }
    };
    reverseProject.building.levels[0]!.rooms[0]!.boundary[0] = {
      wallId: "south",
      direction: "REVERSE"
    };
    const reverse = splitWall(reverseProject, {
      levelId: "ground-floor",
      wallId: "south",
      splitPoint: { x: 40, z: 0 },
      newWallId: "south-second"
    });
    expect(reverse.ok).toBe(true);
    if (!reverse.ok) return;
    const reverseResult = collapseWallJunction(reverse.project, {
      levelId: "ground-floor",
      junction: { x: 40, z: 0 }
    });
    expect(reverseResult.ok).toBe(true);
    if (!reverseResult.ok) return;
    expect(reverseResult.project.building.levels[0]?.rooms[0]?.boundary[0]).toEqual({
      wallId: "south",
      direction: "REVERSE"
    });
    expectCanonicalValidity(reverseResult.project);
  });

  it("rewrites compatible uses for both Rooms sharing one Wall", () => {
    const split = splitWall(createSharedWallProject(), {
      levelId: "ground-floor",
      wallId: "shared",
      splitPoint: { x: 100, z: 40 },
      newWallId: "shared-second"
    });
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    const result = collapseWallJunction(split.project, {
      levelId: "ground-floor",
      junction: { x: 100, z: 40 }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level = result.project.building.levels[0]!;
    expect(level.walls.filter((wall) => wall.id.startsWith("shared"))).toEqual([
      expect.objectContaining({
        id: "shared",
        roomIds: ["left-room", "right-room"]
      })
    ]);
    expect(level.rooms[0]?.boundary[1]).toEqual({
      wallId: "shared",
      direction: "FORWARD"
    });
    expect(level.rooms[1]?.boundary.at(-1)).toEqual({
      wallId: "shared",
      direction: "REVERSE"
    });
    expectCanonicalValidity(result.project);
  });

  it.each([
    ["a third incident Wall", [createWall("first", 0, 0, 50, 0), createWall("second", 50, 0, 100, 0), createWall("third", 50, 0, 50, 50)]],
    ["different thickness", [createWall("first", 0, 0, 50, 0), { ...createWall("second", 50, 0, 100, 0), thickness: 24 }]],
    ["different height", [createWall("first", 0, 0, 50, 0), { ...createWall("second", 50, 0, 100, 0), height: 320 }]],
    ["non-collinear geometry", [createWall("first", 0, 0, 50, 0), createWall("second", 50, 0, 100, 1)]],
    ["incompatible Room references", [createWall("first", 0, 0, 50, 0), createWall("second", 50, 0, 100, 0, ["room"])]],
    ["an invalid Opening placement", [createWall("first", 0, 0, 50, 0), { ...createWall("second", 50, 0, 100, 0), openings: [createOpening("unsafe", 45, 10)] }]]
  ])("leaves topology unchanged for %s", (_reason, walls) => {
    const project = createProject(walls.map((wall) => structuredClone(wall)));
    const result = collapseWallJunction(project, {
      levelId: "ground-floor",
      junction: { x: 50, z: 0 }
    });

    expect(result).toEqual({ ok: true, project });
  });
});

describe("deleteWallAndCollapseRedundantTopology", () => {
  it("deletes a branch and atomically collapses only its newly redundant junction", () => {
    const project = createProject([
      createWall("original", 0, 0, 50, 0),
      createWall("split-child", 50, 0, 100, 0),
      createWall("branch", 50, 0, 50, 50),
      createWall("unrelated-a", 200, 0, 250, 0),
      createWall("unrelated-b", 250, 0, 300, 0)
    ]);
    const result = deleteWallAndCollapseRedundantTopology(project, {
      levelId: "ground-floor",
      wallId: "branch"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]?.walls).toEqual([
      expect.objectContaining({
        id: "original",
        start: { x: 0, z: 0 },
        end: { x: 100, z: 0 }
      }),
      expect.objectContaining({ id: "unrelated-a" }),
      expect.objectContaining({ id: "unrelated-b" })
    ]);
    expect(project.building.levels[0]?.walls).toHaveLength(5);
    expectCanonicalValidity(result.project);
  });

  it("restores a split Room Wall after deleting its standalone branch", () => {
    const split = splitWall(createRectangleProject(), {
      levelId: "ground-floor",
      wallId: "south",
      splitPoint: { x: 40, z: 0 },
      newWallId: "south-second"
    });
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    const connected = createConnectedWall(split.project, {
      levelId: "ground-floor",
      wall: createWall("branch", 40, 0, 40, 50)
    });
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;

    const result = deleteWallAndCollapseRedundantTopology(connected.project, {
      levelId: "ground-floor",
      wallId: "branch"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.building.levels[0]?.walls.some((wall) => wall.id === "south-second")).toBe(false);
    expect(result.project.building.levels[0]?.rooms[0]?.boundary).toHaveLength(4);
    expectCanonicalValidity(result.project);
  });
});

function connection(newWallId: string): WallInteriorConnection {
  return { wallId: "base-a", newWallId };
}

function createRectangleProject(): Project {
  const roomIds = ["room"];
  return createProject(
    [
      createWall("south", 0, 0, 100, 0, roomIds),
      createWall("east", 100, 0, 100, 100, roomIds),
      createWall("north", 100, 100, 0, 100, roomIds),
      createWall("west", 0, 100, 0, 0, roomIds)
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

function createSharedWallProject(): Project {
  const left = "left-room";
  const right = "right-room";
  return createProject(
    [
      createWall("left-south", 0, 0, 100, 0, [left]),
      createWall("shared", 100, 0, 100, 100, [left, right]),
      createWall("left-north", 100, 100, 0, 100, [left]),
      createWall("left-west", 0, 100, 0, 0, [left]),
      createWall("right-south", 100, 0, 200, 0, [right]),
      createWall("right-east", 200, 0, 200, 100, [right]),
      createWall("right-north", 200, 100, 100, 100, [right])
    ],
    [
      createRoom(left, ["left-south", "shared", "left-north", "left-west"]),
      {
        ...createRoom(right, ["right-south", "right-east", "right-north"]),
        boundary: [
          { wallId: "right-south", direction: "FORWARD" },
          { wallId: "right-east", direction: "FORWARD" },
          { wallId: "right-north", direction: "FORWARD" },
          { wallId: "shared", direction: "REVERSE" }
        ]
      }
    ]
  );
}

function createRoom(id: string, wallIds: readonly string[]): Room {
  return {
    id,
    name: id,
    type: "OTHER",
    boundary: wallIds.map((wallId) => ({ wallId, direction: "FORWARD" }))
  };
}

function createWall(
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

function createOpening(id: string, offsetFromStart: number, width: number) {
  return {
    id,
    type: "WINDOW" as const,
    offsetFromStart,
    width,
    height: 120,
    elevation: 90
  };
}

function createProject(walls: Wall[], rooms: Room[] = []): Project {
  return {
    id: "topology-project",
    name: "Topology Project",
    schemaVersion: "2.0.0",
    revision: 7,
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

function expectCanonicalValidity(project: Project): void {
  expect(validateProjectCrossReferences(project)).toEqual({ valid: true, errors: [] });
  expect(validateProjectReferenceConsistency(project)).toEqual({ valid: true, errors: [] });
  expect(validateProjectGeometry(project)).toEqual({ valid: true, errors: [] });
}

function polygonArea(room: Room, walls: readonly Wall[]): number {
  const byId = new Map(walls.map((wall) => [wall.id, wall]));
  const points = room.boundary.map((edge) => {
    const wall = byId.get(edge.wallId)!;
    return edge.direction === "FORWARD" ? wall.start : wall.end;
  });
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length]!;
      return sum + point.x * next.z - next.x * point.z;
    }, 0) / 2
  );
}
