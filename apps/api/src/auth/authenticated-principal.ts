/**
 * Authenticated API caller derived from a validated OIDC access token.
 *
 * The contract deliberately exposes only stable identity and Keycloak client
 * roles; controllers must not depend on raw token claims or provider internals.
 */
export type AuthenticatedPrincipal = {
  readonly subject: string;
  readonly username?: string;
  readonly email?: string;
  readonly roles: readonly string[];
};
