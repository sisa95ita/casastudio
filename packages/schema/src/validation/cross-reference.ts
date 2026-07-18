import type { Project } from "../project";
import { ValidationErrorCode } from "./validation-error-code";
import type { ValidationError, ValidationResult } from "./validation-result";

const toIdSet = (items: { id: string }[]) => new Set(items.map((item) => item.id));

const pushError = (
  errors: ValidationError[],
  code: ValidationErrorCode,
  path: string,
  message: string
) => {
  errors.push({ code, path, message });
};

export const validateProjectCrossReferences = (project: Project): ValidationResult => {
  const errors: ValidationError[] = [];
  const levelIds = toIdSet(project.building.levels);
  const viewpointIds = toIdSet(project.viewpoints);
  const baseImageIds = toIdSet(project.baseImages);
  const designBriefIds = toIdSet(project.designBriefs);
  const renderRequestIds = toIdSet(project.renderRequests);
  const projectRoomIds = new Set(project.building.levels.flatMap((level) => level.rooms.map((room) => room.id)));

  project.building.levels.forEach((level, levelIndex) => {
    const levelRoomIds = toIdSet(level.rooms);
    const levelWallIds = toIdSet(level.walls);

    level.rooms.forEach((room, roomIndex) => {
      room.wallIds.forEach((wallId, wallIdIndex) => {
        if (!levelWallIds.has(wallId)) {
          pushError(
            errors,
            ValidationErrorCode.WALL_NOT_FOUND,
            `building.levels[${levelIndex}].rooms[${roomIndex}].wallIds[${wallIdIndex}]`,
            `Room "${room.id}" references wall "${wallId}", but no wall with that id exists in level "${level.id}".`
          );
        }
      });
    });

    level.walls.forEach((wall, wallIndex) => {
      wall.roomIds.forEach((roomId, roomIdIndex) => {
        if (!levelRoomIds.has(roomId)) {
          pushError(
            errors,
            ValidationErrorCode.ROOM_NOT_FOUND,
            `building.levels[${levelIndex}].walls[${wallIndex}].roomIds[${roomIdIndex}]`,
            `Wall "${wall.id}" references room "${roomId}", but no room with that id exists in level "${level.id}".`
          );
        }
      });

      wall.openings.forEach((opening, openingIndex) => {
        if (opening.type !== "DOOR" || !opening.connectedRoomIds) {
          return;
        }

        opening.connectedRoomIds.forEach((roomId, connectedRoomIdIndex) => {
          if (!levelRoomIds.has(roomId)) {
            pushError(
              errors,
              ValidationErrorCode.ROOM_NOT_FOUND,
              `building.levels[${levelIndex}].walls[${wallIndex}].openings[${openingIndex}].connectedRoomIds[${connectedRoomIdIndex}]`,
              `Opening "${opening.id}" references connected room "${roomId}", but no room with that id exists in level "${level.id}".`
            );
          }
        });
      });
    });

    level.staircases.forEach((staircase, staircaseIndex) => {
      if (!levelIds.has(staircase.fromLevelId)) {
        pushError(
          errors,
          ValidationErrorCode.LEVEL_NOT_FOUND,
          `building.levels[${levelIndex}].staircases[${staircaseIndex}].fromLevelId`,
          `Staircase "${staircase.id}" references from level "${staircase.fromLevelId}", but no level with that id exists.`
        );
      }

      if (!levelIds.has(staircase.toLevelId)) {
        pushError(
          errors,
          ValidationErrorCode.LEVEL_NOT_FOUND,
          `building.levels[${levelIndex}].staircases[${staircaseIndex}].toLevelId`,
          `Staircase "${staircase.id}" references to level "${staircase.toLevelId}", but no level with that id exists.`
        );
      }

      if (staircase.fromRoomId && !projectRoomIds.has(staircase.fromRoomId)) {
        pushError(
          errors,
          ValidationErrorCode.ROOM_NOT_FOUND,
          `building.levels[${levelIndex}].staircases[${staircaseIndex}].fromRoomId`,
          `Staircase "${staircase.id}" references from room "${staircase.fromRoomId}", but no room with that id exists.`
        );
      }

      if (staircase.toRoomId && !projectRoomIds.has(staircase.toRoomId)) {
        pushError(
          errors,
          ValidationErrorCode.ROOM_NOT_FOUND,
          `building.levels[${levelIndex}].staircases[${staircaseIndex}].toRoomId`,
          `Staircase "${staircase.id}" references to room "${staircase.toRoomId}", but no room with that id exists.`
        );
      }
    });
  });

  project.viewpoints.forEach((viewpoint, viewpointIndex) => {
    if (!levelIds.has(viewpoint.levelId)) {
      pushError(
        errors,
        ValidationErrorCode.LEVEL_NOT_FOUND,
        `viewpoints[${viewpointIndex}].levelId`,
        `Viewpoint "${viewpoint.id}" references level "${viewpoint.levelId}", but no level with that id exists.`
      );
    }

    if (viewpoint.roomId && !projectRoomIds.has(viewpoint.roomId)) {
      pushError(
        errors,
        ValidationErrorCode.ROOM_NOT_FOUND,
        `viewpoints[${viewpointIndex}].roomId`,
        `Viewpoint "${viewpoint.id}" references room "${viewpoint.roomId}", but no room with that id exists.`
      );
    }
  });

  project.baseImages.forEach((baseImage, baseImageIndex) => {
    if (!viewpointIds.has(baseImage.viewpointId)) {
      pushError(
        errors,
        ValidationErrorCode.VIEWPOINT_NOT_FOUND,
        `baseImages[${baseImageIndex}].viewpointId`,
        `BaseImage "${baseImage.id}" references viewpoint "${baseImage.viewpointId}", but no viewpoint with that id exists.`
      );
    }
  });

  project.renderRequests.forEach((renderRequest, renderRequestIndex) => {
    if (!viewpointIds.has(renderRequest.viewpointId)) {
      pushError(
        errors,
        ValidationErrorCode.VIEWPOINT_NOT_FOUND,
        `renderRequests[${renderRequestIndex}].viewpointId`,
        `RenderRequest "${renderRequest.id}" references viewpoint "${renderRequest.viewpointId}", but no viewpoint with that id exists.`
      );
    }

    if (!baseImageIds.has(renderRequest.baseImageId)) {
      pushError(
        errors,
        ValidationErrorCode.BASE_IMAGE_NOT_FOUND,
        `renderRequests[${renderRequestIndex}].baseImageId`,
        `RenderRequest "${renderRequest.id}" references base image "${renderRequest.baseImageId}", but no base image with that id exists.`
      );
    }

    if (!designBriefIds.has(renderRequest.designBriefId)) {
      pushError(
        errors,
        ValidationErrorCode.DESIGN_BRIEF_NOT_FOUND,
        `renderRequests[${renderRequestIndex}].designBriefId`,
        `RenderRequest "${renderRequest.id}" references design brief "${renderRequest.designBriefId}", but no design brief with that id exists.`
      );
    }
  });

  project.renderResults.forEach((renderResult, renderResultIndex) => {
    if (!renderRequestIds.has(renderResult.renderRequestId)) {
      pushError(
        errors,
        ValidationErrorCode.RENDER_REQUEST_NOT_FOUND,
        `renderResults[${renderResultIndex}].renderRequestId`,
        `RenderResult "${renderResult.id}" references render request "${renderResult.renderRequestId}", but no render request with that id exists.`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

