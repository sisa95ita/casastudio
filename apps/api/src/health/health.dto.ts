import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Public status values used by liveness, readiness, and dependency checks.
 */
export enum HealthStatus {
  Ok = "ok",
  Error = "error"
}

/**
 * Readiness result for one external dependency.
 *
 * Details are intentionally terse so callers can diagnose availability without
 * exposing credentials, connection strings, or provider internals.
 */
export class DependencyHealthDto {
  @ApiProperty({ type: String })
  readonly name!: string;

  @ApiProperty({ enum: HealthStatus, enumName: "HealthStatus" })
  readonly status!: HealthStatus;

  @ApiPropertyOptional({ type: String })
  readonly detail?: string;
}

/**
 * Stable response body for public health probes.
 *
 * Liveness never includes dependencies; readiness includes each dependency so
 * orchestration and CI hooks can distinguish database and identity failures.
 */
export class HealthResponseDto {
  @ApiProperty({ enum: HealthStatus, enumName: "HealthStatus" })
  readonly status!: HealthStatus;

  @ApiProperty({ type: String })
  readonly timestamp!: string;

  @ApiProperty({ type: Number })
  readonly uptimeSeconds!: number;

  @ApiPropertyOptional({ type: () => [DependencyHealthDto] })
  readonly dependencies?: readonly DependencyHealthDto[];
}
