# Backend Foundation Phase 1B

## Purpose

Phase 1B introduces normalized PostgreSQL persistence for the current canonical
CasaStudio Project aggregate. It adds relational storage, Prisma repositories,
mapping, seed data, and PostgreSQL tests. It does not add project HTTP
endpoints, project mutation APIs, frontend integration, geometry snapshots, or
Geometry Engine execution.

## Scope

The persisted aggregate is derived from ProjectSchema `2.0.0` as implemented in
the schema package. The model includes physical building records, observation
records, and design-rendering records because all of them are current canonical
Project data:

- Project, Building, Level, Room, Wall, Opening
- RoomBoundaryEdge, WallRoomReference, OpeningConnectedRoomReference
- Staircase, StairFlight, StairLanding
- Viewpoint, BaseImage
- DesignBrief, DesignBriefConstraint, DesignBriefPaletteEntry,
  DesignBriefReferenceAsset
- RenderRequest, RenderResult

## Architecture

The read pipeline is:

```text
PostgreSQL normalized records
        ↓
PrismaProjectRepository
        ↓
ProjectPersistenceAggregate
        ↓
ProjectAggregateMapper
        ↓
ProjectSchema validation
        ↓
semantic validation
        ↓
canonical Project
```

Application code depends on the `PROJECTS_REPOSITORY` token and the
`ProjectsRepository` contract. Prisma payloads and technical database IDs remain
inside the persistence module.

## Identity Policy

Every persistent domain entity has:

- a technical UUID primary key used by PostgreSQL and Prisma relations;
- a CasaStudio domain ID preserved from ProjectSchema.

The Project domain ID is globally unique. Nested domain IDs are unique within
their Project because schema identifiers are Project-scoped. Foreign keys use
technical UUIDs.

Technical IDs are never reconstructed into the canonical Project. Domain IDs are
never regenerated during persistence or loading.

## Metadata And Ownership

Application metadata is stored on `Project` separately from canonical Project
fields:

- `ownerSubject`
- `createdBySubject`
- `updatedBySubject`
- database `createdAt`
- database `updatedAt`

The canonical Project timestamps are stored as exact ISO strings in
`domainCreatedAt` and `domainUpdatedAt` so loading can reconstruct the exact
ProjectSchema values, including timezone text. Project lifecycle status is not
persisted because no concrete current lifecycle exists.

Ownership uses the Keycloak `sub`, not username or email. The development demo
subject is:

```text
8d62f7e2-0c2a-4f2a-a9cf-7f62c2f4e8f7
```

## Ordering

All canonical arrays are loaded deterministically. PostgreSQL row order is never
used as a Project order source. The persistence model classifies ordered
collections as follows:

| Persisted collection | Classification | Rationale |
| --- | --- | --- |
| Building `levels` | semantically ordered | Level order is the vertical hierarchy as persisted by the Project. |
| Level `rooms` | canonical-order preservation only | Room order is not geometric topology, but it is part of exact Project reconstruction. |
| Level `walls` | canonical-order preservation only | Wall topology is referenced by ID; array order still belongs to the canonical Project value. |
| Level `staircases` | canonical-order preservation only | Staircase references carry connection semantics; array order is preserved exactly. |
| Room `boundary` | semantically ordered | Boundary order is the room perimeter traversal order. |
| Wall `roomIds` | canonical-order preservation only | Adjacency semantics are set-like and capped by validation; order is preserved because it is canonical data. |
| Wall `openings` | semantically ordered | Opening order follows wall-local ordering and is preserved with wall-relative data. |
| Door `connectedRoomIds` | canonical-order preservation only | Connectivity is set-like; order is still canonical Project content. |
| Staircase `flights` | semantically ordered | Flight order describes circulation through the staircase. |
| Staircase `landings` | semantically ordered | Landing order describes circulation through the staircase. |
| Project `viewpoints` | canonical-order preservation only | Viewpoint semantics are ID/reference based; canonical array order must round-trip. |
| Project `baseImages` | canonical-order preservation only | BaseImage semantics are ID/reference based; canonical array order must round-trip. |
| Project `designBriefs` | canonical-order preservation only | DesignBrief semantics are ID/reference based; canonical array order must round-trip. |
| DesignBrief `constraints` | canonical-order preservation only | Prompt modifiers are stored as ordered canonical text entries. |
| DesignBrief `palette` | canonical-order preservation only | Palette entries are ordered canonical text entries. |
| DesignBrief `referenceAssetRefs` | canonical-order preservation only | Reference assets are ordered canonical text entries. |
| Project `renderRequests` | canonical-order preservation only | RenderRequest semantics are ID/reference based; canonical array order must round-trip. |
| Project `renderResults` | canonical-order preservation only | RenderResult semantics are ID/reference based; canonical array order must round-trip. |

