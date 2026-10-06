import type { DurableDesignProposal, DesignTarget } from "@casastudio/ai";
import type { ArtifactMetadata } from "../artifacts/design-artifact.store";

export const DESIGN_PROPOSALS_REPOSITORY = Symbol(
  "DESIGN_PROPOSALS_REPOSITORY"
);
export type StoredDesignProposal = Readonly<{
  proposal: DurableDesignProposal;
  artifact: ArtifactMetadata;
}>;

export interface DesignProposalsRepository {
  create(record: StoredDesignProposal): Promise<StoredDesignProposal>;
  find(
    projectId: string,
    proposalId: string
  ): Promise<StoredDesignProposal | null>;
  list(
    target: DesignTarget,
    limit: number,
    before?: { createdAt: Date; id: string }
  ): Promise<readonly StoredDesignProposal[]>;
  delete(
    projectId: string,
    proposalId: string
  ): Promise<StoredDesignProposal | null>;
}
