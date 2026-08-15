import { ProjectSchema, type Project } from "../project/index.js";
import {
  IdentifierSchema,
  Point2DSchema,
  type Identifier,
  type Point2D
} from "../primitives/index.js";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  ValidationErrorCode,
  type ValidationError
} from "../validation/index.js";
import type { Opening } from "./opening.js";
import type { RoomBoundaryEdge } from "./room.js";
import { WallSchema, type Wall } from "./wall.js";

const splitParameterTolerance = 1e-9;
const wallMergeCollinearityTolerance = 1e-9;

/** Endpoint of a Wall that can be repositioned by an editing operation. */
export type WallEndpoint = "start" | "end";

/**
 * Stable result returned by pure Project editing operations.
 *
 * Expected precondition failures are returned as typed validation errors. A
 * successful operation returns a new Project graph and never mutates its input.
 */
export type ProjectEditingResult =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly errors: readonly ValidationError[] };

/** Input required to append a caller-identified Wall to a Level. */
export type CreateWallInput = {
  readonly levelId: Identifier;
  readonly wall: Wall;
};

/** Input required to reposition one endpoint of an existing Wall. */
export type MoveWallEndpointInput = {
  readonly levelId: Identifier;
  readonly wallId: Identifier;
  readonly endpoint: WallEndpoint;
  readonly position: Point2D;
};

/** Input required to remove an unreferenced Wall from a Level. */
export type DeleteWallInput = {
  readonly levelId: Identifier;
  readonly wallId: Identifier;
};

/** Input identifying a canonical Wall junction that may be redundant. */
export type CollapseWallJunctionInput = {
  readonly levelId: Identifier;
  readonly junction: Point2D;
};

/** Input required to update the supported scalar properties of an existing Wall. */
export type UpdateWallPropertiesInput = {
  readonly levelId: Identifier;
  readonly wallId: Identifier;
  readonly height?: number;
  readonly thickness?: number;
};

/** Input required to divide a Wall into two canonical child segments. */
export type SplitWallInput = {
  readonly levelId: Identifier;
  readonly wallId: Identifier;
  readonly splitPoint: Point2D;
  readonly newWallId: Identifier;
};

/** Identifies an existing Wall that must be split for a new endpoint. */
export type WallInteriorConnection = {
  readonly wallId: Identifier;
  readonly newWallId: Identifier;
};

/** Input for atomically creating a Wall whose endpoints may split existing Walls. */
export type CreateConnectedWallInput = CreateWallInput & {
  readonly startConnection?: WallInteriorConnection;
  readonly endConnection?: WallInteriorConnection;
};

/**
 * Appends a Wall to an existing Level while preserving the caller-supplied ID.
 *
 * The operation validates only its local editing preconditions. Complete
 * Project, cross-reference, renderability, and runtime-geometry validation
 * remain responsibilities of the authoritative save boundary.
 */
export function createWall(
  project: Project,
  input: CreateWallInput
): ProjectEditingResult {
  const levelIndex = project.building.levels.findIndex(
    (level) => level.id === input.levelId
  );

  if (levelIndex < 0) {
    return failure(levelNotFound(input.levelId));
  }

  const identifierResult = IdentifierSchema.safeParse(input.wall.id);
  if (!identifierResult.success) {
    return failure({
      code: ValidationErrorCode.INVALID_IDENTIFIER,
      path: "wall.id",
      message: "Wall ID must be a non-empty lowercase kebab-case identifier."
    });
  }

  const duplicatePath = findWallPath(project, input.wall.id);
  if (duplicatePath) {
    return failure({
      code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
      path: duplicatePath,
      message: `Wall identifier "${input.wall.id}" is already in use.`
    });
  }

  const wallResult = WallSchema.safeParse(input.wall);
  if (!wallResult.success) {
    const zeroLength = hasSamePoint(input.wall.start, input.wall.end);

    return failure(
      zeroLength
        ? zeroLengthWall(input.wall.id, "wall.end")
        : {
            code: ValidationErrorCode.INVALID_WALL_ENDPOINT,
            path: "wall",
            message: `Wall "${input.wall.id}" does not satisfy the local Wall contract.`
          }
    );
  }

  const duplicateOpeningInWall = findDuplicateOpening(wallResult.data);
  if (duplicateOpeningInWall) {
    return failure({
      code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
      path: duplicateOpeningInWall.path,
      message: `Opening identifier "${duplicateOpeningInWall.id}" is duplicated within the new Wall.`
    });
  }

  const duplicateOpening = findOpeningPath(
    project,
    wallResult.data.openings.map((opening) => opening.id)
  );
  if (duplicateOpening) {
    return failure({
      code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
      path: duplicateOpening.path,
      message: `Opening identifier "${duplicateOpening.id}" is already in use.`
    });
  }

  return success(
    mapLevel(project, levelIndex, (level) => ({
      ...level,
      walls: [...level.walls, wallResult.data]
    }))
  );
}

