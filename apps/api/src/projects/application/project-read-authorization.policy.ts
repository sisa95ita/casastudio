import { Injectable } from "@nestjs/common";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { KeycloakRole } from "../../auth/keycloak-role";
import type { LoadedProjectMetadata } from "../persistence/project.repository";

/**
 * Authorizes read access to a loaded Project aggregate.
 *
 * Regular users may read only Projects whose persisted owner subject equals
 * their validated Keycloak `sub`; administrators may read any Project. The
 * policy never uses username, email, display names, or client-supplied owner IDs.
 */
@Injectable()
export class ProjectReadAuthorizationPolicy {
  /**
   * Returns the authorization decision for an authenticated Project read.
   */
  canReadProject(principal: AuthenticatedPrincipal, metadata: LoadedProjectMetadata): boolean {
    return this.isAdministrator(principal) || (this.isUser(principal) && metadata.ownerSubject === principal.subject);
  }

  /**
   * Identifies whether access was granted through the administrator override.
   */
  isAdministrator(principal: AuthenticatedPrincipal): boolean {
    return principal.roles.includes(KeycloakRole.Admin);
  }

  private isUser(principal: AuthenticatedPrincipal): boolean {
    return principal.roles.includes(KeycloakRole.User);
  }
}
