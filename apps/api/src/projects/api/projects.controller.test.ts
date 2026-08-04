import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ProjectSchema, type Project } from "@casastudio/schema";
import { sign } from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import type { LoadedProject, ProjectsRepository } from "../persistence/project.repository";

const canonicalProjectUrl = new URL("../../../../../packages/schema/examples/project.json", import.meta.url);
const canonicalProject = ProjectSchema.parse(JSON.parse(readFileSync(canonicalProjectUrl, "utf8")));
const ownerSubject = "8d62f7e2-0c2a-4f2a-a9cf-7f62c2f4e8f7";
const defaultTestEnvironment = {
  NODE_ENV: "test",
  API_PORT: "3000",
  DATABASE_URL: "postgresql://localhost:5432/casastudio_test?schema=public",
  KEYCLOAK_BASE_URL: "http://localhost:8080",
  KEYCLOAK_REALM: "casastudio",
  KEYCLOAK_ISSUER: "http://issuer.test/realms/casastudio",
  KEYCLOAK_JWKS_URI: "http://localhost:8080/realms/casastudio/protocol/openid-connect/certs",
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
};

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

  it("returns the authoritative Project for its owner", async () => {
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
    expect(response.body.project.building.levels[0].rooms[1].boundary[0]).toEqual({
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
  });

  it("requires authentication", async () => {
    const context = await createTestApp({
      loadedProject: createLoadedProject(canonicalProject)
    });

    await request(context.app.getHttpServer()).get(`/api/v1/projects/${canonicalProject.id}`).expect(401);
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
          message: "Project ID must be a non-empty lowercase kebab-case identifier."
        }
      ]
    });
    expect(context.repository.findLoadedByDomainId).not.toHaveBeenCalled();

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
});

describe("Projects OpenAPI contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("documents the read-only Project endpoint without internal metadata or geometry APIs", async () => {
    const context = await createTestApp({
      environment: {
        NODE_ENV: "development"
      },
      loadedProject: createLoadedProject(canonicalProject)
    });

    const response = await request(context.app.getHttpServer()).get("/api/docs-json").expect(200);
    const documentJson = JSON.stringify(response.body);
    const operation = response.body.paths["/api/v1/projects/{id}"].get;
    const schemas = response.body.components.schemas;

    expect(operation).toBeDefined();
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
    expect(Object.keys(operation.responses)).toEqual(expect.arrayContaining(["200", "400", "401", "403", "404", "500"]));
    expect(schemas.ProjectResponseDto).toBeDefined();
    expect(documentJson).toContain("#/components/schemas/ProjectDto");
    expect(documentJson).toContain("#/components/schemas/BuildingDto");
    expect(documentJson).toContain("#/components/schemas/RoomBoundaryEdgeDto");
    expect(documentJson).toContain("#/components/schemas/RenderRequestDto");
    expect(documentJson).not.toContain("ownerSubject");
    expect(documentJson).not.toContain("createdBySubject");
    expect(documentJson).not.toContain("updatedBySubject");
    expect(documentJson).not.toContain('"projectId"');
    expect(Object.keys(response.body.paths).some((path) => path.includes("geometry"))).toBe(false);

    await context.app.close();
  });
});

async function createTestApp(options: {
  readonly loadedProject?: LoadedProject | null;
  readonly errorKind?: "persisted-invalid" | "persistence";
  readonly environment?: Record<string, string>;
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
  const { PrismaService: RuntimePrismaService } = await import("../../persistence/prisma.service");
  const { OidcHealthService: RuntimeOidcHealthService } = await import("../../health/oidc-health.service");
  const { PROJECTS_REPOSITORY } = await import("../persistence/projects-repository.token");
  const { PersistedProjectInvalidError, ProjectPersistenceError } = await import(
    "../persistence/project-persistence-error"
  );
  const { configureApiApplication } = await import("../../bootstrap/create-api-application");
  const repository = createRepository({
    loadedProject: options.loadedProject,
    error:
      options.errorKind === "persisted-invalid"
        ? new PersistedProjectInvalidError("schema internals", [])
        : options.errorKind === "persistence"
          ? new ProjectPersistenceError("SQL connection refused")
          : undefined
  });
  const moduleReference = await Test.createTestingModule({
    imports: [AppModule]
  })
    .overrideProvider(RuntimePrismaService)
    .useValue(prisma)
    .overrideProvider(RuntimeOidcHealthService)
    .useValue(oidc)
    .overrideProvider(PROJECTS_REPOSITORY)
    .useValue(repository)
    .compile();
  const app = moduleReference.createNestApplication();

  configureApiApplication(app, {
    enableShutdownHooks: false
  });
  await app.init();

  return {
    app,
    repository
  };
}

function createRepository(input: { readonly loadedProject?: LoadedProject | null; readonly error?: Error }): ProjectsRepository {
  return {
    findByDomainId: vi.fn<ProjectsRepository["findByDomainId"]>(),
    findLoadedByDomainId: vi.fn<ProjectsRepository["findLoadedByDomainId"]>(async () => {
      if (input.error) {
        throw input.error;
      }

      return input.loadedProject ?? null;
    })
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
          audience: options?.audience ?? defaultTestEnvironment.KEYCLOAK_AUDIENCE,
          expiresIn: options?.expiresIn ?? 300,
          issuer: options?.issuer ?? defaultTestEnvironment.KEYCLOAK_ISSUER,
          keyid: keyId
        }
      )
  };
}
