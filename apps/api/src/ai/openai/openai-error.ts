import { DesignGenerationError } from "@casastudio/ai";
import {
  AiProviderFailure,
  type AiFailureStage,
  type AiProviderDiagnostics
} from "../ai-provider-failure";

const sdkErrorClasses = new Set([
  "Error",
  "TypeError",
  "SyntaxError",
  "ZodError",
  "OpenAIError",
  "APIError",
  "BadRequestError",
  "AuthenticationError",
  "PermissionDeniedError",
  "NotFoundError",
  "ConflictError",
  "UnprocessableEntityError",
  "RateLimitError",
  "InternalServerError",
  "APIConnectionError",
  "APIConnectionTimeoutError",
  "AbortError",
  "APIUserAbortError"
]);

const recordOf = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};

/** Never log raw messages: upstream errors can quote user input, keys or headers. */
export function sanitizedOpenAIDiagnostics(
  error: unknown,
  stage: AiFailureStage,
  responseRequestId?: unknown
): AiProviderDiagnostics {
  const record = recordOf(error);
  const payload = recordOf(record.error);
  const token = (value: unknown) =>
    typeof value === "string" && /^[a-z][a-z0-9_]{0,79}$/.test(value)
      ? value
      : undefined;
  const providerCode = token(record.code) ?? token(payload.code);
  const providerType = token(record.type) ?? token(payload.type);
  const upstreamStatus =
    typeof record.status === "number" &&
    Number.isInteger(record.status) &&
    record.status >= 100 &&
    record.status <= 599
      ? record.status
      : undefined;
  const constructor = record["constructor"];
  const constructorName =
    typeof constructor === "function" ? constructor.name : undefined;
  const className =
    constructorName && sdkErrorClasses.has(constructorName)
      ? constructorName
      : record.name;
  const errorClass =
    typeof className === "string" && sdkErrorClasses.has(className)
      ? className
      : "UnknownError";
  const param = record.param ?? payload.param;
  const providerParam =
    typeof param === "string" &&
    /^[a-zA-Z_][a-zA-Z0-9_.[\]]{0,119}$/.test(param)
      ? param
      : undefined;
  // SDK APIError.requestID is copied from the response x-request-id header.
  const candidateId =
    record.requestID ?? record.request_id ?? responseRequestId;
  const providerRequestId =
    typeof candidateId === "string" &&
    /^(?:req_[a-zA-Z0-9_-]+|[a-fA-F0-9-]{16,64})$/.test(candidateId) &&
    candidateId.length <= 160
      ? candidateId
      : undefined;
  const schemaFailure =
    providerCode === "invalid_json_schema" ||
    (upstreamStatus === 400 && providerParam === "text.format.schema");
  const message =
    typeof payload.message === "string"
      ? payload.message
      : typeof record.message === "string"
        ? record.message
        : "";
  const unsupportedSchemaKeyword = schemaFailure
    ? [
        "oneOf",
        "allOf",
        "not",
        "if",
        "then",
        "else",
        "dependentRequired",
        "dependentSchemas"
      ].find((keyword) => new RegExp(`\\b${keyword}\\b`).test(message))
    : undefined;
  const safeMessage =
    stage === "request_construction"
      ? "Furniture interpretation request construction failed locally."
      : stage === "response_decoding"
        ? "Provider output could not be decoded as structured Furniture edits."
        : stage === "provider_result_validation"
          ? "Provider output failed the Furniture edit result contract."
          : schemaFailure
            ? "OpenAI rejected the Structured Outputs JSON schema."
            : providerCode === "unsupported_parameter"
              ? "OpenAI rejected an unsupported request parameter."
              : upstreamStatus
                ? `OpenAI returned HTTP ${upstreamStatus} for Furniture interpretation.`
                : "Furniture interpretation SDK call failed without an upstream HTTP status.";
  return {
    errorClass,
    upstreamStatus,
    providerCode,
    providerType,
    providerParam,
    providerRequestId,
    unsupportedSchemaKeyword,
    safeMessage
  };
}

