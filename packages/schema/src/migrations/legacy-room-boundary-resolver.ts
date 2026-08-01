import type { Point2D } from "../primitives";
import type { RoomBoundaryEdge } from "../physical-building";
import {
  LegacyRoomBoundaryMigrationFailureReason,
  MigrationErrorCode,
  type ProjectMigrationError
} from "./migration-error";

type LegacyWall = {
  id: string;
  start: Point2D;
  end: Point2D;
};

type ResolveLegacyRoomBoundaryInput = {
  roomId: string;
  levelId: string;
  wallIds: readonly string[];
  walls: readonly LegacyWall[];
  allWalls?: readonly (LegacyWall & { levelId: string })[];
  path: string;
};

type ResolveLegacyRoomBoundaryResult =
  | {
      ok: true;
      boundary: RoomBoundaryEdge[];
    }
  | {
      ok: false;
      errors: readonly ProjectMigrationError[];
    };

type TraversedEdge = {
  wall: LegacyWall;
  fromKey: string;
  toKey: string;
  direction: "FORWARD" | "REVERSE";
};

const pointKey = (point: Point2D): string => `${point.x}:${point.z}`;

const geometryKey = (wall: LegacyWall): string => {
  const startKey = pointKey(wall.start);
  const endKey = pointKey(wall.end);

  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
};

const hasSamePoint = (first: Point2D, second: Point2D): boolean => first.x === second.x && first.z === second.z;

const comparePoints = (first: Point2D, second: Point2D): number => first.x - second.x || first.z - second.z;

const compareWalls = (first: LegacyWall, second: LegacyWall): number => first.id.localeCompare(second.id);

const migrationFailure = (
  input: ResolveLegacyRoomBoundaryInput,
  reason: LegacyRoomBoundaryMigrationFailureReason,
  message: string,
  wallId?: string
): ResolveLegacyRoomBoundaryResult => ({
  ok: false,
  errors: [
    {
      code: MigrationErrorCode.LEGACY_ROOM_BOUNDARY_MIGRATION_FAILED,
      message,
      path: input.path,
      roomId: input.roomId,
      wallId,
      levelId: input.levelId,
      reason
    }
  ]
});

const getEndpoint = (wall: LegacyWall, key: string): Point2D => {
  if (pointKey(wall.start) === key) {
    return wall.start;
  }

  return wall.end;
};

const getOtherEndpointKey = (wall: LegacyWall, endpointKey: string): string =>
  pointKey(wall.start) === endpointKey ? pointKey(wall.end) : pointKey(wall.start);

const getSignedArea = (edges: readonly TraversedEdge[]): number => {
  let area = 0;

  edges.forEach((edge) => {
    const start = getEndpoint(edge.wall, edge.fromKey);
    const end = getEndpoint(edge.wall, edge.toKey);

    area += start.x * end.z - end.x * start.z;
  });

  return area / 2;
};

const invertDirection = (direction: "FORWARD" | "REVERSE"): "FORWARD" | "REVERSE" =>
  direction === "FORWARD" ? "REVERSE" : "FORWARD";

/**
 * Normalizes reconstructed legacy room loops to counter-clockwise winding.
 *
 * This is migration-only normalization. Canonical validation rejects clockwise
 * persisted boundaries rather than rewriting them.
 */
const normalizeWinding = (edges: readonly TraversedEdge[]): RoomBoundaryEdge[] => {
  const signedArea = getSignedArea(edges);
  const orientedEdges =
    signedArea < 0
      ? [...edges].reverse().map((edge) => ({
          ...edge,
          fromKey: edge.toKey,
          toKey: edge.fromKey,
          direction: invertDirection(edge.direction)
        }))
      : edges;

  return orientedEdges.map((edge) => ({
    wallId: edge.wall.id,
    direction: edge.direction
  }));
};

const directionFor = (wall: LegacyWall, fromKey: string): "FORWARD" | "REVERSE" =>
  pointKey(wall.start) === fromKey ? "FORWARD" : "REVERSE";

const orientation = (a: Point2D, b: Point2D, c: Point2D): number =>
  (b.z - a.z) * (c.x - b.x) - (b.x - a.x) * (c.z - b.z);

const isOnSegment = (a: Point2D, b: Point2D, c: Point2D): boolean =>
  Math.min(a.x, c.x) <= b.x &&
  b.x <= Math.max(a.x, c.x) &&
  Math.min(a.z, c.z) <= b.z &&
  b.z <= Math.max(a.z, c.z);

const isCollinear = (a: Point2D, b: Point2D, c: Point2D): boolean => orientation(a, b, c) === 0;

