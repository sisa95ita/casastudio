import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../persistence/prisma.service";
import { HealthStatus, type DependencyHealthDto, type HealthResponseDto } from "./health.dto";
import { OidcHealthService } from "./oidc-health.service";

/**
 * Computes public liveness and readiness probe responses.
 *
 * Liveness is process-only; readiness verifies infrastructure dependencies so
 * container orchestration and future CI do not send traffic before PostgreSQL,
 * migrations, and OIDC key discovery are available.
 */
@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService) private readonly prismaService: PrismaService,
    @Inject(OidcHealthService) private readonly oidcHealthService: OidcHealthService
  ) {}

  /**
   * Returns a dependency-free liveness response.
   */
  getLiveness(): HealthResponseDto {
    return {
      status: HealthStatus.Ok,
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime()
    };
  }

  /**
   * Checks all required readiness dependencies and reports their individual states.
   */
  async getReadiness(): Promise<HealthResponseDto> {
    const dependencies = await Promise.all([
      this.checkDependency("postgres", () => this.prismaService.verifyReady()),
      this.checkDependency("keycloak", () => this.oidcHealthService.verifyReady())
    ]);
    const status = dependencies.every((dependency) => dependency.status === HealthStatus.Ok)
      ? HealthStatus.Ok
      : HealthStatus.Error;

    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      dependencies
    };
  }

  private async checkDependency(
    name: string,
    verifyDependency: () => Promise<void>
  ): Promise<DependencyHealthDto> {
    try {
      await verifyDependency();

      return {
        name,
        status: HealthStatus.Ok
      };
    } catch {
      return {
        name,
        status: HealthStatus.Error,
        detail: `${name} readiness check failed`
      };
    }
  }
}
