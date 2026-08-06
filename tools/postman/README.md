# CasaStudio Postman Collection

This folder contains a safe local-development Postman collection for the
CasaStudio API.

Import:

- `CasaStudio API.postman_collection.json`
- `CasaStudio Local.postman_environment.json`

Select the `CasaStudio Local` environment. On the collection Authorization tab,
request an OAuth 2.0 token with Authorization Code Flow with PKCE. The
collection is configured for:

- Auth URL: `{{keycloakBaseUrl}}/realms/{{realm}}/protocol/openid-connect/auth`
- Access Token URL: `{{keycloakBaseUrl}}/realms/{{realm}}/protocol/openid-connect/token`
- Client ID: `casastudio-web`
- Client authentication: none
- PKCE challenge method: S256
- Scope: `openid`
- Callback URL: `https://oauth.pstmn.io/v1/browser-callback`

The callback URL is the Postman browser-auth callback documented by Postman for
returning an Authorization Code flow from the system browser back to Postman. It
is registered in the local Keycloak realm for `casastudio-web` and is not added
as a web origin.

The token endpoint is still used by Postman to exchange the authorization code
for tokens. Direct Access Grants are disabled, which disables the password grant
only; users authenticate on Keycloak's page instead of giving credentials to
Postman scripts.

Do not commit tokens. Postman OAuth tokens are local user state. The collection
and environment intentionally contain no passwords, client secrets, access
tokens, refresh tokens, or admin credentials.

Swagger remains the authoritative API contract. This collection is an executable
development aid for common local checks, not a replacement for OpenAPI.