/**
 * Moves one explicitly selected Wall endpoint without changing Wall identity.
 *
 * The target Level and Wall must exist, the new point must be finite, and the
 * resulting segment must have non-zero length.
 */
export function moveWallEndpoint(
  project: Project,
  input: MoveWallEndpointInput
): ProjectEditingResult {
  const levelIndex = project.building.levels.findIndex(
    (level) => level.id === input.levelId
  );

  if (levelIndex < 0) {
    return failure(levelNotFound(input.levelId));
  }

  const level = project.building.levels[levelIndex];
  const wallIndex =
    level?.walls.findIndex((wall) => wall.id === input.wallId) ?? -1;

  if (!level || wallIndex < 0) {
    return failure(wallNotFound(input.levelId, input.wallId));
  }

  const positionResult = Point2DSchema.safeParse(input.position);
  if (!positionResult.success) {
    return failure({
      code: ValidationErrorCode.INVALID_WALL_ENDPOINT,
      path: `building.levels[${levelIndex}].walls[${wallIndex}].${input.endpoint}`,
      message: "Wall endpoint coordinates must be finite numbers."
    });
  }

  const wall = level.walls[wallIndex];
  if (!wall) {
    return failure(wallNotFound(input.levelId, input.wallId));
  }

  const otherEndpoint = input.endpoint === "start" ? wall.end : wall.start;
  if (hasSamePoint(positionResult.data, otherEndpoint)) {
    return failure(
      zeroLengthWall(
        input.wallId,
        `building.levels[${levelIndex}].walls[${wallIndex}].${input.endpoint}`
      )
    );
  }

  return success(
    mapLevel(project, levelIndex, (currentLevel) => ({
      ...currentLevel,
      walls: currentLevel.walls.map((currentWall, currentWallIndex) =>
        currentWallIndex === wallIndex
          ? { ...currentWall, [input.endpoint]: positionResult.data }
          : currentWall
      )
    }))
  );
}

/**
 * Updates supported Wall properties without changing identity or geometry references.
 *
 * The resulting Wall is validated by the canonical Wall schema. Invalid values
 * are rejected without clamping and the input Project is never mutated.
 */
export function updateWallProperties(
  project: Project,
  input: UpdateWallPropertiesInput
): ProjectEditingResult {
  const levelIndex = project.building.levels.findIndex(
    (level) => level.id === input.levelId
  );

  if (levelIndex < 0) {
    return failure(levelNotFound(input.levelId));
  }

  const level = project.building.levels[levelIndex];
  const wallIndex =
    level?.walls.findIndex((wall) => wall.id === input.wallId) ?? -1;

  if (!level || wallIndex < 0) {
    return failure(wallNotFound(input.levelId, input.wallId));
  }

  const wall = level.walls[wallIndex];
  if (!wall) {
    return failure(wallNotFound(input.levelId, input.wallId));
  }

  const candidate = {
    ...wall,
    ...(input.height === undefined ? {} : { height: input.height }),
    ...(input.thickness === undefined ? {} : { thickness: input.thickness })
  };
  const wallResult = WallSchema.safeParse(candidate);

  if (!wallResult.success) {
    const errors = wallResult.error.issues.flatMap(
      (issue): ValidationError[] => {
        const property = issue.path[0];
        const path = `building.levels[${levelIndex}].walls[${wallIndex}].${String(property)}`;

        if (property === "height") {
          return [
            {
              code: ValidationErrorCode.INVALID_WALL_HEIGHT,
              path,
              message: "Wall height must be a finite positive measurement."
            }
          ];
        }
        if (property === "thickness") {
          return [
            {
              code: ValidationErrorCode.INVALID_WALL_THICKNESS,
              path,
              message: "Wall thickness must be a finite positive measurement."
            }
          ];
        }
        return [];
      }
    );

    return errors.length > 0
      ? { ok: false, errors }
      : failure({
          code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
          path: `building.levels[${levelIndex}].walls[${wallIndex}]`,
          message: `Wall "${input.wallId}" does not satisfy the Wall contract.`
        });
  }

  return success(
    mapLevel(project, levelIndex, (currentLevel) => ({
      ...currentLevel,
      walls: currentLevel.walls.map((currentWall, currentWallIndex) =>
        currentWallIndex === wallIndex ? wallResult.data : currentWall
      )
    }))
  );
}

