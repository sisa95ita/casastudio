import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";

import { ProblemDetailsDto } from "../common/problem-details/problem-details.dto";
import type { AuthenticatedPrincipal } from "./authenticated-principal";
import { AuthenticatedPrincipalDto } from "./authenticated-principal.dto";
import { CurrentPrincipal } from "./current-principal.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { KeycloakRole } from "./keycloak-role";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";

/**
 * Minimal protected authentication diagnostics for local stack verification.
 *
 * These endpoints prove bearer validation and client-role authorization without
 * creating project APIs or exposing provider token internals.
 */
@ApiTags("auth")
@ApiBearerAuth("bearer")
@Controller({
  path: "auth",
  version: "1"
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuthController {
  @Get("me")
  @ApiOkResponse({ type: AuthenticatedPrincipalDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  getCurrentPrincipal(
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ): AuthenticatedPrincipalDto {
    return toAuthenticatedPrincipalDto(principal);
  }

  @Get("admin")
  @Roles(KeycloakRole.Admin)
  @ApiOkResponse({ type: AuthenticatedPrincipalDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  getAdminDiagnostic(@CurrentPrincipal() principal: AuthenticatedPrincipal): AuthenticatedPrincipalDto {
    return toAuthenticatedPrincipalDto(principal);
  }
}

function toAuthenticatedPrincipalDto(principal: AuthenticatedPrincipal): AuthenticatedPrincipalDto {
  return {
    roles: principal.roles,
    subject: principal.subject,
    username: principal.username
  };
}
