import { UnauthorizedException } from "@nestjs/common";

import type { AuthenticatedPrincipal } from "./authenticated-principal";

type KeycloakResourceAccess = Record<string, { readonly roles?: unknown } | undefined>;

/**
 * Minimal validated shape the API accepts from Keycloak access tokens.
 */
export type KeycloakJwtPayload = {
  readonly sub?: unknown;
  readonly preferred_username?: unknown;
  readonly email?: unknown;
  readonly resource_access?: unknown;
};

/**
 * Builds an authenticated principal from validated OIDC JWT claims.
 *
 * Role extraction is limited to the configured Keycloak client resource so
 * realm-wide roles do not accidentally become API authorization decisions.
 */
export function principalFromKeycloakClaims(
  payload: KeycloakJwtPayload,
  clientId: string
): AuthenticatedPrincipal {
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new UnauthorizedException("Token subject is missing.");
  }

  return {
    subject: payload.sub,
    username: optionalString(payload.preferred_username),
    email: optionalString(payload.email),
    roles: extractClientRoles(payload.resource_access, clientId)
  };
}

function extractClientRoles(resourceAccess: unknown, clientId: string): readonly string[] {
  if (!isRecord(resourceAccess)) {
    return [];
  }

  const clientAccess = (resourceAccess as KeycloakResourceAccess)[clientId];

  if (!clientAccess || !Array.isArray(clientAccess.roles)) {
    return [];
  }

  return clientAccess.roles.filter((role): role is string => typeof role === "string");
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
