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

/**
 * Validates whether an already parsed Project contains the minimum workflow
 * data required by the future Geometry Engine rendering pipeline.
 *
 * This phase is separate from ProjectSchema composition and cross-reference
 * validation. It checks only first-layer renderability prerequisites and does
 * not perform geometry, asset, provider, prompt, status-lifecycle, or
 * bidirectional-consistency validation.
 */
export const validateProjectRenderability = (project: Project): ValidationResult => {
  const errors: ValidationError[] = [];
  const viewpointIds = toIdSet(project.viewpoints);
  const baseImageIds = toIdSet(project.baseImages);
  const designBriefIds = toIdSet(project.designBriefs);
  const baseImageViewpointIds = new Set(project.baseImages.map((baseImage) => baseImage.viewpointId));

  if (project.viewpoints.length === 0) {
    pushError(
      errors,
      ValidationErrorCode.PROJECT_HAS_NO_VIEWPOINTS,
      "viewpoints",
      "Project must contain at least one viewpoint to be renderable."
    );
  }

  project.viewpoints.forEach((viewpoint, viewpointIndex) => {
    if (!baseImageViewpointIds.has(viewpoint.id)) {
      pushError(
        errors,
        ValidationErrorCode.VIEWPOINT_HAS_NO_BASE_IMAGE,
        `viewpoints[${viewpointIndex}]`,
        `Viewpoint "${viewpoint.id}" must have at least one base image to be renderable.`
      );
    }
  });

  if (project.designBriefs.length === 0) {
    pushError(
      errors,
      ValidationErrorCode.PROJECT_HAS_NO_DESIGN_BRIEFS,
      "designBriefs",
      "Project must contain at least one design brief to be renderable."
    );
  }

  if (project.renderRequests.length === 0) {
    pushError(
      errors,
      ValidationErrorCode.PROJECT_HAS_NO_RENDER_REQUESTS,
      "renderRequests",
      "Project must contain at least one render request to be renderable."
    );
  }

  project.renderRequests.forEach((renderRequest, renderRequestIndex) => {
    if (!viewpointIds.has(renderRequest.viewpointId)) {
      pushError(
        errors,
        ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE,
        `renderRequests[${renderRequestIndex}].viewpointId`,
        `RenderRequest "${renderRequest.id}" references missing viewpoint "${renderRequest.viewpointId}".`
      );
    }

    if (!baseImageIds.has(renderRequest.baseImageId)) {
      pushError(
        errors,
        ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE,
        `renderRequests[${renderRequestIndex}].baseImageId`,
        `RenderRequest "${renderRequest.id}" references missing base image "${renderRequest.baseImageId}".`
      );
    }

    if (!designBriefIds.has(renderRequest.designBriefId)) {
      pushError(
        errors,
        ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE,
        `renderRequests[${renderRequestIndex}].designBriefId`,
        `RenderRequest "${renderRequest.id}" references missing design brief "${renderRequest.designBriefId}".`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};
