/**
 * Stable top-level API error codes exposed in Problem Details responses.
 *
 * Infrastructure and domain-specific codes share one vocabulary so clients can
 * branch on stable failure identifiers without parsing human-readable text.
 */
export enum ApiErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  Unauthorized = "UNAUTHORIZED",
  Forbidden = "FORBIDDEN",
  InternalServerError = "INTERNAL_SERVER_ERROR",
  DependencyUnavailable = "DEPENDENCY_UNAVAILABLE",
  ProjectIdInvalid = "PROJECT_ID_INVALID",
  ProjectNotFound = "PROJECT_NOT_FOUND",
  ProjectAccessForbidden = "PROJECT_ACCESS_FORBIDDEN",
  ProjectPersistedStateInvalid = "PROJECT_PERSISTED_STATE_INVALID",
  ProjectReadFailed = "PROJECT_READ_FAILED",
  ProjectGeometryBuildFailed = "PROJECT_GEOMETRY_BUILD_FAILED",
  ProjectGeometryInvalid = "PROJECT_GEOMETRY_INVALID",
  ProjectGeometrySerializationFailed = "PROJECT_GEOMETRY_SERIALIZATION_FAILED"
}
