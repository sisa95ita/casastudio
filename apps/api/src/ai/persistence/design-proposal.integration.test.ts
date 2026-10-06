import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
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
import { PrismaDesignProposalsRepository } from "./prisma-design-proposal.repository";

const describeWithDatabase = process.env.DATABASE_URL
  ? describe
  : describe.skip;
describeWithDatabase(
  "durable proposals with PostgreSQL and temporary artifact storage",
  () => {
    let prisma: PrismaClient;
    let root: string;
    let projects: PrismaProjectRepository;
    let history: DesignProposalHistoryService;
    let generation: GenerateDesignProposalService;
    let provider: ReturnType<typeof fixtureProvider>;
    let proposals: PrismaDesignProposalsRepository;
    const principal = {
      subject: "b4-integration-owner",
      roles: [KeycloakRole.User]
    };
    const project = { ...fixtureProject(), id: "b4-persistence-integration" };
    const request = {
      ...input,
      referenceViews: input.referenceViews.map((r) => ({
        ...r,
        target: { ...r.target, projectId: project.id }
      }))
    };

    beforeAll(async () => {
      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
      });
      root = await mkdtemp(join(tmpdir(), "casastudio-b4-prisma-test-"));
      const store = new FilesystemDesignArtifactStore(root, 20_000_000);
      projects = new PrismaProjectRepository(prisma as PrismaService, store);
      const loader = new AuthorizedProjectLoader(
        projects,
        new ProjectReadAuthorizationPolicy()
      );
      proposals = new PrismaDesignProposalsRepository(prisma as PrismaService);
      provider = fixtureProvider();
      generation = new GenerateDesignProposalService(
        loader,
        provider,
        new PersistDesignProposalService(store, proposals)
      );
      history = new DesignProposalHistoryService(loader, proposals, store);
    });
    beforeEach(async () => {
      await projects.deleteProject({ projectId: project.id });
      await projects.createProject(project, principal.subject);
      vi.mocked(provider.generateDesign).mockClear();
    });
    afterAll(async () => {
      if (projects) await projects.deleteProject({ projectId: project.id });
      if (prisma) await prisma.$disconnect();
      if (root) await rm(root, { recursive: true, force: true });
    });

    it("persists a safe response before success, round-trips bytes and provenance, orders/pages newest first, and preserves all Project fields", async () => {
      const before = await prisma.project.findUniqueOrThrow({
        where: { domainId: project.id }
      });
      const first = await generation.generate(project.id, request, principal);
      const second = await generation.generate(project.id, request, principal);
      const list = await history.list(
        project.id,
        "ground",
        "living",
        principal
      );
      expect(list.proposals).toHaveLength(2);
      expect(list.proposals[0]!.id).toBe(
        [first.id, second.id].sort().reverse()[0]
      );
      expect(
        await prisma.designProposal.count({
          where: { project: { domainId: project.id } }
        })
      ).toBe(2);
      expect(await readdir(root)).toHaveLength(2);
      expect(list.proposals).toContainEqual(first);
      expect(list.proposals[0]!.telemetry!.usage).not.toHaveProperty("raw");
      expect(JSON.stringify(list)).not.toContain("base64");
      expect(JSON.stringify(list)).not.toContain("artifactKey");
      expect(
        await prisma.project.findUniqueOrThrow({
          where: { domainId: project.id }
        })
      ).toEqual(before);
      const image = await history.artifact(project.id, first.id, principal);
      expect(image.bytes.toString("base64")).toBe(
        fixtureArtifact.uri.split(",")[1]
      );
      expect(
        await proposals.list({ ...first.target, levelId: "other" }, 20)
      ).toEqual([]);
      expect(
        await proposals.list(
          { ...first.target, projectId: "other-project" },
          20
        )
      ).toEqual([]);
      expect(await proposals.find("other-project", first.id)).toBeNull();
      await history.delete(project.id, first.id, principal);
      expect(await proposals.find(project.id, first.id)).toBeNull();
      expect(await readdir(root)).toHaveLength(1);
      expect(
        await prisma.project.findUniqueOrThrow({
          where: { domainId: project.id }
        })
      ).toEqual(before);
      expect(provider.generateDesign).toHaveBeenCalledTimes(2);
    });

    it("survives complete geometric replacement and Room deletion, then Project deletion cascades metadata and cleans files", async () => {
      const saved = await generation.generate(project.id, request, principal);
      const edited = {
        ...project,
        building: {
          ...project.building,
          levels: project.building.levels.map((l) => ({ ...l, rooms: [] }))
        }
      };
      await projects.replaceProject({
        projectId: project.id,
        baseRevision: project.revision,
        project: edited,
        actorSubject: principal.subject,
        requiredOwnerSubject: principal.subject
      });
      const list = await history.list(
        project.id,
        "ground",
        "living",
        principal
      );
      expect(list.proposals[0]).toEqual(saved);
      expect((await projects.findByDomainId(project.id))!.revision).toBe(
        saved.projectRevision! + 1
      );
      expect(
        await prisma.room.count({
          where: { project: { domainId: project.id } }
        })
      ).toBe(0);
      const forbidden = await projects.deleteProject({
        projectId: project.id,
        requiredOwnerSubject: "other"
      });
      expect(forbidden.status).toBe("forbidden");
      expect(await readdir(root)).toHaveLength(1);
      expect(
        await projects.deleteProject({
          projectId: project.id,
          requiredOwnerSubject: principal.subject
        })
      ).toEqual({ status: "deleted" });
      expect(
        await prisma.designProposal.count({ where: { id: saved.id } })
      ).toBe(0);
      expect(await readdir(root)).toEqual([]);
      await expect(
        history.artifact(project.id, saved.id, principal)
      ).rejects.toMatchObject({ status: 404 });
      expect(provider.generateDesign).toHaveBeenCalledTimes(1);
    });

    it("compensates a completed generation if its owning Project is deleted while the provider is pending", async () => {
      let resolve!: (value: { artifact: typeof fixtureArtifact }) => void;
      const pending = new Promise<{ artifact: typeof fixtureArtifact }>(
        (done) => {
          resolve = done;
        }
      );
      vi.mocked(provider.generateDesign).mockReturnValueOnce(pending);
      const work = generation.generate(project.id, request, principal);
      const failure = expect(work).rejects.toMatchObject({
        code: "AI_PROPOSAL_PERSISTENCE_FAILED"
      });
      await vi.waitFor(() =>
        expect(provider.generateDesign).toHaveBeenCalledTimes(1)
      );
      await projects.deleteProject({ projectId: project.id });
      resolve({ artifact: fixtureArtifact });
      await failure;
      expect(await readdir(root)).toEqual([]);
      expect(await prisma.designProposal.count()).toBe(0);
      expect(provider.generateDesign).toHaveBeenCalledTimes(1);
    });

    it("seeds the owner zero-cost acceptance fixtures through the development utility without provider calls or Project changes", async () => {
      const before = await prisma.project.findUniqueOrThrow({
        where: { domainId: project.id }
      });
      const result = await promisify(execFile)(
        "pnpm",
        ["db:seed:design-history", project.id, "ground", "living"],
        {
          env: {
            ...process.env,
            NODE_ENV: "test",
            AI_ARTIFACT_DIRECTORY: root,
            AI_ARTIFACT_MAX_BYTES: "20000000"
          }
        }
      );
      expect(result.stdout).toContain(
        "Zero provider calls. Project revision unchanged."
      );
      const list = await history.list(
        project.id,
        "ground",
        "living",
        principal
      );
      expect(list.proposals).toHaveLength(2);
      expect(list.proposals.map((p) => p.projectRevision)).toEqual([
        project.revision,
        project.revision - 1
      ]);
      expect(
        list.proposals.every((p) => p.telemetry!.provider === "local-fixture")
      ).toBe(true);
      const artifact = await history.artifact(
        project.id,
        list.proposals[0]!.id,
        principal
      );
      expect(artifact.metadata.width).toBe(640);
      expect(artifact.metadata.height).toBe(480);
      expect(artifact.bytes.length).toBeGreaterThan(0);
      expect(
        await prisma.project.findUniqueOrThrow({
          where: { domainId: project.id }
        })
      ).toEqual(before);
      expect(provider.generateDesign).not.toHaveBeenCalled();
    }, 30_000);
  }
);
