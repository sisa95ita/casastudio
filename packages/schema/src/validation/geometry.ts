import type { Point2D } from "../primitives";
import type { Level, RoomBoundaryEdge, Wall } from "../physical-building";
import type { Project } from "../project";
import { ValidationErrorCode } from "./validation-error-code";
import type { ValidationError, ValidationResult } from "./validation-result";

const pushError = (
  errors: ValidationError[],
  code: ValidationErrorCode,
  path: string,
  message: string
) => {
  errors.push({ code, path, message });
};

const getLength = (start: Point2D, end: Point2D): number => {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;

  return Math.hypot(deltaX, deltaZ);
};

const hasSamePoint = (first: Point2D, second: Point2D): boolean => first.x === second.x && first.z === second.z;

const getPointKey = (point: Point2D): string => `${point.x}:${point.z}`;

const getUndirectedWallGeometryKey = (wall: Wall): string => {
  const startKey = getPointKey(wall.start);
  const endKey = getPointKey(wall.end);

  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
};

const getTraversalStart = (boundaryEdge: RoomBoundaryEdge, wall: Wall): Point2D =>
  boundaryEdge.direction === "FORWARD" ? wall.start : wall.end;

const getTraversalEnd = (boundaryEdge: RoomBoundaryEdge, wall: Wall): Point2D =>
  boundaryEdge.direction === "FORWARD" ? wall.end : wall.start;

const getSignedArea = (vertices: readonly Point2D[]): number => {
  let signedArea = 0;

  vertices.forEach((vertex, index) => {
    const nextVertex = vertices[(index + 1) % vertices.length];

    if (!nextVertex) {
      return;
    }

    signedArea += vertex.x * nextVertex.z - nextVertex.x * vertex.z;
  });

  return signedArea / 2;
};

const orientation = (a: Point2D, b: Point2D, c: Point2D): number =>
  (b.z - a.z) * (c.x - b.x) - (b.x - a.x) * (c.z - b.z);

const isOnSegment = (a: Point2D, b: Point2D, c: Point2D): boolean =>
  Math.min(a.x, c.x) <= b.x &&
  b.x <= Math.max(a.x, c.x) &&
  Math.min(a.z, c.z) <= b.z &&
  b.z <= Math.max(a.z, c.z);

const areCollinear = (a: Point2D, b: Point2D, c: Point2D): boolean => orientation(a, b, c) === 0;

const segmentsPartiallyOverlap = (aStart: Point2D, aEnd: Point2D, bStart: Point2D, bEnd: Point2D): boolean => {
  if (!areCollinear(aStart, bStart, aEnd) || !areCollinear(aStart, bEnd, aEnd)) {
    return false;
  }

  const overlapX =
    Math.min(Math.max(aStart.x, aEnd.x), Math.max(bStart.x, bEnd.x)) -
    Math.max(Math.min(aStart.x, aEnd.x), Math.min(bStart.x, bEnd.x));
  const overlapZ =
    Math.min(Math.max(aStart.z, aEnd.z), Math.max(bStart.z, bEnd.z)) -
    Math.max(Math.min(aStart.z, aEnd.z), Math.min(bStart.z, bEnd.z));

  return overlapX > 0 || overlapZ > 0;
};

const segmentsIntersect = (aStart: Point2D, aEnd: Point2D, bStart: Point2D, bEnd: Point2D): boolean => {
  const firstOrientation = orientation(aStart, aEnd, bStart);
  const secondOrientation = orientation(aStart, aEnd, bEnd);
  const thirdOrientation = orientation(bStart, bEnd, aStart);
  const fourthOrientation = orientation(bStart, bEnd, aEnd);

  if (firstOrientation === 0 && isOnSegment(aStart, bStart, aEnd)) return true;
  if (secondOrientation === 0 && isOnSegment(aStart, bEnd, aEnd)) return true;
  if (thirdOrientation === 0 && isOnSegment(bStart, aStart, bEnd)) return true;
  if (fourthOrientation === 0 && isOnSegment(bStart, aEnd, bEnd)) return true;

  return (firstOrientation > 0) !== (secondOrientation > 0) && (thirdOrientation > 0) !== (fourthOrientation > 0);
};

type TraversedRoomBoundaryEdge = {
  boundaryEdge: RoomBoundaryEdge;
  wall: Wall;
  start: Point2D;
  end: Point2D;
};

const invertBoundaryDirection = (direction: RoomBoundaryEdge["direction"]): RoomBoundaryEdge["direction"] =>
  direction === "FORWARD" ? "REVERSE" : "FORWARD";

const getTraversedBoundary = (
  boundary: readonly RoomBoundaryEdge[],
  wallsById: ReadonlyMap<string, Wall>
): TraversedRoomBoundaryEdge[] | undefined => {
  const traversedBoundary: TraversedRoomBoundaryEdge[] = [];

  for (const boundaryEdge of boundary) {
    const wall = wallsById.get(boundaryEdge.wallId);

    if (!wall) {
      return undefined;
    }

    traversedBoundary.push({
      boundaryEdge,
      wall,
      start: getTraversalStart(boundaryEdge, wall),
      end: getTraversalEnd(boundaryEdge, wall)
    });
  }

  return traversedBoundary;
};

