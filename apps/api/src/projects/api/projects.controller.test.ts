import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  GeometryBuildErrorCode,
  GeometryModel,
  LevelGeometry,
  Vertex,
  type GeometryBuildResult
} from "@casastudio/geometry";
import { ProjectSchema, type Project } from "@casastudio/schema";
import { sign } from "jsonwebtoken";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi
} from "vitest";

import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import type { ProjectGeometryBuilder } from "../geometry-api/project-geometry-builder";
import type {
  LoadedProject,
  ProjectsRepository
} from "../persistence/project.repository";

const canonicalProjectUrl = new URL(
  "../../../../../packages/schema/examples/project.json",
  import.meta.url
);
const canonicalProjectFixture = ProjectSchema.parse(
  JSON.parse(readFileSync(canonicalProjectUrl, "utf8"))
);
const canonicalProject = ProjectSchema.parse({
  ...canonicalProjectFixture,
  id: "demo-project",
  name: "Demo Project"
});
const ownerSubject = "8d62f7e2-0c2a-4f2a-a9cf-7f62c2f4e8f7";
const defaultTestEnvironment = {
  NODE_ENV: "test",
  API_PORT: "3000",
  DATABASE_URL: "postgresql://localhost:5432/casastudio_test?schema=public",
  KEYCLOAK_BASE_URL: "http://localhost:8080",
  KEYCLOAK_REALM: "casastudio",
  KEYCLOAK_ISSUER: "http://issuer.test/realms/casastudio",
  KEYCLOAK_JWKS_URI:
    "http://localhost:8080/realms/casastudio/protocol/openid-connect/certs",
  KEYCLOAK_AUDIENCE: "casastudio-api",
  KEYCLOAK_CLIENT_ID: "casastudio-api",
  LOG_LEVEL: "silent"
};

type DependencyMock = {
  readonly verifyReady: ReturnType<typeof vi.fn<() => Promise<void>>>;
};

type TestAppContext = {
  readonly app: INestApplication;
  readonly repository: ProjectsRepository;
  readonly geometryBuilder: ProjectGeometryBuilder;
};

const coldControllerBootstrapTimeoutMs = 15_000;

