# Backend Foundation Phase 1C

## Purpose

Phase 1C introduces the first authoritative read-only Project HTTP API backed by
the normalized relational persistence from Phase 1B.

The only Project business endpoint in this phase is:

```text
GET /api/v1/projects/:id
```

No Project creation, update, deletion, listing, workspace endpoint, geometry
endpoint, frontend integration, generated client, revision history, or
Geometry Engine execution is included.

## Endpoint Contract

`GET /api/v1/projects/:id` returns the current persisted Project by CasaStudio
domain ID.

The response envelope is:

```json
{
  "project": {},
  "sourceRevision": 1
}
```

`project` is an explicit backend-owned transport representation of the
canonical ProjectSchema `2.0.0` Project. `sourceRevision` is the authoritative
persisted Project revision used as the response source and must equal
`project.revision`.

The endpoint does not expose Prisma technical UUIDs, `ownerSubject`,
`createdBySubject`, `updatedBySubject`, database row timestamps, SQL details, or
runtime geometry data.

## Authentication

The endpoint is protected by the existing Keycloak JWT Passport strategy and
the existing `JwtAuthGuard`.

Missing, malformed, invalid, expired, wrong-issuer, and wrong-audience bearer
tokens return `401 Unauthorized` through the shared Problem Details filter.
Controllers receive the sanitized `AuthenticatedPrincipal`; they do not parse
JWTs or inspect raw token claims.

## Authorization

Project ownership is evaluated after the persistence root metadata is loaded.

Policy:

| Role | Access |
| --- | --- |
| `casastudio-user` | May read only when `principal.subject === metadata.ownerSubject`. |
| `casastudio-admin` | May read any Project. |

Authorization uses the validated Keycloak `sub` only. Username, email, display
name, token presentation fields, and client-provided owner IDs are not
authorization inputs.

When a Project exists but the authenticated caller is neither its owner nor an
administrator, the endpoint returns `403 Forbidden`. Missing Projects return
`404 Not Found`.

## DTO Architecture

The API owns explicit DTO classes under `apps/api/src/projects/api`.

The transport hierarchy covers the current canonical schema entities:

- `Project`
- `Building`
- `Level`
- `Room`
- `RoomBoundaryEdge`
- `Wall`
- `Opening`
- `Staircase`
- `StairFlight`
- `StairLanding`
- `Viewpoint`
- `BaseImage`
- `DesignBrief`
- `RenderRequest`
- `RenderResult`

DTO classes are separate from Prisma models and separate from schema package
runtime objects. They preserve canonical domain IDs, enum values, units,
revision, ISO timestamp strings, optional fields, and deterministic array order.

## Mapper Boundary

`ProjectApiMapper` maps:

```text
canonical Project
        ↓
ProjectResponseDto
```

The mapper has no Prisma dependency, no request dependency, no Geometry Engine
dependency, and no controller-specific logic. It creates fresh response objects
and preserves room-boundary order and direction.

## Repository Metadata Loading

The `ProjectsRepository` contract still supports:

```ts
findByDomainId(projectId: string)
```

Phase 1C adds:

```ts
findLoadedByDomainId(projectId: string)
```

The loaded result contains the validated canonical Project plus internal
metadata needed for authorization:

- `ownerSubject`
- `createdBySubject`
- `updatedBySubject`
- database `createdAt`
- database `updatedAt`

The metadata wrapper does not alter the canonical Project and is not serialized
to clients.

## Problem Details

Project read failures use RFC 9457-style Problem Details through the global
filter.

| Scenario | HTTP status | Code |
| --- | --- | --- |
| Invalid Project ID | `400` | `PROJECT_ID_INVALID` |
| Missing/invalid token | `401` | existing `UNAUTHORIZED` |
| Existing Project, forbidden caller | `403` | `PROJECT_ACCESS_FORBIDDEN` |
| Missing Project | `404` | `PROJECT_NOT_FOUND` |
| Invalid persisted aggregate | `500` | `PROJECT_PERSISTED_STATE_INVALID` |
| Repository/database failure | `500` | `PROJECT_READ_FAILED` |

