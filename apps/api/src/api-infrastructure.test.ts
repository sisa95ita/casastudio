import { generateKeyPairSync } from "node:crypto";

import { Controller, Get, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { sign } from "jsonwebtoken";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { configureApiApplication } from "./bootstrap/create-api-application";
import { ApiErrorCode } from "./common/problem-details/api-error-code";
import { createValidatedConfiguration } from "./config/app-configuration";
import { apiEnvironmentFilePaths } from "./config/environment-files";
import { principalFromKeycloakClaims } from "./auth/keycloak-claims";
import { HealthStatus } from "./health/health.dto";
import { PrismaService } from "./persistence/prisma.service";

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
  readonly prisma: DependencyMock;
  readonly oidc: DependencyMock;
};

@Controller({
  path: "diagnostics",
  version: "1"
})
class TestDiagnosticsController {
  @Get("explode")
  explode(): void {
    throw new Error("leaked internal failure");
  }
}

@Module({
  controllers: [TestDiagnosticsController]
})
class TestDiagnosticsModule {}

describe("API configuration", () => {
  it("accepts a valid environment", () => {
    expect(createValidatedConfiguration(defaultTestEnvironment)).toMatchObject({
      apiPort: 3000,
      apiHost: "0.0.0.0",
      corsAllowedOrigins: ["http://localhost:5173", "http://localhost:8081"],
      databaseUrl: defaultTestEnvironment.DATABASE_URL,
      keycloak: {
        audience: "casastudio-api",
        clientId: "casastudio-api"
      },
      swaggerEnabled: true
    });
  });

  it("rejects missing required variables", () => {
    const environment: Record<string, string> = { ...defaultTestEnvironment };
    delete environment.DATABASE_URL;

    expect(() => createValidatedConfiguration(environment)).toThrow();
  });

  it("disables Swagger by default in production", () => {
    expect(
      createValidatedConfiguration({
        ...defaultTestEnvironment,
        NODE_ENV: "production"
      }).swaggerEnabled
    ).toBe(false);
  });

  it("loads the ignored root local override before repository defaults", () => {
    expect(apiEnvironmentFilePaths[0]).toMatch(/\.env\.local$/);
    expect(apiEnvironmentFilePaths[1]).toMatch(/\.env$/);
  });

  it("accepts explicit private-network service URLs and CORS origins", () => {
    const configuration = createValidatedConfiguration({
      ...defaultTestEnvironment,
      KEYCLOAK_BASE_URL: "http://192.0.2.10:8080",
      KEYCLOAK_ISSUER: "http://192.0.2.10:8080/realms/casastudio",
      CORS_ALLOWED_ORIGINS: "http://localhost:5173,http://192.0.2.10:5173"
    });

    expect(configuration.keycloak.baseUrl).toBe("http://192.0.2.10:8080");
    expect(configuration.corsAllowedOrigins).toEqual([
      "http://localhost:5173",
      "http://192.0.2.10:5173"
    ]);
  });
});

describe("CORS", () => {
  it("allows the explicit local Vite origin and bearer header", async () => {
    const context = await createTestApp();

    const response = await request(context.app.getHttpServer())
      .options("/api/v1/health/live")
      .set("origin", "http://localhost:5173")
      .set("access-control-request-method", "GET")
      .set("access-control-request-headers", "authorization")
      .expect(204);

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-headers"]).toContain("Authorization");

    await context.app.close();
  });

  it("allows authenticated Project creation and replacement methods", async () => {
    const context = await createTestApp();

    const response = await request(context.app.getHttpServer())
      .options("/api/v1/projects/demo-project")
      .set("origin", "http://localhost:5173")
      .set("access-control-request-method", "PUT")
      .set("access-control-request-headers", "authorization,content-type")
      .expect(204);

    expect(response.headers["access-control-allow-methods"]).toContain("POST");
    expect(response.headers["access-control-allow-methods"]).toContain("PUT");
    expect(response.headers["access-control-allow-headers"]).toContain("Authorization");
    expect(response.headers["access-control-allow-headers"]).toContain("Content-Type");

    await context.app.close();
  });

  it("allows a configured LAN frontend origin explicitly", async () => {
    const context = await createTestApp({
      environment: {
        CORS_ALLOWED_ORIGINS: "http://localhost:5173,http://192.0.2.10:5173"
      }
    });

    const response = await request(context.app.getHttpServer())
      .options("/api/v1/health/live")
      .set("origin", "http://192.0.2.10:5173")
      .set("access-control-request-method", "GET")
      .expect(204);

    expect(response.headers["access-control-allow-origin"]).toBe("http://192.0.2.10:5173");
    await context.app.close();
  });

  it("does not allow an unrelated frontend origin", async () => {
    const context = await createTestApp();

    const response = await request(context.app.getHttpServer())
      .options("/api/v1/health/live")
      .set("origin", "http://unrelated.example")
      .set("access-control-request-method", "GET")
      .expect(204);

    expect(response.headers).not.toHaveProperty("access-control-allow-origin");
    await context.app.close();
  });
});