describe("ProjectsController", () => {
  const signingKeys = createSigningKeys();

  beforeAll(() => {
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
  });

  afterAll(() => {
    vi.doUnmock("jwks-rsa");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it(
    "returns the authoritative Project for its owner",
    async () => {
      const context = await createTestApp({
        loadedProject: createLoadedProject(canonicalProject)
      });

      const response = await request(context.app.getHttpServer())
        .get(`/api/v1/projects/${canonicalProject.id}`)
        .set(
          "authorization",
          `Bearer ${signingKeys.signToken({
            subject: ownerSubject,
            roles: ["casastudio-user"]
          })}`
        )
        .expect(200);

      expect(response.body.project.id).toBe(canonicalProject.id);
      expect(response.body.project.revision).toBe(canonicalProject.revision);
      expect(response.body.sourceRevision).toBe(canonicalProject.revision);
      expect(response.body.sourceRevision).toBe(response.body.project.revision);
      expect(
        response.body.project.building.levels[0].rooms[1].boundary[0]
      ).toEqual({
        wallId: "living-kitchen-partition",
        direction: "REVERSE"
      });
      expect(response.body.project.viewpoints).toHaveLength(2);
      expect(response.body.project.baseImages).toHaveLength(2);
      expect(response.body.project.designBriefs).toHaveLength(1);
      expect(response.body.project.renderRequests).toHaveLength(1);
      expect(JSON.stringify(response.body)).not.toContain("ownerSubject");
      expect(JSON.stringify(response.body)).not.toContain("createdBySubject");
      expect(JSON.stringify(response.body)).not.toContain("updatedBySubject");
      expect(JSON.stringify(response.body)).not.toContain('"projectId"');

      await context.app.close();
    },
    coldControllerBootstrapTimeoutMs
  );

  it("lists lightweight owner-scoped Project summaries", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });

    const response = await request(context.app.getHttpServer())
      .get("/api/v1/projects")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({ subject: ownerSubject, roles: ["casastudio-user"] })}`
      )
      .expect(200);

    expect(response.body).toEqual({
      projects: [
        {
          id: canonicalProject.id,
          name: canonicalProject.name,
          revision: canonicalProject.revision,
          updatedAt: canonicalProject.updatedAt,
          ownedByCurrentUser: true
        }
      ]
    });
    expect(context.repository.listProjectSummaries).toHaveBeenCalledWith(
      ownerSubject
    );
    expect(JSON.stringify(response.body)).not.toContain("building");

    await context.app.close();
  });

  it("creates a canonical revision-one Project owned by the caller intent", async () => {
    const context = await createTestApp({ loadedProject: null });

    const response = await request(context.app.getHttpServer())
      .post("/api/v1/projects")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({ subject: ownerSubject, roles: ["casastudio-user"] })}`
      )
      .send({ name: "My apartment" })
      .expect(201);

    expect(response.body.sourceRevision).toBe(1);
    expect(response.body.project).toMatchObject({
      name: "My apartment",
      revision: 1,
      building: {
        name: "My apartment",
        levels: [
          {
            name: "Ground Floor",
            elevation: 0,
            rooms: [],
            walls: [],
            staircases: []
          }
        ]
      }
    });
    expect(context.repository.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My apartment", revision: 1 }),
      ownerSubject
    );

    await context.app.close();
  });

  it("returns a typed conflict for an existing normalized owner Project name", async () => {
    const context = await createTestApp({ loadedProject: null });
    vi.mocked(context.repository.projectNameExists).mockResolvedValue(true);

    const response = await request(context.app.getHttpServer())
      .post("/api/v1/projects")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({ subject: ownerSubject, roles: ["casastudio-user"] })}`
      )
      .send({ name: "  DEMO PROJECT  " })
      .expect(409);

    expect(context.repository.projectNameExists).toHaveBeenCalledWith(
      ownerSubject,
      "demo project"
    );
    expect(context.repository.createProject).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      code: ApiErrorCode.ProjectNameConflict,
      status: 409
    });
    await context.app.close();
  });

  it("maps a race-safe persistence name conflict to the typed 409 Problem", async () => {
    const context = await createTestApp({
      loadedProject: null,
      createErrorKind: "name-conflict"
    });

    const response = await request(context.app.getHttpServer())
      .post("/api/v1/projects")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({ subject: ownerSubject, roles: ["casastudio-user"] })}`
      )
      .send({ name: "My apartment" })
      .expect(409);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.ProjectNameConflict,
      status: 409,
      errors: [expect.objectContaining({ path: "name" })]
    });
    await context.app.close();
  });

  it("maps a low-level create failure to the generic write Problem", async () => {
    const context = await createTestApp({
      loadedProject: null,
      createErrorKind: "persistence"
    });

    const response = await request(context.app.getHttpServer())
      .post("/api/v1/projects")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({ subject: ownerSubject, roles: ["casastudio-user"] })}`
      )
      .send({ name: "My apartment" })
      .expect(500);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.ProjectWriteFailed,
      status: 500
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "SQL connection refused"
    );
    await context.app.close();
  });

  it("replaces a complete Project and returns the next authoritative revision", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });
    const proposedProject = { ...canonicalProject, name: "Updated apartment" };

    const response = await request(context.app.getHttpServer())
      .put(`/api/v1/projects/${canonicalProject.id}`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({ subject: ownerSubject, roles: ["casastudio-user"] })}`
      )
      .send({
        baseRevision: canonicalProject.revision,
        project: proposedProject
      })
      .expect(200);

    expect(response.body).toMatchObject({
      sourceRevision: canonicalProject.revision + 1,
      project: {
        id: canonicalProject.id,
        name: "Updated apartment",
        revision: canonicalProject.revision + 1
      }
    });
    expect(context.repository.replaceProject).toHaveBeenCalledTimes(1);

    await context.app.close();
  });

  it("maps malformed, identity, invalid-state, and stale saves to stable Problems", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });
    const authorization = `Bearer ${signingKeys.signToken({
      subject: ownerSubject,
      roles: ["casastudio-user"]
    })}`;

    const malformed = await request(context.app.getHttpServer())
      .put(`/api/v1/projects/${canonicalProject.id}`)
      .set("authorization", authorization)
      .send({ baseRevision: "not-a-revision", project: canonicalProject })
      .expect(400);
    expect(malformed.body.code).toBe(ApiErrorCode.InvalidRequest);

    const mismatch = await request(context.app.getHttpServer())
      .put(`/api/v1/projects/${canonicalProject.id}`)
      .set("authorization", authorization)
      .send({
        baseRevision: canonicalProject.revision,
        project: { ...canonicalProject, id: "another-project" }
      })
      .expect(400);
    expect(mismatch.body.code).toBe(ApiErrorCode.ProjectAggregateIdMismatch);

    const invalidProject = structuredClone(canonicalProject);
    const invalidWall = invalidProject.building.levels[0]?.walls[0];
    if (!invalidWall) throw new Error("Canonical fixture requires a Wall.");
    invalidWall.end = invalidWall.start;
    const invalid = await request(context.app.getHttpServer())
      .put(`/api/v1/projects/${canonicalProject.id}`)
      .set("authorization", authorization)
      .send({
        baseRevision: canonicalProject.revision,
        project: invalidProject
      })
      .expect(422);
    expect(invalid.body.code).toBe(ApiErrorCode.ProjectStateInvalid);

    const stale = await request(context.app.getHttpServer())
      .put(`/api/v1/projects/${canonicalProject.id}`)
      .set("authorization", authorization)
      .send({
        baseRevision: canonicalProject.revision + 1,
        project: {
          ...canonicalProject,
          revision: canonicalProject.revision + 1
        }
      })
      .expect(409);
    expect(stale.body.code).toBe(ApiErrorCode.ProjectRevisionConflict);

    await context.app.close();
  });

  it("enforces unauthenticated, owner, non-owner, and administrator update access", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });
    const payload = {
      baseRevision: canonicalProject.revision,
      project: canonicalProject
    };

    await request(context.app.getHttpServer())
      .put(`/api/v1/projects/${canonicalProject.id}`)
      .send(payload)
      .expect(401);

    await request(context.app.getHttpServer())
      .put(`/api/v1/projects/${canonicalProject.id}`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({ subject: "other-subject", roles: ["casastudio-user"] })}`
      )
      .send(payload)
      .expect(403);

    await request(context.app.getHttpServer())
      .put(`/api/v1/projects/${canonicalProject.id}`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({ subject: "admin-subject", roles: ["casastudio-admin"] })}`
      )
      .send(payload)
      .expect(200);

    await context.app.close();
  });

  it("deletes an owned Project and applies not-found semantics afterward", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });
    const authorization = `Bearer ${signingKeys.signToken({
      subject: ownerSubject,
      roles: ["casastudio-user"]
    })}`;

    await request(context.app.getHttpServer())
      .delete(`/api/v1/projects/${canonicalProject.id}`)
      .set("authorization", authorization)
      .expect(204);

    expect(context.repository.deleteProject).toHaveBeenCalledWith({
      projectId: canonicalProject.id,
      requiredOwnerSubject: ownerSubject
    });
    await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}`)
      .set("authorization", authorization)
      .expect(404);
    await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}/geometry`)
      .set("authorization", authorization)
      .expect(404);
    await request(context.app.getHttpServer())
      .delete(`/api/v1/projects/${canonicalProject.id}`)
      .set("authorization", authorization)
      .expect(404);

    const listed = await request(context.app.getHttpServer())
      .get("/api/v1/projects")
      .set("authorization", authorization)
      .expect(200);
    expect(listed.body.projects).toEqual([]);
    await context.app.close();
  });

  it("forbids non-owner deletion and preserves the administrator override", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });

    await request(context.app.getHttpServer())
      .delete(`/api/v1/projects/${canonicalProject.id}`)
      .expect(401);
    await request(context.app.getHttpServer())
      .delete(`/api/v1/projects/${canonicalProject.id}`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({ subject: "other-subject", roles: ["casastudio-user"] })}`
      )
      .expect(403);
    await request(context.app.getHttpServer())
      .delete(`/api/v1/projects/${canonicalProject.id}`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({ subject: "admin-subject", roles: ["casastudio-admin"] })}`
      )
      .expect(204);

    expect(context.repository.deleteProject).toHaveBeenLastCalledWith({
      projectId: canonicalProject.id,
      requiredOwnerSubject: undefined
    });
    await context.app.close();
  });

  it("maps deletion persistence failures to a sanitized write Problem", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject),
      deleteErrorKind: "persistence"
    });

    const response = await request(context.app.getHttpServer())
      .delete(`/api/v1/projects/${canonicalProject.id}`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({ subject: ownerSubject, roles: ["casastudio-user"] })}`
      )
      .expect(500);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.ProjectWriteFailed,
      status: 500
    });
    expect(JSON.stringify(response.body)).not.toContain("constraint internals");
    await context.app.close();
  });

  it("requires authentication", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });

    await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}`)
      .expect(401);
    await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}`)
      .set("authorization", "Bearer not-a-token")
      .expect(401);

    await context.app.close();
  });

  it("forbids non-owners with the user role", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });

    const response = await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: "other-subject",
          username: ownerSubject,
          email: `${ownerSubject}@example.test`,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(403);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.ProjectAccessForbidden,
      status: 403
    });
    expect(JSON.stringify(response.body)).not.toContain(ownerSubject);

    await context.app.close();
  });

  it("allows administrators to read non-owned Projects", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });

    await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: "admin-subject",
          roles: ["casastudio-admin"]
        })}`
      )
      .expect(200);

    await context.app.close();
  });

  it("returns the authoritative Project geometry for its owner", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });

    const response = await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}/geometry`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: ownerSubject,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(200);

    expect(response.body.sourceProjectId).toBe(canonicalProject.id);
    expect(response.body.sourceRevision).toBe(canonicalProject.revision);
    expect(response.body.geometry).toMatchObject({
      id: `geometry-model:${canonicalProject.id}:${canonicalProject.revision}`,
      units: {
        length: "cm",
        angle: "deg"
      }
    });
    expect(response.body.geometry.levels[0].sourceLevelId).toBe("ground-floor");
    expect(response.body.geometry.levels[0].polygons[0]).toMatchObject({
      sourceRoomId: "living-room",
      metrics: {
        area: expect.any(Number),
        winding: expect.any(String)
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("ownerSubject");
    expect(JSON.stringify(response.body)).not.toContain("createdBySubject");
    expect(JSON.stringify(response.body)).not.toContain("updatedBySubject");
    expect(JSON.stringify(response.body)).not.toContain('"projectId"');
    expect(JSON.stringify(response.body)).not.toContain("findLoadedByDomainId");
    expect(context.repository.findLoadedByDomainId).toHaveBeenCalledTimes(1);
    expect(context.geometryBuilder.build).toHaveBeenCalledTimes(1);

    await context.app.close();
  });

  it("requires authentication for Project geometry", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });

    await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}/geometry`)
      .expect(401);
    await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}/geometry`)
      .set("authorization", "Bearer not-a-token")
      .expect(401);

    await context.app.close();
  });

  it("reuses owner and administrator authorization for Project geometry", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });

    const forbiddenResponse = await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}/geometry`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: "other-subject",
          username: ownerSubject,
          email: `${ownerSubject}@example.test`,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(403);

    expect(forbiddenResponse.body).toMatchObject({
      code: ApiErrorCode.ProjectAccessForbidden,
      status: 403
    });
    expect(JSON.stringify(forbiddenResponse.body)).not.toContain(ownerSubject);

    await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}/geometry`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: "admin-subject",
          roles: ["casastudio-admin"]
        })}`
      )
      .expect(200);

    await context.app.close();
  });

  it("rejects malformed Project IDs before repository access", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });

    const response = await request(context.app.getHttpServer())
      .get("/api/v1/projects/Casa Studio")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: ownerSubject,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(400);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.ProjectIdInvalid,
      status: 400,
      errors: [
        {
          path: "id",
          message:
            "Project ID must be a non-empty lowercase kebab-case identifier."
        }
      ]
    });
    expect(context.repository.findLoadedByDomainId).not.toHaveBeenCalled();

    await context.app.close();
  });

  it("rejects malformed Project geometry IDs before repository or engine access", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });

    const response = await request(context.app.getHttpServer())
      .get("/api/v1/projects/Casa Studio/geometry")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: ownerSubject,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(400);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.ProjectIdInvalid,
      status: 400
    });
    expect(context.repository.findLoadedByDomainId).not.toHaveBeenCalled();
    expect(context.geometryBuilder.build).not.toHaveBeenCalled();

    await context.app.close();
  });

  it("returns not found for unknown valid Project IDs", async () => {
    const context = await createTestApp({
      loadedProject: null
    });

    const response = await request(context.app.getHttpServer())
      .get("/api/v1/projects/unknown-project")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: ownerSubject,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(404);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.ProjectNotFound,
      status: 404
    });

    await context.app.close();
  });

  it("returns not found for unknown valid Project geometry IDs", async () => {
    const context = await createTestApp({
      loadedProject: null
    });

    const response = await request(context.app.getHttpServer())
      .get("/api/v1/projects/unknown-project/geometry")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: ownerSubject,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(404);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.ProjectNotFound,
      status: 404
    });

    await context.app.close();
  });

  it("returns a sanitized persisted-state failure for corrupt aggregate reads", async () => {
    const context = await createTestApp({
      errorKind: "persisted-invalid"
    });

    const response = await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: ownerSubject,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(500);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.ProjectPersistedStateInvalid,
      status: 500
    });
    expect(JSON.stringify(response.body)).not.toContain("schema internals");

    await context.app.close();
  });

  it("returns a sanitized read failure for repository failures", async () => {
    const context = await createTestApp({
      errorKind: "persistence"
    });

    const response = await request(context.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: ownerSubject,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(500);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.ProjectReadFailed,
      status: 500
    });
    expect(JSON.stringify(response.body)).not.toContain("SQL");

    await context.app.close();
  });

  it("returns sanitized geometry-specific failures", async () => {
    const invalidContext = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject),
      geometryBuildResult: {
        ok: false,
        errors: [
          {
            code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
            message: "engine diagnostic internals",
            path: "building.levels[0].rooms[0].boundary",
            sourceId: "living-room"
          }
        ]
      }
    });

    const invalidResponse = await request(invalidContext.app.getHttpServer())
      .get(`/api/v1/projects/${canonicalProject.id}/geometry`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: ownerSubject,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(500);

    expect(invalidResponse.body).toMatchObject({
      code: ApiErrorCode.ProjectGeometryInvalid,
      status: 500
    });
    expect(JSON.stringify(invalidResponse.body)).not.toContain(
      "engine diagnostic internals"
    );
    await invalidContext.app.close();

    const buildFailureContext = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject),
      geometryBuilder: {
        build: vi.fn<ProjectGeometryBuilder["build"]>(() => {
          throw new Error("engine stack internals");
        })
      }
    });

    const buildFailureResponse = await request(
      buildFailureContext.app.getHttpServer()
    )
      .get(`/api/v1/projects/${canonicalProject.id}/geometry`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: ownerSubject,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(500);

    expect(buildFailureResponse.body).toMatchObject({
      code: ApiErrorCode.ProjectGeometryBuildFailed,
      status: 500
    });
    expect(JSON.stringify(buildFailureResponse.body)).not.toContain(
      "engine stack internals"
    );
    await buildFailureContext.app.close();

    const serializationFailureContext = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject),
      geometryBuildResult: createNonFiniteGeometryBuildResult(canonicalProject)
    });

    const serializationFailureResponse = await request(
      serializationFailureContext.app.getHttpServer()
    )
      .get(`/api/v1/projects/${canonicalProject.id}/geometry`)
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          subject: ownerSubject,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(500);

    expect(serializationFailureResponse.body).toMatchObject({
      code: ApiErrorCode.ProjectGeometrySerializationFailed,
      status: 500
    });
    expect(JSON.stringify(serializationFailureResponse.body)).not.toContain(
      "must be finite"
    );
    await serializationFailureContext.app.close();
  });
});