const isContinuousAndClosed = (traversedBoundary: readonly TraversedRoomBoundaryEdge[]): boolean =>
  traversedBoundary.every((edge, index) => {
    const nextEdge = traversedBoundary[(index + 1) % traversedBoundary.length];

    return nextEdge !== undefined && hasSamePoint(edge.end, nextEdge.start);
  });

const getSingleFlippedContinuityFixIndex = (
  boundary: readonly RoomBoundaryEdge[],
  wallsById: ReadonlyMap<string, Wall>
): number | undefined => {
  const fixIndexes: number[] = [];

  boundary.forEach((boundaryEdge, boundaryIndex) => {
    const flippedBoundary = boundary.map((edge, edgeIndex) =>
      edgeIndex === boundaryIndex ? { ...edge, direction: invertBoundaryDirection(edge.direction) } : edge
    );
    const traversedBoundary = getTraversedBoundary(flippedBoundary, wallsById);

    if (traversedBoundary && isContinuousAndClosed(traversedBoundary)) {
      fixIndexes.push(boundaryIndex);
    }
  });

  return fixIndexes.length === 1 ? fixIndexes[0] : undefined;
};

const areAdjacentBoundaryEdges = (firstIndex: number, secondIndex: number, edgeCount: number): boolean =>
  Math.abs(firstIndex - secondIndex) === 1 || (firstIndex === 0 && secondIndex === edgeCount - 1);

const areVerticesCollinear = (vertices: readonly Point2D[]): boolean => {
  const firstVertex = vertices[0];
  const secondVertex = vertices.find((vertex) => firstVertex && !hasSamePoint(vertex, firstVertex));

  if (!firstVertex || !secondVertex) {
    return true;
  }

  return vertices.every((vertex) => orientation(firstVertex, secondVertex, vertex) === 0);
};

const validateRoomBoundaryGeometry = (
  errors: ValidationError[],
  level: Level,
  levelIndex: number
) => {
  const wallsById = new Map(level.walls.map((wall) => [wall.id, wall]));

  level.rooms.forEach((room, roomIndex) => {
    if (room.boundary.length === 0) {
      return;
    }

    const boundaryPath = `building.levels[${levelIndex}].rooms[${roomIndex}].boundary`;
    const traversedBoundary = getTraversedBoundary(room.boundary, wallsById);

    if (!traversedBoundary) {
      return;
    }

    const flippedFixIndex = getSingleFlippedContinuityFixIndex(room.boundary, wallsById);

    if (flippedFixIndex !== undefined) {
      pushError(
        errors,
        ValidationErrorCode.INVALID_ROOM_BOUNDARY_DIRECTION,
        `${boundaryPath}[${flippedFixIndex}]`,
        `Room "${room.id}" boundary edge ${flippedFixIndex} has a direction that prevents continuous traversal.`
      );
      return;
    }

    for (let boundaryIndex = 0; boundaryIndex < traversedBoundary.length - 1; boundaryIndex += 1) {
      const currentEdge = traversedBoundary[boundaryIndex];
      const nextEdge = traversedBoundary[boundaryIndex + 1];

      if (currentEdge && nextEdge && !hasSamePoint(currentEdge.end, nextEdge.start)) {
        pushError(
          errors,
          ValidationErrorCode.INVALID_ROOM_BOUNDARY_ORDER,
          `${boundaryPath}[${boundaryIndex + 1}]`,
          `Room "${room.id}" boundary is not continuous between boundary edges ${boundaryIndex} and ${boundaryIndex + 1}.`
        );
        return;
      }
    }

    const firstEdge = traversedBoundary[0];
    const lastEdge = traversedBoundary.at(-1);

    if (!firstEdge || !lastEdge || !hasSamePoint(lastEdge.end, firstEdge.start)) {
      pushError(
        errors,
        ValidationErrorCode.OPEN_ROOM_BOUNDARY,
        boundaryPath,
        `Room "${room.id}" boundary does not close back to its starting point.`
      );
      return;
    }

    const vertices = traversedBoundary.map((edge) => edge.start);

    if (areVerticesCollinear(vertices)) {
      pushError(
        errors,
        ValidationErrorCode.DEGENERATE_ROOM_BOUNDARY,
        boundaryPath,
        `Room "${room.id}" boundary produces a zero-area polygon.`
      );
      return;
    }

    for (let firstIndex = 0; firstIndex < traversedBoundary.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < traversedBoundary.length; secondIndex += 1) {
        const first = traversedBoundary[firstIndex];
        const second = traversedBoundary[secondIndex];

        if (!first || !second) {
          continue;
        }

        if (segmentsPartiallyOverlap(first.start, first.end, second.start, second.end)) {
          pushError(
            errors,
            ValidationErrorCode.PARTIAL_BOUNDARY_OVERLAP,
            `${boundaryPath}[${secondIndex}]`,
            `Room "${room.id}" boundary edge ${secondIndex} partially overlaps another boundary edge.`
          );
          return;
        }

        if (areAdjacentBoundaryEdges(firstIndex, secondIndex, traversedBoundary.length)) {
          continue;
        }

        if (segmentsIntersect(first.start, first.end, second.start, second.end)) {
          pushError(
            errors,
            ValidationErrorCode.SELF_INTERSECTING_ROOM_BOUNDARY,
            `${boundaryPath}[${secondIndex}]`,
            `Room "${room.id}" boundary edge ${secondIndex} intersects another non-adjacent boundary edge.`
          );
          return;
        }
      }
    }

    const signedArea = getSignedArea(vertices);

    if (signedArea === 0) {
      pushError(
        errors,
        ValidationErrorCode.DEGENERATE_ROOM_BOUNDARY,
        boundaryPath,
        `Room "${room.id}" boundary produces a zero-area polygon.`
      );
      return;
    }

    if (signedArea < 0) {
      pushError(
        errors,
        ValidationErrorCode.CLOCKWISE_OUTER_ROOM_BOUNDARY,
        boundaryPath,
        `Room "${room.id}" boundary must be persisted counter-clockwise.`
      );
    }
  });
};