describe("health endpoints", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports liveness without checking dependencies", async () => {
    const context = await createTestApp();
    context.prisma.verifyReady.mockRejectedValue(new Error("database unavailable"));

    const response = await request(context.app.getHttpServer()).get("/api/v1/health/live");

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.status).toBe(HealthStatus.Ok);
    expect(context.prisma.verifyReady).not.toHaveBeenCalled();

    await context.app.close();
  });

  it("reports readiness when dependencies are available", async () => {
    const context = await createTestApp();

    const response = await request(context.app.getHttpServer()).get("/api/v1/health/ready").expect(200);

    expect(response.body).toMatchObject({
      status: HealthStatus.Ok,
      dependencies: [
        { name: "postgres", status: HealthStatus.Ok },
        { name: "keycloak", status: HealthStatus.Ok }
      ]
    });

    await context.app.close();
  });

  it("returns 503 when PostgreSQL is unavailable", async () => {
    const context = await createTestApp();
    context.prisma.verifyReady.mockRejectedValue(new Error("database unavailable"));

    const response = await request(context.app.getHttpServer()).get("/api/v1/health/ready").expect(503);

    expect(response.body).toMatchObject({
      status: HealthStatus.Error,
      dependencies: [
        { name: "postgres", status: HealthStatus.Error },
        { name: "keycloak", status: HealthStatus.Ok }
      ]
    });

    await context.app.close();
  });

  it("returns 503 when Keycloak JWKS is unavailable", async () => {
    const context = await createTestApp();
    context.oidc.verifyReady.mockRejectedValue(new Error("jwks unavailable"));

    const response = await request(context.app.getHttpServer()).get("/api/v1/health/ready").expect(503);

    expect(response.body).toMatchObject({
      status: HealthStatus.Error,
      dependencies: [
        { name: "postgres", status: HealthStatus.Ok },
        { name: "keycloak", status: HealthStatus.Error }
      ]
    });

    await context.app.close();
  });
});

describe("Problem Details", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes unknown routes and propagates request IDs", async () => {
    const context = await createTestApp();

    const response = await request(context.app.getHttpServer())
      .get("/api/v1/missing")
      .set("x-request-id", "request-test-id")
      .expect(404);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.InvalidRequest,
      requestId: "request-test-id",
      status: 404
    });

    await context.app.close();
  });

  it("normalizes unauthorized responses", async () => {
    const context = await createTestApp();

    const response = await request(context.app.getHttpServer()).get("/api/v1/auth/me").expect(401);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.Unauthorized,
      status: 401
    });

    await context.app.close();
  });

  it("sanitizes unexpected exceptions", async () => {
    const context = await createTestApp({
      extraImports: [TestDiagnosticsModule]
    });

    const response = await request(context.app.getHttpServer())
      .get("/api/v1/diagnostics/explode")
      .expect(500);

    expect(response.body).toMatchObject({
      code: ApiErrorCode.InternalServerError,
      detail: "An unexpected error occurred.",
      status: 500
    });
    expect(JSON.stringify(response.body)).not.toContain("leaked internal failure");

    await context.app.close();
  });
});

describe("authentication and authorization", () => {
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

  it("accepts a valid JWT and returns safe claims only", async () => {
    const context = await createTestApp();
    const token = signingKeys.signToken({
      roles: ["casastudio-user"]
    });

    const response = await request(context.app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      roles: ["casastudio-user"],
      subject: "demo-subject",
      username: "demo"
    });
    expect(response.body).not.toHaveProperty("email");
    expect(response.body).not.toHaveProperty("resource_access");

    await context.app.close();
  });

  it("rejects invalid signatures", async () => {
    const context = await createTestApp();
    const invalidSigningKeys = createSigningKeys();

    await request(context.app.getHttpServer())
      .get("/api/v1/auth/me")
      .set(
        "authorization",
        `Bearer ${invalidSigningKeys.signToken({
          roles: ["casastudio-user"]
        })}`
      )
      .expect(401);

    await context.app.close();
  });

  it("rejects a wrong issuer", async () => {
    const context = await createTestApp();

    await request(context.app.getHttpServer())
      .get("/api/v1/auth/me")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          issuer: "http://wrong-issuer.test/realms/casastudio",
          roles: ["casastudio-user"]
        })}`
      )
      .expect(401);

    await context.app.close();
  });

  it("rejects a wrong audience", async () => {
    const context = await createTestApp();

    await request(context.app.getHttpServer())
      .get("/api/v1/auth/me")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          audience: "wrong-audience",
          roles: ["casastudio-user"]
        })}`
      )
      .expect(401);

    await context.app.close();
  });

  it("rejects a token with authorized party but no configured audience", async () => {
    const context = await createTestApp();

    await request(context.app.getHttpServer())
      .get("/api/v1/auth/me")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          authorizedParty: "casastudio-api",
          includeAudience: false,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(401);

    await context.app.close();
  });

  it("rejects expired tokens", async () => {
    const context = await createTestApp();

    await request(context.app.getHttpServer())
      .get("/api/v1/auth/me")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          expiresIn: -30,
          roles: ["casastudio-user"]
        })}`
      )
      .expect(401);

    await context.app.close();
  });

  it("allows and denies role-guarded diagnostics", async () => {
    const context = await createTestApp();

    await request(context.app.getHttpServer())
      .get("/api/v1/auth/admin")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          roles: ["casastudio-user"]
        })}`
      )
      .expect(403);

    await request(context.app.getHttpServer())
      .get("/api/v1/auth/admin")
      .set(
        "authorization",
        `Bearer ${signingKeys.signToken({
          roles: ["casastudio-user", "casastudio-admin"]
        })}`
      )
      .expect(200);

    await context.app.close();
  });

  it("extracts only configured client roles", () => {
    expect(
      principalFromKeycloakClaims(
        {
          sub: "subject",
          resource_access: {
            "other-client": {
              roles: ["casastudio-admin"]
            },
            "casastudio-api": {
              roles: ["casastudio-user"]
            }
          }
        },
        "casastudio-api"
      ).roles
    ).toEqual(["casastudio-user"]);
  });
});

