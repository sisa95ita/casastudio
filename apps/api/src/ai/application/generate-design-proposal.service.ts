import { randomUUID } from "node:crypto";

import {
  DesignGenerationError,
  InteriorDesignService,
  deriveDesignContext,
  type DesignProposal,
  type InteriorDesignProvider
} from "@casastudio/ai";
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import { ApiProblemError } from "../../common/problem-details/problem-details-exception";
import { AuthorizedProjectLoader } from "../../projects/application/authorized-project-loader.service";
import type { GenerateRoomDesignRequestDto } from "../api/design-proposal.dto";
import { INTERIOR_DESIGN_PROVIDER } from "../interior-design-provider.token";

@Injectable()
export class GenerateDesignProposalService {
  private readonly logger = new Logger(GenerateDesignProposalService.name);

  constructor(
    @Inject(AuthorizedProjectLoader)
    private readonly projectLoader: AuthorizedProjectLoader,
    @Inject(INTERIOR_DESIGN_PROVIDER)
    private readonly provider: InteriorDesignProvider
  ) {}

  async generate(
    projectId: string,
    input: GenerateRoomDesignRequestDto,
    principal: AuthenticatedPrincipal
  ): Promise<DesignProposal> {
    const { loadedProject } = await this.projectLoader.load(
      projectId,
      principal
    );
    const target = {
      kind: "room" as const,
      projectId,
      levelId: input.levelId,
      roomId: input.roomId
    };

    try {
      input.referenceViews.forEach((reference) => {
        validateReferenceImage(reference.image);
        if (
          reference.target.projectId !== projectId ||
          reference.target.levelId !== input.levelId ||
          reference.target.roomId !== input.roomId
        ) {
          throw new DesignGenerationError(
            "unsupported_target",
            "A visual reference does not match the requested Room."
          );
        }
      });
      const context = deriveDesignContext(loadedProject.project, target);
      const service = new InteriorDesignService(this.provider, {
        createId: () => `design-${randomUUID()}`,
        now: () => new Date()
      });
      return await service.generate({
        target,
        instructions: input.instructions,
        context,
        referenceViews: input.referenceViews
      });
    } catch (error) {
      if (!(error instanceof DesignGenerationError)) throw error;
      this.logger.warn(
        { projectId, roomId: input.roomId, code: error.code },
        "AI design generation failed"
      );
      throw toApiProblem(error);
    }
  }
}

function validateReferenceImage(
  image: GenerateRoomDesignRequestDto["referenceViews"][number]["image"]
): void {
  const prefix = `data:${image.mimeType};base64,`;
  if (!image.dataUrl.startsWith(prefix)) {
    throw new DesignGenerationError(
      "missing_reference",
      "The visual reference MIME type does not match its payload."
    );
  }
}

function toApiProblem(error: DesignGenerationError): ApiProblemError {
  const mapping = {
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
  const [status, code, title] = mapping[error.code];
  return new ApiProblemError({
    type: `/problems/${code.toLowerCase().replaceAll("_", "-")}`,
    title,
    status,
    detail: error.message,
    code
  });
}
