import { ProjectSchema, type Project } from "../project/index.js";
import { IdentifierSchema, type Identifier } from "../primitives/index.js";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectIdentifierUniqueness,
  validateProjectReferenceConsistency,
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

/** Input for atomically removing one eligible highest Level. */
export type DeleteLevelInput = {
  readonly levelId: Identifier;
};

/**
 * Returns the canonical highest Level using elevation followed by durable Level
 * order as the deterministic tie-breaker.
 */
export function findHighestLevel(
  project: Pick<Project, "building">
): Level | undefined {
  return project.building.levels.reduce<Level | undefined>(
    (highest, level) =>
      !highest || level.elevation >= highest.elevation ? level : highest,
    undefined
  );
}

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
  if (
    levelResult.data.name === current.name &&
    levelResult.data.elevation === current.elevation
  ) {
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

/**
 * Removes only the highest Level while preserving at least one Level.
 *
 * Level-owned Walls, Openings, Rooms, and Staircases are removed with their
 * container. Building Furniture, cross-Level Staircases, and observation and
 * rendering artifacts that depend on the deleted Level are cascaded in the
 * same validated Project candidate.
 */
export function deleteLevel(
  project: Project,
  input: DeleteLevelInput
): ProjectEditingResult {
  const level = project.building.levels.find(
    (candidate) => candidate.id === input.levelId
  );
  if (!level) {
    return failure({
      code: ValidationErrorCode.LEVEL_NOT_FOUND,
      path: "levelId",
      message: `Level "${input.levelId}" could not be found.`
    });
  }
  const highest = findHighestLevel(project);
  if (project.building.levels.length <= 1 || highest?.id !== level.id) {
    return failure({
      code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
      path: "levelId",
      message:
        project.building.levels.length <= 1
          ? "The final remaining Level cannot be deleted."
          : `Only the highest Level "${highest?.id}" can be deleted.`
    });
  }

  const deletedRoomIds = new Set(level.rooms.map((room) => room.id));
  const deletedViewpointIds = new Set(
    project.viewpoints
      .filter((viewpoint) => viewpoint.levelId === level.id)
      .map((viewpoint) => viewpoint.id)
  );
  const deletedBaseImageIds = new Set(
    project.baseImages
      .filter((image) => deletedViewpointIds.has(image.viewpointId))
      .map((image) => image.id)
  );
  const deletedRenderRequestIds = new Set(
    project.renderRequests
      .filter(
        (request) =>
          deletedViewpointIds.has(request.viewpointId) ||
          deletedBaseImageIds.has(request.baseImageId)
      )
      .map((request) => request.id)
  );

  const candidate: Project = {
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels
        .filter((candidateLevel) => candidateLevel.id !== level.id)
        .map((candidateLevel) => ({
          ...candidateLevel,
          staircases: candidateLevel.staircases.filter(
            (staircase) =>
              staircase.fromLevelId !== level.id &&
              staircase.toLevelId !== level.id &&
              (!staircase.fromRoomId ||
                !deletedRoomIds.has(staircase.fromRoomId)) &&
              (!staircase.toRoomId || !deletedRoomIds.has(staircase.toRoomId))
          )
        })),
      furniture: project.building.furniture.filter(
        (item) => !deletedRoomIds.has(item.roomId)
      )
    },
    viewpoints: project.viewpoints.filter(
      (viewpoint) => !deletedViewpointIds.has(viewpoint.id)
    ),
    baseImages: project.baseImages.filter(
      (image) => !deletedBaseImageIds.has(image.id)
    ),
    renderRequests: project.renderRequests.filter(
      (request) => !deletedRenderRequestIds.has(request.id)
    ),
    renderResults: project.renderResults.filter(
      (result) => !deletedRenderRequestIds.has(result.renderRequestId)
    )
  };

  return validateCandidate(candidate);
}

function validateCandidate(candidate: Project): ProjectEditingResult {
  const parsed = ProjectSchema.safeParse(candidate);
  if (!parsed.success) return failure(invalidLevelProperties());
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

function invalidLevelProperties(): ValidationError {
  return {
    code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
    path: "level",
    message:
      "Level name and elevation must satisfy the canonical Level contract."
  };
}

function failure(error: ValidationError): ProjectEditingResult {
  return { ok: false, errors: [error] };
}
