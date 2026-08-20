import { generateKeyPairSync } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { sign } from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiErrorCode } from "../../common/problem-details/api-error-code";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;
const ownerSubject = "project-write-integration-owner";
const otherSubject = "project-write-integration-other";
const adminSubject = "project-write-integration-admin";
const environment = {
  NODE_ENV: "test",
  API_PORT: "3000",
  KEYCLOAK_BASE_URL: "http://localhost:8080",
  KEYCLOAK_REALM: "casastudio",
  KEYCLOAK_ISSUER: "http://issuer.test/realms/casastudio",
  KEYCLOAK_JWKS_URI: "http://localhost:8080/realms/casastudio/protocol/openid-connect/certs",
  KEYCLOAK_AUDIENCE: "casastudio-api",
  KEYCLOAK_CLIENT_ID: "casastudio-api",
  LOG_LEVEL: "silent"
};

describeWithDatabase("authenticated Project write API with PostgreSQL", () => {
  const signingKeys = createSigningKeys();
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    for (const [key, value] of Object.entries(environment)) {
      vi.stubEnv(key, value);
    }
    vi.stubEnv("SWAGGER_ENABLED", undefined);
    vi.doMock("jwks-rsa", () => ({
      passportJwtSecret:
        () =>
        (
          _request: unknown,
          _rawJwtToken: string,
          done: (error: Error | null, secret?: string) => void
        ) =>
          done(null, signingKeys.publicPem)
    }));
    vi.resetModules();

    const { AppModule } = await import("../../app.module");
    const { OidcHealthService } = await import("../../health/oidc-health.service");
    const { PrismaService } = await import("../../persistence/prisma.service");
    const { configureApiApplication } = await import("../../bootstrap/create-api-application");
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OidcHealthService)
      .useValue({ verifyReady: vi.fn(async () => undefined) })
      .compile();

    app = moduleReference.createNestApplication();
    configureApiApplication(app, { enableShutdownHooks: false });
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      await cleanup();
    }
    if (app) {
      await app.close();
    }
    vi.doUnmock("jwks-rsa");
    vi.unstubAllEnvs();
  });

  it("creates, lists, reads, saves, round-trips, and derives coherent geometry", async () => {
    const authorization = userAuthorization(ownerSubject);
    const created = await request(app.getHttpServer())
      .post("/api/v1/projects")
      .set("authorization", authorization)
      .send({ name: "Integration apartment" })
      .expect(201);
    const projectId = created.body.project.id as string;

    expect(created.body).toMatchObject({
      sourceRevision: 1,
      project: {
        id: projectId,
        name: "Integration apartment",
        revision: 1,
        building: {
          levels: [{ name: "Ground Floor", elevation: 0, walls: [] }]
        }
      }
    });

    const listed = await request(app.getHttpServer())
      .get("/api/v1/projects")
      .set("authorization", authorization)
      .expect(200);
    expect(listed.body.projects).toContainEqual({
      id: projectId,
      name: "Integration apartment",
      revision: 1,
      updatedAt: created.body.project.updatedAt
    });
    expect(JSON.stringify(listed.body)).not.toContain("building");

    const read = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set("authorization", authorization)
      .expect(200);
    const proposed = structuredClone(read.body.project);
    proposed.name = "Saved integration apartment";
    proposed.building.levels[0].walls.push(
      createBoundaryWall("client-generated-wall", { x: 0, z: 0 }, { x: 100, z: 0 }),
      createBoundaryWall("saved-east-wall", { x: 100, z: 0 }, { x: 100, z: 100 }),
      createBoundaryWall("saved-north-wall", { x: 100, z: 100 }, { x: 0, z: 100 }),
      createBoundaryWall("saved-west-wall", { x: 0, z: 100 }, { x: 0, z: 0 })
    );
    proposed.building.levels[0].rooms.push({
      id: "saved-room",
      name: "Saved Room",
      type: "OTHER",
      boundary: [
        { wallId: "client-generated-wall", direction: "FORWARD" },
        { wallId: "saved-east-wall", direction: "FORWARD" },
        { wallId: "saved-north-wall", direction: "FORWARD" },
        { wallId: "saved-west-wall", direction: "FORWARD" }
      ]
    });

    const saved = await request(app.getHttpServer())
      .put(`/api/v1/projects/${projectId}`)
      .set("authorization", authorization)
      .send({ baseRevision: 1, project: proposed })
      .expect(200);

    expect(saved.body.sourceRevision).toBe(2);
    expect(saved.body.project).toMatchObject({
      id: projectId,
      name: "Saved integration apartment",
      revision: 2
    });
    expect(saved.body.project.building.levels[0].walls).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "client-generated-wall" })])
    );

    const authoritative = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set("authorization", authorization)
      .expect(200);
    expect(authoritative.body).toEqual(saved.body);

    const geometry = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/geometry`)
      .set("authorization", authorization)
      .expect(200);
    expect(geometry.body.sourceProjectId).toBe(projectId);
    expect(geometry.body.sourceRevision).toBe(2);
    expect(geometry.body.geometry.levels[0].boundaryEdges).toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceWallId: "client-generated-wall" })])
    );
    expect(geometry.body.geometry.levels[0].polygons[0]).toMatchObject({
      sourceRoomId: "saved-room",
      metrics: { area: 10_000 }
    });

    const persisted = await prisma.project.findUniqueOrThrow({
      where: { domainId: projectId },
      include: { walls: true, levels: true }
    });
    expect(persisted.revision).toBe(2);
    expect(persisted.walls.map((wall) => wall.domainId)).toContain("client-generated-wall");
    expect(persisted.levels).toHaveLength(1);
  });

  it("commits exactly one of two concurrent saves from the same base revision", async () => {
    const authorization = userAuthorization(ownerSubject);
    const created = await request(app.getHttpServer())
      .post("/api/v1/projects")
      .set("authorization", authorization)
      .send({ name: "Concurrent apartment" })
      .expect(201);
    const projectId = created.body.project.id as string;
    const firstProposal = structuredClone(created.body.project);
    const secondProposal = structuredClone(created.body.project);
    firstProposal.name = "Writer A";
    secondProposal.name = "Writer B";
    firstProposal.building.levels[0].walls.push(createWall("writer-a-wall", 0));
    secondProposal.building.levels[0].walls.push(createWall("writer-b-wall", 200));

    const responses = await Promise.all([
      request(app.getHttpServer())
        .put(`/api/v1/projects/${projectId}`)
        .set("authorization", authorization)
        .send({ baseRevision: 1, project: firstProposal }),
      request(app.getHttpServer())
        .put(`/api/v1/projects/${projectId}`)
        .set("authorization", authorization)
        .send({ baseRevision: 1, project: secondProposal })
    ]);
    const success = responses.find((response) => response.status === 200);
    const conflict = responses.find((response) => response.status === 409);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(conflict?.body.code).toBe(ApiErrorCode.ProjectRevisionConflict);
    const authoritative = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set("authorization", authorization)
      .expect(200);
    expect(authoritative.body.sourceRevision).toBe(2);
    expect(authoritative.body.project).toEqual(success?.body.project);
    expect(await prisma.project.findUniqueOrThrow({ where: { domainId: projectId } })).toMatchObject({
      revision: 2,
      name: success?.body.project.name
    });
  });

  it("rejects geometry-invalid state without changing revision or normalized rows", async () => {
    const authorization = userAuthorization(ownerSubject);
    const created = await request(app.getHttpServer())
      .post("/api/v1/projects")
      .set("authorization", authorization)
      .send({ name: "Invalid geometry apartment" })
      .expect(201);
    const projectId = created.body.project.id as string;
    const invalid = structuredClone(created.body.project);
    invalid.building.levels[0].walls.push({
      ...createWall("zero-length-wall", 0),
      end: { x: 2_000, z: 0 }
    });

    const rejected = await request(app.getHttpServer())
      .put(`/api/v1/projects/${projectId}`)
      .set("authorization", authorization)
      .send({ baseRevision: 1, project: invalid })
      .expect(422);
    expect(rejected.body.code).toBe(ApiErrorCode.ProjectStateInvalid);

    const authoritative = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set("authorization", authorization)
      .expect(200);
    expect(authoritative.body).toEqual(created.body);
    expect(await prisma.wall.count({ where: { project: { domainId: projectId } } })).toBe(0);
  });

  it("enforces ownership, admin override, authentication, and owner assignment", async () => {
    const ownerAuthorization = userAuthorization(ownerSubject);
    const created = await request(app.getHttpServer())
      .post("/api/v1/projects")
      .set("authorization", ownerAuthorization)
      .send({ name: "Authorization apartment" })
      .expect(201);
    const projectId = created.body.project.id as string;
    const payload = { baseRevision: 1, project: created.body.project };

    await request(app.getHttpServer()).put(`/api/v1/projects/${projectId}`).send(payload).expect(401);
    await request(app.getHttpServer())
      .put(`/api/v1/projects/${projectId}`)
      .set("authorization", userAuthorization(otherSubject))
      .send(payload)
      .expect(403);
    await request(app.getHttpServer())
      .put(`/api/v1/projects/${projectId}`)
      .set("authorization", adminAuthorization())
      .send(payload)
      .expect(200);

    const persisted = await prisma.project.findUniqueOrThrow({ where: { domainId: projectId } });
    expect(persisted.ownerSubject).toBe(ownerSubject);
    expect(persisted.updatedBySubject).toBe(adminSubject);
  });

  async function cleanup(): Promise<void> {
    await prisma.project.deleteMany({
      where: { ownerSubject: { in: [ownerSubject, otherSubject, adminSubject] } }
    });
  }

  function userAuthorization(subject: string): string {
    return `Bearer ${signingKeys.signToken(subject, ["casastudio-user"])}`;
  }

  function adminAuthorization(): string {
    return `Bearer ${signingKeys.signToken(adminSubject, ["casastudio-admin"])}`;
  }
});

function createWall(id: string, z: number) {
  return {
    id,
    start: { x: 2_000, z },
    end: { x: 2_100, z },
    height: 280,
    thickness: 20,
    roomIds: [],
    openings: []
  };
}

function createBoundaryWall(
  id: string,
  start: { readonly x: number; readonly z: number },
  end: { readonly x: number; readonly z: number }
) {
  return {
    ...createWall(id, 0),
    start,
    end,
    roomIds: ["saved-room"]
  };
}

function createSigningKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicPem = publicKey.export({ format: "pem", type: "spki" }) as string;
  const privatePem = privateKey.export({ format: "pem", type: "pkcs8" });

  return {
    publicPem,
    signToken: (subject: string, roles: readonly string[]) =>
      sign(
        {
          preferred_username: subject,
          resource_access: { "casastudio-api": { roles } },
          sub: subject
        },
        privatePem,
        {
          algorithm: "RS256",
          audience: environment.KEYCLOAK_AUDIENCE,
          expiresIn: 300,
          issuer: environment.KEYCLOAK_ISSUER,
          keyid: "project-write-integration-key"
        }
      )
  };
}
