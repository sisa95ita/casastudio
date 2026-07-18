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
  RENDER_REQUEST_NOT_RENDERABLE = "RENDER_REQUEST_NOT_RENDERABLE",

  /**
   * A Viewpoint references a Room that belongs to a different Level than the Viewpoint.
   */
  VIEWPOINT_ROOM_LEVEL_MISMATCH = "VIEWPOINT_ROOM_LEVEL_MISMATCH",

  /**
   * A Staircase fromRoomId references a Room that belongs to a different Level than fromLevelId.
   */
  STAIRCASE_FROM_ROOM_LEVEL_MISMATCH = "STAIRCASE_FROM_ROOM_LEVEL_MISMATCH",

  /**
   * A Staircase toRoomId references a Room that belongs to a different Level than toLevelId.
   */
  STAIRCASE_TO_ROOM_LEVEL_MISMATCH = "STAIRCASE_TO_ROOM_LEVEL_MISMATCH",

  /**
   * A RenderRequest references a BaseImage derived from a different Viewpoint.
   */
  RENDER_REQUEST_VIEWPOINT_BASE_IMAGE_MISMATCH = "RENDER_REQUEST_VIEWPOINT_BASE_IMAGE_MISMATCH",

  /**
   * A Wall has identical start and end coordinates.
   */
  WALL_ZERO_LENGTH = "WALL_ZERO_LENGTH",

  /**
   * An Opening starts before the Wall or extends beyond the Wall length.
   */
  OPENING_OUTSIDE_WALL = "OPENING_OUTSIDE_WALL",

  /**
   * A StairFlight has identical start and end coordinates.
   */
  STAIR_FLIGHT_ZERO_LENGTH = "STAIR_FLIGHT_ZERO_LENGTH",

  /**
   * A StairLanding width is zero or negative.
   */
  STAIR_LANDING_NON_POSITIVE_WIDTH = "STAIR_LANDING_NON_POSITIVE_WIDTH",

  /**
   * A StairLanding depth is zero or negative.
   */
  STAIR_LANDING_NON_POSITIVE_DEPTH = "STAIR_LANDING_NON_POSITIVE_DEPTH",

  /**
   * A StairFlight end elevation is not greater than its start elevation.
   */
  STAIR_FLIGHT_NOT_ASCENDING = "STAIR_FLIGHT_NOT_ASCENDING",

  /**
   * A Level contains multiple Walls with identical start and end coordinates.
   */
  DUPLICATE_WALL_GEOMETRY = "DUPLICATE_WALL_GEOMETRY"
}
