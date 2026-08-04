import { describe, expect, it } from "vitest";

import { LegacyRoomBoundaryMigrationFailureReason } from "./migration-error.js";
import { resolveLegacyRoomBoundary } from "./legacy-room-boundary-resolver.js";

type TestWall = {
  id: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
};

const rectangleWalls: TestWall[] = [
  { id: "north", start: { x: 0, z: 0 }, end: { x: 10, z: 0 } },
  { id: "east", start: { x: 10, z: 0 }, end: { x: 10, z: 8 } },
  { id: "south", start: { x: 10, z: 8 }, end: { x: 0, z: 8 } },
  { id: "west", start: { x: 0, z: 8 }, end: { x: 0, z: 0 } }
];

const resolve = (wallIds: readonly string[], walls: readonly TestWall[] = rectangleWalls) =>
  resolveLegacyRoomBoundary({
    roomId: "living-room",
    levelId: "ground-level",
    wallIds,
    walls,
    path: "building.levels.0.rooms.0.wallIds"
  });

const expectFailureReason = (
  wallIds: readonly string[],
  walls: readonly TestWall[],
  reason: LegacyRoomBoundaryMigrationFailureReason
) => {
  const result = resolve(wallIds, walls);

  expect(result.ok).toBe(false);

  if (!result.ok) {
    expect(result.errors[0]?.reason).toBe(reason);
  }
};

