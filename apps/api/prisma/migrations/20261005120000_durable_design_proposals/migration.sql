CREATE TABLE "DesignProposal" (
    "id" TEXT NOT NULL,
    "projectId" UUID NOT NULL,
    "levelDomainId" TEXT NOT NULL,
    "roomDomainId" TEXT NOT NULL,
    "projectRevision" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instructions" TEXT NOT NULL,
    "referenceFingerprint" TEXT NOT NULL,
    "artifactKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "orchestrationModel" TEXT,
    "imageModel" TEXT,
    "generationMode" TEXT,
    "durationMs" INTEGER NOT NULL,
    "outputFormat" TEXT NOT NULL,
    "outputQuality" TEXT,
    "usage" JSONB,
    CONSTRAINT "DesignProposal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DesignProposal_artifactKey_key" ON "DesignProposal"("artifactKey");
CREATE INDEX "DesignProposal_room_history_idx" ON "DesignProposal"("projectId", "levelDomainId", "roomDomainId", "createdAt" DESC, "id" DESC);
ALTER TABLE "DesignProposal" ADD CONSTRAINT "DesignProposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