The mapper rejects non-contiguous persisted positions instead of returning a
partially reconstructed Project.

No Phase 1B `position` column is unnecessary. Every persisted `position` either
represents domain traversal/circulation order or preserves a canonical
ProjectSchema array exactly.

## Room Boundaries

`RoomBoundaryEdge` is an explicit relationship from Room to Wall with:

- technical UUID primary key;
- `roomId` technical FK;
- `wallId` technical FK;
- `position`;
- `direction` enum with `FORWARD` and `REVERSE`.

Constraints prevent duplicate positions and duplicate Wall use inside one Room
boundary. The duplicate Wall constraint matches the canonical Room schema and
the simple-loop domain rule: the same Wall must not appear more than once in one
Room boundary. Normal writes cannot reference a missing Wall. The mapper
preserves both order and direction.

## Validation On Read

The mapper validates reconstructed data with:

1. `ProjectSchema`
2. cross-reference validation
3. reference-consistency validation
4. persisted geometry validation

Renderability validation is not part of normal persistence reads because future
draft Projects may be structurally and semantically valid while not renderable.
The canonical demo seed runs renderability validation because the demo fixture is
expected to be renderable.

Invalid persisted data raises internal reconstruction or invalid-persistence
errors. HTTP mapping is deferred.

## Seed Behavior

The Prisma seed reads the authoritative fixture from:

```text
packages/schema/examples/project.json
```

It validates the fixture, replaces only the known demo Project when the existing
row is owned by the expected demo subject, writes the full aggregate in one
transaction, reloads through the mapper, and compares the full canonical round
trip.

The seed reports only the domain project ID, revision, and owner subject. It
does not print passwords, tokens, or connection strings.

Run:

```bash
pnpm db:seed
```

`pnpm db:reset:dev` resets the configured development database, applies
migrations, and runs the seed. It is development/test-only.

## Migration

The Phase 1B migration is:

```text
20260804144154_phase_1b_project_persistence
```

Local workflow:

```bash
pnpm db:validate
pnpm db:generate
pnpm db:migrate:dev
pnpm db:migrate:status
pnpm db:seed
```

Production-like and test workflow:

```bash
pnpm db:migrate:deploy
pnpm db:migrate:status
```

Do not use `prisma db push` for CasaStudio schema changes.

## Testing

Mapper and API infrastructure tests run with:

```bash
pnpm --filter @casastudio/api test
```

PostgreSQL-backed persistence tests run when `DATABASE_URL` is present. They
cover:

- missing project lookup;
- canonical persist/load round trip;
- owner metadata;
- room-boundary orientation and order;
- duplicate-position constraints;
- duplicate Wall use constraints for one Room boundary;
- reconstruction rejection for ordering gaps;
- semantic rejection for inconsistent references;
- repeatable canonical demo seed;
- mapper equality against the canonical Project.

## Local Development

Fully containerized:

```bash
docker compose -f compose.yml -f compose.dev.yml up --build
```

Hybrid backend development:

```bash
docker compose -f compose.yml -f compose.dev.yml stop web api
docker compose -f compose.yml -f compose.dev.yml up -d postgres keycloak
pnpm --filter @casastudio/api dev
```

For the local API process, use host-facing URLs in `apps/api/.env`, including
PostgreSQL on `localhost:5432`, Keycloak issuer on `localhost:8080`, and the
JWKS URL reachable from the local process.

When changing the imported Keycloak realm, recreate the local Keycloak state or
explicitly re-import the realm because startup import skips an already existing
realm.

## Known Limitations

- No Project HTTP endpoints exist yet.
- No save/update API exists yet.
- No revision conflict handling or revision history exists yet.
- No project sharing, membership, audit table, or soft delete exists yet.
- Cross-table global uniqueness of every Project identifier is validated by the
  schema/semantic layer rather than a shared database registry.
- Geometry Engine execution remains outside persistence.

## Deferred After Phase 1B

- Project controllers and route contracts.
- Authorization checks against `ownerSubject`.
- HTTP Problem Details mapping for project persistence errors.
- Project response DTOs and API documentation.
- Mutation, save, and optimistic-concurrency behavior.
- Frontend project loading integration.
