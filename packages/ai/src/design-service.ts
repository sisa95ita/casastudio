import type { DesignRequest, DesignRefinementRequest } from "./contracts.js";
import { DesignGenerationError } from "./failures.js";
import type {
  InteriorDesignProvider,
  GeneratedDesignProposal
} from "./provider.js";

export type DesignServiceDependencies = Readonly<{
  createId: () => string;
  now: () => Date;
}>;

/** Coordinates one transient generation without owning canonical Project state. */
export class InteriorDesignService {
  constructor(
    private readonly provider: InteriorDesignProvider,
    private readonly dependencies: DesignServiceDependencies
  ) {}

  async generate(request: DesignRequest): Promise<GeneratedDesignProposal> {
    return this.execute(request);
  }

  async refine(
    request: DesignRefinementRequest
  ): Promise<GeneratedDesignProposal> {
    const base = request.baseProposal;
    if (
      base.target.projectId !== request.target.projectId ||
      base.target.levelId !== request.target.levelId ||
      base.target.roomId !== request.target.roomId ||
      request.context.project.id !== request.target.projectId ||
      request.context.level.id !== request.target.levelId ||
      request.context.room.id !== request.target.roomId
    ) {
      throw new DesignGenerationError(
        "unsupported_target",
        "The base design and architecture must belong to the same Room."
      );
    }
    if (base.projectRevision !== request.context.project.revision) {
      throw new DesignGenerationError(
        "stale_context",
        "This design uses historical architecture. Generate a new root design from the current Room."
      );
    }
    if (
      !base.artifact.uri.startsWith(`data:${base.artifact.mimeType};base64,`) ||
      !base.artifact.uri.split(",")[1]
    ) {
      throw new DesignGenerationError(
        "missing_reference",
        "The saved base design image is required for refinement."
      );
    }
    return this.execute(request, true);
  }

  private async execute(
    request: DesignRequest | DesignRefinementRequest,
    refine = false
  ): Promise<GeneratedDesignProposal> {
    const requiredReferenceKinds = [
      "room-axonometric",
      "room-interior-a",
      "room-interior-b"
    ] as const;
    const referenceKinds = request.referenceViews.map(
      (reference) => reference.kind
    );
    if (
      request.referenceViews.length === 0 ||
      requiredReferenceKinds.some(
        (kind) =>
          referenceKinds.filter((candidate) => candidate === kind).length !== 1
      ) ||
      request.referenceViews.some(
        (reference) =>
          !reference.image.dataUrl ||
          reference.target.projectId !== request.target.projectId ||
          reference.target.levelId !== request.target.levelId ||
          reference.target.roomId !== request.target.roomId
      )
    ) {
      throw new DesignGenerationError(
        "missing_reference",
        "A visual reference is required to generate a design."
      );
    }
    const result = refine
      ? await this.provider.refineDesign(request as DesignRefinementRequest)
      : await this.provider.generateDesign(request);
    const iteration = "iteration" in request ? request.iteration : undefined;
    return Object.freeze({
      id: this.dependencies.createId(),
      target: request.target,
      status: "succeeded",
      artifact: result.artifact,
      createdAt: this.dependencies.now().toISOString(),
      ...(iteration?.sessionId
        ? {
            session: Object.freeze({
              id: iteration.sessionId,
              ...(iteration.previousProposalId
                ? { previousProposalId: iteration.previousProposalId }
                : {})
            })
          }
        : {}),
      providerMetadata: Object.freeze({
        provider: this.provider.name,
        ...(result.continuation ? { continuation: result.continuation } : {})
      }),
      ...(result.telemetry
        ? {
            telemetry: Object.freeze({
              provider: this.provider.name,
              ...result.telemetry
            })
          }
        : {})
    });
  }
}
