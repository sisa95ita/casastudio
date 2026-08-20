import type { Project } from "../project/index.js";
import {
  IdentifierSchema,
  Point2DSchema,
  type Identifier,
  type Point2D
} from "../primitives/index.js";
import {
  ValidationErrorCode,
  type ValidationError
} from "../validation/index.js";
import { WallSchema, type Wall } from "./wall.js";

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

/**
 * Appends a Wall to an existing Level while preserving the caller-supplied ID.
 *
 * The operation validates only its local editing preconditions. Complete
 * Project, cross-reference, renderability, and runtime-geometry validation
 * remain responsibilities of the authoritative save boundary.
 */
export function createWall(project: Project, input: CreateWallInput): ProjectEditingResult {
  const levelIndex = project.building.levels.findIndex((level) => level.id === input.levelId);

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

  return success(mapLevel(project, levelIndex, (level) => ({
    ...level,
    walls: [...level.walls, wallResult.data]
  })));
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
  const levelIndex = project.building.levels.findIndex((level) => level.id === input.levelId);

  if (levelIndex < 0) {
    return failure(levelNotFound(input.levelId));
  }

  const level = project.building.levels[levelIndex];
  const wallIndex = level?.walls.findIndex((wall) => wall.id === input.wallId) ?? -1;

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

  return success(mapLevel(project, levelIndex, (currentLevel) => ({
    ...currentLevel,
    walls: currentLevel.walls.map((currentWall, currentWallIndex) =>
      currentWallIndex === wallIndex
        ? { ...currentWall, [input.endpoint]: positionResult.data }
        : currentWall
    )
  })));
}

/**
 * Removes an unreferenced Wall from its owning Level.
 *
 * A Wall used by a Room boundary or carrying reciprocal `roomIds` is rejected
 * so the operation cannot create dangling canonical references implicitly.
 */
export function deleteWall(project: Project, input: DeleteWallInput): ProjectEditingResult {
  const levelIndex = project.building.levels.findIndex((level) => level.id === input.levelId);

  if (levelIndex < 0) {
    return failure(levelNotFound(input.levelId));
  }

  const level = project.building.levels[levelIndex];
  const wallIndex = level?.walls.findIndex((wall) => wall.id === input.wallId) ?? -1;

  if (!level || wallIndex < 0) {
    return failure(wallNotFound(input.levelId, input.wallId));
  }

  const wall = level.walls[wallIndex];
  const referencingRoomIds = level.rooms
    .filter((room) => room.boundary.some((edge) => edge.wallId === input.wallId))
    .map((room) => room.id);

  if ((wall?.roomIds.length ?? 0) > 0 || referencingRoomIds.length > 0) {
    return failure({
      code: ValidationErrorCode.WALL_IS_REFERENCED,
      path: `building.levels[${levelIndex}].walls[${wallIndex}]`,
      message: `Wall "${input.wallId}" cannot be deleted while it is referenced by a Room boundary.`
    });
  }

  return success(mapLevel(project, levelIndex, (currentLevel) => ({
    ...currentLevel,
    walls: currentLevel.walls.filter((_, currentWallIndex) => currentWallIndex !== wallIndex)
  })));
}

function mapLevel(
  project: Project,
  levelIndex: number,
  transform: (level: Project["building"]["levels"][number]) => Project["building"]["levels"][number]
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

function findWallPath(project: Project, wallId: Identifier): string | undefined {
  for (const [levelIndex, level] of project.building.levels.entries()) {
    const wallIndex = level.walls.findIndex((wall) => wall.id === wallId);
    if (wallIndex >= 0) {
      return `building.levels[${levelIndex}].walls[${wallIndex}].id`;
    }
  }

  return undefined;
}

function findDuplicateOpening(wall: Wall): { readonly id: Identifier; readonly path: string } | undefined {
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
      const openingIndex = wall.openings.findIndex((opening) => openingIdSet.has(opening.id));
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

function wallNotFound(levelId: Identifier, wallId: Identifier): ValidationError {
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