describe("Projects OpenAPI contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("documents Project lifecycle, full replacement, read, and geometry contracts", async () => {
    const context = await createTestApp({
      environment: {
        NODE_ENV: "development"
      },
      loadedProject: createLoadedProject(canonicalProject)
    });

    const response = await request(context.app.getHttpServer())
      .get("/api/docs-json")
      .expect(200);
    const documentJson = JSON.stringify(response.body);
    const operation = response.body.paths["/api/v1/projects/{id}"].get;
    const listOperation = response.body.paths["/api/v1/projects"].get;
    const createOperation = response.body.paths["/api/v1/projects"].post;
    const replaceOperation = response.body.paths["/api/v1/projects/{id}"].put;
    const deleteOperation = response.body.paths["/api/v1/projects/{id}"].delete;
    const geometryOperation =
      response.body.paths["/api/v1/projects/{id}/geometry"].get;
    const schemas = response.body.components.schemas;

    expect(operation).toBeDefined();
    expect(listOperation).toBeDefined();
    expect(createOperation).toBeDefined();
    expect(replaceOperation).toBeDefined();
    expect(deleteOperation).toBeDefined();
    expect(operation.security).toEqual([{ bearer: [] }]);
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "id",
          required: true,
          in: "path"
        })
      ])
    );
    expect(Object.keys(operation.responses)).toEqual(
      expect.arrayContaining(["200", "400", "401", "403", "404", "500"])
    );
    expect(schemas.ProjectResponseDto).toBeDefined();
    expect(schemas.ProjectListResponseDto).toBeDefined();
    expect(Object.keys(createOperation.responses)).toEqual(
      expect.arrayContaining(["201", "400", "401", "403", "422", "500"])
    );
    expect(Object.keys(replaceOperation.responses)).toEqual(
      expect.arrayContaining([
        "200",
        "400",
        "401",
        "403",
        "404",
        "409",
        "422",
        "500"
      ])
    );
    expect(Object.keys(deleteOperation.responses)).toEqual(
      expect.arrayContaining(["204", "400", "401", "403", "404", "500"])
    );
    expect(geometryOperation).toBeDefined();
    expect(geometryOperation.security).toEqual([{ bearer: [] }]);
    expect(geometryOperation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "id",
          required: true,
          in: "path"
        })
      ])
    );
    expect(Object.keys(geometryOperation.responses)).toEqual(
      expect.arrayContaining(["200", "400", "401", "403", "404", "500"])
    );
    expect(
      geometryOperation.responses["200"].content["application/json"].schema
    ).toEqual({
      $ref: "#/components/schemas/ProjectGeometryResponseDto"
    });
    expect(schemas.ProjectGeometryResponseDto.required).toEqual(
      expect.arrayContaining(["sourceProjectId", "sourceRevision", "geometry"])
    );
    expect(schemas.GeometrySnapshotDto).toBeDefined();
    expect(documentJson).toContain("#/components/schemas/GeometryLevelDto");
    expect(documentJson).toContain(
      "#/components/schemas/GeometryPolygonMetricsDto"
    );
    expect(documentJson).toContain("#/components/schemas/ProjectDto");
    expect(documentJson).toContain("#/components/schemas/BuildingDto");
    expect(documentJson).toContain("#/components/schemas/RoomBoundaryEdgeDto");
    expect(documentJson).toContain("#/components/schemas/RenderRequestDto");
    expect(documentJson).not.toContain("ownerSubject");
    expect(documentJson).not.toContain("createdBySubject");
    expect(documentJson).not.toContain("updatedBySubject");
    expect(documentJson).not.toContain('"projectId"');
    expect(
      Object.keys(response.body.paths).some((path) =>
        path.includes("/workspace")
      )
    ).toBe(false);
    expect(
      Object.keys(response.body.paths).some((path) =>
        path.includes("/geometry/rebuild")
      )
    ).toBe(false);
    expect(
      Object.keys(response.body.paths).some((path) =>
        path.includes("/geometry/validate")
      )
    ).toBe(false);
    expect(
      Object.keys(response.body.paths).some((path) =>
        path.includes("/geometry/{geometryId}")
      )
    ).toBe(false);
    expect(
      Object.values(response.body.paths).some(
        (pathItem) => "patch" in (pathItem as Record<string, unknown>)
      )
    ).toBe(false);
    await context.app.close();
  });
});