/**
 * Splits a Wall at an interior point while preserving canonical topology.
 *
 * The original Wall ID remains on the segment from the original start to the
 * split point. The caller-supplied ID belongs to the segment from the split
 * point to the original end. Ordered Room boundary uses are expanded in place,
 * with reverse traversals expanded in reverse order. Openings wholly before or
 * after the split retain identity and physical placement; a split through an
 * Opening is rejected.
 */
export function splitWall(
  project: Project,
  input: SplitWallInput
): ProjectEditingResult {
  const levelIndex = project.building.levels.findIndex(
    (level) => level.id === input.levelId
  );
  if (levelIndex < 0) {
    return failure(levelNotFound(input.levelId));
  }

  const level = project.building.levels[levelIndex];
  const wallIndex =
    level?.walls.findIndex((wall) => wall.id === input.wallId) ?? -1;
  if (!level || wallIndex < 0) {
    return failure(wallNotFound(input.levelId, input.wallId));
  }

  const splitPointResult = Point2DSchema.safeParse(input.splitPoint);
  if (!splitPointResult.success) {
    return failure({
      code: ValidationErrorCode.INVALID_WALL_ENDPOINT,
      path: "splitPoint",
      message: "Wall split coordinates must be finite numbers."
    });
  }

  const identifierResult = IdentifierSchema.safeParse(input.newWallId);
  if (!identifierResult.success) {
    return failure({
      code: ValidationErrorCode.INVALID_IDENTIFIER,
      path: "newWallId",
      message: "Split Wall ID must be a non-empty lowercase kebab-case identifier."
    });
  }
  const duplicatePath = findWallPath(project, input.newWallId);
  if (duplicatePath) {
    return failure({
      code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
      path: duplicatePath,
      message: `Wall identifier "${input.newWallId}" is already in use.`
    });
  }

  const wall = level.walls[wallIndex];
  if (!wall) {
    return failure(wallNotFound(input.levelId, input.wallId));
  }
  const splitPoint = splitPointResult.data;
  const parameter = getSegmentParameter(wall, splitPoint);
  if (parameter === undefined) {
    return failure({
      code: ValidationErrorCode.WALL_SPLIT_POINT_NOT_ON_WALL,
      path: "splitPoint",
      message: `Wall "${wall.id}" can only be split at a point on its segment.`
    });
  }
  if (
    parameter <= splitParameterTolerance ||
    parameter >= 1 - splitParameterTolerance
  ) {
    return failure({
      code: ValidationErrorCode.WALL_SPLIT_AT_ENDPOINT,
      path: "splitPoint",
      message: `Wall "${wall.id}" cannot be split at an existing endpoint.`
    });
  }

  const wallLength = getWallLength(wall);
  const splitDistance = wallLength * parameter;
  const openingResult = redistributeOpenings(wall.openings, splitDistance);
  if (!openingResult.ok) {
    return failure({
      code: ValidationErrorCode.WALL_SPLIT_INTERSECTS_OPENING,
      path: `building.levels[${levelIndex}].walls[${wallIndex}].openings`,
      message: `Wall "${wall.id}" cannot be split through Opening "${openingResult.openingId}".`
    });
  }

  const firstWallResult = WallSchema.safeParse({
    ...wall,
    end: splitPoint,
    openings: openingResult.first
  });
  const secondWallResult = WallSchema.safeParse({
    ...wall,
    id: input.newWallId,
    start: splitPoint,
    openings: openingResult.second
  });
  if (!firstWallResult.success || !secondWallResult.success) {
    return failure({
      code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
      path: `building.levels[${levelIndex}].walls[${wallIndex}]`,
      message: `Splitting Wall "${wall.id}" produced an invalid child Wall.`
    });
  }

  const transformed = mapLevel(project, levelIndex, (currentLevel) => ({
    ...currentLevel,
    rooms: currentLevel.rooms.map((room) => ({
      ...room,
      boundary: room.boundary.flatMap((edge) =>
        expandSplitBoundaryEdge(edge, wall.id, input.newWallId)
      )
    })),
    walls: currentLevel.walls.flatMap((currentWall, currentWallIndex) =>
      currentWallIndex === wallIndex
        ? [firstWallResult.data, secondWallResult.data]
        : [currentWall]
    )
  }));

  return validateCanonicalEditingResult(transformed, "Wall split");
}

