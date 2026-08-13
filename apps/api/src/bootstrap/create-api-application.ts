import { ValidationPipe, VersioningType, type INestApplication, type Type } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";

import type { AppConfiguration } from "../config/app-configuration";
import { setupSwagger } from "./swagger";

/**
 * Runtime switches for configuring a Nest API application instance.
 */
export type ApiApplicationOptions = {
  readonly enableShutdownHooks?: boolean;
};

/**
 * Applies CasaStudio's global HTTP API behavior to a Nest application.
 *
 * URI versioning is installed after the `/api` global prefix, producing routes
 * such as `/api/v1/health/live` without requiring every controller path to
 * manually include a version segment.
 */
export function configureApiApplication(
  app: INestApplication,
  options: ApiApplicationOptions = {}
): AppConfiguration {
  const configuration = readAppConfiguration(app.get(ConfigService<AppConfiguration, true>));

  app.useLogger(app.get(Logger));
  app.enableCors({
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    origin: configuration.corsAllowedOrigins
  });
  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1"
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true
    })
  );
  if (options.enableShutdownHooks ?? true) {
    app.enableShutdownHooks();
  }
  setupSwagger(app, configuration);

  return configuration;
}

/**
 * Builds the validated configuration object from Nest's typed config service.
 */
export function readAppConfiguration(
  configService: ConfigService<AppConfiguration, true>
): AppConfiguration {
  return {
    nodeEnv: configService.get("nodeEnv", { infer: true }),
    apiPort: configService.get("apiPort", { infer: true }),
    apiHost: configService.get("apiHost", { infer: true }),
    databaseUrl: configService.get("databaseUrl", { infer: true }),
    corsAllowedOrigins: configService.get("corsAllowedOrigins", { infer: true }),
    keycloak: configService.get("keycloak", { infer: true }),
    swaggerEnabled: configService.get("swaggerEnabled", { infer: true }),
    logLevel: configService.get("logLevel", { infer: true })
  };
}

/**
 * Creates a configured API app for tests and for the process entrypoint.
 */
export async function createApiApplication(appModule?: Type<unknown>): Promise<INestApplication> {
  const { NestFactory } = await import("@nestjs/core");
  const rootModule = appModule ?? (await import("../app.module")).AppModule;
  const app = await NestFactory.create(rootModule, {
    bufferLogs: true
  });

  configureApiApplication(app);

  return app;
}
