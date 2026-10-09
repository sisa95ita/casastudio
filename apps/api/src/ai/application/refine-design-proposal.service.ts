import { randomUUID } from "node:crypto";
import {
  DesignGenerationError,
  InteriorDesignService,
  deriveDesignContext,
  type InteriorDesignProvider
} from "@casastudio/ai";
import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { AuthorizedProjectLoader } from "../../projects/application/authorized-project-loader.service";
import type { GenerateRoomDesignRequestDto } from "../api/design-proposal.dto";
import {
  DESIGN_ARTIFACT_STORE,
  type DesignArtifactStore
} from "../artifacts/design-artifact.store";
import {
  DESIGN_PROPOSALS_REPOSITORY,
  type DesignProposalsRepository
} from "../persistence/design-proposal.repository";
import { INTERIOR_DESIGN_PROVIDER } from "../interior-design-provider.token";
import { PersistDesignProposalService } from "./persist-design-proposal.service";
import {
  toApiProblem,
  validateReferenceImage
} from "./generate-design-proposal.service";

@Injectable()
export class RefineDesignProposalService {
  constructor(
    @Inject(AuthorizedProjectLoader)
    private readonly loader: AuthorizedProjectLoader,
    @Inject(DESIGN_PROPOSALS_REPOSITORY)
    private readonly proposals: DesignProposalsRepository,
    @Inject(DESIGN_ARTIFACT_STORE)
    private readonly artifacts: DesignArtifactStore,
    @Inject(INTERIOR_DESIGN_PROVIDER)
    private readonly provider: InteriorDesignProvider,
    @Inject(PersistDesignProposalService)
    private readonly persistence: PersistDesignProposalService
  ) {}

  async refine(
    projectId: string,
    baseProposalId: string,
    input: GenerateRoomDesignRequestDto,
    principal: AuthenticatedPrincipal
  ) {
    const { loadedProject } = await this.loader.load(projectId, principal);
    const base = await this.proposals.find(projectId, baseProposalId);
    if (!base) throw new NotFoundException("Design proposal not found.");
    try {
      const target = {
        kind: "room" as const,
        projectId,
        levelId: input.levelId,
        roomId: input.roomId
      };
      if (
        base.proposal.target.levelId !== target.levelId ||
        base.proposal.target.roomId !== target.roomId
      ) {
        throw new DesignGenerationError(
          "unsupported_target",
          "The base proposal belongs to a different Room."
        );
      }
      if (base.proposal.projectRevision !== loadedProject.project.revision) {
        throw new DesignGenerationError(
          "stale_context",
          "This design uses historical architecture. Generate a new root design from the current Room."
        );
      }
      const context = deriveDesignContext(loadedProject.project, target);
      input.referenceViews.forEach((reference) => {
        validateReferenceImage(reference.image);
        if (
          reference.target.projectId !== projectId ||
          reference.target.levelId !== target.levelId ||
          reference.target.roomId !== target.roomId
        ) {
          throw new DesignGenerationError(
            "unsupported_target",
            "A canonical reference belongs to a different Room."
          );
        }
      });
      let bytes: Buffer;
      try {
        bytes = await this.artifacts.read(base.artifact);
      } catch {
        throw new ServiceUnavailableException(
          "The saved base design image is unavailable."
        );
      }
      const service = new InteriorDesignService(this.provider, {
        createId: () => `design-${randomUUID()}`,
        now: () => new Date()
      });
      const proposal = await service.refine({
        target,
        context,
        referenceViews: input.referenceViews,
        instructions: input.instructions,
        preservation: "preserve-unrequested-design",
        baseProposal: {
          id: base.proposal.id,
          target: base.proposal.target,
          projectRevision: base.proposal.projectRevision,
          artifact: {
            ...base.proposal.artifact,
            uri: `data:${base.artifact.mimeType};base64,${bytes.toString("base64")}`
          }
        },
        ...(base.proposal.providerMetadata?.provider === this.provider.name &&
        base.providerContinuation
          ? { providerContinuation: base.providerContinuation }
          : {})
      });
      return await this.persistence.persist(
        proposal,
        context.project.revision,
        input.instructions,
        context,
        input.referenceViews,
        baseProposalId
      );
    } catch (error) {
      if (error instanceof DesignGenerationError) throw toApiProblem(error);
      throw error;
    }
  }

  async conversation(
    projectId: string,
    proposalId: string,
    principal: AuthenticatedPrincipal,
    afterTurn = 0
  ) {
    await this.loader.load(projectId, principal);
    const base = await this.proposals.find(projectId, proposalId);
    if (!base) throw new NotFoundException("Design proposal not found.");
    return this.proposals.conversation(projectId, proposalId, afterTurn);
  }
}