/**
 * Creates one Wall and applies any required endpoint Wall splits atomically.
 *
 * The returned Project is committed only after every split, the new Wall
 * creation, and canonical validation succeed. Expected failure leaves the
 * caller's Project unchanged.
 */
export function createConnectedWall(
  project: Project,
  input: CreateConnectedWallInput
): ProjectEditingResult {
  if (
    input.startConnection?.wallId === input.endConnection?.wallId &&
    input.startConnection !== undefined
  ) {
    return failure({
      code: ValidationErrorCode.WALL_SPLIT_POINT_NOT_ON_WALL,
      path: "wall",
      message: "A connected Wall cannot split the same source Wall at both endpoints."
    });
  }

  let candidate = project;
  const connections = [
    input.startConnection
      ? { connection: input.startConnection, point: input.wall.start }
      : undefined,
    input.endConnection
      ? { connection: input.endConnection, point: input.wall.end }
      : undefined
  ].filter(
    (entry): entry is {
      readonly connection: WallInteriorConnection;
      readonly point: Point2D;
    } => entry !== undefined
  );

  for (const { connection, point } of connections) {
    const splitResult = splitWall(candidate, {
      levelId: input.levelId,
      wallId: connection.wallId,
      splitPoint: point,
      newWallId: connection.newWallId
    });
    if (!splitResult.ok) {
      return splitResult;
    }
    candidate = splitResult.project;
  }

  const createResult = createWall(candidate, {
    levelId: input.levelId,
    wall: input.wall
  });
  return createResult.ok
    ? validateCanonicalEditingResult(createResult.project, "Connected Wall creation")
    : createResult;
}

/**
 * Collapses a degree-two junction between compatible collinear Wall segments.
 *
 * The earlier segment in Level order retains its ID and orientation. Room
 * boundary traversals and Wall-relative Opening offsets are rewritten to
 * preserve their existing physical meaning. An ineligible or ambiguous
 * junction is returned as an unchanged successful Project.
 */
export function collapseWallJunction(
  project: Project,
  input: CollapseWallJunctionInput
): ProjectEditingResult {
  const levelIndex = project.building.levels.findIndex(
    (level) => level.id === input.levelId
  );
  if (levelIndex < 0) {
    return failure(levelNotFound(input.levelId));
  }

  const junctionResult = Point2DSchema.safeParse(input.junction);
  if (!junctionResult.success) {
    return failure({
      code: ValidationErrorCode.INVALID_WALL_ENDPOINT,
      path: "junction",
      message: "Wall junction coordinates must be finite numbers."
    });
  }

  return success(
    tryCollapseWallJunction(project, levelIndex, junctionResult.data) ?? project
  );
}

/**
 * Deletes one unreferenced Wall and collapses compatible junctions made
 * redundant by that deletion.
 *
 * Only the deleted Wall's former endpoints are inspected. Deletion and any
 * safe local collapses are validated and returned as one immutable Project.
 */
export function deleteWallAndCollapseRedundantTopology(
  project: Project,
  input: DeleteWallInput
): ProjectEditingResult {
  const levelIndex = project.building.levels.findIndex(
    (level) => level.id === input.levelId
  );
  const level = project.building.levels[levelIndex];
  const deletedWall = level?.walls.find((wall) => wall.id === input.wallId);
  const deleteResult = deleteWall(project, input);
  if (!deleteResult.ok || levelIndex < 0 || !deletedWall) return deleteResult;

  let candidate = deleteResult.project;
  for (const junction of [deletedWall.start, deletedWall.end]) {
    candidate =
      tryCollapseWallJunction(candidate, levelIndex, junction) ?? candidate;
  }

  return validateCanonicalEditingResult(
    candidate,
    "Wall deletion and redundant junction collapse"
  );
}