const hasCollinearOverlap = (a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean => {
  if (!isCollinear(a, c, b) || !isCollinear(a, d, b)) {
    return false;
  }

  const overlapX = Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
  const overlapZ = Math.min(Math.max(a.z, b.z), Math.max(c.z, d.z)) - Math.max(Math.min(a.z, b.z), Math.min(c.z, d.z));

  return overlapX > 0 || overlapZ > 0;
};

const segmentsIntersect = (a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean => {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 === 0 && isOnSegment(a, c, b)) return true;
  if (o2 === 0 && isOnSegment(a, d, b)) return true;
  if (o3 === 0 && isOnSegment(c, a, d)) return true;
  if (o4 === 0 && isOnSegment(c, b, d)) return true;

  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
};

const areAdjacentBoundaryEdges = (firstIndex: number, secondIndex: number, edgeCount: number): boolean =>
  Math.abs(firstIndex - secondIndex) === 1 || (firstIndex === 0 && secondIndex === edgeCount - 1);

const validateIntersections = (
  input: ResolveLegacyRoomBoundaryInput,
  edges: readonly TraversedEdge[]
): ResolveLegacyRoomBoundaryResult | undefined => {
  for (let firstIndex = 0; firstIndex < edges.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
      const first = edges[firstIndex];
      const second = edges[secondIndex];

      if (!first || !second) {
        continue;
      }

      const a = getEndpoint(first.wall, first.fromKey);
      const b = getEndpoint(first.wall, first.toKey);
      const c = getEndpoint(second.wall, second.fromKey);
      const d = getEndpoint(second.wall, second.toKey);

      if (hasCollinearOverlap(a, b, c, d)) {
        return migrationFailure(
          input,
          LegacyRoomBoundaryMigrationFailureReason.PARTIAL_BOUNDARY_OVERLAP,
          `Room "${input.roomId}" contains unsupported overlapping boundary segments.`
        );
      }

      if (areAdjacentBoundaryEdges(firstIndex, secondIndex, edges.length)) {
        continue;
      }

      if (segmentsIntersect(a, b, c, d)) {
        return migrationFailure(
          input,
          LegacyRoomBoundaryMigrationFailureReason.SELF_INTERSECTING_LOOP,
          `Room "${input.roomId}" contains a self-intersecting boundary loop.`
        );
      }
    }
  }

  return undefined;
};

/**
 * Reconstructs a deterministic canonical Room boundary from legacy `wallIds`.
 *
 * The resolver uses exact endpoint equality in level-local XZ coordinates,
 * treats selected walls as an undirected graph, rejects ambiguous or invalid
 * topology, and returns ordered/oriented boundary edges without mutating source
 * walls or room data.
 */
