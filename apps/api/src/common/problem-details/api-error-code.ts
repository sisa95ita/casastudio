/**
 * Stable top-level API error codes exposed in Problem Details responses.
 *
 * These codes intentionally stay infrastructure-level in Phase 1A so future
 * project and geometry APIs can add domain-specific codes without changing the
 * base error envelope.
 */
export enum ApiErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  Unauthorized = "UNAUTHORIZED",
  Forbidden = "FORBIDDEN",
  InternalServerError = "INTERNAL_SERVER_ERROR",
  DependencyUnavailable = "DEPENDENCY_UNAVAILABLE"
}