/** Returns a validated local collapse, or no result when compatibility is unsafe. */
function tryCollapseWallJunction(
  project: Project,
  levelIndex: number,
  junction: Point2D
): Project | undefined {
  const level = project.building.levels[levelIndex];
  if (!level) return undefined;

  const incident = level.walls.flatMap((wall, wallIndex) =>
    (["start", "end"] as const).flatMap((endpoint) =>
      hasSamePoint(wall[endpoint], junction)
        ? [{ wall, wallIndex, endpoint }]
        : []
    )
  );
  if (incident.length !== 2) return undefined;

  const [firstIncident, secondIncident] = incident;
  if (!firstIncident || !secondIncident || firstIncident.wall.id === secondIncident.wall.id) {
    return undefined;
  }

  const survivor =
    firstIncident.wallIndex < secondIncident.wallIndex
      ? firstIncident
      : secondIncident;
  const removed = survivor === firstIncident ? secondIncident : firstIncident;
  if (!areWallPropertiesCompatible(survivor.wall, removed.wall)) {
    return undefined;
  }

  const survivorOuter = getOppositeEndpoint(survivor.wall, survivor.endpoint);
  const removedOuter = getOppositeEndpoint(removed.wall, removed.endpoint);
  if (!isStraightContinuation(survivorOuter, junction, removedOuter)) {
    return undefined;
  }

  const mergedStart =
    survivor.endpoint === "end" ? survivorOuter : removedOuter;
  const mergedEnd =
    survivor.endpoint === "end" ? removedOuter : survivorOuter;
  const openings = mergeWallOpenings(
    survivor.wall,
    removed.wall,
    mergedStart,
    mergedEnd
  );
  if (!openings) return undefined;

  const mergedWallResult = WallSchema.safeParse({
    ...survivor.wall,
    start: mergedStart,
    end: mergedEnd,
    openings
  });
  if (!mergedWallResult.success) return undefined;

  const rooms = level.rooms.map((room) =>
    mergeRoomBoundaryUses(
      room.boundary,
      survivor.wall,
      removed.wall,
      mergedWallResult.data,
      junction
    )
  );
  if (rooms.some((boundary) => boundary === undefined)) return undefined;

  const transformed = mapLevel(project, levelIndex, (currentLevel) => ({
    ...currentLevel,
    rooms: currentLevel.rooms.map((room, roomIndex) => ({
      ...room,
      boundary: rooms[roomIndex] ?? room.boundary
    })),
    walls: currentLevel.walls.flatMap((wall, wallIndex) => {
      if (wallIndex === survivor.wallIndex) return [mergedWallResult.data];
      return wallIndex === removed.wallIndex ? [] : [wall];
    })
  }));
  const validation = validateCanonicalEditingResult(
    transformed,
    "Wall junction collapse"
  );
  return validation.ok ? validation.project : undefined;
}

/** Compares every non-geometric physical property retained by a Wall merge. */
function areWallPropertiesCompatible(first: Wall, second: Wall): boolean {
  return (
    first.name === second.name &&
    first.description === second.description &&
    first.height === second.height &&
    first.thickness === second.thickness &&
    arraysEqual(first.roomIds, second.roomIds)
  );
}