async function createTestApp(options: {
  readonly loadedProject?: LoadedProject | null;
  readonly errorKind?: "persisted-invalid" | "persistence";
  readonly createErrorKind?: "name-conflict" | "persistence";
  readonly deleteErrorKind?: "persistence";
  readonly environment?: Record<string, string>;
  readonly geometryBuildResult?: GeometryBuildResult;
  readonly geometryBuilder?: ProjectGeometryBuilder;
}): Promise<TestAppContext> {
  const prisma: DependencyMock = {
    verifyReady: vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  };
  const oidc: DependencyMock = {
    verifyReady: vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  };

  for (const [key, value] of Object.entries({
    ...defaultTestEnvironment,
    ...options.environment
  })) {
    vi.stubEnv(key, value);
  }
  vi.stubEnv("SWAGGER_ENABLED", options.environment?.SWAGGER_ENABLED);

  vi.resetModules();
  const { AppModule } = await import("../../app.module");
  const { PrismaService: RuntimePrismaService } =
    await import("../../persistence/prisma.service");
  const { OidcHealthService: RuntimeOidcHealthService } =
    await import("../../health/oidc-health.service");
  const { PROJECTS_REPOSITORY } =
    await import("../persistence/projects-repository.token");
  const { PROJECT_GEOMETRY_BUILDER } =
    await import("../geometry-api/project-geometry-builder");
  const { GeometryEngine } = await import("@casastudio/geometry");
  const {
    PersistedProjectInvalidError,
    ProjectNameConflictPersistenceError,
    ProjectPersistenceError
  } = await import("../persistence/project-persistence-error");
  const { configureApiApplication } =
    await import("../../bootstrap/create-api-application");
  const repository = createRepository({
    loadedProject: options.loadedProject,
    error:
      options.errorKind === "persisted-invalid"
        ? new PersistedProjectInvalidError("schema internals", [])
        : options.errorKind === "persistence"
          ? new ProjectPersistenceError("SQL connection refused")
          : undefined,
    createError:
      options.createErrorKind === "name-conflict"
        ? new ProjectNameConflictPersistenceError()
        : options.createErrorKind === "persistence"
          ? new ProjectPersistenceError("SQL connection refused")
          : undefined,
    deleteError:
      options.deleteErrorKind === "persistence"
        ? new ProjectPersistenceError("constraint internals")
        : undefined
  });
  const geometryBuilder =
    options.geometryBuilder ??
    ({
      build: vi.fn<ProjectGeometryBuilder["build"]>(
        (project) =>
          options.geometryBuildResult ?? GeometryEngine.build(project)
      )
    } satisfies ProjectGeometryBuilder);
  const moduleReference = await Test.createTestingModule({
    imports: [AppModule]
  })
    .overrideProvider(RuntimePrismaService)
    .useValue(prisma)
    .overrideProvider(RuntimeOidcHealthService)
    .useValue(oidc)
    .overrideProvider(PROJECTS_REPOSITORY)
    .useValue(repository)
    .overrideProvider(PROJECT_GEOMETRY_BUILDER)
    .useValue(geometryBuilder)
    .compile();
  const app = moduleReference.createNestApplication();

  configureApiApplication(app, {
    enableShutdownHooks: false
  });
  await app.init();

  return {
    app,
    repository,
    geometryBuilder
  };
}

