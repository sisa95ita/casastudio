import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { AuthModule } from "./auth/auth.module";
import { StructuredLoggingModule } from "./bootstrap/logging.module";
import { ProblemDetailsFilter } from "./common/problem-details/problem-details.filter";
import { CasaStudioConfigModule } from "./config/casastudio-config.module";
import { HealthModule } from "./health/health.module";

/**
 * Root Nest module for CasaStudio API infrastructure.
 *
 * Phase 1A registers only cross-cutting infrastructure modules: configuration,
 * structured logging, health/readiness, persistence lifecycle, Problem Details,
 * and authentication diagnostics. Business modules arrive in later phases.
 */
@Module({
  imports: [CasaStudioConfigModule, StructuredLoggingModule, HealthModule, AuthModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ProblemDetailsFilter
    }
  ]
})
export class AppModule {}