/** Compares ordered canonical identifier collections without normalization. */
function arraysEqual<T>(first: readonly T[], second: readonly T[]): boolean {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

/** Returns the endpoint opposite a known junction incidence. */
function getOppositeEndpoint(
  wall: Wall,
  endpoint: WallEndpoint
): Point2D {
  return endpoint === "start" ? wall.end : wall.start;
}

/** Tests whether two non-zero vectors continue through a junction collinearly. */
function isStraightContinuation(
  first: Point2D,
  junction: Point2D,
  second: Point2D
): boolean {
  const firstVector = {
    x: first.x - junction.x,
    z: first.z - junction.z
  };
  const secondVector = {
    x: second.x - junction.x,
    z: second.z - junction.z
  };
  const firstLength = Math.hypot(firstVector.x, firstVector.z);
  const secondLength = Math.hypot(secondVector.x, secondVector.z);
  if (firstLength === 0 || secondLength === 0) return false;

  const cross = firstVector.x * secondVector.z - firstVector.z * secondVector.x;
  const dot = firstVector.x * secondVector.x + firstVector.z * secondVector.z;
  return (
    Math.abs(cross) <=
      wallMergeCollinearityTolerance * firstLength * secondLength && dot < 0
  );
}

/** Re-expresses stable Opening identities relative to the merged Wall start. */
function mergeWallOpenings(
  first: Wall,
  second: Wall,
  mergedStart: Point2D,
  mergedEnd: Point2D
): Opening[] | undefined {
  const mergedLength = Math.hypot(
    mergedEnd.x - mergedStart.x,
    mergedEnd.z - mergedStart.z
  );
  if (mergedLength === 0) return undefined;
  const direction = {
    x: (mergedEnd.x - mergedStart.x) / mergedLength,
    z: (mergedEnd.z - mergedStart.z) / mergedLength
  };
  const seen = new Set<Identifier>();
  const openings: Opening[] = [];

  for (const wall of [first, second]) {
    const wallLength = getWallLength(wall);
    if (
      wallLength === 0 ||
      wall.openings.some(
        (opening) =>
          opening.offsetFromStart < 0 ||
          opening.offsetFromStart + opening.width > wallLength ||
          seen.has(opening.id)
      )
    ) {
      return undefined;
    }

    const startDistance =
      (wall.start.x - mergedStart.x) * direction.x +
      (wall.start.z - mergedStart.z) * direction.z;
    const aligned =
      (wall.end.x - wall.start.x) * direction.x +
        (wall.end.z - wall.start.z) * direction.z >
      0;
    for (const opening of wall.openings) {
      seen.add(opening.id);
      openings.push({
        ...opening,
        offsetFromStart: aligned
          ? startDistance + opening.offsetFromStart
          : startDistance - opening.offsetFromStart - opening.width
      });
    }
  }

  if (
    openings.some(
      (opening) =>
        opening.offsetFromStart < -splitParameterTolerance ||
        opening.offsetFromStart + opening.width >
          mergedLength + splitParameterTolerance
    )
  ) {
    return undefined;
  }
  return openings.sort(
    (firstOpening, secondOpening) =>
      firstOpening.offsetFromStart - secondOpening.offsetFromStart ||
      firstOpening.id.localeCompare(secondOpening.id)
  );
}

/** Replaces one compatible adjacent Room traversal pair with the merged Wall. */
function mergeRoomBoundaryUses(
  boundary: readonly RoomBoundaryEdge[],
  survivor: Wall,
  removed: Wall,
  merged: Wall,
  junction: Point2D
): RoomBoundaryEdge[] | undefined {
  const survivorIndex = boundary.findIndex((edge) => edge.wallId === survivor.id);
  const removedIndex = boundary.findIndex((edge) => edge.wallId === removed.id);
  if (survivorIndex < 0 && removedIndex < 0) return [...boundary];
  if (survivorIndex < 0 || removedIndex < 0) return undefined;

  const pairStart = [survivorIndex, removedIndex].find(
    (index) => (index + 1) % boundary.length === (index === survivorIndex ? removedIndex : survivorIndex)
  );
  if (pairStart === undefined) return undefined;
  const pairEnd = (pairStart + 1) % boundary.length;
  const firstEdge = boundary[pairStart];
  const secondEdge = boundary[pairEnd];
  if (!firstEdge || !secondEdge) return undefined;
  const firstWall = firstEdge.wallId === survivor.id ? survivor : removed;
  const secondWall = secondEdge.wallId === survivor.id ? survivor : removed;
  const traversalStart = getBoundaryTraversalStart(firstEdge, firstWall);
  const firstTraversalEnd = getBoundaryTraversalEnd(firstEdge, firstWall);
  const secondTraversalStart = getBoundaryTraversalStart(secondEdge, secondWall);
  const traversalEnd = getBoundaryTraversalEnd(secondEdge, secondWall);
  if (
    !hasSamePoint(firstTraversalEnd, junction) ||
    !hasSamePoint(secondTraversalStart, junction)
  ) {
    return undefined;
  }

  const direction =
    hasSamePoint(merged.start, traversalStart) &&
    hasSamePoint(merged.end, traversalEnd)
      ? "FORWARD"
      : hasSamePoint(merged.end, traversalStart) &&
          hasSamePoint(merged.start, traversalEnd)
        ? "REVERSE"
        : undefined;
  if (!direction) return undefined;
  const replacement = { wallId: merged.id, direction } as const;

  if (pairEnd === 0) {
    return boundary.slice(1).map((edge, index) =>
      index === boundary.length - 2 ? replacement : edge
    );
  }
  return boundary.flatMap((edge, index) => {
    if (index === pairStart) return [replacement];
    return index === pairEnd ? [] : [edge];
  });
}

/** Resolves the canonical start of one oriented Room boundary use. */
function getBoundaryTraversalStart(
  edge: RoomBoundaryEdge,
  wall: Wall
): Point2D {
  return edge.direction === "FORWARD" ? wall.start : wall.end;
}

/** Resolves the canonical end of one oriented Room boundary use. */
function getBoundaryTraversalEnd(
  edge: RoomBoundaryEdge,
  wall: Wall
): Point2D {
  return edge.direction === "FORWARD" ? wall.end : wall.start;
}

function getWallLength(wall: Wall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
}

function getSegmentParameter(wall: Wall, point: Point2D): number | undefined {
  const deltaX = wall.end.x - wall.start.x;
  const deltaZ = wall.end.z - wall.start.z;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (lengthSquared === 0) return undefined;

  const relativeX = point.x - wall.start.x;
  const relativeZ = point.z - wall.start.z;
  const parameter = (relativeX * deltaX + relativeZ * deltaZ) / lengthSquared;
  const projectedX = wall.start.x + parameter * deltaX;
  const projectedZ = wall.start.z + parameter * deltaZ;
  const distance = Math.hypot(point.x - projectedX, point.z - projectedZ);
  const tolerance = Math.max(1, Math.sqrt(lengthSquared)) * splitParameterTolerance;

  return distance <= tolerance && parameter >= 0 && parameter <= 1
    ? parameter
    : undefined;
}

function redistributeOpenings(
  openings: readonly Opening[],
  splitDistance: number
):
  | { readonly ok: true; readonly first: Opening[]; readonly second: Opening[] }
  | { readonly ok: false; readonly openingId: Identifier } {
  const first: Opening[] = [];
  const second: Opening[] = [];

  for (const opening of openings) {
    const openingEnd = opening.offsetFromStart + opening.width;
    if (openingEnd <= splitDistance) {
      first.push(opening);
    } else if (opening.offsetFromStart >= splitDistance) {
      second.push({
        ...opening,
        offsetFromStart: opening.offsetFromStart - splitDistance
      });
    } else {
      return { ok: false, openingId: opening.id };
    }
  }

  return { ok: true, first, second };
}

function expandSplitBoundaryEdge(
  edge: RoomBoundaryEdge,
  originalWallId: Identifier,
  newWallId: Identifier
): readonly RoomBoundaryEdge[] {
  if (edge.wallId !== originalWallId) return [edge];
  return edge.direction === "FORWARD"
    ? [edge, { wallId: newWallId, direction: "FORWARD" }]
    : [
        { wallId: newWallId, direction: "REVERSE" },
        edge
      ];
}

function validateCanonicalEditingResult(
  project: Project,
  operation: string
): ProjectEditingResult {
  const parsed = ProjectSchema.safeParse(project);
  if (!parsed.success) {
    return failure({
      code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
      path: "project",
      message: `${operation} produced a structurally invalid Project.`
    });
  }

  for (const validate of [
    validateProjectCrossReferences,
    validateProjectReferenceConsistency,
    validateProjectGeometry
  ]) {
    const result = validate(parsed.data);
    if (!result.valid) return { ok: false, errors: result.errors };
  }

  return success(parsed.data);
}

/**
 * Removes an unreferenced Wall from its owning Level.
 *
 * A Wall used by a Room boundary or carrying reciprocal `roomIds` is rejected
 * so the operation cannot create dangling canonical references implicitly.
 */
export function deleteWall(
  project: Project,
  input: DeleteWallInput
): ProjectEditingResult {
  const levelIndex = project.building.levels.findIndex(
    (level) => level.id === input.levelId
  );

  if (levelIndex < 0) {
    return failure(levelNotFound(input.levelId));
  }

  const level = project.building.levels[levelIndex];
  const wallIndex =
    level?.walls.findIndex((wall) => wall.id === input.wallId) ?? -1;

  if (!level || wallIndex < 0) {
    return failure(wallNotFound(input.levelId, input.wallId));
  }

  const wall = level.walls[wallIndex];
  const referencingRoomIds = level.rooms
    .filter((room) =>
      room.boundary.some((edge) => edge.wallId === input.wallId)
    )
    .map((room) => room.id);

  if ((wall?.roomIds.length ?? 0) > 0 || referencingRoomIds.length > 0) {
    return failure({
      code: ValidationErrorCode.WALL_IS_REFERENCED,
      path: `building.levels[${levelIndex}].walls[${wallIndex}]`,
      message: `Wall "${input.wallId}" cannot be deleted while it is referenced by a Room boundary.`
    });
  }

  return success(
    mapLevel(project, levelIndex, (currentLevel) => ({
      ...currentLevel,
      walls: currentLevel.walls.filter(
        (_, currentWallIndex) => currentWallIndex !== wallIndex
      )
    }))
  );
}

function mapLevel(
  project: Project,
  levelIndex: number,
  transform: (
    level: Project["building"]["levels"][number]
  ) => Project["building"]["levels"][number]
): Project {
  return {
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels.map((level, index) =>
        index === levelIndex ? transform(level) : level
      )
    }
  };
}