function createRepository(input: {
  readonly loadedProject?: LoadedProject | null;
  readonly error?: Error;
  readonly createError?: Error;
  readonly deleteError?: Error;
}): ProjectsRepository {
  let currentLoadedProject = input.loadedProject ?? null;

  return {
    findByDomainId: vi.fn<ProjectsRepository["findByDomainId"]>(),
    listProjectSummaries: vi.fn<ProjectsRepository["listProjectSummaries"]>(
      async () =>
        currentLoadedProject
          ? [
              {
                id: currentLoadedProject.project.id,
                name: currentLoadedProject.project.name,
                revision: currentLoadedProject.project.revision,
                updatedAt: currentLoadedProject.project.updatedAt,
                ownerSubject: currentLoadedProject.metadata.ownerSubject
              }
            ]
          : []
    ),
    projectNameExists: vi.fn<ProjectsRepository["projectNameExists"]>(
      async () => false
    ),
    createProject: vi.fn<ProjectsRepository["createProject"]>(
      async (project) => {
        if (input.createError) throw input.createError;
        return createLoadedProject(project);
      }
    ),
    replaceProject: vi.fn<ProjectsRepository["replaceProject"]>(
      async ({ project }) => ({
        status: "updated",
        loadedProject: createLoadedProject({
          ...project,
          revision: project.revision + 1,
          updatedAt: "2026-08-13T12:00:00.000Z"
        })
      })
    ),
    deleteProject: vi.fn<ProjectsRepository["deleteProject"]>(
      async ({ requiredOwnerSubject }) => {
        if (input.deleteError) throw input.deleteError;
        if (!currentLoadedProject) return { status: "not-found" };
        if (
          requiredOwnerSubject &&
          currentLoadedProject.metadata.ownerSubject !== requiredOwnerSubject
        ) {
          return { status: "forbidden" };
        }

        currentLoadedProject = null;
        return { status: "deleted" };
      }
    ),
    findLoadedByDomainId: vi.fn<ProjectsRepository["findLoadedByDomainId"]>(
      async () => {
        if (input.error) {
          throw input.error;
        }

        return currentLoadedProject;
      }
    )
  };
}

