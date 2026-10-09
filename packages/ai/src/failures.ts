export type DesignFailureCode =
  | "provider_not_configured"
  | "provider_unavailable"
  | "authentication_failed"
  | "model_access_failed"
  | "rate_limited"
  | "generation_timeout"
  | "invalid_provider_response"
  | "generation_failed"
  | "missing_reference"
  | "stale_context"
  | "unsupported_target";

/** Safe provider-neutral failure. Provider details remain in `cause` for server logs. */
export class DesignGenerationError extends Error {
  constructor(
    readonly code: DesignFailureCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "DesignGenerationError";
  }
}
