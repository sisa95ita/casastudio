import { createHash } from "node:crypto";
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import {
  DesignGenerationError,
  type DesignProposal,
  type DesignReferenceView,
  type DesignGenerationUsage
} from "@casastudio/ai";
import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import { ApiProblemError } from "../../common/problem-details/problem-details-exception";
import {
  DESIGN_ARTIFACT_STORE,
  type DesignArtifactStore
} from "../artifacts/design-artifact.store";
import {
  DESIGN_PROPOSALS_REPOSITORY,
  type DesignProposalsRepository
} from "../persistence/design-proposal.repository";

@Injectable()
export class PersistDesignProposalService {
  private readonly logger = new Logger(PersistDesignProposalService.name);
  constructor(
    @Inject(DESIGN_ARTIFACT_STORE)
    private readonly artifacts: DesignArtifactStore,
    @Inject(DESIGN_PROPOSALS_REPOSITORY)
    private readonly proposals: DesignProposalsRepository
  ) {}

  async persist(
    proposal: DesignProposal,
    projectRevision: number,
    instructions: string,
    context: unknown,
    references: readonly DesignReferenceView[]
  ) {
    let artifact;
    try {
      const t = proposal.telemetry;
      if (
        (t?.image.width !== undefined &&
          proposal.artifact.width !== undefined &&
          t.image.width !== proposal.artifact.width) ||
        (t?.image.height !== undefined &&
          proposal.artifact.height !== undefined &&
          t.image.height !== proposal.artifact.height) ||
        (t?.image.format !== undefined &&
          t.image.format !== proposal.artifact.mimeType.slice(6))
      ) {
        throw new DesignGenerationError(
          "invalid_provider_response",
          "The generated image dimensions do not match its metadata."
        );
      }
      artifact = await this.artifacts.put({
        ...proposal.artifact,
        width: t?.image.width ?? proposal.artifact.width,
        height: t?.image.height ?? proposal.artifact.height
      });
      // Only digests of canonical context, reference camera metadata and bytes survive.
      const referenceFingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            context,
            references: references.map((r) => ({
              kind: r.kind,
              target: r.target,
              camera: r.camera,
              width: r.image.width,
              height: r.image.height,
              sha256: createHash("sha256").update(r.image.dataUrl).digest("hex")
            }))
          })
        )
        .digest("hex");
      const record = await this.proposals.create({
        artifact,
        proposal: {
          id: proposal.id,
          target: proposal.target,
          status: "succeeded",
          createdAt: t?.generatedAt ?? proposal.createdAt,
          projectRevision,
          instructions,
          referenceFingerprint,
          artifact: {
            kind: "image",
            uri: "",
            mimeType: artifact.mimeType,
            width: artifact.width,
            height: artifact.height,
            byteSize: artifact.byteSize,
            sha256: artifact.sha256
          },
          telemetry: {
            provider:
              proposal.providerMetadata?.provider ?? t?.provider ?? "unknown",
            durationMs: Math.min(
              2_147_483_647,
              Math.max(
                0,
                Math.round(Number.isFinite(t?.durationMs) ? t!.durationMs : 0)
              )
            ),
            generatedAt: t?.generatedAt ?? proposal.createdAt,
            ...(t?.orchestrationModel
              ? { orchestrationModel: t.orchestrationModel }
              : {}),
            ...(t?.imageModel ? { imageModel: t.imageModel } : {}),
            ...(t?.generationMode ? { generationMode: t.generationMode } : {}),
            image: {
              width: artifact.width,
              height: artifact.height,
              format: artifact.mimeType.slice(6) as "png" | "jpeg" | "webp",
              ...(t?.image.quality ? { quality: t.image.quality } : {})
            },
            ...(t?.usage ? { usage: normalizeUsage(t.usage) } : {})
          }
        }
      });
      return record.proposal;
    } catch (error) {
      if (artifact)
        await this.artifacts.delete(artifact.key).catch(() => {
          this.logger.warn(
            { proposalId: proposal.id },
            "Proposal compensation could not remove an artifact"
          );
        });
      if (error instanceof DesignGenerationError) throw error;
      throw new ApiProblemError({
        type: "/problems/ai-proposal-persistence-failed",
        title: "Design proposal could not be saved",
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: ApiErrorCode.AiProposalPersistenceFailed,
        detail:
          "The design was generated, but CasaStudio could not save the proposal. The paid generation may have completed. No generation was retried.",
        cause: error
      });
    }
  }
}

function normalizeUsage(usage: DesignGenerationUsage): DesignGenerationUsage {
  const safe = (n: number) =>
    Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  return {
    inputTokens: safe(usage.inputTokens),
    outputTokens: safe(usage.outputTokens),
    totalTokens: safe(usage.totalTokens),
    ...(usage.cachedInputTokens !== undefined
      ? { cachedInputTokens: safe(usage.cachedInputTokens) }
      : {}),
    ...(usage.cacheWriteInputTokens !== undefined
      ? { cacheWriteInputTokens: safe(usage.cacheWriteInputTokens) }
      : {}),
    ...(usage.reasoningTokens !== undefined
      ? { reasoningTokens: safe(usage.reasoningTokens) }
      : {})
  };
}
