import { ProjectSchema, type Project } from "../project/index.js";
import { IdentifierSchema, type Identifier } from "../primitives/index.js";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  ValidationErrorCode,
  type ValidationError
} from "../validation/index.js";
import {
  DoorSchema,
  OpeningSchema,
  WindowSchema,
  type Door,
  type DoorHingeSide,
  type DoorSwingSide,
  type Opening,
  type Window
} from "./opening.js";
import type { Wall } from "./wall.js";
import type { ProjectEditingResult } from "./wall-editing.js";

export { openingAdjacentClearance, openingEndpointClearance } from "./opening.js";

/** Default Door orientation used when reading legacy Projects. */
export const defaultDoorOrientation = Object.freeze({
  hingeSide: "START" as const,
  swingSide: "LEFT" as const
});

/** Returns the durable hinge side, applying the legacy default when absent. */
export const getDoorHingeSide = (door: Door): DoorHingeSide =>
  door.hingeSide ?? defaultDoorOrientation.hingeSide;

/** Returns the durable swing side, applying the legacy default when absent. */
export const getDoorSwingSide = (door: Door): DoorSwingSide =>
  door.swingSide ?? defaultDoorOrientation.swingSide;

export { getOpeningInterval } from "./opening.js";

/** Input for mounting one complete Opening on a Wall. */
export type CreateOpeningInput = {
  readonly levelId: Identifier;
  readonly wallId: Identifier;
  readonly opening: Opening;
};

/** Editable scalar and orientation properties shared by Opening operations. */
export type UpdateOpeningProperties = {
  readonly offsetFromStart?: number;
  readonly width?: number;
  readonly height?: number;
  readonly elevation?: number;
  readonly hingeSide?: DoorHingeSide;
  readonly swingSide?: DoorSwingSide;
};

/** Input for editing one existing Wall-owned Opening. */
export type UpdateOpeningInput = UpdateOpeningProperties & {
  readonly levelId: Identifier;
  readonly wallId: Identifier;
  readonly openingId: Identifier;
};

/** Input for moving one Opening along its owning Wall. */
export type MoveOpeningInput = {
  readonly levelId: Identifier;
  readonly wallId: Identifier;
  readonly openingId: Identifier;
  readonly offsetFromStart: number;
};

/** Input for removing one Wall-owned Opening. */
export type DeleteOpeningInput = {
  readonly levelId: Identifier;
  readonly wallId: Identifier;
  readonly openingId: Identifier;
};

/** Creates a Door with explicit deterministic orientation. */
export function createDoor(
  project: Project,
  input: Omit<CreateOpeningInput, "opening"> & { readonly door: Door }
): ProjectEditingResult {
  return createOpening(project, {
    ...input,
    opening: {
      ...input.door,
      hingeSide: getDoorHingeSide(input.door),
      swingSide: getDoorSwingSide(input.door)
    }
  });
}

/** Creates a Window parametrically mounted on one canonical Wall. */
export function createWindow(
  project: Project,
  input: Omit<CreateOpeningInput, "opening"> & { readonly window: Window }
): ProjectEditingResult {
  return createOpening(project, { ...input, opening: input.window });
}

/** Mounts one immutable Opening on a Wall after local invariant validation. */
export function createOpening(project: Project, input: CreateOpeningInput): ProjectEditingResult {
  const location = findWall(project, input.levelId, input.wallId);
  if (!location) return failure(wallNotFound(input.levelId, input.wallId));
  if (!IdentifierSchema.safeParse(input.opening.id).success) {
    return failure({
      code: ValidationErrorCode.INVALID_IDENTIFIER,
      path: "opening.id",
      message: "Opening ID must be a non-empty lowercase kebab-case identifier."
    });
  }
  if (findOpening(project, input.opening.id)) {
    return failure({
      code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
      path: "opening.id",
      message: `Opening identifier "${input.opening.id}" is already in use.`
    });
  }
  const parsed = OpeningSchema.safeParse(input.opening);
  if (!parsed.success) return failure(invalidOpening("opening", input.opening.id));
  return replaceWallOpenings(project, location, [...location.wall.openings, parsed.data], "Opening creation");
}

