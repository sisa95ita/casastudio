import { Inject, Injectable } from "@nestjs/common";
import type { DesignProposal as PrismaProposal, Prisma } from "@prisma/client";
import type {
  DesignGenerationUsage,
  DesignTarget,
  DurableDesignProposal
} from "@casastudio/ai";
import { PrismaService } from "../../persistence/prisma.service";
import type {
  DesignProposalsRepository,
  StoredDesignProposal
} from "./design-proposal.repository";

@Injectable()
export class PrismaDesignProposalsRepository implements DesignProposalsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create({
    proposal: p,
    artifact: a
  }: StoredDesignProposal): Promise<StoredDesignProposal> {
    const t = p.telemetry!;
    const row = await this.prisma.designProposal.create({
      data: {
        id: p.id,
        project: { connect: { domainId: p.target.projectId } },
        levelDomainId: p.target.levelId,
        roomDomainId: p.target.roomId,
        projectRevision: p.projectRevision,
        createdAt: new Date(p.createdAt),
        instructions: p.instructions,
        referenceFingerprint: p.referenceFingerprint,
        artifactKey: a.key,
        mimeType: a.mimeType,
        width: a.width,
        height: a.height,
        byteSize: a.byteSize,
        sha256: a.sha256,
        provider: t.provider,
        orchestrationModel: t.orchestrationModel,
        imageModel: t.imageModel,
        generationMode: t.generationMode,
        durationMs: t.durationMs,
        outputFormat: t.image.format,
        outputQuality: t.image.quality,
        ...(t.usage ? { usage: t.usage as Prisma.InputJsonObject } : {})
      }
    });
    return mapRecord(row, p.target.projectId);
  }

  async find(projectId: string, id: string) {
    const row = await this.prisma.designProposal.findFirst({
      where: { id, project: { domainId: projectId } }
    });
    return row ? mapRecord(row, projectId) : null;
  }

  async list(
    target: DesignTarget,
    limit: number,
    before?: { createdAt: Date; id: string }
  ) {
    const rows = await this.prisma.designProposal.findMany({
      where: {
        project: { domainId: target.projectId },
        levelDomainId: target.levelId,
        roomDomainId: target.roomId,
        ...(before
          ? {
              OR: [
                { createdAt: { lt: before.createdAt } },
                { createdAt: before.createdAt, id: { lt: before.id } }
              ]
            }
          : {})
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit
    });
    return rows.map((row) => mapRecord(row, target.projectId));
  }

  async delete(projectId: string, id: string) {
    // RETURNING through deleteMany is unavailable; the transaction preserves identity.
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.designProposal.findFirst({
        where: { id, project: { domainId: projectId } }
      });
      if (!row) return null;
      const result = await tx.designProposal.deleteMany({
        where: { id, projectId: row.projectId }
      });
      return result.count ? mapRecord(row, projectId) : null;
    });
  }
}

function mapRecord(
  row: PrismaProposal,
  projectId: string
): StoredDesignProposal {
  const artifact = {
    key: row.artifactKey,
    mimeType: row.mimeType as "image/png" | "image/jpeg" | "image/webp",
    width: row.width,
    height: row.height,
    byteSize: row.byteSize,
    sha256: row.sha256
  };
  const createdAt = row.createdAt.toISOString();
  const proposal: DurableDesignProposal = {
    id: row.id,
    status: "succeeded",
    target: {
      kind: "room",
      projectId,
      levelId: row.levelDomainId,
      roomId: row.roomDomainId
    },
    createdAt,
    instructions: row.instructions,
    projectRevision: row.projectRevision,
    referenceFingerprint: row.referenceFingerprint,
    artifact: {
      kind: "image",
      uri: `/api/v1/projects/${encodeURIComponent(projectId)}/design-proposals/${encodeURIComponent(row.id)}/artifact`,
      mimeType: artifact.mimeType,
      width: artifact.width,
      height: artifact.height,
      byteSize: artifact.byteSize,
      sha256: artifact.sha256
    },
    providerMetadata: { provider: row.provider },
    telemetry: {
      provider: row.provider,
      durationMs: row.durationMs,
      generatedAt: createdAt,
      ...(row.orchestrationModel
        ? { orchestrationModel: row.orchestrationModel }
        : {}),
      ...(row.imageModel ? { imageModel: row.imageModel } : {}),
      ...(row.generationMode
        ? { generationMode: row.generationMode as "edit" | "generate" }
        : {}),
      image: {
        width: row.width,
        height: row.height,
        format: row.outputFormat as "png" | "jpeg" | "webp",
        ...(row.outputQuality ? { quality: row.outputQuality } : {})
      },
      ...(row.usage
        ? { usage: row.usage as unknown as DesignGenerationUsage }
        : {})
    }
  };
  return { proposal, artifact };
}
