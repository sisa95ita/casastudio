import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { ApiErrorCode } from "./api-error-code";

/**
 * Nested validation or dependency error item in a Problem Details response.
 *
 * The structure is intentionally generic so future schema and geometry errors
 * can report field paths without changing the top-level envelope.
 */
export class ProblemDetailItemDto {
  @ApiProperty({ type: String })
  readonly path!: string;

  @ApiProperty({ type: String })
  readonly message!: string;
}

/**
 * RFC 9457-style API error envelope returned by the global exception filter.
 *
 * The API never exposes stack traces or raw provider errors in this shape; a
 * correlation ID connects sanitized responses to structured server logs.
 */
export class ProblemDetailsDto {
  @ApiProperty({ type: String })
  readonly type!: string;

  @ApiProperty({ type: String })
  readonly title!: string;

  @ApiProperty({ type: Number })
  readonly status!: number;

  @ApiProperty({ type: String })
  readonly detail!: string;

  @ApiPropertyOptional({ type: String })
  readonly instance?: string;

  @ApiProperty({ enum: ApiErrorCode, enumName: "ApiErrorCode" })
  readonly code!: ApiErrorCode;

  @ApiPropertyOptional({ type: String })
  readonly requestId?: string;

  @ApiPropertyOptional({ type: () => [ProblemDetailItemDto] })
  readonly errors?: readonly ProblemDetailItemDto[];
}