/** Updates one Opening without allowing its discriminator or identity to change. */
export function updateOpening(project: Project, input: UpdateOpeningInput): ProjectEditingResult {
  const location = findWall(project, input.levelId, input.wallId);
  if (!location) return failure(wallNotFound(input.levelId, input.wallId));
  const openingIndex = location.wall.openings.findIndex((opening) => opening.id === input.openingId);
  const opening = location.wall.openings[openingIndex];
  if (!opening) return failure(openingNotFound(input.openingId));
  if (opening.type === "WINDOW" && (input.hingeSide !== undefined || input.swingSide !== undefined)) {
    return failure(invalidOpening("opening", input.openingId));
  }
  const candidate = {
    ...opening,
    ...(input.offsetFromStart === undefined ? {} : { offsetFromStart: input.offsetFromStart }),
    ...(input.width === undefined ? {} : { width: input.width }),
    ...(input.height === undefined ? {} : { height: input.height }),
    ...(input.elevation === undefined ? {} : { elevation: input.elevation }),
    ...(input.hingeSide === undefined ? {} : { hingeSide: input.hingeSide }),
    ...(input.swingSide === undefined ? {} : { swingSide: input.swingSide })
  };
  const parsed = (opening.type === "DOOR" ? DoorSchema : WindowSchema).safeParse(candidate);
  if (!parsed.success) return failure(invalidOpening("opening", input.openingId));
  const openings = location.wall.openings.map((current, index) =>
    index === openingIndex ? parsed.data : current
  );
  return replaceWallOpenings(project, location, openings, "Opening update");
}

/** Repositions one Opening along its Wall as one semantic Project mutation. */
export function moveOpening(project: Project, input: MoveOpeningInput): ProjectEditingResult {
  return updateOpening(project, input);
}

/** Deletes one Opening with its owning Wall left otherwise unchanged. */
export function deleteOpening(project: Project, input: DeleteOpeningInput): ProjectEditingResult {
  const location = findWall(project, input.levelId, input.wallId);
  if (!location) return failure(wallNotFound(input.levelId, input.wallId));
  if (!location.wall.openings.some((opening) => opening.id === input.openingId)) {
    return failure(openingNotFound(input.openingId));
  }
  return replaceWallOpenings(
    project,
    location,
    location.wall.openings.filter((opening) => opening.id !== input.openingId),
    "Opening deletion"
  );
}

type WallLocation = {
  readonly levelIndex: number;
  readonly wallIndex: number;
  readonly wall: Wall;
};

function findWall(project: Project, levelId: Identifier, wallId: Identifier): WallLocation | undefined {
  const levelIndex = project.building.levels.findIndex((level) => level.id === levelId);
  const level = project.building.levels[levelIndex];
  const wallIndex = level?.walls.findIndex((wall) => wall.id === wallId) ?? -1;
  const wall = level?.walls[wallIndex];
  return levelIndex >= 0 && wallIndex >= 0 && wall ? { levelIndex, wallIndex, wall } : undefined;
}

function findOpening(project: Project, openingId: Identifier): Opening | undefined {
  return project.building.levels.flatMap((level) => level.walls)
    .flatMap((wall) => wall.openings)
    .find((opening) => opening.id === openingId);
}

function replaceWallOpenings(
  project: Project,
  location: WallLocation,
  openings: readonly Opening[],
  operation: string
): ProjectEditingResult {
  const candidate: Project = {
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels.map((level, levelIndex) =>
        levelIndex === location.levelIndex
          ? {
              ...level,
              walls: level.walls.map((wall, wallIndex) =>
                wallIndex === location.wallIndex ? { ...wall, openings: [...openings] } : wall
              )
            }
          : level
      )
    }
  };
  const parsed = ProjectSchema.safeParse(candidate);
  if (!parsed.success) {
    return failure({
      code: ValidationErrorCode.INVALID_OPENING_DIMENSIONS,
      path: "opening",
      message: `${operation} produced a structurally invalid Opening.`
    });
  }
  for (const validate of [validateProjectCrossReferences, validateProjectReferenceConsistency, validateProjectGeometry]) {
    const result = validate(parsed.data);
    if (!result.valid) return { ok: false, errors: result.errors };
  }
  return { ok: true, project: parsed.data };
}

function wallNotFound(levelId: Identifier, wallId: Identifier): ValidationError {
  return {
    code: ValidationErrorCode.WALL_NOT_FOUND,
    path: "building.levels[].walls[].id",
    message: `Wall "${wallId}" could not be found in level "${levelId}".`
  };
}

function openingNotFound(openingId: Identifier): ValidationError {
  return {
    code: ValidationErrorCode.OPENING_NOT_FOUND,
    path: "building.levels[].walls[].openings[].id",
    message: `Opening "${openingId}" could not be found.`
  };
}

function invalidOpening(path: string, openingId: string): ValidationError {
  return {
    code: ValidationErrorCode.INVALID_OPENING_DIMENSIONS,
    path,
    message: `Opening "${openingId}" does not satisfy the Opening contract.`
  };
}

function failure(error: ValidationError): ProjectEditingResult {
  return { ok: false, errors: [error] };
}