export function furnitureInterpretationFailure(
  error: unknown,
  stage: AiFailureStage,
  responseRequestId?: unknown
): AiProviderFailure {
  const mapped =
    stage === "provider_request"
      ? normalizeOpenAIError(error, new Date(), "furniture-edit")
      : new DesignGenerationError(
          stage === "request_construction"
            ? "generation_failed"
            : "invalid_provider_response",
          stage === "request_construction"
            ? "The Furniture edit request could not be prepared."
            : "The AI provider did not return a valid Furniture edit."
        );
  return new AiProviderFailure(
    mapped.code,
    mapped.message,
    stage,
    sanitizedOpenAIDiagnostics(error, stage, responseRequestId),
    { cause: error }
  );
}

export function normalizeOpenAIError(
  error: unknown,
  now: Date,
  operation: "interior-design" | "furniture-edit" = "interior-design"
): DesignGenerationError {
  if (error instanceof DesignGenerationError) return error;
  const record =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const status = typeof record.status === "number" ? record.status : undefined;
  const code = typeof record.code === "string" ? record.code : undefined;
  const name = typeof record.name === "string" ? record.name : undefined;

  if (
    status === 404 ||
    code === "model_not_found" ||
    code === "model_access_denied"
  ) {
    return new DesignGenerationError(
      "model_access_failed",
      "The configured AI model is unavailable to this server.",
      { cause: error }
    );
  }

  if (status === 401 || status === 403) {
    return new DesignGenerationError(
      "authentication_failed",
      "The AI provider rejected the server configuration.",
      { cause: error }
    );
  }
  if (status === 429) {
    const retryAfterSeconds = readRetryAfterSeconds(record.headers, now);
    const allowanceExhausted =
      record.type === "insufficient_quota" ||
      [
        "insufficient_quota",
        "credit_balance_exhausted",
        "organization_spend_limit_exceeded",
        "project_spend_limit_exceeded",
        "organization_usage_limit_exceeded"
      ].includes(code ?? "");
    return new DesignGenerationError(
      "rate_limited",
      allowanceExhausted
        ? "The AI provider's usage allowance is exhausted. Check the server's provider budget before trying again."
        : retryAfterSeconds !== undefined
          ? `The AI provider is rate limited. Try again in ${retryAfterSeconds} seconds.`
          : "The AI provider is rate limited. Try again later.",
      { cause: error }
    );
  }
  if (
    status === 408 ||
    code === "ETIMEDOUT" ||
    name === "AbortError" ||
    name === "APIConnectionTimeoutError"
  ) {
    return new DesignGenerationError(
      "generation_timeout",
      operation === "furniture-edit"
        ? "AI Furniture interpretation timed out."
        : "The AI image generation timed out.",
      { cause: error }
    );
  }
  if (status !== undefined && status >= 500) {
    return new DesignGenerationError(
      "provider_unavailable",
      "The AI provider is temporarily unavailable.",
      { cause: error }
    );
  }
  if (name === "APIConnectionError") {
    return new DesignGenerationError(
      "provider_unavailable",
      "The AI provider is temporarily unavailable.",
      { cause: error }
    );
  }
  return new DesignGenerationError(
    "generation_failed",
    operation === "furniture-edit"
      ? "The AI provider could not interpret the Furniture edit."
      : "The AI provider could not generate the design.",
    { cause: error }
  );
}

/** Read only a validated delay; raw headers and upstream messages stay server-side. */
function readRetryAfterSeconds(
  headers: unknown,
  now: Date
): number | undefined {
  if (!headers || typeof headers !== "object") return undefined;
  const values = headers as {
    get?: (name: string) => unknown;
    [key: string]: unknown;
  };
  const read = (name: string) => {
    const value =
      typeof values.get === "function" ? values.get(name) : values[name];
    return typeof value === "string" && value.length <= 100
      ? value.trim()
      : undefined;
  };
  const milliseconds = read("retry-after-ms");
  const retryAfter = read("retry-after");
  const numeric = /^\d+(?:\.\d+)?$/;
  const seconds =
    milliseconds && numeric.test(milliseconds)
      ? Number(milliseconds) / 1000
      : retryAfter && numeric.test(retryAfter)
        ? Number(retryAfter)
        : retryAfter && /^[A-Za-z]{3},/.test(retryAfter)
          ? (Date.parse(retryAfter) - now.getTime()) / 1000
          : undefined;
  return seconds !== undefined && Number.isFinite(seconds) && seconds >= 0
    ? Math.ceil(seconds)
    : undefined;
}
