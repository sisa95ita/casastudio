# Backend Foundation Phase 1D

## Purpose

Phase 1D introduces the authoritative read-only Geometry Snapshot API derived
from the persisted canonical Project.

The only new business endpoint is:

```text
GET /api/v1/projects/:id/geometry
```

No frontend integration, Project mutation, geometry persistence, generated
client, background job, cache, collaboration model, or revision-history behavior
is included.

## Endpoint Contract

`GET /api/v1/projects/:id/geometry` returns the Geometry Engine snapshot for
the current persisted Project revision.

The response envelope is:

```json
{
  "sourceProjectId": "demo-project",
  "sourceRevision": 1,
  "geometry": {}
}
```

`sourceProjectId` and `sourceRevision` are copied from the canonical Project
loaded for the request. The API does not trust caller-provided revision data and
does not expose owner metadata, database timestamps, Prisma UUIDs, or runtime
Geometry Engine class instances.

## Authentication And Authorization

The geometry endpoint uses the existing Keycloak JWT `JwtAuthGuard`.
The API validates the token issuer, signature, expiration, and configured
audience before the controller runs. `KEYCLOAK_AUDIENCE` is `casastudio-api` in
local development, so tokens must contain `aud = casastudio-api`; `azp =
casastudio-api` only records the authorized party and does not satisfy the
audience requirement.

The development realm JSON contains Audience protocol mappers for both the
public `casastudio-web` browser client and the confidential `casastudio-api`
client representing the API audience. Newly imported realms must include the
mapper before issuing API tokens. Tokens must be reissued after mapper changes
because existing access tokens keep their original claims. Manual Admin Console
edits are temporary unless represented in `docker/keycloak/casastudio-realm.json`.

For local manual checks, use the Postman collection in `tools/postman`. It uses
Authorization Code Flow with PKCE, sends users to Keycloak's browser login, and
stores OAuth tokens only as local Postman user state. The token endpoint remains
part of the Authorization Code exchange. Direct Access Grants are disabled,
which disables only the password grant.

Authorization reuses the Project read policy:

| Role | Access |
| --- | --- |
| `casastudio-user` | May read only when `principal.subject === metadata.ownerSubject`. |
| `casastudio-admin` | May read any Project. |

Authorization uses Keycloak `sub` only. Username and email are not ownership
inputs.

## Project Loading Pipeline

The application pipeline is:

```text
ProjectIdPipe
        ↓
AuthorizedProjectLoader
        ↓
ProjectsRepository.findLoadedByDomainId
        ↓
ProjectReadAuthorizationPolicy
        ↓
GetProjectGeometryService
```

The Project aggregate is loaded once. Repository implementations still validate
canonical schema and semantic persistence state on read. The geometry service
does not access Prisma.

## Geometry Engine Integration

The public Geometry Engine entry point is:

```ts
GeometryEngine.build(project)
```

The API wires this through the focused `ProjectGeometryBuilder` boundary. The
builder receives only the canonical validated Project and returns the Geometry
Engine build-result union. The Geometry Engine remains independent from NestJS,
HTTP, Prisma, and persistence.

## Runtime-To-DTO Boundary

`GeometrySnapshotApiMapper` maps:

```text
GeometryModel
        ↓
ProjectGeometryResponseDto
```

The mapper creates fresh DTO objects and never serializes runtime classes
directly. The current snapshot includes:

- geometry model ID;
- source Project units;
- levels;
- vertices;
- boundary edges derived from source Walls;
- ordered boundary edge uses;
- loops;
- room-derived polygons;
- polygon metrics, centroid, bounds, area, signed area, and winding.

The current Geometry Engine does not expose openings, renderer meshes,
triangulation, or standalone room/wall DTOs beyond source IDs and boundary-edge
topology, so the API does not invent those fields.

## Ordering

Top-level geometry arrays preserve the Geometry Engine's deterministic order.
Loop edge-use arrays preserve semantic traversal order. For room outer loops,
that order mirrors canonical `Room.boundary` order and direction.

Set-like adjacency views, such as a vertex's incident boundary edge IDs, are
serialized as sorted arrays. The API does not rely on JSON serialization of
`Map`, `Set`, `ReadonlyMap`, or `ReadonlySet`.

## Numeric And Unit Semantics

Coordinates, elevations, wall heights, wall thicknesses, and polygon metrics
preserve Geometry Engine numeric output without rounding. Length values use the
source Project length unit, currently centimeters. Polygon area values use
square source length units.

The mapper rejects `NaN`, `Infinity`, and `-Infinity` before a response is
returned. It does not convert coordinate axes or units.

## Problem Details

Geometry endpoint failures use the shared RFC 9457 Problem Details filter.

| Scenario | HTTP status | Code |
| --- | --- | --- |
| Invalid Project ID | `400` | `PROJECT_ID_INVALID` |
| Missing/invalid token | `401` | `UNAUTHORIZED` |
| Existing Project, forbidden caller | `403` | `PROJECT_ACCESS_FORBIDDEN` |
| Missing Project | `404` | `PROJECT_NOT_FOUND` |
| Invalid persisted aggregate | `500` | `PROJECT_PERSISTED_STATE_INVALID` |
| Repository/database failure | `500` | `PROJECT_READ_FAILED` |
| Geometry Engine build diagnostics | `500` | `PROJECT_GEOMETRY_INVALID` |
| Unexpected Geometry Engine exception | `500` | `PROJECT_GEOMETRY_BUILD_FAILED` |
| Unsafe snapshot serialization | `500` | `PROJECT_GEOMETRY_SERIALIZATION_FAILED` |

