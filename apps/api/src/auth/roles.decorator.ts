import { SetMetadata } from "@nestjs/common";

import type { KeycloakRole } from "./keycloak-role";

/**
 * Metadata key used by the role guard to read required Keycloak client roles.
 */
export const requiredRolesMetadataKey = "casastudio:required-roles";

/**
 * Declares Keycloak client roles required by a protected route.
 *
 * The decorator stores only coarse client-role requirements. Project ownership
 * and resource-specific authorization remain separate business-layer checks.
 */
export const Roles = (...roles: readonly KeycloakRole[]) =>
  SetMetadata(requiredRolesMetadataKey, roles);