/**
 * Validates first-layer geometric/topological invariants for an already parsed
 * Project.
 *
 * Run this validator after `ProjectSchema`,
 * `validateProjectCrossReferences`, `validateProjectReferenceConsistency`, and
 * `validateProjectRenderability`. It assumes `ProjectSchema` parsing has
 * already succeeded and therefore focuses on local geometric consistency in the
 * physical building model: wall segment length, opening placement within a
 * wall, stair flight length and elevation direction, stair landing dimensions,
 * exact duplicate wall geometry within a Level, and persisted room-boundary
 * geometry that can be checked without constructing Geometry Engine runtime
 * objects.
 */
export const validateProjectGeometry = (project: Project): ValidationResult => {
  const errors: ValidationError[] = [];

  project.building.levels.forEach((level, levelIndex) => {
    const wallGeometryToIndex = new Map<string, number>();

    level.walls.forEach((wall, wallIndex) => {
      const wallPath = `building.levels[${levelIndex}].walls[${wallIndex}]`;
      const wallLength = getLength(wall.start, wall.end);

      if (wallLength === 0) {
        pushError(
          errors,
          ValidationErrorCode.WALL_ZERO_LENGTH,
          `${wallPath}.end`,
          `Wall "${wall.id}" must have distinct start and end coordinates.`
        );
      }

      wall.openings.forEach((opening, openingIndex) => {
        if (wallLength === 0) {
          return;
        }

        if (opening.offsetFromStart < 0 || opening.offsetFromStart + opening.width > wallLength) {
          pushError(
            errors,
            ValidationErrorCode.OPENING_OUTSIDE_WALL,
            `${wallPath}.openings[${openingIndex}]`,
            `Opening "${opening.id}" must fit completely inside wall "${wall.id}".`
          );
        }
      });

      const geometryKey = getUndirectedWallGeometryKey(wall);
      const duplicateWallIndex = wallGeometryToIndex.get(geometryKey);

      if (duplicateWallIndex === undefined) {
        wallGeometryToIndex.set(geometryKey, wallIndex);
      } else {
        pushError(
          errors,
          ValidationErrorCode.DUPLICATE_WALL_GEOMETRY,
          wallPath,
          `Wall "${wall.id}" duplicates the start and end coordinates of wall "${level.walls[duplicateWallIndex]?.id}" in level "${level.id}".`
        );
      }
    });

    validateRoomBoundaryGeometry(errors, level, levelIndex);

    level.staircases.forEach((staircase, staircaseIndex) => {
      const staircasePath = `building.levels[${levelIndex}].staircases[${staircaseIndex}]`;

      staircase.flights.forEach((flight, flightIndex) => {
        const flightPath = `${staircasePath}.flights[${flightIndex}]`;

        if (hasSamePoint(flight.start, flight.end)) {
          pushError(
            errors,
            ValidationErrorCode.STAIR_FLIGHT_ZERO_LENGTH,
            `${flightPath}.end`,
            `Stair flight "${flight.id}" must have distinct start and end coordinates.`
          );
        }

        if (flight.endElevation <= flight.startElevation) {
          pushError(
            errors,
            ValidationErrorCode.STAIR_FLIGHT_NOT_ASCENDING,
            `${flightPath}.endElevation`,
            `Stair flight "${flight.id}" must end above its start elevation.`
          );
        }
      });

      staircase.landings.forEach((landing, landingIndex) => {
        const landingPath = `${staircasePath}.landings[${landingIndex}]`;

        if (landing.width <= 0) {
          pushError(
            errors,
            ValidationErrorCode.STAIR_LANDING_NON_POSITIVE_WIDTH,
            `${landingPath}.width`,
            `Stair landing "${landing.id}" width must be greater than zero.`
          );
        }

        if (landing.depth <= 0) {
          pushError(
            errors,
            ValidationErrorCode.STAIR_LANDING_NON_POSITIVE_DEPTH,
            `${landingPath}.depth`,
            `Stair landing "${landing.id}" depth must be greater than zero.`
          );
        }
      });
    });
  });

  return {
    valid: errors.length === 0,
    errors
  };
};
