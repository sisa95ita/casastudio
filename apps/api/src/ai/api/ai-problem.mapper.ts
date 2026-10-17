import { DesignGenerationError } from "@casastudio/ai";
import { HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import { ApiProblemError } from "../../common/problem-details/problem-details-exception";

export function toApiProblem(
  error: DesignGenerationError,
  operation: "interior-design" | "furniture-edit" = "interior-design"
): ApiProblemError {
  const mapping = {
    stale_context: [
      HttpStatus.CONFLICT,
      ApiErrorCode.AiStaleContext,
      "Historical design context"
    ],
    provider_not_configured: [
      HttpStatus.SERVICE_UNAVAILABLE,
      ApiErrorCode.AiProviderNotConfigured,
      "AI provider not configured"
    ],
    provider_unavailable: [
      HttpStatus.SERVICE_UNAVAILABLE,
      ApiErrorCode.AiProviderUnavailable,
      "AI provider unavailable"
    ],
    authentication_failed: [
      HttpStatus.SERVICE_UNAVAILABLE,
      ApiErrorCode.AiAuthenticationFailed,
      "AI provider authentication failed"
    ],
    model_access_failed: [
      HttpStatus.SERVICE_UNAVAILABLE,
      ApiErrorCode.AiModelAccessFailed,
      "AI model unavailable"
    ],
    rate_limited: [
      HttpStatus.TOO_MANY_REQUESTS,
      ApiErrorCode.AiRateLimited,
      "AI provider rate limited"
    ],
    generation_timeout: [
      HttpStatus.GATEWAY_TIMEOUT,
      ApiErrorCode.AiGenerationTimeout,
      "AI generation timed out"
    ],
    invalid_provider_response: [
      HttpStatus.BAD_GATEWAY,
      ApiErrorCode.AiInvalidProviderResponse,
      "Invalid AI provider response"
    ],
    generation_failed: [
      HttpStatus.BAD_GATEWAY,
      ApiErrorCode.AiGenerationFailed,
      "AI generation failed"
    ],
    missing_reference: [
      HttpStatus.BAD_REQUEST,
      ApiErrorCode.AiMissingReference,
      "Visual reference required"
    ],
    unsupported_target: [
      HttpStatus.UNPROCESSABLE_ENTITY,
      ApiErrorCode.AiUnsupportedTarget,
      "Unsupported design target"
    ]
  } as const;
  const [status, code, defaultTitle] = mapping[error.code];
  const furnitureTitles: Partial<
    Record<DesignGenerationError["code"], string>
  > = {
    generation_failed: "AI Furniture interpretation failed",
    invalid_provider_response: "Invalid AI Furniture edit response",
    generation_timeout: "AI Furniture interpretation timed out",
    stale_context: "Stale Furniture edit context",
    unsupported_target: "Unsupported Furniture edit context"
  };
  const title =
    operation === "furniture-edit"
      ? (furnitureTitles[error.code] ?? defaultTitle)
      : defaultTitle;
  const detail =
    operation === "furniture-edit" && error.code === "generation_failed"
      ? "The AI provider could not interpret the Furniture edit."
      : operation === "furniture-edit" && error.code === "generation_timeout"
        ? "AI Furniture interpretation timed out."
        : error.message;
  return new ApiProblemError({
    type: `/problems/${code.toLowerCase().replaceAll("_", "-")}`,
    title,
    status,
    detail,
    code
  });
}
