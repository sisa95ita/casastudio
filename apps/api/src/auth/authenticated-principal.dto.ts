import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Safe diagnostic representation of the authenticated caller.
 *
 * Raw tokens, refresh tokens, provider session state, and full JWT claims are
 * intentionally excluded from API responses.
 */
export class AuthenticatedPrincipalDto {
  @ApiProperty({ type: String })
  readonly subject!: string;

  @ApiPropertyOptional({ type: String })
  readonly username?: string;

  @ApiProperty({ type: [String] })
  readonly roles!: readonly string[];
}
