/**
 * Stable error codes returned by schema-owned Project migration.
 *
 * These codes describe migration input, transformation, and canonical
 * validation failures. They are intentionally separate from validation-layer
 * `ValidationErrorCode` values.
 */
export enum MigrationErrorCode {
  /**
   * Raw input did not declare a schema version.
   */
  MISSING_SCHEMA_VERSION = "MISSING_SCHEMA_VERSION",

  /**
   * Raw input declared a schema version in an invalid shape.
   */
  INVALID_SCHEMA_VERSION = "INVALID_SCHEMA_VERSION",

  /**
   * Raw input declared a version with no supported migration path.
   */
  UNSUPPORTED_PROJECT_SCHEMA_VERSION = "UNSUPPORTED_PROJECT_SCHEMA_VERSION",

  /**
   * Legacy input did not match the expected source-version structure.
   */
  INVALID_LEGACY_SHAPE = "INVALID_LEGACY_SHAPE",

  /**
   * Legacy `wallIds` topology could not be reconstructed as a room boundary.
   */
  LEGACY_ROOM_BOUNDARY_MIGRATION_FAILED = "LEGACY_ROOM_BOUNDARY_MIGRATION_FAILED",

  /**
   * Transformed data failed canonical Project schema validation.
   */
  CANONICAL_VALIDATION_FAILED = "CANONICAL_VALIDATION_FAILED"
}

/**
 * Fine-grained reasons for legacy `wallIds` boundary reconstruction failures.
 */
export enum LegacyRoomBoundaryMigrationFailureReason {
  MISSING_WALL = "MISSING_WALL",
  CROSS_LEVEL_WALL = "CROSS_LEVEL_WALL",
  DUPLICATE_WALL_REFERENCE = "DUPLICATE_WALL_REFERENCE",
  DEGENERATE_WALL = "DEGENERATE_WALL",
  OPEN_LOOP = "OPEN_LOOP",
  DISCONNECTED_LOOP = "DISCONNECTED_LOOP",
  BRANCHING_GRAPH = "BRANCHING_GRAPH",
  MULTIPLE_VALID_LOOPS = "MULTIPLE_VALID_LOOPS",
  DEGENERATE_POLYGON = "DEGENERATE_POLYGON",
  SELF_INTERSECTING_LOOP = "SELF_INTERSECTING_LOOP",
  PARTIAL_BOUNDARY_OVERLAP = "PARTIAL_BOUNDARY_OVERLAP",
  DUPLICATE_WALL_GEOMETRY = "DUPLICATE_WALL_GEOMETRY",
  NON_MANIFOLD_REFERENCE = "NON_MANIFOLD_REFERENCE",
  BIDIRECTIONAL_REFERENCE_CONFLICT = "BIDIRECTIONAL_REFERENCE_CONFLICT",
  INVALID_LEGACY_SHAPE = "INVALID_LEGACY_SHAPE"
}

/**
 * Non-throwing migration error reported for expected document failures.
 */
export type ProjectMigrationError = {
  code: MigrationErrorCode;
  message: string;
  path?: string;
  sourceVersion?: string;
  roomId?: string;
  wallId?: string;
  levelId?: string;
  reason?: LegacyRoomBoundaryMigrationFailureReason;
};
