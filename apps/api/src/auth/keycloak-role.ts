/**
 * Keycloak client roles understood by the Phase 1A authorization foundation.
 *
 * Project ownership and domain-specific permissions are intentionally deferred;
 * these roles only prove that client-role extraction and role guarding work.
 */
export enum KeycloakRole {
  User = "casastudio-user",
  Admin = "casastudio-admin"
}
