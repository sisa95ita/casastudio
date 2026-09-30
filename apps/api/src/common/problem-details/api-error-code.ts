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
  ProjectAggregateIdMismatch = "PROJECT_AGGREGATE_ID_MISMATCH",
  ProjectServerFieldsInvalid = "PROJECT_SERVER_FIELDS_INVALID",
  ProjectStateInvalid = "PROJECT_STATE_INVALID",
  ProjectRevisionConflict = "PROJECT_REVISION_CONFLICT",
  ProjectNameConflict = "PROJECT_NAME_CONFLICT",
  ProjectWriteFailed = "PROJECT_WRITE_FAILED",
  ProjectGeometryBuildFailed = "PROJECT_GEOMETRY_BUILD_FAILED",
  ProjectGeometryInvalid = "PROJECT_GEOMETRY_INVALID",
  ProjectGeometrySerializationFailed = "PROJECT_GEOMETRY_SERIALIZATION_FAILED",
  AiProviderNotConfigured = "AI_PROVIDER_NOT_CONFIGURED",
  AiProviderUnavailable = "AI_PROVIDER_UNAVAILABLE",
  AiAuthenticationFailed = "AI_AUTHENTICATION_FAILED",
  AiModelAccessFailed = "AI_MODEL_ACCESS_FAILED",
  AiRateLimited = "AI_RATE_LIMITED",
  AiGenerationTimeout = "AI_GENERATION_TIMEOUT",
  AiInvalidProviderResponse = "AI_INVALID_PROVIDER_RESPONSE",
  AiGenerationFailed = "AI_GENERATION_FAILED",
  AiMissingReference = "AI_MISSING_REFERENCE",
  AiUnsupportedTarget = "AI_UNSUPPORTED_TARGET"
}
