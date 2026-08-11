import { z } from "zod";

const booleanFromEnvironment = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value.toLowerCase())) {
    return false;
  }

  return value;
}, z.boolean());

const databaseUrlSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://"),
    {
      message: "DATABASE_URL must be a PostgreSQL connection URL"
    }
  );

const corsAllowedOriginsSchema = z
  .string()
  .default("http://localhost:5173,http://localhost:8081")
  .transform((value, context) => {
    const origins = value
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean);

    if (origins.length === 0 || origins.some((origin) => !URL.canParse(origin))) {
      context.addIssue({
        code: "custom",
        message: "CORS_ALLOWED_ORIGINS must contain comma-separated absolute URLs"
      });
      return z.NEVER;
    }

    return origins;
  });

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().int().positive().max(65535).default(3000),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  CORS_ALLOWED_ORIGINS: corsAllowedOriginsSchema,
  DATABASE_URL: databaseUrlSchema,
  KEYCLOAK_BASE_URL: z.url(),
  KEYCLOAK_REALM: z.string().min(1),
  KEYCLOAK_ISSUER: z.url(),
  KEYCLOAK_JWKS_URI: z.url(),
  KEYCLOAK_AUDIENCE: z.string().min(1),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  SWAGGER_ENABLED: booleanFromEnvironment.optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info")
});

type EnvironmentVariables = z.infer<typeof environmentSchema>;

/**
 * Central typed representation of the CasaStudio API runtime configuration.
 *
 * Production code receives this object through Nest's `ConfigService`; keeping
 * process environment parsing here makes missing infrastructure configuration
 * fail during startup instead of leaking into controllers, guards, or services.
 */
export type AppConfiguration = {
  readonly nodeEnv: "development" | "test" | "production";
  readonly apiPort: number;
  readonly apiHost: string;
  readonly databaseUrl: string;
  readonly corsAllowedOrigins: readonly string[];
  readonly keycloak: {
    readonly baseUrl: string;
    readonly realm: string;
    readonly issuer: string;
    readonly jwksUri: string;
    readonly audience: string;
    readonly clientId: string;
  };
  readonly swaggerEnabled: boolean;
  readonly logLevel:
    "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
};

/**
 * Validates raw environment values and maps them to the API configuration.
 *
 * Swagger defaults to enabled outside production to keep local development
 * discoverable while making the production default intentionally closed.
 */
export function createValidatedConfiguration(
  rawEnvironment: Record<string, unknown>
): AppConfiguration {
  const environment = environmentSchema.parse(rawEnvironment);

  return mapEnvironmentToConfiguration(environment);
}

function mapEnvironmentToConfiguration(
  environment: EnvironmentVariables
): AppConfiguration {
  return {
    nodeEnv: environment.NODE_ENV,
    apiPort: environment.API_PORT,
    apiHost: environment.API_HOST,
    databaseUrl: environment.DATABASE_URL,
    corsAllowedOrigins: environment.CORS_ALLOWED_ORIGINS,
    keycloak: {
      baseUrl: environment.KEYCLOAK_BASE_URL,
      realm: environment.KEYCLOAK_REALM,
      issuer: environment.KEYCLOAK_ISSUER,
      jwksUri: environment.KEYCLOAK_JWKS_URI,
      audience: environment.KEYCLOAK_AUDIENCE,
      clientId: environment.KEYCLOAK_CLIENT_ID
    },
    swaggerEnabled:
      environment.SWAGGER_ENABLED ?? environment.NODE_ENV !== "production",
    logLevel: environment.LOG_LEVEL
  };
}
