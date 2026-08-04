import { SetMetadata } from "@nestjs/common";

import type { KeycloakRole } from "./keycloak-role";

/**
 * Metadata key used by the role guard to read required Keycloak client roles.
 */
export const requiredRolesMetadataKey = "casastudio:required-roles";

/**
 * Declares Keycloak client roles required by a protected route.
 *
 * The decorator is intentionally client-role focused; project ownership and
 * resource-specific authorization are deferred to later backend phases.
 */
export const Roles = (...roles: readonly KeycloakRole[]) =>
  SetMetadata(requiredRolesMetadataKey, roles);
