import { ConfigService } from "@nestjs/config";

import type { AppConfiguration } from "../config/app-configuration";
import { createApiApplication } from "./create-api-application";

/**
 * Starts the CasaStudio API HTTP server after configuration validation passes.
 *
 * The only process boundary concern left here is selecting the validated port;
 * all HTTP behavior is configured in `createApiApplication`.
 */
export async function bootstrapApi(): Promise<void> {
  const app = await createApiApplication();
  const configService = app.get(ConfigService<AppConfiguration, true>);
  const apiPort = configService.get("apiPort", { infer: true });

  await app.listen(apiPort);
}
