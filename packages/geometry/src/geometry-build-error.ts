/**
 * Stable public error codes produced while deriving runtime geometry.
 *
 * These codes intentionally describe Geometry Engine build failures rather
 * than schema parsing or persisted validation failures. The first executable
 * slice only exposes the categories needed to defend runtime construction.
 */
export const GeometryBuildErrorCode = {
  INVALID_PROJECT_GEOMETRY: "INVALID_PROJECT_GEOMETRY",
  MISSING_SOURCE_ENTITY: "MISSING_SOURCE_ENTITY",
  GEOMETRY_BUILD_INVARIANT_VIOLATION: "GEOMETRY_BUILD_INVARIANT_VIOLATION"
} as const;

/**
 * Public discriminant for geometry-build diagnostics.
 */
export type GeometryBuildErrorCode =
  (typeof GeometryBuildErrorCode)[keyof typeof GeometryBuildErrorCode];

/**
 * Describes an expected failure while deriving a `GeometryModel`.
 *
 * Geometry build errors are returned in `GeometryBuildResult` and are not
 * thrown. `path` points at the relevant source Project location when known,
 * while `sourceId` carries the source entity identifier involved in the
 * failure.
 */
export type GeometryBuildError = {
  readonly code: GeometryBuildErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly sourceId?: string;
};
