import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { ProblemDetailsDto } from "../common/problem-details/problem-details.dto";
import type { AppConfiguration } from "../config/app-configuration";

/**
 * Installs the development OpenAPI document for infrastructure diagnostics.
 *
 * Swagger is intentionally gated by validated configuration so production
 * deployments default to no API explorer while local developers can paste a
 * Keycloak bearer token into the documented security scheme.
 */
export function setupSwagger(app: INestApplication, configuration: AppConfiguration): void {
  if (!configuration.swaggerEnabled) {
    return;
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle("CasaStudio API")
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Keycloak access token"
      },
      "bearer"
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    extraModels: [ProblemDetailsDto]
  });

  SwaggerModule.setup("api/docs", app, document);
}