export const resolveLegacyRoomBoundary = (
  input: ResolveLegacyRoomBoundaryInput
): ResolveLegacyRoomBoundaryResult => {
  if (input.wallIds.length === 0) {
    return { ok: true, boundary: [] };
  }

  const uniqueWallIds = new Set(input.wallIds);

  if (uniqueWallIds.size !== input.wallIds.length) {
    return migrationFailure(
      input,
      LegacyRoomBoundaryMigrationFailureReason.DUPLICATE_WALL_REFERENCE,
      `Room "${input.roomId}" references the same wall more than once.`
    );
  }

  const levelWallsById = new Map(input.walls.map((wall) => [wall.id, wall]));
  const selectedWalls: LegacyWall[] = [];

  for (const wallId of input.wallIds) {
    const wall = levelWallsById.get(wallId);

    if (!wall) {
      const crossLevelWall = input.allWalls?.find((candidate) => candidate.id === wallId && candidate.levelId !== input.levelId);

      return migrationFailure(
        input,
        crossLevelWall
          ? LegacyRoomBoundaryMigrationFailureReason.CROSS_LEVEL_WALL
          : LegacyRoomBoundaryMigrationFailureReason.MISSING_WALL,
        crossLevelWall
          ? `Room "${input.roomId}" references wall "${wallId}", but it belongs to level "${crossLevelWall.levelId}".`
          : `Room "${input.roomId}" references wall "${wallId}", but no wall with that id exists in level "${input.levelId}".`,
        wallId
      );
    }

    if (hasSamePoint(wall.start, wall.end)) {
      return migrationFailure(
        input,
        LegacyRoomBoundaryMigrationFailureReason.DEGENERATE_WALL,
        `Room "${input.roomId}" references degenerate wall "${wall.id}".`,
        wall.id
      );
    }

    selectedWalls.push(wall);
  }

  const geometryKeys = new Set<string>();

  for (const wall of selectedWalls) {
    const key = geometryKey(wall);

    if (geometryKeys.has(key)) {
      return migrationFailure(
        input,
        LegacyRoomBoundaryMigrationFailureReason.DUPLICATE_WALL_GEOMETRY,
        `Room "${input.roomId}" references multiple walls with identical geometry.`,
        wall.id
      );
    }

    geometryKeys.add(key);
  }

  const endpointToWalls = new Map<string, LegacyWall[]>();

  selectedWalls.forEach((wall) => {
    [pointKey(wall.start), pointKey(wall.end)].forEach((key) => {
      endpointToWalls.set(key, [...(endpointToWalls.get(key) ?? []), wall]);
    });
  });

  const connectedWallIds = new Set<string>();
  const wallsToVisit = [selectedWalls[0]].filter((wall): wall is LegacyWall => wall !== undefined);

  while (wallsToVisit.length > 0) {
    const wall = wallsToVisit.pop();

    if (!wall || connectedWallIds.has(wall.id)) {
      continue;
    }

    connectedWallIds.add(wall.id);

    [pointKey(wall.start), pointKey(wall.end)].forEach((key) => {
      endpointToWalls.get(key)?.forEach((connectedWall) => {
        if (!connectedWallIds.has(connectedWall.id)) {
          wallsToVisit.push(connectedWall);
        }
      });
    });
  }

  if (connectedWallIds.size !== selectedWalls.length) {
    return migrationFailure(
      input,
      LegacyRoomBoundaryMigrationFailureReason.DISCONNECTED_LOOP,
      `Room "${input.roomId}" boundary contains disconnected wall components.`
    );
  }

  const branchingEndpoint = [...endpointToWalls.entries()].find(([, walls]) => walls.length > 2);

  if (branchingEndpoint) {
    return migrationFailure(
      input,
      LegacyRoomBoundaryMigrationFailureReason.BRANCHING_GRAPH,
      `Room "${input.roomId}" boundary branches at endpoint ${branchingEndpoint[0]}.`
    );
  }

  const openEndpoint = [...endpointToWalls.entries()].find(([, walls]) => walls.length === 1);

  if (openEndpoint) {
    return migrationFailure(
      input,
      LegacyRoomBoundaryMigrationFailureReason.OPEN_LOOP,
      `Room "${input.roomId}" boundary has an open endpoint at ${openEndpoint[0]}.`
    );
  }

  const startKey = [...endpointToWalls.keys()]
    .map((key) => {
      const [x, z] = key.split(":").map(Number);

      return { key, point: { x: x ?? 0, z: z ?? 0 } };
    })
    .sort((first, second) => comparePoints(first.point, second.point))[0]?.key;

  if (!startKey) {
    return migrationFailure(
      input,
      LegacyRoomBoundaryMigrationFailureReason.INVALID_LEGACY_SHAPE,
      `Room "${input.roomId}" boundary could not be reconstructed.`
    );
  }

  const traversedEdges: TraversedEdge[] = [];
  const visitedWallIds = new Set<string>();
  let currentKey = startKey;
  let previousWallId: string | undefined;

  while (traversedEdges.length < selectedWalls.length) {
    const incidentWalls = [...(endpointToWalls.get(currentKey) ?? [])].sort(compareWalls);
    const nextWall = incidentWalls.find((wall) => wall.id !== previousWallId && !visitedWallIds.has(wall.id));

    if (!nextWall) {
      return migrationFailure(
        input,
        LegacyRoomBoundaryMigrationFailureReason.MULTIPLE_VALID_LOOPS,
        `Room "${input.roomId}" boundary could not be traversed as one unique loop.`
      );
    }

    const toKey = getOtherEndpointKey(nextWall, currentKey);
    traversedEdges.push({
      wall: nextWall,
      fromKey: currentKey,
      toKey,
      direction: directionFor(nextWall, currentKey)
    });
    visitedWallIds.add(nextWall.id);
    previousWallId = nextWall.id;
    currentKey = toKey;
  }

  if (currentKey !== startKey) {
    return migrationFailure(
      input,
      LegacyRoomBoundaryMigrationFailureReason.DISCONNECTED_LOOP,
      `Room "${input.roomId}" boundary does not close back to its starting endpoint.`
    );
  }

  if (visitedWallIds.size !== selectedWalls.length || endpointToWalls.size !== selectedWalls.length) {
    return migrationFailure(
      input,
      LegacyRoomBoundaryMigrationFailureReason.MULTIPLE_VALID_LOOPS,
      `Room "${input.roomId}" boundary contains multiple valid cycles.`
    );
  }

  const intersectionFailure = validateIntersections(input, traversedEdges);

  if (intersectionFailure) {
    return intersectionFailure;
  }

  if (getSignedArea(traversedEdges) === 0) {
    return migrationFailure(
      input,
      LegacyRoomBoundaryMigrationFailureReason.DEGENERATE_POLYGON,
      `Room "${input.roomId}" boundary has zero signed area.`
    );
  }

  return {
    ok: true,
    boundary: normalizeWinding(traversedEdges)
  };
};
