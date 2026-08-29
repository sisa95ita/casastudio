import { ProjectSchema, type Project } from "../project/index.js";
import { IdentifierSchema, type Identifier } from "../primitives/index.js";
import {
  validateProjectIdentifierUniqueness,
  ValidationErrorCode,
  type ValidationError
} from "../validation/index.js";
import { LevelSchema, type Level } from "./level.js";
import type { ProjectEditingResult } from "./wall-editing.js";

/** Input for appending one empty, caller-identified Level to a Project. */
export type CreateLevelInput = Pick<Level, "id" | "name" | "elevation">;

/** Editable physical and display metadata for one existing Level. */
export type UpdateLevelPropertiesInput = {
  readonly levelId: Identifier;
  readonly name?: Level["name"];
  readonly elevation?: Level["elevation"];
};

/**
 * Appends an empty Level while preserving the Project's durable Level order.
 *
 * The caller owns stable ID generation. Geometry and other Level-scoped
 * entities are authored independently after this atomic operation succeeds.
 */
export function createLevel(
  project: Project,
  input: CreateLevelInput
): ProjectEditingResult {
  if (!IdentifierSchema.safeParse(input.id).success) {
    return failure({
      code: ValidationErrorCode.INVALID_IDENTIFIER,
      path: "level.id",
      message: "Level ID must be a non-empty lowercase kebab-case identifier."
    });
  }
  if (project.building.levels.some((level) => level.id === input.id)) {
    return failure({
      code: ValidationErrorCode.DUPLICATE_IDENTIFIER,
      path: "level.id",
      message: `Level identifier "${input.id}" is already in use.`
    });
  }

  const levelResult = LevelSchema.safeParse({
    ...input,
    rooms: [],
    walls: [],
    staircases: []
  });
  if (!levelResult.success) return failure(invalidLevelProperties());

  return validateCandidate({
    ...project,
    building: {
      ...project.building,
      levels: [...project.building.levels, levelResult.data]
    }
  });
}

/** Replaces the supported metadata of one Level without changing its contents. */
export function updateLevelProperties(
  project: Project,
  input: UpdateLevelPropertiesInput
): ProjectEditingResult {
  const levelIndex = project.building.levels.findIndex(
    (level) => level.id === input.levelId
  );
  if (levelIndex < 0) {
    return failure({
      code: ValidationErrorCode.LEVEL_NOT_FOUND,
      path: "levelId",
      message: `Level "${input.levelId}" could not be found.`
    });
  }

  const current = project.building.levels[levelIndex]!;
  const levelResult = LevelSchema.safeParse({
    ...current,
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.elevation === undefined ? {} : { elevation: input.elevation })
  });
  if (!levelResult.success) return failure(invalidLevelProperties());
  if (levelResult.data.name === current.name && levelResult.data.elevation === current.elevation) {
    return { ok: true, project };
  }

  return validateCandidate({
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels.map((level, index) =>
        index === levelIndex ? levelResult.data : level
      )
    }
  });
}

function validateCandidate(candidate: Project): ProjectEditingResult {
  const parsed = ProjectSchema.safeParse(candidate);
  if (!parsed.success) return failure(invalidLevelProperties());
  const identifiers = validateProjectIdentifierUniqueness(parsed.data);
  return identifiers.valid
    ? { ok: true, project: parsed.data }
    : { ok: false, errors: identifiers.errors };
}

function invalidLevelProperties(): ValidationError {
  return {
    code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
    path: "level",
    message: "Level name and elevation must satisfy the canonical Level contract."
  };
}

function failure(error: ValidationError): ProjectEditingResult {
  return { ok: false, errors: [error] };
}
