import type {
  DurableDesignProposal,
  DesignTarget,
  DesignConversationPage
} from "@casastudio/ai";
import type { ArtifactMetadata } from "../artifacts/design-artifact.store";

export const DESIGN_PROPOSALS_REPOSITORY = Symbol(
  "DESIGN_PROPOSALS_REPOSITORY"
);
export type StoredDesignProposal = Readonly<{
  proposal: DurableDesignProposal;
  artifact: ArtifactMetadata;
  /** Server-only, provider-namespaced continuation data. Never a public DTO. */
  providerContinuation?: Readonly<Record<string, string>>;
}>;

export interface DesignProposalsRepository {
  create(
    record: StoredDesignProposal,
    baseProposalId?: string
  ): Promise<StoredDesignProposal>;
  conversation(
    projectId: string,
    proposalId: string,
    afterTurn: number
  ): Promise<DesignConversationPage | null>;
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
