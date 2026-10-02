import type { Level } from "./level.js";
import { isWallRoomBoundaryEdge } from "./room.js";

/** A direct same-Level passage, derived without modifying persisted topology. */
export type RoomAdjacencyConnection = Readonly<{
  roomId: string;
  kind: "door" | "wall-opening";
  wallId: string;
  openingId: string;
  width: number;
  height: number;
  offsetFromWallStart: number;
  sillElevation: number;
  targetBoundaryDirection?: "FORWARD" | "REVERSE";
}>;

/**
 * Explicit Door navigation metadata takes precedence; otherwise a passage must
 * have two reciprocal, opposite Room uses of its canonical host Wall. Persisted
 * outer boundaries are counter-clockwise, so opposite traversal means opposite
 * sides. No proximity or FREE-edge inference is made: FREE has no passage meaning.
 * Inconsistent, ambiguous and different-floor relationships are omitted. Explicit
 * navigation metadata can resolve a connection even without buildable boundaries.
 */
export function deriveDirectRoomConnections(
  level: Level,
  targetRoomId: string
): readonly RoomAdjacencyConnection[] {
  const rooms = new Map(level.rooms.map((room) => [room.id, room]));
  const target = rooms.get(targetRoomId);
  if (!target) return Object.freeze([]);
  const directions = new Map(
    level.rooms.map((room) => [
      room.id,
      new Map(
        room.boundary.flatMap((edge) =>
          isWallRoomBoundaryEdge(edge)
            ? [[edge.wallId, edge.direction] as const]
            : []
        )
      )
    ])
  );
  const results = new Map<string, RoomAdjacencyConnection>();
  for (const wall of level.walls) {
    const targetDirection = directions.get(target.id)?.get(wall.id);
    const owners = [...new Set(wall.roomIds)].filter((id) => {
      const room = rooms.get(id);
      return room && (room.elevation ?? 0) === (target.elevation ?? 0);
    });
    if (owners.length > 2) continue;
    const sharedNeighborId =
      owners.length === 2 && owners.includes(target.id)
        ? owners.find((id) => id !== target.id)
        : undefined;
    for (const opening of wall.openings) {
      if (opening.type === "WINDOW") continue;
      let neighborId = sharedNeighborId;
      if (opening.type === "DOOR" && opening.connectedRoomIds?.length) {
        const connected = [...new Set(opening.connectedRoomIds)];
        // Incomplete/contradictory explicit metadata is not repaired by guessing.
        if (connected.length !== 2 || !connected.includes(target.id)) continue;
        if (owners.some((id) => !connected.includes(id))) continue;
        neighborId = connected.find((id) => id !== target.id);
        if (sharedNeighborId && neighborId !== sharedNeighborId) continue;
      } else {
        if (!neighborId || !targetDirection) continue;
        const direction = directions.get(neighborId)?.get(wall.id);
        if (!direction || direction === targetDirection) continue;
      }
      const neighbor = neighborId ? rooms.get(neighborId) : undefined;
      if (!neighbor || (neighbor.elevation ?? 0) !== (target.elevation ?? 0))
        continue;
      const neighborDirection = directions.get(neighbor.id)?.get(wall.id);
      if (targetDirection && neighborDirection === targetDirection) continue;
      const length = Math.hypot(
        wall.end.x - wall.start.x,
        wall.end.z - wall.start.z
      );
      if (
        opening.offsetFromStart < 0 ||
        opening.width <= 0 ||
        opening.height <= 0 ||
        opening.offsetFromStart + opening.width > length ||
        opening.elevation + opening.height > wall.height ||
        opening.elevation + opening.height <= (target.elevation ?? 0)
      )
        continue;
      const key = JSON.stringify([neighbor.id, wall.id, opening.id]);
      results.set(
        key,
        Object.freeze({
          roomId: neighbor.id,
          kind: opening.type === "DOOR" ? "door" : "wall-opening",
          wallId: wall.id,
          openingId: opening.id,
          width: opening.width,
          height: opening.height,
          offsetFromWallStart: opening.offsetFromStart,
          sillElevation: opening.elevation,
          ...(targetDirection
            ? { targetBoundaryDirection: targetDirection }
            : {})
        })
      );
    }
  }
  return Object.freeze(
    [...results.values()].sort(
      (a, b) =>
        compare(a.roomId, b.roomId) ||
        compare(a.wallId, b.wallId) ||
        compare(a.openingId, b.openingId)
    )
  );
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
