import type { Level, Point2D, Room, Units, Wall } from "@casastudio/schema";

import type { BoundingBox } from "./model/index.js";

/** Physical measurements derived for one canonical Wall segment. */
export type WallMeasurement = {
  readonly length: number;
};

/** Physical measurements derived from one ordered Room boundary. */
export type RoomMeasurement = {
  readonly roomId: Room["id"];
  readonly area: number;
  readonly perimeter: number;
  readonly boundaryPoints: readonly Point2D[];
};

/** Overall physical extents of plan geometry in level-local XZ coordinates. */
export type PlanMeasurement = BoundingBox & {
  readonly width: number;
  readonly depth: number;
};

/** Aggregate measurements for explicitly modeled Rooms and Walls on a Level. */
export type LevelMeasurement = {
  readonly rooms: readonly RoomMeasurement[];
  readonly totalRoomArea: number;
  readonly totalWallLength: number;
  readonly plan?: PlanMeasurement;
};

/** Calculates the full physical Wall length independently of owned Openings. */
export function measureWall(wall: Pick<Wall, "start" | "end">): WallMeasurement {
  return { length: pointDistance(wall.start, wall.end) };
}

/** Returns the ordered polygon points represented by a Room's oriented Wall boundary. */
export function deriveRoomBoundaryPoints(
  level: Pick<Level, "walls">,
  room: Pick<Room, "boundary">
): readonly Point2D[] | undefined {
  if (room.boundary.length < 3) return undefined;
  const walls = new Map(level.walls.map((wall) => [wall.id, wall]));
  const traversals = room.boundary.map((edge) => {
    const wall = walls.get(edge.wallId);
    if (!wall) return undefined;
    return edge.direction === "FORWARD"
      ? { start: wall.start, end: wall.end }
      : { start: wall.end, end: wall.start };
  });
  if (traversals.some((traversal) => !traversal)) return undefined;
  const complete = traversals as readonly { readonly start: Point2D; readonly end: Point2D }[];
  const contiguous = complete.every((traversal, index) => {
    const next = complete[(index + 1) % complete.length];
    return next ? pointsEqual(traversal.end, next.start) : false;
  });
  return contiguous ? Object.freeze(complete.map((traversal) => ({ ...traversal.start }))) : undefined;
}

/** Derives true polygon area and exact ordered-boundary perimeter for one Room. */
export function measureRoom(
  level: Pick<Level, "walls">,
  room: Pick<Room, "id" | "boundary">
): RoomMeasurement | undefined {
  const boundaryPoints = deriveRoomBoundaryPoints(level, room);
  if (!boundaryPoints) return undefined;
  let doubledSignedArea = 0;
  let perimeter = 0;
  boundaryPoints.forEach((point, index) => {
    const next = boundaryPoints[(index + 1) % boundaryPoints.length];
    if (!next) return;
    doubledSignedArea += point.x * next.z - next.x * point.z;
    perimeter += pointDistance(point, next);
  });
  return Object.freeze({
    roomId: room.id,
    area: Math.abs(doubledSignedArea / 2),
    perimeter,
    boundaryPoints
  });
}

/** Derives overall plan bounds from every canonical Wall endpoint on a Level. */
export function measurePlan(level: Pick<Level, "walls">): PlanMeasurement | undefined {
  const points = level.walls.flatMap((wall) => [wall.start, wall.end]);
  if (points.length === 0) return undefined;
  const minX = Math.min(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxZ = Math.max(...points.map((point) => point.z));
  return Object.freeze({
    minX,
    minZ,
    maxX,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ
  });
}

/**
 * Derives Level aggregates from explicit buildable Rooms and physical Walls.
 *
 * Total Room area is the sum of explicit Rooms whose ordered boundaries are
 * complete. Unassigned bounded faces and draft Rooms are intentionally omitted.
 */
export function measureLevel(level: Level): LevelMeasurement {
  const rooms = level.rooms.flatMap((room) => {
    const measurement = measureRoom(level, room);
    return measurement ? [measurement] : [];
  });
  return Object.freeze({
    rooms: Object.freeze(rooms),
    totalRoomArea: rooms.reduce((total, room) => total + room.area, 0),
    totalWallLength: level.walls.reduce((total, wall) => total + measureWall(wall).length, 0),
    plan: measurePlan(level)
  });
}

/** Calculates Euclidean distance between two level-local Project points. */
export function pointDistance(first: Point2D, second: Point2D): number {
  return Math.hypot(second.x - first.x, second.z - first.z);
}

/** Declared unit shape accepted by architectural measurement formatters. */
export type ArchitecturalMeasurementUnits = Pick<Units, "length">;

function pointsEqual(first: Point2D, second: Point2D): boolean {
  return first.x === second.x && first.z === second.z;
}
