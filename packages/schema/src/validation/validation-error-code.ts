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
  RENDER_REQUEST_NOT_FOUND = "RENDER_REQUEST_NOT_FOUND"
}
