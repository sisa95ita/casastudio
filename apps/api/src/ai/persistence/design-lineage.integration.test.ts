import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { DesignGenerationError } from "@casastudio/ai";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import type { PrismaService } from "../../persistence/prisma.service";
import { PrismaProjectRepository } from "../../projects/persistence/prisma-project.repository";
import { AuthorizedProjectLoader } from "../../projects/application/authorized-project-loader.service";
import { ProjectReadAuthorizationPolicy } from "../../projects/application/project-read-authorization.policy";
import { KeycloakRole } from "../../auth/keycloak-role";
import { FilesystemDesignArtifactStore } from "../artifacts/filesystem-design-artifact.store";
import {
  fixtureArtifact,
  fixtureProject,
  fixtureProvider,
  input
} from "../test/design-fixture";
import { GenerateDesignProposalService } from "../application/generate-design-proposal.service";
import { PersistDesignProposalService } from "../application/persist-design-proposal.service";
import { DesignProposalHistoryService } from "../application/design-proposal-history.service";
import { RefineDesignProposalService } from "../application/refine-design-proposal.service";
import { PrismaDesignProposalsRepository } from "./prisma-design-proposal.repository";

(process.env.DATABASE_URL ? describe : describe.skip)(
  "AI-C1 durable branching, failures and deletion (zero-cost PostgreSQL)",
  () => {
    let prisma: PrismaClient;
    let directory: string;
    let store: FilesystemDesignArtifactStore;
    let projects: PrismaProjectRepository;
    let proposals: PrismaDesignProposalsRepository;
    let loader: AuthorizedProjectLoader;
    let persistence: PersistDesignProposalService;
    let generation: GenerateDesignProposalService;
    let refinement: RefineDesignProposalService;
    let history: DesignProposalHistoryService;
    let rootId: string;
    const provider = fixtureProvider();
    const owner = {
      subject: "c1-integration-owner",
      roles: [KeycloakRole.User]
    };
    const project = { ...fixtureProject(), id: "c1-lineage-integration" };
    const payload = {
      ...input,
      referenceViews: input.referenceViews.map((r) => ({
        ...r,
        target: { ...r.target, projectId: project.id }
      }))
    };
    const refine = (id = rootId, instructions = "Change only the sofa") =>
      refinement.refine(project.id, id, { ...payload, instructions }, owner);

    beforeAll(async () => {
      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
      });
      directory = await mkdtemp(join(tmpdir(), "casastudio-c1-lineage-"));
      store = new FilesystemDesignArtifactStore(directory, 20_000_000);
      projects = new PrismaProjectRepository(prisma as PrismaService, store);
      loader = new AuthorizedProjectLoader(
        projects,
        new ProjectReadAuthorizationPolicy()
      );
      proposals = new PrismaDesignProposalsRepository(prisma as PrismaService);
      persistence = new PersistDesignProposalService(store, proposals);
      generation = new GenerateDesignProposalService(
        loader,
        provider,
        persistence
      );
      refinement = new RefineDesignProposalService(
        loader,
        proposals,
        store,
        provider,
        persistence
      );
      history = new DesignProposalHistoryService(loader, proposals, store);
    });
    beforeEach(async () => {
      await projects.deleteProject({ projectId: project.id });
      await projects.createProject(project, owner.subject);
      vi.mocked(provider.refineDesign).mockClear();
      vi.mocked(provider.generateDesign).mockClear();
      rootId = (await generation.generate(project.id, payload, owner)).id;
    });
    afterAll(async () => {
      if (projects) await projects.deleteProject({ projectId: project.id });
      if (prisma) await prisma.$disconnect();
      if (directory) await rm(directory, { recursive: true, force: true });
    });

    it("lazily adopts an AI-B root, persists delta/parents, creates grandchildren and branches, and reloads with no Project mutation", async () => {
      const before = await projects.findLoadedByDomainId(project.id);
      expect(
        await refinement.conversation(project.id, rootId, owner)
      ).toBeNull();
      expect(
        await prisma.designConversation.count({
          where: { project: { domainId: project.id } }
        })
      ).toBe(0);
      const child = await refine();
      const grandchild = await refine(child.id, "Make the lighting warmer");
      const branch = await refine(rootId, "Try darker wood");
      expect(child.lineage).toMatchObject({
        parentProposalId: rootId,
        turnNumber: 1
      });
      expect(grandchild.lineage).toMatchObject({
        parentProposalId: child.id,
        turnNumber: 2,
        conversationId: child.lineage!.conversationId
      });
      expect(branch.lineage).toMatchObject({
        parentProposalId: rootId,
        turnNumber: 3,
        conversationId: child.lineage!.conversationId
      });
      // New application/repository instances simulate restart; all history comes from DB.
      const reloaded = new RefineDesignProposalService(
        loader,
        new PrismaDesignProposalsRepository(prisma as PrismaService),
        store,
        provider,
        persistence
      );
      const page = await reloaded.conversation(
        project.id,
        grandchild.id,
        owner
      );
      expect(page!.rootProposal.id).toBe(rootId);
      expect(page!.iterations.map((p) => [p.id, p.instructions])).toEqual([
        [child.id, "Change only the sofa"],
        [grandchild.id, "Make the lighting warmer"],
        [branch.id, "Try darker wood"]
      ]);
      expect(
        page!.iterations.every(
          (p) => JSON.stringify(p.target) === JSON.stringify(child.target)
        )
      ).toBe(true);
      const sent = vi.mocked(provider.refineDesign).mock.calls;
      expect(sent.map(([r]) => r.baseProposal.id)).toEqual([
        rootId,
        child.id,
        rootId
      ]);
      expect(sent[0]![0].baseProposal.artifact.uri).toBe(fixtureArtifact.uri);
      expect(sent[0]![0].preservation).toBe("preserve-unrequested-design");
      expect(sent[0]![0].context.project.revision).toBe(project.revision);
      expect(sent[0]![0].referenceViews.map((r) => r.kind)).toEqual(
        payload.referenceViews.map((r) => r.kind)
      );
      expect(provider.refineDesign).toHaveBeenCalledTimes(3);
      expect(provider.generateDesign).toHaveBeenCalledTimes(1);
      expect(await projects.findLoadedByDomainId(project.id)).toEqual(before);
    });

    it("blocks a stale root before provider work but preserves historical lineage/image access", async () => {
      await refine();
      await prisma.project.update({
        where: { domainId: project.id },
        data: { revision: { increment: 1 } }
      });
      vi.mocked(provider.refineDesign).mockClear();
      await expect(refine()).rejects.toMatchObject({
        code: "AI_STALE_CONTEXT",
        status: 409
      });
      expect(provider.refineDesign).not.toHaveBeenCalled();
      expect(
        (await refinement.conversation(project.id, rootId, owner))!.iterations
      ).toHaveLength(1);
      expect(
        (await history.artifact(project.id, rootId, owner)).bytes.toString(
          "base64"
        )
      ).toBe(fixtureArtifact.uri.split(",")[1]);
    });

    it("rejects cross-Room, cross-Level and mismatched references before any provider call", async () => {
      for (const change of [
        { roomId: "other" },
        { levelId: "other" },
        {
          referenceViews: payload.referenceViews.map((r) => ({
            ...r,
            target: { ...r.target, projectId: "other-project" }
          }))
        }
      ]) {
        await expect(
          refinement.refine(
            project.id,
            rootId,
            { ...payload, ...change },
            owner
          )
        ).rejects.toMatchObject({ code: "AI_UNSUPPORTED_TARGET" });
      }
      await expect(
        refinement.refine(
          project.id,
          rootId,
          { ...payload, referenceViews: payload.referenceViews.slice(1) },
          owner
        )
      ).rejects.toMatchObject({ code: "AI_MISSING_REFERENCE" });
      expect(provider.refineDesign).not.toHaveBeenCalled();
    });

    it("uses Project authorization for refinement, parent/result images and conversation queries", async () => {
      const child = await refine();
      const other = { subject: "other", roles: [KeycloakRole.User] };
      for (const id of [rootId, child.id, "missing-id"]) {
        await expect(
          refinement.refine(project.id, id, payload, other)
        ).rejects.toMatchObject({ status: 403 });
        await expect(
          refinement.conversation(project.id, id, other)
        ).rejects.toMatchObject({ status: 403 });
        await expect(
          history.artifact(project.id, id, other)
        ).rejects.toMatchObject({ status: 403 });
      }
      const second = {
        ...project,
        id: `${project.id}-other`,
        name: "Second home"
      };
      await projects.createProject(second, owner.subject);
      try {
        await expect(
          refinement.refine(second.id, rootId, payload, owner)
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          refinement.conversation(second.id, child.id, owner)
        ).rejects.toMatchObject({ status: 404 });
      } finally {
        await projects.deleteProject({ projectId: second.id });
      }
      expect(provider.refineDesign).toHaveBeenCalledTimes(1);
      expect(
        (await refinement.conversation(project.id, child.id, {
          subject: "admin",
          roles: [KeycloakRole.Admin]
        }))!.rootProposal.id
      ).toBe(rootId);
    });

    it.each([
      "provider",
      "artifact",
      "database",
      "invalid-output",
      "missing-base"
    ])(
      "%s failure leaves no child/empty conversation or duplicate generation",
      async (failure) => {
        let spy: { mockRestore(): void } | undefined;
        if (failure === "provider")
          vi.mocked(provider.refineDesign).mockRejectedValueOnce(
            new DesignGenerationError(
              "generation_failed",
              "Fixture provider failure"
            )
          );
        if (failure === "invalid-output")
          vi.mocked(provider.refineDesign).mockResolvedValueOnce({
            artifact: {
              ...fixtureArtifact,
              uri: "data:image/png;base64,aW52YWxpZA=="
            }
          });
        if (failure === "artifact")
          spy = vi
            .spyOn(store, "put")
            .mockRejectedValueOnce(new Error("Fixture disk failure"));
        if (failure === "missing-base")
          spy = vi
            .spyOn(store, "read")
            .mockRejectedValueOnce(new Error("Fixture missing bytes"));
        if (failure === "database") {
          const transaction = prisma.$transaction.bind(prisma);
          // Real DB rollback AFTER both conversation and child writes, not a mocked repository.
          const original = prisma.$transaction;
          prisma.$transaction = ((work: (tx: unknown) => Promise<unknown>) =>
            transaction(async (tx) => {
              await work(tx);
              throw new Error("Fixture failure after lineage writes");
            })) as typeof prisma.$transaction;
          spy = {
            mockRestore: () => {
              prisma.$transaction = original;
            }
          };
        }
        try {
          await expect(refine()).rejects.toBeDefined();
        } finally {
          spy?.mockRestore();
        }
        expect(provider.refineDesign).toHaveBeenCalledTimes(
          failure === "missing-base" ? 0 : 1
        );
        expect(provider.generateDesign).toHaveBeenCalledTimes(1);
        expect(
          await prisma.designProposal.count({
            where: { project: { domainId: project.id } }
          })
        ).toBe(1);
        expect(
          await prisma.designConversation.count({
            where: { project: { domainId: project.id } }
          })
        ).toBe(0);
        expect(await readdir(directory)).toHaveLength(1);
      }
    );

    it("rechecks revision at commit after a concurrent architecture change without another provider call", async () => {
      vi.mocked(provider.refineDesign).mockImplementationOnce(async () => {
        await prisma.project.update({
          where: { domainId: project.id },
          data: { revision: { increment: 1 } }
        });
        return { artifact: fixtureArtifact };
      });
      await expect(refine()).rejects.toMatchObject({
        code: "AI_STALE_CONTEXT"
      });
      expect(provider.refineDesign).toHaveBeenCalledTimes(1);
      expect(
        await prisma.designConversation.count({
          where: { project: { domainId: project.id } }
        })
      ).toBe(0);
      expect(await readdir(directory)).toHaveLength(1);
    });

    it("compensates if the base is deleted while generation is pending", async () => {
      vi.mocked(provider.refineDesign).mockImplementationOnce(async () => {
        await history.delete(project.id, rootId, owner);
        return { artifact: fixtureArtifact };
      });
      await expect(refine()).rejects.toBeDefined();
      expect(provider.refineDesign).toHaveBeenCalledTimes(1);
      expect(await readdir(directory)).toHaveLength(0);
      expect(
        await prisma.designConversation.count({
          where: { project: { domainId: project.id } }
        })
      ).toBe(0);
    });

    it("isolates optional provider continuation, retains lineage without it, and does not pass metadata to a different provider", async () => {
      await prisma.designProposal.update({
        where: { id: rootId },
        data: { providerContinuation: { responseId: "expired-provider-id" } }
      });
      const child = await refine();
      expect(
        vi.mocked(provider.refineDesign).mock.calls[0]![0].providerContinuation
      ).toEqual({ responseId: "expired-provider-id" });
      expect(
        JSON.stringify(
          await refinement.conversation(project.id, child.id, owner)
        )
      ).not.toContain("expired-provider-id");
      await prisma.designProposal.update({
        where: { id: rootId },
        data: { provider: "different-provider" }
      });
      await refine(rootId);
      expect(
        vi.mocked(provider.refineDesign).mock.calls[1]![0].providerContinuation
      ).toBeUndefined();
      await refine(child.id);
      expect(
        vi.mocked(provider.refineDesign).mock.calls[2]![0].providerContinuation
      ).toBeUndefined();
      expect(
        (await refinement.conversation(project.id, child.id, owner))!.iterations
      ).toHaveLength(3);
    });

    it("persists returned continuation only server-side and can continue after the next provider omits state", async () => {
      vi.mocked(provider.refineDesign).mockResolvedValueOnce({
        artifact: fixtureArtifact,
        continuation: { responseId: "server-only-result" }
      });
      const child = await refine();
      expect(
        (await proposals.find(project.id, child.id))!.providerContinuation
      ).toEqual({ responseId: "server-only-result" });
      expect(JSON.stringify(child)).not.toContain("server-only-result");
      const grandchild = await refine(child.id);
      expect(
        vi.mocked(provider.refineDesign).mock.calls[1]![0].providerContinuation
      ).toEqual({ responseId: "server-only-result" });
      await refine(grandchild.id);
      expect(
        vi.mocked(provider.refineDesign).mock.calls[2]![0].providerContinuation
      ).toBeUndefined();
      expect(
        JSON.stringify(await refinement.conversation(project.id, rootId, owner))
      ).not.toContain("server-only-result");
    });

    it("blocks parent deletion, deletes leaves safely, keeps turn ordering and cleans an empty root conversation", async () => {
      const before = await projects.findLoadedByDomainId(project.id);
      const child = await refine();
      const grandchild = await refine(child.id);
      for (const id of [rootId, child.id])
        await expect(
          history.delete(project.id, id, owner)
        ).rejects.toMatchObject({
          code: "AI_PROPOSAL_HAS_DESCENDANTS",
          status: 409
        });
      expect(await readdir(directory)).toHaveLength(3);
      await history.delete(project.id, grandchild.id, owner);
      await history.delete(project.id, child.id, owner);
      const branch = await refine();
      expect(branch.lineage!.turnNumber).toBe(3);
      await history.delete(project.id, branch.id, owner);
      expect(
        (await refinement.conversation(project.id, rootId, owner))!.iterations
      ).toEqual([]);
      await history.delete(project.id, rootId, owner);
      expect(await readdir(directory)).toHaveLength(0);
      expect(
        await prisma.designConversation.count({
          where: { project: { domainId: project.id } }
        })
      ).toBe(0);
      expect(await projects.findLoadedByDomainId(project.id)).toEqual(before);
      expect(provider.refineDesign).toHaveBeenCalledTimes(3);
    });

    it("does not remove artifact bytes when metadata deletion fails", async () => {
      const spy = vi
        .spyOn(proposals, "delete")
        .mockRejectedValueOnce(new Error("Fixture deletion failure"));
      try {
        await expect(history.delete(project.id, rootId, owner)).rejects.toThrow(
          "Fixture deletion failure"
        );
      } finally {
        spy.mockRestore();
      }
      expect(
        (await history.artifact(project.id, rootId, owner)).bytes.length
      ).toBeGreaterThan(0);
      expect(provider.refineDesign).not.toHaveBeenCalled();
    });

    it("serializes simultaneous first branches into one conversation with distinct ordered turns", async () => {
      const children = await Promise.all([
        refine(rootId, "Change chairs"),
        refine(rootId, "Change sofa")
      ]);
      expect(new Set(children.map((p) => p.lineage!.conversationId)).size).toBe(
        1
      );
      expect(children.map((p) => p.lineage!.turnNumber).sort()).toEqual([1, 2]);
      expect(provider.refineDesign).toHaveBeenCalledTimes(2);
      expect(
        (await refinement.conversation(project.id, rootId, owner))!.iterations
      ).toHaveLength(2);
    });

    it("bounds chronological lineage queries and allows deleted geometry history", async () => {
      for (let i = 0; i < 22; i++) await refine(rootId, `Fixture turn ${i}`);
      const first = (await refinement.conversation(project.id, rootId, owner))!;
      expect(first.iterations).toHaveLength(20);
      expect(first.nextAfterTurn).toBe(20);
      const second = (await refinement.conversation(
        project.id,
        rootId,
        owner,
        first.nextAfterTurn
      ))!;
      expect(second.iterations.map((p) => p.lineage!.turnNumber)).toEqual([
        21, 22
      ]);
      expect(second.nextAfterTurn).toBeUndefined();
      const withoutRoom = {
        ...project,
        building: {
          ...project.building,
          levels: project.building.levels.map((l) => ({ ...l, rooms: [] }))
        }
      };
      await projects.replaceProject({
        projectId: project.id,
        baseRevision: project.revision,
        project: withoutRoom,
        actorSubject: owner.subject
      });
      expect(
        (await refinement.conversation(project.id, rootId, owner))!.iterations
      ).toHaveLength(20);
      await expect(refine()).rejects.toMatchObject({
        code: "AI_STALE_CONTEXT"
      });
    });

    it("cascades Project removal through branches and cleans every artifact", async () => {
      const child = await refine();
      await refine(child.id);
      await refine(rootId);
      await projects.deleteProject({ projectId: project.id });
      expect(
        await prisma.designProposal.findUnique({ where: { id: child.id } })
      ).toBeNull();
      expect(
        await prisma.designConversation.findUnique({
          where: { id: child.lineage!.conversationId }
        })
      ).toBeNull();
      expect(await readdir(directory)).toEqual([]);
    });

    it("database constraints reject cross-conversation parents, self-parenting and incomplete turn identity", async () => {
      const child = await refine();
      const anotherRoot = (
        await generation.generate(project.id, payload, owner)
      ).id;
      await refine(anotherRoot);
      await expect(
        prisma.designProposal.update({
          where: { id: child.id },
          data: { parentProposalId: anotherRoot }
        })
      ).rejects.toBeDefined();
      await expect(
        prisma.designProposal.update({
          where: { id: child.id },
          data: { parentProposalId: child.id }
        })
      ).rejects.toBeDefined();
      await expect(
        prisma.designProposal.update({
          where: { id: child.id },
          data: { turnNumber: null }
        })
      ).rejects.toBeDefined();
      expect(
        (await proposals.find(project.id, child.id))!.proposal.lineage!
          .parentProposalId
      ).toBe(rootId);
    });
  }
);
