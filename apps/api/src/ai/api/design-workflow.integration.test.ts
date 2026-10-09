import "reflect-metadata";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { sign } from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DesignGenerationError, type DesignFailureCode } from "@casastudio/ai";
import type { PrismaService } from "../../persistence/prisma.service";
import { FilesystemDesignArtifactStore } from "../artifacts/filesystem-design-artifact.store";
import { DESIGN_ARTIFACT_STORE } from "../artifacts/design-artifact.store";
import { INTERIOR_DESIGN_PROVIDER } from "../interior-design-provider.token";
import { fixtureProvider, input } from "../test/design-fixture";
import { PrismaDesignProposalsRepository } from "../persistence/prisma-design-proposal.repository";

const withDatabase = process.env.DATABASE_URL ? describe : describe.skip;
withDatabase(
  "AI-B5 signed JWT, real API, database and temporary artifact store",
  () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let root: string;
    let store: FilesystemDesignArtifactStore;
    let projectId: string;
    let otherProjectId: string;
    let savedId: string;
    let payload: typeof input;
    const provider = fixtureProvider();
    const issuer = "http://ai-b5.test/realms/casastudio";
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    const token = (subject: string) =>
      `Bearer ${sign(
        {
          sub: subject,
          resource_access: { "casastudio-api": { roles: ["casastudio-user"] } }
        },
        privateKey,
        {
          algorithm: "RS256",
          issuer,
          audience: "casastudio-api",
          expiresIn: 300
        }
      )}`;
    const owner = token("ai-b5-owner");
    const other = token("ai-b5-other");
    const path = () => `/api/v1/projects/${projectId}/design-proposals`;
    beforeAll(async () => {
      for (const [key, value] of Object.entries({
        NODE_ENV: "test",
        KEYCLOAK_BASE_URL: "http://localhost:8080",
        KEYCLOAK_REALM: "casastudio",
        KEYCLOAK_ISSUER: issuer,
        KEYCLOAK_JWKS_URI: `${issuer}/certs`,
        KEYCLOAK_AUDIENCE: "casastudio-api",
        KEYCLOAK_CLIENT_ID: "casastudio-api",
        LOG_LEVEL: "silent",
        SWAGGER_ENABLED: "false"
      }))
        vi.stubEnv(key, value);
      vi.stubEnv("OPENAI_API_KEY", undefined);
      vi.stubEnv("AI_PROVIDER", undefined);
      vi.doMock("jwks-rsa", () => ({
        passportJwtSecret:
          () =>
          (
            _req: unknown,
            _token: string,
            done: (error: null, key: string) => void
          ) =>
            done(
              null,
              publicKey.export({ format: "pem", type: "spki" }) as string
            )
      }));
      root = await mkdtemp(join(tmpdir(), "casastudio-b5-jwt-"));
      store = new FilesystemDesignArtifactStore(root, 20_000_000);
      const { AppModule } = await import("../../app.module");
      const { PrismaService } =
        await import("../../persistence/prisma.service");
      const { configureApiApplication } =
        await import("../../bootstrap/create-api-application");
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(INTERIOR_DESIGN_PROVIDER)
        .useValue(provider)
        .overrideProvider(DESIGN_ARTIFACT_STORE)
        .useValue(store)
        .compile();
      app = module.createNestApplication();
      configureApiApplication(app, { enableShutdownHooks: false });
      await app.init();
      prisma = app.get(PrismaService);
      for (const [authorization, name] of [
        [owner, "AI-B5 owner"],
        [other, "AI-B5 other"]
      ]) {
        const created = await request(app.getHttpServer())
          .post("/api/v1/projects")
          .set("authorization", authorization!)
          .send({ name })
          .expect(201);
        if (authorization === other) {
          otherProjectId = created.body.project.id;
          continue;
        }
        projectId = created.body.project.id;
        const points = [
          { x: 0, z: 0 },
          { x: 400, z: 0 },
          { x: 400, z: 300 },
          { x: 0, z: 300 }
        ];
        const project = structuredClone(created.body.project);
        project.building.levels = [
          {
            id: "ground",
            name: "Ground",
            elevation: 0,
            walls: [],
            staircases: [],
            rooms: [
              {
                id: "living",
                name: "Studio",
                type: "STUDIO",
                boundary: points.map((start, i) => ({
                  kind: "FREE",
                  start,
                  end: points[(i + 1) % 4]
                }))
              }
            ]
          }
        ];
        await request(app.getHttpServer())
          .put(`/api/v1/projects/${projectId}`)
          .set("authorization", owner)
          .send({ baseRevision: created.body.sourceRevision, project })
          .expect(200);
      }
      payload = {
        ...input,
        referenceViews: input.referenceViews.map((r) => ({
          ...r,
          target: { ...r.target, projectId }
        }))
      };
    }, 30_000);
    afterAll(async () => {
      if (app) {
        for (const [id, authorization] of [
          [projectId, owner],
          [otherProjectId, other]
        ])
          if (id)
            await request(app.getHttpServer())
              .delete(`/api/v1/projects/${id}`)
              .set("authorization", authorization!)
              .expect(204);
        await app.close();
      }
      if (root) await rm(root, { recursive: true, force: true });
      vi.doUnmock("jwks-rsa");
      vi.unstubAllEnvs();
    });

    it("persists one stable identity without canonical mutation and enforces JWT/Project ownership on every route", async () => {
      const before = await prisma.project.findUniqueOrThrow({
        where: { domainId: projectId }
      });
      const result = await request(app.getHttpServer())
        .post(path())
        .set("authorization", owner)
        .send(payload)
        .expect(201);
      savedId = result.body.id;
      expect(JSON.stringify(result.body)).not.toMatch(
        /base64|artifactKey|casastudio-b5-jwt/
      );
      expect(await readdir(root)).toHaveLength(1);
      expect(
        await prisma.designProposal.count({
          where: { project: { domainId: projectId } }
        })
      ).toBe(1);
      for (const authorization of [undefined, other]) {
        const status = authorization ? 403 : 401;
        for (const method of ["get", "delete", "post"] as const) {
          const route = method === "delete" ? `${path()}/${savedId}` : path();
          let call = request(app.getHttpServer())[method](route);
          if (authorization) call = call.set("authorization", authorization);
          if (method === "get")
            call = call.query({ levelId: "ground", roomId: "living" });
          if (method === "post") call = call.send(payload);
          await call.expect(status);
        }
        let artifact = request(app.getHttpServer()).get(
          `${path()}/${savedId}/artifact`
        );
        if (authorization)
          artifact = artifact.set("authorization", authorization);
        await artifact.expect(status);
      }
      await request(app.getHttpServer())
        .get(
          `/api/v1/projects/${otherProjectId}/design-proposals/${savedId}/artifact`
        )
        .set("authorization", other)
        .expect(404);
      const history = await request(app.getHttpServer())
        .get(path())
        .set("authorization", owner)
        .query({ levelId: "ground", roomId: "living" })
        .expect(200);
      expect(history.body.proposals[0].id).toBe(savedId);
      const image = await request(app.getHttpServer())
        .get(`${path()}/${savedId}/artifact`)
        .set("authorization", owner)
        .expect(200);
      expect(image.headers["content-type"]).toBe("image/png");
      expect(
        await prisma.project.findUniqueOrThrow({
          where: { domainId: projectId }
        })
      ).toEqual(before);
      expect(provider.generateDesign).toHaveBeenCalledTimes(1);
    });

    it("AI-C1 refines one saved root twice, reloads branches, normalizes conflicts and authorizes each operation", async () => {
      const before = await prisma.project.findUniqueOrThrow({
        where: { domainId: projectId }
      });
      const invoke = (id: string, instructions: string) =>
        request(app.getHttpServer())
          .post(`${path()}/${id}/refinements`)
          .set("authorization", owner)
          .send({ ...payload, instructions });
      const beforeCalls = vi.mocked(provider.refineDesign).mock.calls.length;
      await request(app.getHttpServer())
        .get(`${path()}/${savedId}/conversation`)
        .set("authorization", owner)
        .expect(200, { page: null });
      const p2 = (await invoke(savedId, "Change only the sofa").expect(201))
        .body;
      expect(provider.refineDesign).toHaveBeenCalledTimes(beforeCalls + 1);
      expect(p2.lineage.parentProposalId).toBe(savedId);
      const reload = await request(app.getHttpServer())
        .get(`${path()}/${p2.id}/conversation`)
        .set("authorization", owner)
        .expect(200);
      expect(reload.body.page.rootProposal.id).toBe(savedId);
      expect(reload.body.page.iterations[0].instructions).toBe(
        "Change only the sofa"
      );
      const p3 = (await invoke(savedId, "Try darker wood").expect(201)).body;
      expect(p3.lineage.parentProposalId).toBe(savedId);
      expect(p3.lineage.conversationId).toBe(p2.lineage.conversationId);
      const branches = await request(app.getHttpServer())
        .get(`${path()}/${savedId}/conversation`)
        .set("authorization", owner)
        .expect(200);
      expect(
        branches.body.page.iterations.map((p: { id: string }) => p.id)
      ).toEqual([p2.id, p3.id]);
      expect(JSON.stringify(branches.body)).not.toMatch(
        /base64|artifactKey|providerContinuation/
      );
      const conflict = await request(app.getHttpServer())
        .delete(`${path()}/${savedId}`)
        .set("authorization", owner)
        .expect(409);
      expect(conflict.body.code).toBe("AI_PROPOSAL_HAS_DESCENDANTS");
      for (const authorization of [undefined, other]) {
        for (const id of [savedId, p2.id, "missing"]) {
          let refine = request(app.getHttpServer())
            .post(`${path()}/${id}/refinements`)
            .send(payload);
          if (authorization)
            refine = refine.set("authorization", authorization);
          await refine.expect(authorization ? 403 : 401);
          let read = request(app.getHttpServer()).get(
            `${path()}/${id}/conversation`
          );
          if (authorization) read = read.set("authorization", authorization);
          await read.expect(authorization ? 403 : 401);
        }
      }
      await request(app.getHttpServer())
        .get(
          `/api/v1/projects/${otherProjectId}/design-proposals/${savedId}/conversation`
        )
        .set("authorization", other)
        .expect(404);
      await request(app.getHttpServer())
        .post(
          `/api/v1/projects/${otherProjectId}/design-proposals/${savedId}/refinements`
        )
        .set("authorization", other)
        .send(payload)
        .expect(404);
      await request(app.getHttpServer())
        .get(`${path()}/${savedId}/conversation?afterTurn=-1`)
        .set("authorization", owner)
        .expect(400);
      await invoke(savedId, "").expect(400);
      await invoke(savedId, "   ").expect(400);
      await invoke(savedId, "x".repeat(2_001)).expect(400);
      await request(app.getHttpServer())
        .post(`${path()}/${savedId}/refinements`)
        .set("authorization", owner)
        .send({
          ...payload,
          providerContinuation: { responseId: "client-injected" }
        })
        .expect(400);
      await prisma.project.update({
        where: { domainId: projectId },
        data: { revision: { increment: 1 } }
      });
      const stale = await invoke(savedId, "Change the sofa").expect(409);
      expect(stale.body.code).toBe("AI_STALE_CONTEXT");
      await prisma.project.update({
        where: { domainId: projectId },
        data: { revision: before.revision }
      });
      expect(provider.refineDesign).toHaveBeenCalledTimes(beforeCalls + 2);
      await request(app.getHttpServer())
        .delete(`${path()}/${p2.id}`)
        .set("authorization", owner)
        .expect(204);
      await request(app.getHttpServer())
        .delete(`${path()}/${p3.id}`)
        .set("authorization", owner)
        .expect(204);
      // Timestamp is intentionally changed by the fixture's direct revision update;
      // no refinement touched canonical data/revision.
      expect(
        (
          await prisma.project.findUniqueOrThrow({
            where: { domainId: projectId }
          })
        ).revision
      ).toBe(before.revision);
      expect(await readdir(root)).toHaveLength(1);
    });

    it.each([
      ["provider_not_configured", 503],
      ["authentication_failed", 503],
      ["model_access_failed", 503],
      ["rate_limited", 429],
      ["provider_unavailable", 503],
      ["generation_failed", 502],
      ["invalid_provider_response", 502],
      ["generation_timeout", 504]
    ] as const)(
      "normalizes %s without resubmission or loss of existing history",
      async (code: DesignFailureCode, status) => {
        const count = vi.mocked(provider.generateDesign).mock.calls.length;
        vi.mocked(provider.generateDesign).mockRejectedValueOnce(
          new DesignGenerationError(code, "Sanitized fixture failure")
        );
        const result = await request(app.getHttpServer())
          .post(path())
          .set("authorization", owner)
          .send(payload)
          .expect(status);
        expect(result.body.code).toBe(`AI_${code.toUpperCase()}`);
        expect(provider.generateDesign).toHaveBeenCalledTimes(count + 1);
        expect(await readdir(root)).toHaveLength(1);
        await request(app.getHttpServer())
          .get(`${path()}/${savedId}/artifact`)
          .set("authorization", owner)
          .expect(200);
      }
    );

    it("rejects missing/mismatched references and stale targets before provider work", async () => {
      const count = vi.mocked(provider.generateDesign).mock.calls.length;
      await request(app.getHttpServer())
        .post(path())
        .set("authorization", owner)
        .send({ ...payload, referenceViews: payload.referenceViews.slice(1) })
        .expect(400);
      await request(app.getHttpServer())
        .post(path())
        .set("authorization", owner)
        .send({ ...payload, roomId: "removed" })
        .expect(422);
      const stale = {
        ...payload,
        roomId: "removed",
        referenceViews: payload.referenceViews.map((r) => ({
          ...r,
          target: { ...r.target, roomId: "removed" }
        }))
      };
      await request(app.getHttpServer())
        .post(path())
        .set("authorization", owner)
        .send(stale)
        .expect(422);
      expect(provider.generateDesign).toHaveBeenCalledTimes(count);
    });

    it("compensates real storage/metadata failures with no second generation, then deletes bytes and metadata", async () => {
      const count = vi.mocked(provider.generateDesign).mock.calls.length;
      const brokenStore = vi
        .spyOn(store, "put")
        .mockRejectedValueOnce(new Error("fixture disk failure"));
      await request(app.getHttpServer())
        .post(path())
        .set("authorization", owner)
        .send(payload)
        .expect(503);
      brokenStore.mockRestore();
      const brokenDb = vi
        .spyOn(app.get(PrismaDesignProposalsRepository), "create")
        .mockRejectedValueOnce(new Error("fixture DB failure"));
      await request(app.getHttpServer())
        .post(path())
        .set("authorization", owner)
        .send(payload)
        .expect(503);
      brokenDb.mockRestore();
      expect(provider.generateDesign).toHaveBeenCalledTimes(count + 2);
      expect(await readdir(root)).toHaveLength(1);
      expect(
        await prisma.designProposal.count({
          where: { project: { domainId: projectId } }
        })
      ).toBe(1);
      await request(app.getHttpServer())
        .delete(`${path()}/${savedId}`)
        .set("authorization", owner)
        .expect(204);
      await request(app.getHttpServer())
        .get(`${path()}/${savedId}/artifact`)
        .set("authorization", owner)
        .expect(404);
      expect(await readdir(root)).toEqual([]);
    });
  }
);
