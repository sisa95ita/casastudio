import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import type { DesignProposalHistory } from "@casastudio/ai";
import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { AuthorizedProjectLoader } from "../../projects/application/authorized-project-loader.service";
import {
  DESIGN_ARTIFACT_STORE,
  type DesignArtifactStore
} from "../artifacts/design-artifact.store";
import {
  DESIGN_PROPOSALS_REPOSITORY,
  type DesignProposalsRepository
} from "../persistence/design-proposal.repository";

@Injectable()
export class DesignProposalHistoryService {
  private readonly logger = new Logger(DesignProposalHistoryService.name);
  constructor(
    @Inject(AuthorizedProjectLoader)
    private readonly loader: AuthorizedProjectLoader,
    @Inject(DESIGN_PROPOSALS_REPOSITORY)
    private readonly proposals: DesignProposalsRepository,
    @Inject(DESIGN_ARTIFACT_STORE)
    private readonly artifacts: DesignArtifactStore
  ) {}

  async list(
    projectId: string,
    levelId: string,
    roomId: string,
    principal: AuthenticatedPrincipal,
    cursor?: string
  ): Promise<DesignProposalHistory> {
    await this.loader.load(projectId, principal);
    let before: { createdAt: Date; id: string } | undefined;
    if (cursor) {
      try {
        const parsed = JSON.parse(
          Buffer.from(cursor, "base64url").toString("utf8")
        );
        if (
          typeof parsed.id !== "string" ||
          parsed.id.length > 200 ||
          typeof parsed.createdAt !== "string"
        )
          throw new Error();
        const createdAt = new Date(parsed.createdAt);
        if (!Number.isFinite(createdAt.getTime())) throw new Error();
        before = { createdAt, id: parsed.id };
      } catch {
        throw new BadRequestException("Invalid history cursor.");
      }
    }
    // Stable historical IDs are deliberately allowed even when geometry was deleted.
    const rows = await this.proposals.list(
      { kind: "room", projectId, levelId, roomId },
      21,
      before
    );
    const proposals = rows.slice(0, 20).map((row) => row.proposal);
    const last = proposals.at(-1);
    return {
      proposals,
      ...(rows.length > 20 && last
        ? {
            nextCursor: Buffer.from(
              JSON.stringify({ createdAt: last.createdAt, id: last.id })
            ).toString("base64url")
          }
        : {})
    };
  }

  async artifact(
    projectId: string,
    proposalId: string,
    principal: AuthenticatedPrincipal
  ) {
    await this.loader.load(projectId, principal);
    const row = await this.proposals.find(projectId, proposalId);
    if (!row) throw new NotFoundException("Design proposal not found.");
    try {
      return {
        bytes: await this.artifacts.read(row.artifact),
        metadata: row.artifact
      };
    } catch {
      throw new ServiceUnavailableException(
        "The saved design image is unavailable."
      );
    }
  }

  async delete(
    projectId: string,
    proposalId: string,
    principal: AuthenticatedPrincipal
  ): Promise<void> {
    await this.loader.load(projectId, principal);
    const row = await this.proposals.delete(projectId, proposalId);
    if (!row) throw new NotFoundException("Design proposal not found.");
    // Metadata deletion revokes access first; external bytes are best-effort cleanup.
    await this.artifacts.delete(row.artifact.key).catch(() => {
      this.logger.warn(
        { projectId, proposalId },
        "Deleted proposal artifact cleanup failed"
      );
    });
  }
}