describe("resolveLegacyRoomBoundary", () => {
  it("returns an empty draft boundary", () => {
    expect(resolve([])).toEqual({ ok: true, boundary: [] });
  });

  it("resolves an ordered rectangle", () => {
    expect(resolve(["north", "east", "south", "west"])).toEqual({
      ok: true,
      boundary: [
        { wallId: "north", direction: "FORWARD" },
        { wallId: "east", direction: "FORWARD" },
        { wallId: "south", direction: "FORWARD" },
        { wallId: "west", direction: "FORWARD" }
      ]
    });
  });

  it("resolves a shuffled rectangle with deterministic output", () => {
    expect(resolve(["south", "north", "west", "east"])).toEqual(resolve(["north", "east", "south", "west"]));
  });

  it("uses REVERSE when traversal follows a wall from end to start", () => {
    const walls = [
      { id: "north", start: { x: 10, z: 0 }, end: { x: 0, z: 0 } },
      rectangleWalls[1],
      rectangleWalls[2],
      rectangleWalls[3]
    ].filter((wall): wall is TestWall => wall !== undefined);

    const result = resolve(["north", "east", "south", "west"], walls);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.boundary[0]).toEqual({ wallId: "north", direction: "REVERSE" });
    }
  });

  it("normalizes clockwise reconstruction to counter-clockwise output", () => {
    const walls = [
      { id: "a-west", start: { x: 0, z: 8 }, end: { x: 0, z: 0 } },
      { id: "b-north", start: { x: 0, z: 0 }, end: { x: 10, z: 0 } },
      { id: "c-east", start: { x: 10, z: 0 }, end: { x: 10, z: 8 } },
      { id: "d-south", start: { x: 10, z: 8 }, end: { x: 0, z: 8 } }
    ];

    expect(resolve(["a-west", "b-north", "c-east", "d-south"], walls)).toEqual({
      ok: true,
      boundary: [
        { wallId: "b-north", direction: "FORWARD" },
        { wallId: "c-east", direction: "FORWARD" },
        { wallId: "d-south", direction: "FORWARD" },
        { wallId: "a-west", direction: "FORWARD" }
      ]
    });
  });

  it("reports missing walls", () => {
    expectFailureReason(["north", "east", "south", "missing"], rectangleWalls, LegacyRoomBoundaryMigrationFailureReason.MISSING_WALL);
  });

  it("reports cross-level walls when detectable", () => {
    const result = resolveLegacyRoomBoundary({
      roomId: "living-room",
      levelId: "ground-level",
      wallIds: ["north", "east", "south", "other-level-wall"],
      walls: rectangleWalls,
      allWalls: [{ id: "other-level-wall", levelId: "upper-level", start: { x: 0, z: 8 }, end: { x: 0, z: 0 } }],
      path: "building.levels.0.rooms.0.wallIds"
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors[0]?.reason).toBe(LegacyRoomBoundaryMigrationFailureReason.CROSS_LEVEL_WALL);
    }
  });

  it("reports duplicate wall IDs", () => {
    expectFailureReason(["north", "east", "south", "north"], rectangleWalls, LegacyRoomBoundaryMigrationFailureReason.DUPLICATE_WALL_REFERENCE);
  });

  it("reports degenerate walls", () => {
    const walls = [{ id: "north", start: { x: 0, z: 0 }, end: { x: 0, z: 0 } }, ...rectangleWalls.slice(1)];

    expectFailureReason(["north", "east", "south", "west"], walls, LegacyRoomBoundaryMigrationFailureReason.DEGENERATE_WALL);
  });

  it("reports open chains", () => {
    expectFailureReason(["north", "east", "south"], rectangleWalls, LegacyRoomBoundaryMigrationFailureReason.OPEN_LOOP);
  });

  it("reports disconnected walls", () => {
    const walls = [
      ...rectangleWalls,
      { id: "far-north", start: { x: 20, z: 20 }, end: { x: 30, z: 20 } },
      { id: "far-east", start: { x: 30, z: 20 }, end: { x: 30, z: 30 } },
      { id: "far-south", start: { x: 30, z: 30 }, end: { x: 20, z: 30 } },
      { id: "far-west", start: { x: 20, z: 30 }, end: { x: 20, z: 20 } }
    ];

    expectFailureReason(
      ["north", "east", "south", "west", "far-north", "far-east", "far-south", "far-west"],
      walls,
      LegacyRoomBoundaryMigrationFailureReason.DISCONNECTED_LOOP
    );
  });

  it("reports branching graphs", () => {
    const walls = [...rectangleWalls, { id: "branch", start: { x: 0, z: 0 }, end: { x: -5, z: 0 } }];

    expectFailureReason(["north", "east", "south", "west", "branch"], walls, LegacyRoomBoundaryMigrationFailureReason.BRANCHING_GRAPH);
  });

  it("reports multiple cycles", () => {
    const walls = [
      { id: "a", start: { x: 0, z: 0 }, end: { x: 10, z: 0 } },
      { id: "b", start: { x: 10, z: 0 }, end: { x: 10, z: 10 } },
      { id: "c", start: { x: 10, z: 10 }, end: { x: 0, z: 10 } },
      { id: "d", start: { x: 0, z: 10 }, end: { x: 0, z: 0 } },
      { id: "e", start: { x: 0, z: 0 }, end: { x: 10, z: 10 } }
    ];

    const result = resolve(["a", "b", "c", "d", "e"], walls);

    expect(result.ok).toBe(false);
  });

  it("reports duplicate wall geometry", () => {
    const walls = [...rectangleWalls, { id: "north-copy", start: { x: 10, z: 0 }, end: { x: 0, z: 0 } }];

    expectFailureReason(["north", "east", "south", "west", "north-copy"], walls, LegacyRoomBoundaryMigrationFailureReason.DUPLICATE_WALL_GEOMETRY);
  });

  it("reports self-intersecting bow-tie loops", () => {
    const walls = [
      { id: "a", start: { x: 0, z: 0 }, end: { x: 10, z: 10 } },
      { id: "b", start: { x: 10, z: 10 }, end: { x: 0, z: 10 } },
      { id: "c", start: { x: 0, z: 10 }, end: { x: 10, z: 0 } },
      { id: "d", start: { x: 10, z: 0 }, end: { x: 0, z: 0 } }
    ];

    expectFailureReason(["a", "b", "c", "d"], walls, LegacyRoomBoundaryMigrationFailureReason.SELF_INTERSECTING_LOOP);
  });

  it("reports partial boundary overlaps", () => {
    const walls = [
      { id: "a", start: { x: 0, z: 0 }, end: { x: 10, z: 0 } },
      { id: "b", start: { x: 10, z: 0 }, end: { x: 5, z: 0 } },
      { id: "c", start: { x: 5, z: 0 }, end: { x: 5, z: 5 } },
      { id: "d", start: { x: 5, z: 5 }, end: { x: 0, z: 5 } },
      { id: "e", start: { x: 0, z: 5 }, end: { x: 0, z: 0 } }
    ];

    expectFailureReason(["a", "b", "c", "d", "e"], walls, LegacyRoomBoundaryMigrationFailureReason.PARTIAL_BOUNDARY_OVERLAP);
  });

  it("resolves shared walls with opposite traversal where expected", () => {
    const walls = [
      { id: "shared", start: { x: 10, z: 0 }, end: { x: 10, z: 10 } },
      { id: "a-north", start: { x: 0, z: 0 }, end: { x: 10, z: 0 } },
      { id: "a-south", start: { x: 10, z: 10 }, end: { x: 0, z: 10 } },
      { id: "a-west", start: { x: 0, z: 10 }, end: { x: 0, z: 0 } },
      { id: "b-north", start: { x: 10, z: 0 }, end: { x: 20, z: 0 } },
      { id: "b-east", start: { x: 20, z: 0 }, end: { x: 20, z: 10 } },
      { id: "b-south", start: { x: 20, z: 10 }, end: { x: 10, z: 10 } }
    ];

    const roomA = resolve(["shared", "a-north", "a-south", "a-west"], walls);
    const roomB = resolve(["shared", "b-north", "b-east", "b-south"], walls);

    expect(roomA.ok).toBe(true);
    expect(roomB.ok).toBe(true);

    if (roomA.ok && roomB.ok) {
      expect(roomA.boundary.find((edge) => edge.wallId === "shared")?.direction).not.toBe(
        roomB.boundary.find((edge) => edge.wallId === "shared")?.direction
      );
    }
  });
});
