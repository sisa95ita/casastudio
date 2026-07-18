/**
 * Shared error-code contract for CasaStudio validation phases.
 *
 * Codes are stable identifiers intended for callers that need to group,
 * translate, or act on validation failures without parsing human messages.
 */
export enum ValidationErrorCode {
  ROOM_NOT_FOUND = "ROOM_NOT_FOUND",
  WALL_NOT_FOUND = "WALL_NOT_FOUND",
  LEVEL_NOT_FOUND = "LEVEL_NOT_FOUND",
  VIEWPOINT_NOT_FOUND = "VIEWPOINT_NOT_FOUND",
  BASE_IMAGE_NOT_FOUND = "BASE_IMAGE_NOT_FOUND",
  DESIGN_BRIEF_NOT_FOUND = "DESIGN_BRIEF_NOT_FOUND",
  RENDER_REQUEST_NOT_FOUND = "RENDER_REQUEST_NOT_FOUND",

  /**
   * The Project has no saved Viewpoints available for rendering.
   */
  PROJECT_HAS_NO_VIEWPOINTS = "PROJECT_HAS_NO_VIEWPOINTS",

  /**
   * A saved Viewpoint has no BaseImage derived from it.
   */
  VIEWPOINT_HAS_NO_BASE_IMAGE = "VIEWPOINT_HAS_NO_BASE_IMAGE",

  /**
   * The Project has no DesignBriefs describing rendering intent.
   */
  PROJECT_HAS_NO_DESIGN_BRIEFS = "PROJECT_HAS_NO_DESIGN_BRIEFS",

  /**
   * The Project has no RenderRequests to execute.
   */
  PROJECT_HAS_NO_RENDER_REQUESTS = "PROJECT_HAS_NO_RENDER_REQUESTS",

  /**
   * A RenderRequest is missing one or more required renderability references.
   */
  RENDER_REQUEST_NOT_RENDERABLE = "RENDER_REQUEST_NOT_RENDERABLE"
}
