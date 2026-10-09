-- AlterTable
ALTER TABLE "DesignProposal" ADD COLUMN     "conversationId" TEXT,
ADD COLUMN     "parentProposalId" TEXT,
ADD COLUMN     "providerContinuation" JSONB,
ADD COLUMN     "turnNumber" INTEGER;

-- CreateTable
CREATE TABLE "DesignConversation" (
    "id" TEXT NOT NULL,
    "projectId" UUID NOT NULL,
    "levelDomainId" TEXT NOT NULL,
    "roomDomainId" TEXT NOT NULL,
    "rootProposalId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "lastTurnNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DesignConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesignConversation_rootProposalId_key" ON "DesignConversation"("rootProposalId");

-- CreateIndex
CREATE INDEX "DesignConversation_projectId_levelDomainId_roomDomainId_cre_idx" ON "DesignConversation"("projectId", "levelDomainId", "roomDomainId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DesignConversation_rootProposalId_projectId_levelDomainId_r_key" ON "DesignConversation"("rootProposalId", "projectId", "levelDomainId", "roomDomainId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignConversation_id_projectId_levelDomainId_roomDomainId_key" ON "DesignConversation"("id", "projectId", "levelDomainId", "roomDomainId");

-- CreateIndex
CREATE INDEX "DesignProposal_parentProposalId_idx" ON "DesignProposal"("parentProposalId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignProposal_id_projectId_levelDomainId_roomDomainId_key" ON "DesignProposal"("id", "projectId", "levelDomainId", "roomDomainId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignProposal_conversationId_turnNumber_key" ON "DesignProposal"("conversationId", "turnNumber");

-- AddForeignKey
ALTER TABLE "DesignProposal" ADD CONSTRAINT "DesignProposal_conversationId_projectId_levelDomainId_room_fkey" FOREIGN KEY ("conversationId", "projectId", "levelDomainId", "roomDomainId") REFERENCES "DesignConversation"("id", "projectId", "levelDomainId", "roomDomainId") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DesignProposal" ADD CONSTRAINT "DesignProposal_parentProposalId_projectId_levelDomainId_ro_fkey" FOREIGN KEY ("parentProposalId", "projectId", "levelDomainId", "roomDomainId") REFERENCES "DesignProposal"("id", "projectId", "levelDomainId", "roomDomainId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DesignConversation" ADD CONSTRAINT "DesignConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignConversation" ADD CONSTRAINT "DesignConversation_rootProposalId_projectId_levelDomainId__fkey" FOREIGN KEY ("rootProposalId", "projectId", "levelDomainId", "roomDomainId") REFERENCES "DesignProposal"("id", "projectId", "levelDomainId", "roomDomainId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Roots remain ordinary AI-B rows. A turn must have complete, non-self lineage.
ALTER TABLE "DesignProposal" ADD CONSTRAINT "DesignProposal_lineage_check" CHECK (
  ("parentProposalId" IS NULL AND "conversationId" IS NULL AND "turnNumber" IS NULL)
  OR ("parentProposalId" IS NOT NULL AND "conversationId" IS NOT NULL AND "turnNumber" IS NOT NULL AND "turnNumber" > 0 AND "parentProposalId" <> "id")
);
ALTER TABLE "DesignConversation" ADD CONSTRAINT "DesignConversation_order_check" CHECK ("lastTurnNumber" >= 0);

-- Same-conversation parentage and increasing order prevent branch mixing/cycles.
CREATE FUNCTION validate_design_proposal_lineage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."parentProposalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "DesignProposal" p JOIN "DesignConversation" c ON c."id" = NEW."conversationId"
    WHERE p."id" = NEW."parentProposalId" AND (
      (p."conversationId" = c."id" AND p."turnNumber" < NEW."turnNumber") OR
      (p."id" = c."rootProposalId" AND p."parentProposalId" IS NULL)
    )
  ) THEN
    RAISE EXCEPTION 'Invalid design proposal lineage' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "DesignProposal_lineage_guard" BEFORE INSERT OR UPDATE OF "parentProposalId", "conversationId", "turnNumber"
ON "DesignProposal" FOR EACH ROW EXECUTE FUNCTION validate_design_proposal_lineage();
