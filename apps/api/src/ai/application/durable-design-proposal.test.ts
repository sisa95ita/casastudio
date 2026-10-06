import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizedProjectLoader } from "../../projects/application/authorized-project-loader.service";
import { ProjectReadAuthorizationPolicy } from "../../projects/application/project-read-authorization.policy";
import { KeycloakRole } from "../../auth/keycloak-role";
import { FilesystemDesignArtifactStore } from "../artifacts/filesystem-design-artifact.store";
import {
  fixtureProject,
  fixtureProvider,
  input,
  memoryProposals
} from "../test/design-fixture";
import { GenerateDesignProposalService } from "./generate-design-proposal.service";
import { PersistDesignProposalService } from "./persist-design-proposal.service";
import { DesignProposalHistoryService } from "./design-proposal-history.service";

describe("durable design generation and history (fake provider only)", () => {
  let root: string;
  const principal = { subject: "owner", roles: [KeycloakRole.User] };
  function setup() {
    const project = fixtureProject();
    const projects = {
      findLoadedByDomainId: vi.fn(async (id: string) =>
        id === project.id
          ? { project, metadata: { ownerSubject: "owner" } }
          : null
      )
    };
    const loader = new AuthorizedProjectLoader(
      projects as never,
      new ProjectReadAuthorizationPolicy()
    );
    const provider = fixtureProvider();
    const store = new FilesystemDesignArtifactStore(root, 1024);
    const { repository, records } = memoryProposals();
    const persistence = new PersistDesignProposalService(store, repository);
    const generate = new GenerateDesignProposalService(
      loader,
      provider,
      persistence
    );
    const history = new DesignProposalHistoryService(loader, repository, store);
    return {
      project,
      projects,
      loader,
      provider,
      store,
      repository,
      records,
      persistence,
      generate,
      history
    };
  }
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "casastudio-history-test-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("persists exactly one image/record before success and a new history service can reopen it without changing the canonical Project", async () => {
    const s = setup();
    const before = structuredClone(s.project);
    const saved = await s.generate.generate(s.project.id, input, principal);
    expect(s.repository.create).toHaveBeenCalledTimes(1);
    expect(s.records.size).toBe(1);
    expect(await readdir(root)).toHaveLength(1);
    expect(s.provider.generateDesign).toHaveBeenCalledTimes(1);
    expect(saved.artifact.uri).toContain(
      `/design-proposals/${saved.id}/artifact`
    );
    const reloaded = new DesignProposalHistoryService(
      s.loader,
      s.repository,
      s.store
    );
    const list = await reloaded.list(
      s.project.id,
      "ground",
      "living",
      principal
    );
    expect(list.proposals[0]).toMatchObject({
      id: saved.id,
      projectRevision: s.project.revision,
      instructions: input.instructions,
      telemetry: {
        provider: "fake",
        imageModel: "fixture",
        generationMode: "edit",
        durationMs: 12,
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
      }
    });
    expect(list.proposals[0]!.telemetry!.usage).not.toHaveProperty("raw");
    expect(JSON.stringify(list)).not.toContain("base64");
    expect(JSON.stringify(list)).not.toContain(root);
    const fetched = await reloaded.artifact(s.project.id, saved.id, principal);
    expect(fetched.metadata.mimeType).toBe("image/png");
    expect(fetched.bytes.toString("base64")).toBe(
      input.referenceViews[0]!.image.dataUrl.split(",")[1]
    );
    expect(
      await reloaded.list(s.project.id, "other-level", "living", principal)
    ).toEqual({ proposals: [] });
    expect(
      await reloaded.list(s.project.id, "ground", "other-room", principal)
    ).toEqual({ proposals: [] });
    await reloaded.delete(s.project.id, saved.id, principal);
    expect(s.records.size).toBe(0);
    expect(await readdir(root)).toEqual([]);
    expect(s.project).toEqual(before);
    expect(s.provider.generateDesign).toHaveBeenCalledTimes(1);
  });

  it("denies generate/list/fetch/delete for another user before any proposal/store/provider operation", async () => {
    const s = setup();
    const saved = await s.generate.generate(s.project.id, input, principal);
    vi.mocked(s.repository.find).mockClear();
    vi.mocked(s.repository.list).mockClear();
    const other = { ...principal, subject: "other" };
    const read = vi.spyOn(s.store, "read");
    const remove = vi.spyOn(s.store, "delete");
    await expect(
      s.generate.generate(s.project.id, input, other)
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      s.history.list(s.project.id, "ground", "living", other)
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      s.history.artifact(s.project.id, saved.id, other)
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      s.history.delete(s.project.id, saved.id, other)
    ).rejects.toMatchObject({ status: 403 });
    expect(s.repository.find).not.toHaveBeenCalled();
    expect(s.repository.list).not.toHaveBeenCalled();
    expect(s.repository.delete).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(s.provider.generateDesign).toHaveBeenCalledTimes(1);
  });

  it("retains historical identity after Room deletion, allows the admin override, and prevents cross-Project ID lookups", async () => {
    const s = setup();
    const saved = await s.generate.generate(s.project.id, input, principal);
    const record = s.records.get(saved.id)!;
    const otherProject = { ...s.project, id: "other-project" };
    s.projects.findLoadedByDomainId.mockImplementation(async (id) => ({
      project: id === "other-project" ? otherProject : s.project,
      metadata: { ownerSubject: "owner" }
    }));
    s.project.building.levels[0]!.rooms = [];
    ++s.project.revision;
    const list = await s.history.list(s.project.id, "ground", "living", {
      subject: "admin",
      roles: [KeycloakRole.Admin]
    });
    expect(list.proposals[0]!.projectRevision).toBe(s.project.revision - 1);
    expect(list.proposals[0]!.target.roomId).toBe("living");
    expect(s.records.get(saved.id)).toEqual(record);
    expect(
      await s.history.list("other-project", "ground", "living", principal)
    ).toEqual({ proposals: [] });
    await expect(
      s.history.artifact("other-project", saved.id, principal)
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      s.history.delete("other-project", saved.id, principal)
    ).rejects.toMatchObject({ status: 404 });
  });

  it("compensates a database failure and never resubmits generation", async () => {
    const s = setup();
    vi.mocked(s.repository.create).mockRejectedValue(
      new Error("database offline")
    );
    await expect(
      s.generate.generate(s.project.id, input, principal)
    ).rejects.toMatchObject({ code: "AI_PROPOSAL_PERSISTENCE_FAILED" });
    expect(s.provider.generateDesign).toHaveBeenCalledTimes(1);
    expect(s.records.size).toBe(0);
    expect(await readdir(root)).toEqual([]);
  });

  it("does not create metadata on storage failure and does not retry a paid request", async () => {
    const s = setup();
    vi.spyOn(s.store, "put").mockRejectedValue(new Error("storage offline"));
    await expect(
      s.generate.generate(s.project.id, input, principal)
    ).rejects.toMatchObject({ code: "AI_PROPOSAL_PERSISTENCE_FAILED" });
    expect(s.provider.generateDesign).toHaveBeenCalledTimes(1);
    expect(s.repository.create).not.toHaveBeenCalled();
    expect(await readdir(root)).toEqual([]);
  });

  it.each([
    { uri: "data:image/png;base64," },
    { uri: "data:image/png;base64,!!!!" },
    { width: 5 },
    { uri: `data:image/png;base64,${Buffer.alloc(2000).toString("base64")}` }
  ])(
    "rejects invalid provider bytes before any persistence without regeneration: %j",
    async (invalid) => {
      const s = setup();
      const { fixtureArtifact } = await import("../test/design-fixture");
      vi.mocked(s.provider.generateDesign).mockResolvedValueOnce({
        artifact: { ...fixtureArtifact, ...invalid }
      });
      await expect(
        s.generate.generate(s.project.id, input, principal)
      ).rejects.toMatchObject({ code: "AI_INVALID_PROVIDER_RESPONSE" });
      expect(s.provider.generateDesign).toHaveBeenCalledTimes(1);
      expect(s.repository.create).not.toHaveBeenCalled();
      expect(await readdir(root)).toEqual([]);
    }
  );

  it("rejects mismatched telemetry dimensions before writing the artifact", async () => {
    const s = setup();
    const { fixtureArtifact } = await import("../test/design-fixture");
    vi.mocked(s.provider.generateDesign).mockResolvedValueOnce({
      artifact: fixtureArtifact,
      telemetry: {
        durationMs: 1,
        generatedAt: "2026-10-05T10:00:00.000Z",
        image: { format: "png", width: 5 }
      }
    });
    const write = vi.spyOn(s.store, "put");
    await expect(
      s.generate.generate(s.project.id, input, principal)
    ).rejects.toMatchObject({ code: "AI_INVALID_PROVIDER_RESPONSE" });
    expect(write).not.toHaveBeenCalled();
    expect(s.repository.create).not.toHaveBeenCalled();
    expect(s.provider.generateDesign).toHaveBeenCalledTimes(1);
  });

  it("retains the safe failure when compensation itself fails", async () => {
    const s = setup();
    vi.mocked(s.repository.create).mockRejectedValue(
      new Error("database offline")
    );
    vi.spyOn(s.store, "delete").mockRejectedValue(new Error("cleanup offline"));
    await expect(
      s.generate.generate(s.project.id, input, principal)
    ).rejects.toMatchObject({ code: "AI_PROPOSAL_PERSISTENCE_FAILED" });
    expect(s.records.size).toBe(0);
    expect(s.provider.generateDesign).toHaveBeenCalledTimes(1);
  });

  it("keeps delete successful if byte cleanup fails, with metadata access already revoked", async () => {
    const s = setup();
    const saved = await s.generate.generate(s.project.id, input, principal);
    vi.spyOn(s.store, "delete").mockRejectedValue(new Error("cleanup offline"));
    await expect(
      s.history.delete(s.project.id, saved.id, principal)
    ).resolves.toBeUndefined();
    await expect(
      s.history.artifact(s.project.id, saved.id, principal)
    ).rejects.toMatchObject({ status: 404 });
    expect(s.records.size).toBe(0);
    expect(s.provider.generateDesign).toHaveBeenCalledTimes(1);
  });

  it("bounds and pages newest-first history with a stable ID tie-break and validates cursors", async () => {
    const s = setup();
    const saved = await s.generate.generate(s.project.id, input, principal);
    const record = s.records.get(saved.id)!;
    s.records.clear();
    for (let i = 0; i < 25; ++i) {
      const id = `proposal-${String(i).padStart(2, "0")}`;
      s.records.set(id, {
        ...record,
        proposal: {
          ...record.proposal,
          id,
          createdAt: new Date(
            1_700_000_000_000 + Math.floor(i / 2) * 1000
          ).toISOString()
        }
      });
    }
    const page1 = await s.history.list(
      s.project.id,
      "ground",
      "living",
      principal
    );
    const page2 = await s.history.list(
      s.project.id,
      "ground",
      "living",
      principal,
      page1.nextCursor
    );
    expect(page1.proposals).toHaveLength(20);
    expect(page2.proposals).toHaveLength(5);
    expect(page2.nextCursor).toBeUndefined();
    expect(page1.proposals[0]!.id).toBe("proposal-24");
    expect(page1.proposals[1]!.id).toBe("proposal-23");
    expect(
      new Set([...page1.proposals, ...page2.proposals].map((p) => p.id)).size
    ).toBe(25);
    await expect(
      s.history.list(s.project.id, "ground", "living", principal, "bad-cursor")
    ).rejects.toMatchObject({ status: 400 });
    expect(s.provider.generateDesign).toHaveBeenCalledTimes(1);
  });
});