describe("OpenAPI", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is enabled in development with bearer security", async () => {
    const context = await createTestApp({
      environment: {
        NODE_ENV: "development"
      }
    });

    const response = await request(context.app.getHttpServer()).get("/api/docs-json").expect(200);

    expect(response.body.components.securitySchemes.bearer).toMatchObject({
      bearerFormat: "JWT",
      scheme: "bearer",
      type: "http"
    });

    await context.app.close();
  });

  it("is disabled in production by default", async () => {
    const context = await createTestApp({
      environment: {
        NODE_ENV: "production"
      }
    });

    await request(context.app.getHttpServer()).get("/api/docs-json").expect(404);

    await context.app.close();
  });
});

describe("PrismaService", () => {
  it("connects and disconnects through Nest lifecycle hooks", async () => {
    const service = new PrismaService(createConfigServiceMock());
    const connect = vi.spyOn(service, "$connect").mockResolvedValue(undefined);
    const disconnect = vi.spyOn(service, "$disconnect").mockResolvedValue(undefined);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});

async function createTestApp(options?: {
  readonly environment?: Record<string, string>;
  readonly extraImports?: readonly unknown[];
}): Promise<TestAppContext> {
  const prisma: DependencyMock = {
    verifyReady: vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  };
  const oidc: DependencyMock = {
    verifyReady: vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  };

  for (const [key, value] of Object.entries({
    ...defaultTestEnvironment,
    ...options?.environment
  })) {
    vi.stubEnv(key, value);
  }
  vi.stubEnv("SWAGGER_ENABLED", options?.environment?.SWAGGER_ENABLED);

  vi.resetModules();
  const { AppModule } = await import("./app.module");
  const { PrismaService: RuntimePrismaService } = await import("./persistence/prisma.service");
  const { OidcHealthService: RuntimeOidcHealthService } = await import("./health/oidc-health.service");
  const moduleReference = await Test.createTestingModule({
    imports: [AppModule, ...(options?.extraImports ?? [])]
  })
    .overrideProvider(RuntimePrismaService)
    .useValue(prisma)
    .overrideProvider(RuntimeOidcHealthService)
    .useValue(oidc)
    .compile();
  const app = moduleReference.createNestApplication();

  configureApiApplication(app, {
    enableShutdownHooks: false
  });
  await app.init();

  return {
    app,
    oidc,
    prisma
  };
}

function createConfigServiceMock(): ConstructorParameters<typeof PrismaService>[0] {
  return {
    get: (key: keyof ReturnType<typeof createValidatedConfiguration>) => {
      const configuration = createValidatedConfiguration(defaultTestEnvironment);

      return configuration[key];
    }
  } as ConstructorParameters<typeof PrismaService>[0];
}

function createSigningKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048
  });
  const publicJwk = publicKey.export({
    format: "jwk"
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
    publicJwk: {
      ...publicJwk,
      alg: "RS256",
      kid: keyId,
      use: "sig"
    },
    publicPem,
    signToken: (options?: {
      readonly audience?: string;
      readonly authorizedParty?: string;
      readonly expiresIn?: number;
      readonly includeAudience?: boolean;
      readonly issuer?: string;
      readonly roles?: readonly string[];
    }) =>
      sign(
        {
          azp: options?.authorizedParty,
          preferred_username: "demo",
          resource_access: {
            "casastudio-api": {
              roles: options?.roles ?? []
            }
          },
          sub: "demo-subject"
        },
        privatePem,
        {
          algorithm: "RS256",
          expiresIn: options?.expiresIn ?? 300,
          issuer: options?.issuer ?? defaultTestEnvironment.KEYCLOAK_ISSUER,
          keyid: keyId,
          ...(options?.includeAudience === false
            ? {}
            : { audience: options?.audience ?? defaultTestEnvironment.KEYCLOAK_AUDIENCE })
        }
      )
  };
}
