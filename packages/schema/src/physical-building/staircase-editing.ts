import { ProjectSchema, type Project } from "../project/index.js";
import { IdentifierSchema, type Identifier } from "../primitives/index.js";
import { StaircaseSchema, type Staircase } from "../staircase/index.js";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectIdentifierUniqueness,
  validateProjectReferenceConsistency,
  ValidationErrorCode,
  type ValidationError
} from "../validation/index.js";
import type { ProjectEditingResult } from "./wall-editing.js";

/** Input for atomically appending one complete semantic Staircase aggregate. */
export type CreateStaircaseInput = {
  readonly owningLevelId: Identifier;
  readonly staircase: Staircase;
};

/** Input for atomically replacing one existing Staircase aggregate. */
export type UpdateStaircaseInput = {
  readonly owningLevelId: Identifier;
  readonly staircaseId: Identifier;
  readonly staircase: Staircase;
};

/** Input for removing one Staircase and its owned Flights and Landings. */
export type DeleteStaircaseInput = {
  readonly owningLevelId: Identifier;
  readonly staircaseId: Identifier;
};

/** Appends a complete Staircase as one canonical Project edit. */
export function createStaircase(
  project: Project,
  input: CreateStaircaseInput
): ProjectEditingResult {
  const levelIndex = findLevelIndex(project, input.owningLevelId);
  if (levelIndex < 0) return failure(levelNotFound(input.owningLevelId));
  const parsed = StaircaseSchema.safeParse(input.staircase);
  if (!parsed.success) return failure(invalidStaircase("staircase"));

  const level = project.building.levels[levelIndex]!;
  return validateCandidate(replaceLevel(project, levelIndex, {
    ...level,
    staircases: [...level.staircases, parsed.data]
  }));
}

/** Replaces a Staircase, its Flights, and its Landings as one canonical edit. */
export function updateStaircase(
  project: Project,
  input: UpdateStaircaseInput
): ProjectEditingResult {
  const levelIndex = findLevelIndex(project, input.owningLevelId);
  if (levelIndex < 0) return failure(levelNotFound(input.owningLevelId));
  const level = project.building.levels[levelIndex]!;
  const staircaseIndex = level.staircases.findIndex(
    (staircase) => staircase.id === input.staircaseId
  );
  if (staircaseIndex < 0) return failure(staircaseNotFound(input.staircaseId));
  if (input.staircase.id !== input.staircaseId) {
    return failure(invalidStaircase("staircase.id"));
  }
  const parsed = StaircaseSchema.safeParse(input.staircase);
  if (!parsed.success) return failure(invalidStaircase("staircase"));

  return validateCandidate(replaceLevel(project, levelIndex, {
    ...level,
    staircases: level.staircases.map((staircase, index) =>
      index === staircaseIndex ? parsed.data : staircase
    )
  }));
}

/** Deletes a Staircase aggregate without treating owned parts as top-level edits. */
export function deleteStaircase(
  project: Project,
  input: DeleteStaircaseInput
): ProjectEditingResult {
  const levelIndex = findLevelIndex(project, input.owningLevelId);
  if (levelIndex < 0) return failure(levelNotFound(input.owningLevelId));
  const level = project.building.levels[levelIndex]!;
  if (!level.staircases.some((staircase) => staircase.id === input.staircaseId)) {
    return failure(staircaseNotFound(input.staircaseId));
  }

  return validateCandidate(replaceLevel(project, levelIndex, {
    ...level,
    staircases: level.staircases.filter(
      (staircase) => staircase.id !== input.staircaseId
    )
  }));
}

function validateCandidate(candidate: Project): ProjectEditingResult {
  const parsed = ProjectSchema.safeParse(candidate);
  if (!parsed.success) return failure(invalidStaircase("project"));
  for (const validate of [
    validateProjectIdentifierUniqueness,
    validateProjectCrossReferences,
    validateProjectReferenceConsistency,
    validateProjectGeometry
  ]) {
    const result = validate(parsed.data);
    if (!result.valid) return { ok: false, errors: result.errors };
  }
  return { ok: true, project: parsed.data };
}

function findLevelIndex(project: Project, levelId: Identifier): number {
  return IdentifierSchema.safeParse(levelId).success
    ? project.building.levels.findIndex((level) => level.id === levelId)
    : -1;
}

function replaceLevel(
  project: Project,
  levelIndex: number,
  level: Project["building"]["levels"][number]
): Project {
  return {
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels.map((candidate, index) =>
        index === levelIndex ? level : candidate
      )
    }
  };
}

function levelNotFound(levelId: Identifier): ValidationError {
  return {
    code: ValidationErrorCode.LEVEL_NOT_FOUND,
    path: "owningLevelId",
    message: `Level "${levelId}" could not be found.`
  };
}

function staircaseNotFound(staircaseId: Identifier): ValidationError {
  return {
    code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
    path: "staircaseId",
    message: `Staircase "${staircaseId}" could not be found.`
  };
}

function invalidStaircase(path: string): ValidationError {
  return {
    code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
    path,
    message: "Staircase data does not satisfy the canonical Staircase contract."
  };
}

function failure(error: ValidationError): ProjectEditingResult {
  return { ok: false, errors: [error] };
}
