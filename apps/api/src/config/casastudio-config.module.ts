import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { createValidatedConfiguration } from "./app-configuration";

/**
 * Owns environment loading and validation for the API process.
 *
 * Runtime modules depend on Nest configuration injection rather than reading
 * `process.env`, which keeps secret handling and required infrastructure
 * validation centralized.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      ignoreEnvFile: shouldIgnoreEnvironmentFiles(),
      isGlobal: true,
      validate: createValidatedConfiguration
    })
  ]
})
export class CasaStudioConfigModule {}

/**
 * Keeps tests hermetic while allowing runtime processes to load local `.env`
 * files through the central configuration boundary.
 */
function shouldIgnoreEnvironmentFiles(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}
