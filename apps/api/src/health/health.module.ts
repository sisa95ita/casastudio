import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { PersistenceModule } from "../persistence/persistence.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { OidcHealthService } from "./oidc-health.service";

/**
 * Public liveness and readiness module for infrastructure orchestration.
 *
 * Readiness depends on persistence and OIDC health services; liveness remains
 * dependency-free by controller contract.
 */
@Module({
  controllers: [HealthController],
  imports: [PersistenceModule, TerminusModule],
  providers: [HealthService, OidcHealthService]
})
export class HealthModule {}