function createLoadedProject(project: Project): LoadedProject {
  const metadataDate = new Date("2026-08-04T10:00:00.000Z");

  return {
    project,
    metadata: {
      ownerSubject,
      createdBySubject: ownerSubject,
      updatedBySubject: ownerSubject,
      createdAt: metadataDate,
      updatedAt: metadataDate
    }
  };
}

function createNonFiniteGeometryBuildResult(
  project: Project
): GeometryBuildResult {
  const vertex = new Vertex("vertex:bad", Number.NaN, 0, () => []);
  const level = new LevelGeometry(
    "level:bad",
    "ground-floor",
    0,
    [vertex],
    [],
    [],
    [],
    []
  );

  return {
    ok: true,
    model: new GeometryModel(
      `geometry-model:${project.id}:${project.revision}`,
      project.id,
      project.revision,
      [level]
    )
  };
}

function createSigningKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048
  });
  const publicPem = publicKey.export({
    format: "pem",
    type: "spki"
  }) as string;
  const privatePem = privateKey.export({
    format: "pem",
    type: "pkcs8"
  });
  const keyId = "casastudio-test-key";

  return {
    publicPem,
    signToken: (options?: {
      readonly audience?: string;
      readonly email?: string;
      readonly expiresIn?: number;
      readonly issuer?: string;
      readonly roles?: readonly string[];
      readonly subject?: string;
      readonly username?: string;
    }) =>
      sign(
        {
          email: options?.email,
          preferred_username: options?.username ?? "demo",
          resource_access: {
            "casastudio-api": {
              roles: options?.roles ?? []
            }
          },
          sub: options?.subject ?? "demo-subject"
        },
        privatePem,
        {
          algorithm: "RS256",
          audience:
            options?.audience ?? defaultTestEnvironment.KEYCLOAK_AUDIENCE,
          expiresIn: options?.expiresIn ?? 300,
          issuer: options?.issuer ?? defaultTestEnvironment.KEYCLOAK_ISSUER,
          keyid: keyId
        }
      )
  };
}
