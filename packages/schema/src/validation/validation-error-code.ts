/**
 * Shared error-code contract for CasaStudio validators.
 *
 * Codes are stable identifiers intended for callers that need to group,
 * translate, or act on validation failures without parsing human messages.
 */
export enum ValidationErrorCode {
  /**
   * A reference to a Room does not resolve during cross-reference validation.
   */
  ROOM_NOT_FOUND = "ROOM_NOT_FOUND",

  /**
   * A reference to a Wall does not resolve during cross-reference validation.
   */
  WALL_NOT_FOUND = "WALL_NOT_FOUND",

  /**
   * A domain operation found more than one Wall with the requested identifier.
   */
  DUPLICATE_WALL_ID = "DUPLICATE_WALL_ID",

  /**
   * A caller supplied an identifier already used by an entity of the same domain kind.
   */
  DUPLICATE_IDENTIFIER = "DUPLICATE_IDENTIFIER",

  /**
   * A caller supplied an identifier outside CasaStudio's persisted identifier format.
   */
  INVALID_IDENTIFIER = "INVALID_IDENTIFIER",

  /**
   * A domain editing operation received an endpoint that is not a valid finite point.
   */
  INVALID_WALL_ENDPOINT = "INVALID_WALL_ENDPOINT",

  /**
   * Removing a Wall would leave one or more canonical Room references dangling.
   */
  WALL_IS_REFERENCED = "WALL_IS_REFERENCED",

  /**
   * A domain operation produced a Project that no longer satisfies the structural schema.
   */
  PROJECT_SCHEMA_VALIDATION_FAILED = "PROJECT_SCHEMA_VALIDATION_FAILED",

  /**
   * A Room boundary references a Wall missing from the owning Level.
   */
  MISSING_ROOM_BOUNDARY_WALL = "MISSING_ROOM_BOUNDARY_WALL",

  /**
   * A Room boundary references a Wall owned by a different Level.
   */
  CROSS_LEVEL_ROOM_BOUNDARY = "CROSS_LEVEL_ROOM_BOUNDARY",

  /**
   * A reference to a Level does not resolve during cross-reference validation.
   */
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
   * Room.boundary and Wall.roomIds disagree during reference-consistency validation.
   */
  ROOM_WALL_REFERENCE_MISMATCH = "ROOM_WALL_REFERENCE_MISMATCH",

  /**
   * A Wall references more than two Rooms during reference-consistency validation.
   */
  NON_MANIFOLD_WALL_REFERENCE = "NON_MANIFOLD_WALL_REFERENCE",

  /**
   * A Wall references the same Room more than once during reference-consistency validation.
   */
  DUPLICATE_WALL_ROOM_REFERENCE = "DUPLICATE_WALL_ROOM_REFERENCE",

  /**
   * A Wall has identical start and end coordinates.
   */
  WALL_ZERO_LENGTH = "WALL_ZERO_LENGTH",

  /**
   * A requested Wall split point does not lie on the target segment.
   */
  WALL_SPLIT_POINT_NOT_ON_WALL = "WALL_SPLIT_POINT_NOT_ON_WALL",

  /**
   * A requested Wall split point is topologically equivalent to an endpoint.
   */
  WALL_SPLIT_AT_ENDPOINT = "WALL_SPLIT_AT_ENDPOINT",

  /**
   * A requested Wall split would divide an Opening between child segments.
   */
  WALL_SPLIT_INTERSECTS_OPENING = "WALL_SPLIT_INTERSECTS_OPENING",

  /**
   * A persisted Room boundary traversal does not close back to its starting point.
   */
  OPEN_ROOM_BOUNDARY = "OPEN_ROOM_BOUNDARY",

  /**
   * A persisted Room boundary uses a wall order that does not form a continuous traversal.
   */
  INVALID_ROOM_BOUNDARY_ORDER = "INVALID_ROOM_BOUNDARY_ORDER",

  /**
   * A persisted Room boundary edge direction prevents an otherwise ordered traversal from connecting.
   */
  INVALID_ROOM_BOUNDARY_DIRECTION = "INVALID_ROOM_BOUNDARY_DIRECTION",

  /**
   * A Room outer boundary is persisted clockwise instead of counter-clockwise.
   */
  CLOCKWISE_OUTER_ROOM_BOUNDARY = "CLOCKWISE_OUTER_ROOM_BOUNDARY",

  /**
   * A persisted Room boundary intersects itself.
   */
  SELF_INTERSECTING_ROOM_BOUNDARY = "SELF_INTERSECTING_ROOM_BOUNDARY",

  /**
   * A persisted Room boundary produces a zero-area polygon.
   */
  DEGENERATE_ROOM_BOUNDARY = "DEGENERATE_ROOM_BOUNDARY",

  /**
   * A persisted Room boundary contains unsupported overlapping collinear segments.
   */
  PARTIAL_BOUNDARY_OVERLAP = "PARTIAL_BOUNDARY_OVERLAP",

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
   * A Level contains multiple Walls with identical geometry in either orientation.
   */
  DUPLICATE_WALL_GEOMETRY = "DUPLICATE_WALL_GEOMETRY"
}
