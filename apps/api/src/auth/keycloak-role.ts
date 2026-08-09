/**
 * Keycloak client roles accepted by the API authorization boundary.
 *
 * These roles are coarse client-level grants. Resource ownership and
 * domain-specific permissions are evaluated by the modules that own those
 * resources.
 */
export enum KeycloakRole {
  User = "casastudio-user",
  Admin = "casastudio-admin"
}