Client responses do not expose SQL, table names, Prisma internals, stack
traces, owner subjects, schema internals, tokens, or secrets. Internal causes
remain attached to application errors and are logged for server-side diagnosis.

## Route Validation

`:id` is validated with the schema package `IdentifierSchema` before repository
access. Invalid identifiers return `400 Bad Request` with safe validation
details and `PROJECT_ID_INVALID`.

The documented identifier format is lowercase kebab-case:

```text
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

The canonical seeded Project domain ID is:

```text
casa-studio-canonical-project
```

## Swagger And OpenAPI

Swagger remains enabled only when the validated configuration enables it, which
defaults to non-production environments.

The OpenAPI document includes:

- bearer authentication using the existing `bearer` security scheme;
- `GET /api/v1/projects/{id}`;
- required path parameter documentation;
- `ProjectResponseDto` and nested DTO schemas;
- `400`, `401`, `403`, `404`, and `500` Problem Details responses.

The OpenAPI contract does not include Project ownership metadata, Prisma
technical IDs as transport fields, `/geometry`, or `/workspace`.

## Logging

Project read authorization logs use safe structured fields:

- `projectId`
- `principalSubject`
- `authorizedByRole`

Forbidden reads are logged at warning level. Successful reads are debug-level.
Bearer tokens, complete principals, owner subjects in client-visible errors,
Project payloads, and Prisma records are not logged by the use case.

The existing Pino HTTP configuration continues to redact authorization headers
and preserve request correlation IDs.

## Tests

Unit tests cover:

- application service success and error mapping;
- owner policy;
- administrator override;
- role requirement for owner reads;
- DTO mapper fidelity and revision invariant;
- route parameter validation;
- sanitized application error codes.

HTTP/OpenAPI tests cover:

- authenticated owner success;
- `401` for missing and invalid bearer tokens;
- `403` for non-owner users;
- administrator access to non-owned Projects;
- username/email non-ownership behavior;
- malformed Project ID rejection before repository access;
- `404` for unknown valid IDs;
- corrupted persisted aggregate mapping;
- repository failure mapping;
- generated OpenAPI path, security, responses, nested DTO refs, and absence of
  geometry endpoints/internal metadata.

PostgreSQL-backed persistence tests cover loaded authorization metadata when
`DATABASE_URL` is available.

## Local Verification

Run static and unit checks:

```bash
pnpm --filter @casastudio/api lint
pnpm --filter @casastudio/api test
pnpm --filter @casastudio/api build
pnpm --filter @casastudio/api prisma validate
pnpm --filter @casastudio/api prisma generate
pnpm lint
pnpm test
pnpm build
```

Validate Compose configuration:

```bash
docker compose config
docker compose -f compose.yml -f compose.dev.yml config
docker compose -f compose.yml -f compose.test.yml config
```

Hybrid verification:

```bash
docker compose -f compose.yml -f compose.dev.yml up -d postgres keycloak
pnpm --filter @casastudio/api dev
```

Obtain a local development token without printing it in reports, then verify:

```bash
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/projects/casa-studio-canonical-project
curl -i http://localhost:3000/api/v1/projects/casa-studio-canonical-project
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/projects/unknown-project
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/projects/CasaStudio
curl http://localhost:3000/api/docs-json
```

Fully containerized verification:

```bash
docker compose -f compose.yml -f compose.dev.yml up --build
curl http://localhost:3000/api/v1/health/live
curl http://localhost:3000/api/v1/health/ready
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/projects/casa-studio-canonical-project
```

Do not include bearer token values in logs, documentation, reports, or commits.

## Known Limitations

- Only the current revision is readable.
- There is no Project create, update, delete, list, or search API.
- There is no optimistic concurrency, conflict handling, audit log, or revision
  history.
- There is no project sharing or membership model.
- There is no frontend integration or generated API client.
- Persistence corruption is reported as a sanitized server error.
- PostgreSQL-backed HTTP tests require a configured test database.

## Deferred To Phase 1D

- Geometry endpoint design and implementation.
- Geometry Engine execution from persisted Projects.
- Geometry response DTOs.
- Geometry-specific Problem Details codes.
- Geometry snapshot or derived artifact behavior.