function findWallPath(
  project: Project,
  wallId: Identifier
): string | undefined {
  for (const [levelIndex, level] of project.building.levels.entries()) {
    const wallIndex = level.walls.findIndex((wall) => wall.id === wallId);
    if (wallIndex >= 0) {
      return `building.levels[${levelIndex}].walls[${wallIndex}].id`;
    }
  }

  return undefined;
}

function findDuplicateOpening(
  wall: Wall
): { readonly id: Identifier; readonly path: string } | undefined {
  const seen = new Set<Identifier>();

  for (const [openingIndex, opening] of wall.openings.entries()) {
    if (seen.has(opening.id)) {
      return { id: opening.id, path: `wall.openings[${openingIndex}].id` };
    }

    seen.add(opening.id);
  }

  return undefined;
}

function findOpeningPath(
  project: Project,
  openingIds: readonly Identifier[]
): { readonly id: Identifier; readonly path: string } | undefined {
  const openingIdSet = new Set(openingIds);

  for (const [levelIndex, level] of project.building.levels.entries()) {
    for (const [wallIndex, wall] of level.walls.entries()) {
      const openingIndex = wall.openings.findIndex((opening) =>
        openingIdSet.has(opening.id)
      );
      if (openingIndex >= 0) {
        const opening = wall.openings[openingIndex];
        if (opening) {
          return {
            id: opening.id,
            path: `building.levels[${levelIndex}].walls[${wallIndex}].openings[${openingIndex}].id`
          };
        }
      }
    }
  }

  return undefined;
}

function hasSamePoint(first: Point2D, second: Point2D): boolean {
  return first.x === second.x && first.z === second.z;
}

function levelNotFound(levelId: Identifier): ValidationError {
  return {
    code: ValidationErrorCode.LEVEL_NOT_FOUND,
    path: "building.levels[].id",
    message: `Level "${levelId}" could not be found.`
  };
}

function wallNotFound(
  levelId: Identifier,
  wallId: Identifier
): ValidationError {
  return {
    code: ValidationErrorCode.WALL_NOT_FOUND,
    path: "building.levels[].walls[].id",
    message: `Wall "${wallId}" could not be found in level "${levelId}".`
  };
}

function zeroLengthWall(wallId: Identifier, path: string): ValidationError {
  return {
    code: ValidationErrorCode.WALL_ZERO_LENGTH,
    path,
    message: `Wall "${wallId}" start and end points must not be identical.`
  };
}

function success(project: Project): ProjectEditingResult {
  return { ok: true, project };
}

function failure(error: ValidationError): ProjectEditingResult {
  return { ok: false, errors: [error] };
}
