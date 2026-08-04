import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { AuthModule } from "./auth/auth.module";
import { StructuredLoggingModule } from "./bootstrap/logging.module";
import { ProblemDetailsFilter } from "./common/problem-details/problem-details.filter";
import { CasaStudioConfigModule } from "./config/casastudio-config.module";
import { HealthModule } from "./health/health.module";
import { ProjectsModule } from "./projects/projects.module";

/**
 * Root Nest module for CasaStudio API infrastructure.
 *
 * It registers cross-cutting infrastructure plus internal feature modules that
 * expose application services without adding HTTP project endpoints at the root
 * boundary.
 */
@Module({
  imports: [CasaStudioConfigModule, StructuredLoggingModule, HealthModule, AuthModule, ProjectsModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ProblemDetailsFilter
    }
  ]
})
export class AppModule {}
