import { toApiProblem } from "../api/ai-problem.mapper";
export { toApiProblem } from "../api/ai-problem.mapper";
import { randomUUID } from "node:crypto";

import {
  DesignGenerationError,
  InteriorDesignService,
  deriveDesignContext,
  type DesignProposal,
  type InteriorDesignProvider
} from "@casastudio/ai";
import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { AuthorizedProjectLoader } from "../../projects/application/authorized-project-loader.service";
import type { GenerateRoomDesignRequestDto } from "../api/design-proposal.dto";
import { INTERIOR_DESIGN_PROVIDER } from "../interior-design-provider.token";
import { PersistDesignProposalService } from "./persist-design-proposal.service";

@Injectable()
export class GenerateDesignProposalService {
  private readonly logger = new Logger(GenerateDesignProposalService.name);

  constructor(
    @Inject(AuthorizedProjectLoader)
    private readonly projectLoader: AuthorizedProjectLoader,
    @Inject(INTERIOR_DESIGN_PROVIDER)
    private readonly provider: InteriorDesignProvider,
    @Inject(PersistDesignProposalService)
    private readonly persistence: PersistDesignProposalService
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
      const proposal = await service.generate({
        target,
        instructions: input.instructions,
        context,
        referenceViews: input.referenceViews
      });
      return await this.persistence.persist(
        proposal,
        loadedProject.project.revision,
        input.instructions,
        context,
        input.referenceViews
      );
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

export function validateReferenceImage(
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
