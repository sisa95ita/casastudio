import { describe, expect, it } from "vitest";
import type { Level, Room, Wall } from "@casastudio/schema";

import {
  deriveRoomBoundaryPoints,
  measureLevel,
  measurePlan,
  measureRoom,
  measureWall
} from "./architectural-measurements.js";

describe("architectural measurements", () => {
  it("measures rectangular and irregular Rooms from their ordered Wall polygons", () => {
    const rectangle = levelFromPolygon("rectangle", [
      [0, 0], [400, 0], [400, 300], [0, 300]
    ]);
    const irregular = levelFromPolygon("irregular", [
      [0, 0], [400, 0], [400, 200], [250, 350], [0, 300]
    ]);

    expect(measureRoom(rectangle, rectangle.rooms[0]!)).toMatchObject({
      area: 120_000,
      perimeter: 1_400
    });
    expect(measureRoom(irregular, irregular.rooms[0]!)?.area).toBe(122_500);
    expect(measureRoom(irregular, irregular.rooms[0]!)?.perimeter).toBeCloseTo(
      400 + 200 + Math.hypot(150, 150) + Math.hypot(250, 50) + 300
    );
    expect(deriveRoomBoundaryPoints(irregular, irregular.rooms[0]!)).toEqual([
      { x: 0, z: 0 },
      { x: 400, z: 0 },
      { x: 400, z: 200 },
      { x: 250, z: 350 },
      { x: 0, z: 300 }
    ]);
  });

  it("counts shared and split Walls according to each Room's exact boundary", () => {
    const walls = [
      wall("bottom-a", 0, 0, 200, 0),
      wall("bottom-b", 200, 0, 400, 0),
      wall("right", 400, 0, 400, 200),
      wall("top-b", 400, 200, 200, 200),
      wall("top-a", 200, 200, 0, 200),
      wall("left", 0, 200, 0, 0),
      wall("shared", 200, 0, 200, 200)
    ];
    const rooms: Room[] = [
      room("left-room", ["bottom-a", "shared", "top-a", "left"], ["FORWARD", "FORWARD", "FORWARD", "FORWARD"]),
      room("right-room", ["bottom-b", "right", "top-b", "shared"], ["FORWARD", "FORWARD", "FORWARD", "REVERSE"])
    ];
    const level = createLevel(walls, rooms);
    const measurement = measureLevel(level);

    expect(measurement.rooms.map(({ area, perimeter }) => ({ area, perimeter }))).toEqual([
      { area: 40_000, perimeter: 800 },
      { area: 40_000, perimeter: 800 }
    ]);
    expect(measurement.totalRoomArea).toBe(80_000);
    expect(measurement.totalWallLength).toBe(1_400);
  });

  it("keeps Openings independent from Wall length, Room area, and perimeter", () => {
    const level = levelFromPolygon("opening-room", [
      [0, 0], [500, 0], [500, 300], [0, 300]
    ]);
    const firstWall = level.walls[0]!;
    firstWall.openings.push({
      id: "door-1",
      type: "DOOR",
      offsetFromStart: 100,
      width: 90,
      height: 210,
      elevation: 0
    });

    expect(measureWall(firstWall).length).toBe(500);
    expect(measureRoom(level, level.rooms[0]!)).toMatchObject({
      area: 150_000,
      perimeter: 1_600
    });
  });

  it("measures angled bounds and multiple disconnected groups", () => {
    const level = createLevel([
      wall("angled", -100, -50, 200, 350),
      wall("separate", 500, 100, 650, 100)
    ], []);
    expect(measureWall(level.walls[0]!).length).toBe(500);
    expect(measurePlan(level)).toEqual({
      minX: -100,
      minZ: -50,
      maxX: 650,
      maxZ: 350,
      width: 750,
      depth: 400
    });
  });

  it("handles empty and partial Levels without fake plan bounds", () => {
    expect(measurePlan(createLevel([], []))).toBeUndefined();
    expect(measureLevel(createLevel([], [])).totalRoomArea).toBe(0);
    expect(measureLevel(createLevel([wall("only", 0, 0, 10, 0)], [])).rooms).toEqual([]);
    expect(measureRoom(createLevel([], [room("draft", [], [])]), room("draft", [], []))).toBeUndefined();
  });

  it("updates every aggregate when canonical geometry changes", () => {
    const original = levelFromPolygon("room", [[0, 0], [400, 0], [400, 300], [0, 300]]);
    const changed = levelFromPolygon("room", [[0, 0], [500, 0], [500, 300], [0, 300]]);
    expect(measureLevel(original)).toMatchObject({ totalRoomArea: 120_000, totalWallLength: 1_400 });
    expect(measureLevel(changed)).toMatchObject({ totalRoomArea: 150_000, totalWallLength: 1_600 });
    expect(measureLevel(changed).plan).toMatchObject({ width: 500, depth: 300 });
  });
});

function levelFromPolygon(id: string, points: readonly (readonly [number, number])[]): Level {
  const walls = points.map((point, index) => {
    const next = points[(index + 1) % points.length]!;
    return wall(`${id}-wall-${index}`, point[0], point[1], next[0], next[1]);
  });
  return createLevel(walls, [room(id, walls.map((candidate) => candidate.id), walls.map(() => "FORWARD"))]);
}

function createLevel(walls: Wall[], rooms: Room[]): Level {
  return { id: "level", name: "Level", elevation: 0, walls, rooms, staircases: [] };
}

function wall(id: string, startX: number, startZ: number, endX: number, endZ: number): Wall {
  return { id, start: { x: startX, z: startZ }, end: { x: endX, z: endZ }, height: 280, thickness: 20, roomIds: [], openings: [] };
}

function room(
  id: string,
  wallIds: readonly string[],
  directions: readonly ("FORWARD" | "REVERSE")[]
): Room {
  return {
    id,
    name: id,
    type: "OTHER",
    boundary: wallIds.map((wallId, index) => ({ wallId, direction: directions[index] ?? "FORWARD" }))
  };
}
