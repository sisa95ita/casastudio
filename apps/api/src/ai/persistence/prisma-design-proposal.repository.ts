import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DesignProposal as PrismaProposal, Prisma } from "@prisma/client";
import type {
  DesignGenerationUsage,
  DesignTarget,
  DurableDesignProposal
} from "@casastudio/ai";
import { DesignGenerationError } from "@casastudio/ai";
import { descendantsConflict } from "../application/lineage-problem";
import { PrismaService } from "../../persistence/prisma.service";
import type {
  DesignProposalsRepository,
  StoredDesignProposal
} from "./design-proposal.repository";

@Injectable()
export class PrismaDesignProposalsRepository implements DesignProposalsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    { proposal: p, artifact: a, providerContinuation }: StoredDesignProposal,
    baseProposalId?: string
  ): Promise<StoredDesignProposal> {
    const t = p.telemetry!;
    const data = {
      id: p.id,
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
      ...(providerContinuation
        ? {
            providerContinuation: providerContinuation as Prisma.InputJsonObject
          }
        : {}),
      ...(t.usage ? { usage: t.usage as Prisma.InputJsonObject } : {})
    };
    const row = baseProposalId
      ? await this.prisma.$transaction(async (tx) => {
          // Same Project lock as canonical replacement/deletion. No lock held during provider work.
          const [project] = await tx.$queryRaw<
            { id: string; revision: number }[]
          >`
        SELECT "id", "revision" FROM "Project" WHERE "domainId" = ${p.target.projectId} FOR UPDATE`;
          if (!project)
            throw new NotFoundException("Design proposal not found.");
          const base = await tx.designProposal.findFirst({
            where: {
              id: baseProposalId,
              projectId: project.id,
              levelDomainId: p.target.levelId,
              roomDomainId: p.target.roomId
            }
          });
          if (!base) throw new NotFoundException("Design proposal not found.");
          if (
            project.revision !== p.projectRevision ||
            base.projectRevision !== p.projectRevision
          ) {
            throw new DesignGenerationError(
              "stale_context",
              "Architecture changed before this refinement could be saved. Generate a new root design from the current Room."
            );
          }
          const conversation = base.conversationId
            ? await tx.designConversation.findUniqueOrThrow({
                where: { id: base.conversationId }
              })
            : await tx.designConversation.upsert({
                where: { rootProposalId: base.id },
                update: {},
                create: {
                  id: `conversation-${randomUUID()}`,
                  projectId: project.id,
                  levelDomainId: base.levelDomainId,
                  roomDomainId: base.roomDomainId,
                  rootProposalId: base.id
                }
              });
          if (
            conversation.projectId !== project.id ||
            conversation.levelDomainId !== p.target.levelId ||
            conversation.roomDomainId !== p.target.roomId
          ) {
            throw new DesignGenerationError(
              "unsupported_target",
              "Conversation scope does not match the requested Room."
            );
          }
          const updated = await tx.designConversation.update({
            where: { id: conversation.id },
            data: { lastTurnNumber: { increment: 1 } }
          });
          return tx.designProposal.create({
            data: {
              ...data,
              parentProposalId: base.id,
              turnNumber: updated.lastTurnNumber,
              conversationId: conversation.id,
              projectId: project.id
            }
          });
        })
      : await this.prisma.designProposal.create({
          data: {
            ...data,
            projectId: (
              await this.prisma.project.findUniqueOrThrow({
                where: { domainId: p.target.projectId },
                select: { id: true }
              })
            ).id
          }
        });
    return mapRecord(row, p.target.projectId);
  }

  async conversation(projectId: string, proposalId: string, afterTurn: number) {
    return this.prisma.$transaction(
      async (tx) => {
        const base = await tx.designProposal.findFirst({
          where: { id: proposalId, project: { domainId: projectId } }
        });
        if (!base) return null;
        const conversation = await tx.designConversation.findFirst({
          where: {
            projectId: base.projectId,
            ...(base.conversationId
              ? { id: base.conversationId }
              : { rootProposalId: base.id })
          }
        });
        if (!conversation) return null;
        const root = await tx.designProposal.findUniqueOrThrow({
          where: { id: conversation.rootProposalId }
        });
        const rows = await tx.designProposal.findMany({
          where: {
            conversationId: conversation.id,
            turnNumber: { gt: afterTurn }
          },
          orderBy: { turnNumber: "asc" },
          take: 21
        });
        const iterations = rows
          .slice(0, 20)
          .map((row) => mapRecord(row, projectId).proposal);
        return {
          conversation: {
            id: conversation.id,
            target: mapRecord(root, projectId).proposal.target,
            rootProposalId: root.id,
            createdAt: conversation.createdAt.toISOString(),
            updatedAt: conversation.updatedAt.toISOString()
          },
          rootProposal: mapRecord(root, projectId).proposal,
          iterations,
          ...(rows.length > 20
            ? { nextAfterTurn: iterations.at(-1)!.lineage!.turnNumber }
            : {})
        };
      },
      { isolationLevel: "RepeatableRead" }
    );
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
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "domainId" = ${projectId} FOR UPDATE`;
      const row = await tx.designProposal.findFirst({
        where: { id, project: { domainId: projectId } }
      });
      if (!row) return null;
      if (
        await tx.designProposal.findFirst({
          where: { parentProposalId: id },
          select: { id: true }
        })
      ) {
        throw descendantsConflict();
      }
      await tx.designConversation.deleteMany({
        where: { rootProposalId: id, proposals: { none: {} } }
      });
      const result = await tx.designProposal.deleteMany({
        where: { id, projectId: row.projectId }
      });
      if (result.count && row.conversationId) {
        await tx.designConversation.update({
          where: { id: row.conversationId },
          data: { updatedAt: new Date() }
        });
      }
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
    ...(row.conversationId && row.parentProposalId && row.turnNumber !== null
      ? {
          lineage: {
            conversationId: row.conversationId,
            parentProposalId: row.parentProposalId,
            turnNumber: row.turnNumber
          }
        }
      : {}),
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
  return {
    proposal,
    artifact,
    ...(row.providerContinuation
      ? {
          providerContinuation: row.providerContinuation as Readonly<
            Record<string, string>
          >
        }
      : {})
  };
}
