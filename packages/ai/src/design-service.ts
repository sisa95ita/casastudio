import type { DesignProposal, DesignRequest } from "./contracts.js";
import { DesignGenerationError } from "./failures.js";
import type { InteriorDesignProvider } from "./provider.js";

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

  async generate(request: DesignRequest): Promise<DesignProposal> {
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
        (kind) => referenceKinds.filter((candidate) => candidate === kind).length !== 1
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
    const result = await this.provider.generateDesign(request);
    return Object.freeze({
      id: this.dependencies.createId(),
      target: request.target,
      status: "succeeded",
      artifact: result.artifact,
      createdAt: this.dependencies.now().toISOString(),
      ...(request.iteration?.sessionId
        ? {
            session: Object.freeze({
              id: request.iteration.sessionId,
              ...(request.iteration.previousProposalId
                ? { previousProposalId: request.iteration.previousProposalId }
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
