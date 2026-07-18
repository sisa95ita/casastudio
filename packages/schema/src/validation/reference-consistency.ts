import type { BaseImage, Viewpoint } from "../observation";
import type { Level } from "../physical-building";
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

const createLevelLookup = (levels: Level[]) => new Map(levels.map((level) => [level.id, level]));

const createRoomLevelLookup = (levels: Level[]) => {
  const roomLevelIds = new Map<string, string>();

  levels.forEach((level) => {
    level.rooms.forEach((room) => {
      roomLevelIds.set(room.id, level.id);
    });
  });

  return roomLevelIds;
};

const createViewpointLookup = (viewpoints: Viewpoint[]) =>
  new Map(viewpoints.map((viewpoint) => [viewpoint.id, viewpoint]));

const createBaseImageLookup = (baseImages: BaseImage[]) =>
  new Map(baseImages.map((baseImage) => [baseImage.id, baseImage]));

/**
 * Validates semantic coherence between references that already resolve.
 *
 * This phase assumes structural validation and cross-reference validation are
 * handled elsewhere. Missing referenced entities are skipped so this validator
 * only reports consistency mismatches between existing Project entities.
 */
export const validateProjectReferenceConsistency = (project: Project): ValidationResult => {
  const errors: ValidationError[] = [];
  const levelsById = createLevelLookup(project.building.levels);
  const roomLevelIds = createRoomLevelLookup(project.building.levels);
  const viewpointsById = createViewpointLookup(project.viewpoints);
  const baseImagesById = createBaseImageLookup(project.baseImages);

  project.viewpoints.forEach((viewpoint, viewpointIndex) => {
    if (!viewpoint.roomId) {
      return;
    }

    const level = levelsById.get(viewpoint.levelId);
    const roomLevelId = roomLevelIds.get(viewpoint.roomId);

    if (!level || !roomLevelId) {
      return;
    }

    if (roomLevelId !== level.id) {
      pushError(
        errors,
        ValidationErrorCode.VIEWPOINT_ROOM_LEVEL_MISMATCH,
        `viewpoints[${viewpointIndex}].roomId`,
        `Viewpoint "${viewpoint.id}" references room "${viewpoint.roomId}", but that room belongs to level "${roomLevelId}" instead of level "${level.id}".`
      );
    }
  });

  project.building.levels.forEach((level, levelIndex) => {
    level.staircases.forEach((staircase, staircaseIndex) => {
      if (staircase.fromRoomId) {
        const fromLevel = levelsById.get(staircase.fromLevelId);
        const fromRoomLevelId = roomLevelIds.get(staircase.fromRoomId);

        if (fromLevel && fromRoomLevelId && fromRoomLevelId !== fromLevel.id) {
          pushError(
            errors,
            ValidationErrorCode.STAIRCASE_FROM_ROOM_LEVEL_MISMATCH,
            `building.levels[${levelIndex}].staircases[${staircaseIndex}].fromRoomId`,
            `Staircase "${staircase.id}" references from room "${staircase.fromRoomId}", but that room belongs to level "${fromRoomLevelId}" instead of from level "${fromLevel.id}".`
          );
        }
      }

      if (staircase.toRoomId) {
        const toLevel = levelsById.get(staircase.toLevelId);
        const toRoomLevelId = roomLevelIds.get(staircase.toRoomId);

        if (toLevel && toRoomLevelId && toRoomLevelId !== toLevel.id) {
          pushError(
            errors,
            ValidationErrorCode.STAIRCASE_TO_ROOM_LEVEL_MISMATCH,
            `building.levels[${levelIndex}].staircases[${staircaseIndex}].toRoomId`,
            `Staircase "${staircase.id}" references to room "${staircase.toRoomId}", but that room belongs to level "${toRoomLevelId}" instead of to level "${toLevel.id}".`
          );
        }
      }
    });
  });

  project.renderRequests.forEach((renderRequest, renderRequestIndex) => {
    const viewpoint = viewpointsById.get(renderRequest.viewpointId);
    const baseImage = baseImagesById.get(renderRequest.baseImageId);

    if (!viewpoint || !baseImage) {
      return;
    }

    if (baseImage.viewpointId !== viewpoint.id) {
      pushError(
        errors,
        ValidationErrorCode.RENDER_REQUEST_VIEWPOINT_BASE_IMAGE_MISMATCH,
        `renderRequests[${renderRequestIndex}].baseImageId`,
        `RenderRequest "${renderRequest.id}" references base image "${baseImage.id}", but that base image belongs to viewpoint "${baseImage.viewpointId}" instead of viewpoint "${viewpoint.id}".`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};