5xx causes remain attached internally for server logs and tests. Client
responses do not expose engine internals, stack traces, full Project payloads,
Prisma details, owner subjects, tokens, or secrets.

## Logging

Successful geometry builds log safe debug fields:

- `projectId`
- `sourceRevision`
- `principalSubject`
- `authorizedByRole`
- `geometryBuildDurationMs`
- `levelCount`
- `roomCount`
- `wallCount`

Forbidden authorization attempts remain warning-level Project read logs. Full
geometry payloads, coordinates in bulk, tokens, complete principals, owner
subjects, and Prisma records are not logged by the use case.

## Swagger And OpenAPI

Swagger remains enabled only when configuration allows it, defaulting to
non-production environments.

The OpenAPI document includes:

- `GET /api/v1/projects/{id}/geometry`;
- bearer authentication;
- required `id` path parameter;
- `ProjectGeometryResponseDto` and nested geometry schemas;
- `400`, `401`, `403`, `404`, and `500` Problem Details responses.

No write route, `/workspace`, `/geometry/:geometryId`, `/geometry/rebuild`, or
`/geometry/validate` endpoint is introduced.

## Tests

Unit tests cover:

- shared Project loading and authorization reuse;
- owner and administrator access;
- forbidden, missing, persisted-state, and read-failed behavior;
- Geometry Engine diagnostics;
- unexpected engine exceptions;
- snapshot serialization failures;
- mapper fidelity for levels, vertices, boundary edges, edge uses, loops,
  polygons, shared walls, metrics, source IDs, ordering, and non-finite numbers.

HTTP/OpenAPI tests cover:

- owner success;
- no token and invalid token;
- non-owner forbidden;
- administrator override;
- malformed ID rejection before repository and engine access;
- unknown valid Project ID;
- geometry-specific failure codes;
- OpenAPI route, security, response schema, required source fields, nested
  geometry schemas, and absence of write/workspace routes.

PostgreSQL-backed persistence tests remain conditional on `DATABASE_URL`.

## Local Verification

Static and unit checks:

```bash
pnpm --filter @casastudio/api lint
pnpm --filter @casastudio/api test
pnpm --filter @casastudio/api build
pnpm --filter @casastudio/geometry lint
pnpm --filter @casastudio/geometry test
pnpm --filter @casastudio/geometry build
pnpm --filter @casastudio/api prisma validate
pnpm --filter @casastudio/api prisma generate
pnpm lint
pnpm test
pnpm build
```

Root script checks:

```bash
pnpm web:lint
pnpm web:test
pnpm web:build
pnpm api:lint
pnpm api:test
pnpm api:build
pnpm app:lint
pnpm app:test
pnpm app:build
```

Compose configuration:

```bash
docker compose config
docker compose -f compose.yml -f compose.dev.yml config
docker compose -f compose.yml -f compose.test.yml config
```

Hybrid verification:

```bash
docker compose -f compose.yml -f compose.dev.yml up -d postgres keycloak
pnpm api:dev
```

Complete Postman's browser-based OAuth login without printing or committing the
token, then verify:

```bash
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/projects/demo-project/geometry
curl -i http://localhost:3000/api/v1/projects/demo-project/geometry
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/projects/unknown-project/geometry
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/projects/CasaStudio/geometry
curl http://localhost:3000/api/docs-json
curl http://localhost:3000/api/v1/health/live
curl http://localhost:3000/api/v1/health/ready
```

Fully containerized verification:

```bash
docker compose -f compose.yml -f compose.dev.yml up --build
curl http://localhost:3000/api/v1/health/live
curl http://localhost:3000/api/v1/health/ready
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/projects/demo-project/geometry
```

Do not include bearer token values in logs, documentation, reports, or commits.

Swagger remains the authoritative API contract. The Postman collection is an
executable local-development collection for common checks, not a replacement for
OpenAPI.

A future hardening pass can introduce a separate development-only public client
such as `casastudio-dev-cli` using the OAuth 2.0 Device Authorization Grant.
Device flow would permit terminal authentication through a browser without
storing or submitting the demo password in scripts, while Direct Access Grants
remain disabled.

## Performance Characteristics

The endpoint loads the Project once and invokes the Geometry Engine once per
request. There are no geometry database writes, no Redis or external cache, no
worker thread, no queue, and no persisted derived artifact.

## Known Limitations

- Only the current persisted revision is readable.
- Geometry snapshots are recomputed per request.
- Geometry is not persisted or versioned separately.
- The current snapshot exposes only data the Geometry Engine currently models.
- There is no frontend integration or generated client.
- PostgreSQL-backed HTTP verification requires local database and Keycloak
  services.

## Deferred After Backend Foundation

- Project creation, update, delete, list, search, and sharing APIs.
- Geometry mutations, validation endpoints, rebuild endpoints, and snapshot
  persistence.
- Revision history, optimistic concurrency, audit logs, and collaboration.
- Frontend API integration and generated API clients.
- Renderer-specific meshes, triangulation, exports, and cached derived assets.
- A dedicated development CLI Keycloak client for local token acquisition.
