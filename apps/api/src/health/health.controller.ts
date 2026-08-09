import { Controller, Get, HttpStatus, Inject, Res } from "@nestjs/common";
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { HealthResponseDto, HealthStatus } from "./health.dto";
import { HealthService } from "./health.service";

/**
 * Public health probe controller.
 *
 * Health endpoints are deliberately unauthenticated: liveness is safe process
 * metadata, and readiness exposes only coarse dependency status for local
 * Compose, CI, and platform health checks.
 */
@ApiTags("health")
@Controller({
  path: "health",
  version: "1"
})
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get("live")
  @ApiOkResponse({ type: HealthResponseDto })
  getLiveness(): HealthResponseDto {
    return this.healthService.getLiveness();
  }

  @Get("ready")
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ type: HealthResponseDto })
  async getReadiness(@Res({ passthrough: true }) response: Response): Promise<HealthResponseDto> {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status === HealthStatus.Error) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return readiness;
  }
}
