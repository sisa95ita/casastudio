# ADR-005 Room Boundary Implementation Plan

## Executive Summary

ADR-005 replaces the persisted room topology field:

```ts
wallIds: Identifier[]
```

with the canonical schema version `2.0.0` contract:

```ts
type RoomBoundaryDirection = "FORWARD" | "REVERSE";

type RoomBoundaryEdge = {
  wallId: Identifier;
  direction: RoomBoundaryDirection;
};

type Room = {
  boundary: RoomBoundaryEdge[];
};
```

The implementation lands in `@casastudio/schema` first.

It must not:

- introduce Geometry Engine production classes;
- let renderers or exporters consume legacy `wallIds`;
- retain `wallIds` as a second canonical source of truth;
- silently normalize canonical room boundaries.

The Geometry Engine will later consume canonical `Room.boundary` and map each persisted `RoomBoundaryEdge` to a runtime `BoundaryEdgeUse`.

The implementation includes:

- schema version `2.0.0`;
- canonical `Room.boundary`;
- draft rooms through `boundary: []`;
- structural rejection of one- and two-edge non-empty boundaries;
- `Wall.roomIds` structural cardinality and uniqueness checks;
- schema-owned migration from legacy `1.0.0` projects;
- non-throwing migration results for expected migration failures;
- cross-reference, reference-consistency, and persisted geometry validation;
- atomic wall-direction reversal, including opening-offset transformation;
- canonical examples, tests, generated JSON Schema, and documentation updates.

The following decisions are final:

- canonical schema version is `2.0.0`;
- migration lives in `packages/schema/src/migrations/`;
- migration preserves `revision`, `createdAt`, and `updatedAt`;
- migration updates only `schemaVersion` and fields required by the format transformation;
- expected migration failures return a discriminated result union;
- unexpected internal faults may still throw;
- Zod structural issues remain separate from `ValidationErrorCode`;
- `project.schema.json` remains the latest canonical JSON Schema artifact;
- `Wall.roomIds` is constrained by Zod to at most two unique room IDs;
- reference-consistency validation still enforces the semantic bidirectional relationship;
- winding normalization is allowed only during explicit migration;
- schema version `1.0.0` with `boundary` but no `wallIds` is invalid legacy input;
- both `wallIds` and `boundary` are accepted only by the explicit migration parser and only when consistent;
- canonical parsing accepts only `boundary`;
- `boundary: []` is structurally valid for draft rooms.

---

## Scope

In scope:

- `@casastudio/schema` domain schemas and inferred types;
- canonical `ProjectSchema` for schema version `2.0.0`;
- supported-version constants and checks;
- migration from raw legacy project documents to canonical parsed `Project`;
- deterministic reconstruction of legacy `wallIds`;
- migration result and error contracts;
- boundary-specific semantic and geometry diagnostics;
- cross-reference validation for `Room.boundary[].wallId`;
- reference-consistency validation for `Room.boundary <-> Wall.roomIds`;
- persisted geometry validation for room boundaries;
- atomic reverse-wall-direction domain operation;
- examples, generated JSON Schema, tests, fixtures, and canonical documentation.

Out of scope:

- runtime `GeometryModel` implementation;
- `BoundaryEdge`, `BoundaryEdgeUse`, `Loop`, `Polygon`, or other Geometry Engine production classes;
- renderer or exporter implementation;
- database persistence migrations;
- editor UI command wiring;
- holes and inner loops;
- curved walls;
- non-simple topology;
- partial edge splitting;
- a general parse-error normalization layer combining Zod and semantic validation errors.

---

## Non-Goals

- Do not keep `wallIds` as a canonical field.
- Do not make ordinary schema parsing migrate legacy data.
- Do not normalize canonical boundaries during parsing or geometry construction.
- Do not let renderers or exporters read legacy topology.
- Do not mutate migration input.
- Do not alter `revision`, `createdAt`, or `updatedAt` during format migration.
- Do not convert expected migration failures into exceptions.
- Do not map all Zod issues into `ValidationErrorCode` in this implementation.
- Do not version JSON Schema artifacts by filename unless a separate requirement appears.
- Do not introduce renderer-specific dependencies.
- Do not solve future topology outside the ADR-005 MVP.

---

## Current-State Inventory

Current codebase facts:

- `packages/schema/src/physical-building/room.ts` defines required `wallIds`.
- `packages/schema/src/physical-building/wall.ts` defines unconstrained `roomIds`.
- `packages/schema/src/project/project.ts` accepts any non-empty `schemaVersion`.
- `packages/schema/src/validation/cross-reference.ts` iterates `room.wallIds`.
- `packages/schema/src/validation/reference-consistency.ts` does not validate room-wall bidirectionality.
- `packages/schema/src/validation/geometry.ts` does not reconstruct or validate room polygons.
- reversed duplicate wall geometry is not detected.
- no room-boundary-specific validation codes exist.
- no schema migration package exists.
- canonical examples use `schemaVersion: "1.0.0"` and `wallIds`.
- generated JSON Schema contains `wallIds`.
- tests and canonical docs are coupled to the old representation.

Relevant existing files include:

- `packages/schema/src/physical-building/room.ts`
- `packages/schema/src/physical-building/wall.ts`
- `packages/schema/src/validation/cross-reference.ts`
- `packages/schema/src/validation/reference-consistency.ts`
- `packages/schema/src/validation/geometry.ts`
- `packages/schema/src/validation/validation-error-code.ts`
- `packages/schema/src/project/project.ts`
- `packages/schema/src/index.ts`
- `packages/schema/examples/project.json`
- `packages/schema/json-schema/project.schema.json`
- `packages/schema/scripts/generate-project-schema.ts`
- `docs/13-project-schema.md`

---

## Target State

### Canonical schema version

```text
2.0.0
```

### Canonical room boundary

```ts
export const RoomBoundaryDirectionSchema = z.enum([
  "FORWARD",
  "REVERSE"
]);

export const RoomBoundaryEdgeSchema = z.strictObject({
  wallId: IdentifierSchema,
  direction: RoomBoundaryDirectionSchema
});

export const RoomSchema = z
  .strictObject({
    id: IdentifierSchema,
    name: RequiredNameSchema,
    type: RoomTypeSchema,
    description: OptionalDescriptionSchema,
    elevation: MeasurementSchema.optional(),
    boundary: z.array(RoomBoundaryEdgeSchema)
  })
  .refine(
    (room) =>
      room.boundary.length === 0 ||
      room.boundary.length >= 3,
    {
      path: ["boundary"],
      message:
        "Room boundary must be empty for drafts or contain at least three edges."
    }
  )
  .refine(
    (room) =>
      new Set(room.boundary.map((edge) => edge.wallId)).size ===
      room.boundary.length,
    {
      path: ["boundary"],
      message:
        "Room boundary must not reference the same wall more than once."
    }
  );
```

### Canonical wall room references

`Wall.roomIds` remains part of the persisted model but gains local structural constraints:

```ts
const WallRoomIdsSchema = IdentifierArraySchema
  .max(2, "A wall may reference at most two rooms.")
  .refine(
    (roomIds) => new Set(roomIds).size === roomIds.length,
    {
      message:
        "A wall must not reference the same room more than once."
    }
  );
```

This Zod rule answers:

> Is the single wall locally shaped according to the MVP persisted contract?

Reference-consistency validation separately answers:

> Do `Wall.roomIds` and `Room.boundary` agree across the level?

### Public inferred types

```ts
export type RoomBoundaryDirection =
  z.infer<typeof RoomBoundaryDirectionSchema>;

export type RoomBoundaryEdge =
  z.infer<typeof RoomBoundaryEdgeSchema>;

export type Room =
  z.infer<typeof RoomSchema>;
```

### Canonical parse behavior

`ProjectSchema.parse`:

- accepts only `schemaVersion: "2.0.0"`;
- accepts `Room.boundary`;
- rejects `Room.wallIds`;
- accepts `boundary: []`;
- rejects non-empty boundaries of length one or two;
- rejects duplicate wall IDs in one room boundary;
- rejects `Wall.roomIds` with more than two entries;
- rejects duplicate room IDs inside `Wall.roomIds`.

### Migration result contract

Expected migration failures do not throw.

```ts
export type ProjectMigrationResult =
  | {
      ok: true;
      project: Project;
      sourceVersion: string;
      targetVersion: "2.0.0";
    }
  | {
      ok: false;
      errors: readonly ProjectMigrationError[];
    };
```

Public API:

```ts
export function migrateProject(
  input: unknown
): ProjectMigrationResult;
```

Expected document problems return `ok: false`, including unsupported schema version, missing walls, disconnected boundaries, ambiguous loops, self-intersections, and inconsistent legacy fields.

Unexpected internal invariant violations or technical faults may throw.

### Migration metadata behavior

Migration:

- updates `schemaVersion` to `2.0.0`;
- replaces `wallIds` with `boundary`;
- preserves `revision`;
- preserves `createdAt`;
- preserves `updatedAt`;
- returns a new object;
- does not mutate input.

### Validation behavior

- Zod handles local structural constraints.
- Cross-reference validation checks whether referenced entities exist in the owning level.
- Reference-consistency validation checks bidirectional semantic agreement.
- Persisted geometry validation checks document-level geometric validity.
- Future Geometry Engine build validation checks runtime topology.
- Zod issues and `ValidationError[]` remain separate contracts.

---

## Implementation Strategy

Implement from the schema core outward:

1. Add schema-version constants and room-boundary types.
2. Switch canonical `ProjectSchema`, `RoomSchema`, and `WallSchema` to the v2 contract.
3. Add schema-owned migration infrastructure and deterministic legacy reconstruction.
4. Update cross-reference validation.
5. Update reference-consistency validation.
6. Add persisted room-boundary geometry validation.
7. Add reverse-wall-direction domain operation.
8. Convert examples, fixtures, tests, and docs.
9. Regenerate the latest canonical JSON Schema.
10. Remove accidental canonical `wallIds` usage.

Each logical commit should pass package tests when practical. Steps 1 and 2 may be combined atomically if splitting them would leave the package uncompilable.

---

## Phase 1: Schema Versioning and Domain Types

### Step 1.1: Add schema-version constants

Create or modify:

- `packages/schema/src/project/schema-version.ts`
- `packages/schema/src/project/index.ts`
- `packages/schema/src/project/project.ts`
- `packages/schema/src/project/schema-version.test.ts`
- `packages/schema/src/project/project.test.ts`

Define current and supported canonical versions, and make `ProjectSchema` accept only `2.0.0`.

Tests must cover accepted and rejected versions.

Blocking: yes.

### Step 1.2: Replace `Room.wallIds` with `Room.boundary`

Modify:

- `packages/schema/src/physical-building/room.ts`
- `packages/schema/src/physical-building/index.ts`
- `packages/schema/src/physical-building/room.test.ts`
- `packages/schema/src/index.test.ts`

Add the new boundary schemas and inferred types. Enforce draft/cardinality and duplicate-wall rules. Reject legacy `wallIds` in canonical parsing.

Blocking: yes.

### Step 1.3: Constrain `Wall.roomIds` structurally

Modify:

- `packages/schema/src/physical-building/wall.ts`
- wall tests.

Add maximum two room IDs and uniqueness. Keep semantic reciprocal validation in reference-consistency.

Blocking: yes for canonical schema.

---

## Phase 2: Schema-Owned Migration

### Step 2.1: Create migration module structure

Create:

```text
packages/schema/src/migrations/
├── index.ts
├── migration-error.ts
├── migrate-project.ts
├── v1-to-v2.ts
├── legacy-room-boundary-resolver.ts
├── migrate-project.test.ts
├── v1-to-v2.test.ts
└── legacy-room-boundary-resolver.test.ts
```

Define migration-specific errors and `ProjectMigrationResult`. Expected migration failures return `ok: false`; unexpected internal faults may throw.

Blocking: yes.

### Step 2.2: Add raw schema-version detection

Implement exact version dispatch:

- missing or non-string version -> failure result;
- exact supported legacy `1.0.0` -> v1-to-v2 migration;
- canonical `2.0.0` -> canonical parse;
- all other versions -> unsupported version failure.

Do not guess future migrations.

Blocking: yes.

### Step 2.3: Implement v1-to-v2 behavior

Rules:

- clone input before transformation;
- use level-local wall lookups;
- remove `wallIds`;
- emit `boundary`;
- update only `schemaVersion` and required transformed fields;
- preserve `revision`, `createdAt`, and `updatedAt`;
- run canonical validation after transformation.

Legacy shape handling:

```text
1.0.0 + wallIds only
    -> normal migration

1.0.0 + wallIds and boundary
    -> migration-only acceptance when consistent;
       emit boundary only

1.0.0 + boundary only
    -> invalid legacy shape

2.0.0 + wallIds
    -> canonical parse failure
```

Blocking: yes.

### Step 2.4: Implement deterministic legacy boundary reconstruction

The resolver must:

- allow empty draft `wallIds`;
- resolve walls in the owning level;
- reject missing, cross-level, duplicate, or degenerate walls;
- require one connected simple cycle;
- reject degree-one, branching, disconnected, or ambiguous graphs;
- assign per-edge direction;
- detect same/reversed duplicate geometry;
- compute signed area;
- normalize to CCW only during migration;
- reject zero area, self-intersection, and partial overlap;
- return a new `RoomBoundaryEdge[]` without mutation.

Blocking: yes for legacy support.

---

## Phase 3: Cross-Reference and Reference-Consistency Validation

### Step 3.1: Update cross-reference validation

Modify cross-reference validation and tests to resolve `Room.boundary[].wallId` in the owning level and report precise paths and codes.

Draft boundaries pass. Bidirectional agreement remains out of this layer.

Blocking: yes.

### Step 3.2: Add bidirectional room-wall consistency

Enforce:

```text
Room.boundary contains Wall.id
    =>
Wall.roomIds contains Room.id
```

and the reverse implication.

Rules include draft rooms, exterior walls, unassigned walls, and defensive diagnostics for duplicate or non-manifold room references.

Zod and reference-consistency both validate `Wall.roomIds`, but for different reasons:

- Zod: local max-two and uniqueness;
- reference consistency: cross-object semantic agreement.

Blocking: yes.

---

## Phase 4: Persisted Geometry Validation

### Step 4.1: Expand geometry helpers

Add document-level helpers for point keys, undirected wall keys, traversal endpoints, signed area, segment intersection, and partial overlap.

Reject reversed duplicate wall geometry as well as same-direction duplicates.

Blocking: yes.

### Step 4.2: Validate canonical room-boundary geometry

For non-draft rooms, validate:

- continuity;
- closure;
- valid traversal direction in geometric context;
- positive canonical winding;
- non-zero area;
- no self-intersection;
- no unsupported partial overlap.

Canonical validation reports errors only. It never reorders or normalizes.

Blocking: yes for geometry-buildable canonical projects.

---

## Phase 5: Reverse Wall Direction Domain Operation

Create a pure operation that:

- does not mutate input;
- swaps wall endpoints;
- inverts every referencing room-boundary direction;
- transforms each opening offset using:

```text
newOffsetFromStart =
    wallLength
    - oldOffsetFromStart
    - opening.width
```

- validates the final state;
- returns a result union without partial output.

Undo/redo UI wiring is out of scope, but applying the operation twice must restore the original project.

---

## Phase 6: Fixtures, JSON Schema, Tests, and Documentation

### Step 6.1: Update examples and fixtures

Convert the canonical example to v2 and `boundary`. Keep an optional v1 `wallIds` example only as a migration fixture.

### Step 6.2: Regenerate latest canonical JSON Schema

Keep only:

```text
packages/schema/json-schema/project.schema.json
```

as the latest canonical artifact.

It must include `boundary`, direction enum values, canonical version, and wall room cardinality where representable, and exclude canonical `wallIds`.

### Step 6.3: Update canonical documentation

Update canonical schema docs for v2, draft boundaries, geometry-buildable boundaries, room-wall reciprocity, and migration-only legacy support.

Historical ADR/review/plan references may keep `wallIds`.

---

## Phase 7: Cleanup

Use repository-wide search to remove accidental canonical `wallIds` use.

Keep legacy references only in migration code, migration tests, legacy fixtures, and historical documentation.

Add explicit tests that canonical parsing rejects `wallIds` and migration is the only supported legacy path.

---

## Test Plan

Run package and repository test, build, and lint commands.

Coverage must include:

- room-boundary structural rules;
- `Wall.roomIds` max-two and uniqueness;
- schema version behavior;
- migration result-union behavior;
- metadata preservation;
- all legacy reconstruction success/failure cases;
- cross-reference and reciprocal consistency;
- canonical geometry validation;
- reverse-wall operation;
- canonical JSON Schema assertions.

Expected migration failures must be tested as `ok: false`, not thrown exceptions.

---

## Error-Code Ownership

### Zod structural issues

Remain Zod issues:

- missing/invalid boundary;
- one/two entries;
- invalid direction enum;
- duplicate boundary wall IDs;
- more than two `Wall.roomIds`;
- duplicate `Wall.roomIds`;
- canonical `wallIds` field.

### Semantic validation codes

Add stable codes for missing or cross-level boundary walls, reciprocal mismatch, defensive duplicate/non-manifold wall references, open/invalid/clockwise/self-intersecting/degenerate boundaries, and partial overlap.

### Migration errors

Use migration-specific codes for missing/invalid/unsupported versions, invalid legacy shape, failed legacy boundary reconstruction, and canonical validation failure.

Future Geometry Engine build errors remain separate.

---

## Risks and Mitigations

- Canonical fixture breakage: combine schema switch and minimum fixture updates atomically.
- Ambiguous migration: reject instead of guessing.
- Normalization leakage: keep normalization inside migration resolver only.
- Hidden dual source of truth: strict canonical schema and repository audit.
- Draft-room ambiguity: empty boundary valid only when no wall lists the room.
- Zod/reference-consistency overlap: document local versus relational responsibilities.
- Exception-heavy migration: expected failures always use the result union.
- Metadata drift: explicit tests preserve revision and timestamps.
- Premature Geometry Engine duplication: keep schema geometry helpers document-focused.
- Generated artifact churn: regenerate in a focused commit.

---

## Recommended Commit Sequence

1. Room-boundary types and version constants.
2. Canonical schema v2 switch, including `Wall.roomIds` constraints.
3. Schema-owned migration and legacy resolver.
4. Cross-reference and reference consistency.
5. Persisted room-boundary geometry validation.
6. Reverse-wall-direction domain operation.
7. Canonical fixtures and docs.
8. Generated JSON Schema.
9. Legacy cleanup and full verification.

Combine the first two commits if repository policy requires every commit to pass all checks.

---

## Definition of Done

- canonical schema requires `2.0.0`;
- `RoomSchema` has `boundary` and no `wallIds`;
- draft empty boundary is valid;
- one/two entries and duplicate wall references are invalid;
- `Wall.roomIds` allows at most two unique room IDs;
- migration handles valid v1 documents through a result union;
- expected migration failures do not throw;
- revision and timestamps are preserved;
- input is not mutated;
- ambiguous legacy topology fails explicitly;
- boundary-only v1 is rejected;
- both-present v1 is accepted only when consistent;
- cross-reference and reciprocal consistency use `Room.boundary`;
- persisted geometry validation rejects invalid canonical boundaries;
- reverse wall direction preserves topology and opening placement;
- canonical example, docs, tests, and JSON Schema use v2;
- remaining `wallIds` references are migration or historical only;
- test, build, and lint commands pass.

---

## Settled Decisions

There are no remaining architectural open questions for ADR-005 implementation.

```text
schemaVersion:
    2.0.0 canonical

migration ownership:
    packages/schema/src/migrations

migration output:
    new canonical Project; source input unchanged

expected migration failures:
    ProjectMigrationResult with ok: false

unexpected internal migration faults:
    may throw

revision:
    preserved

createdAt:
    preserved

updatedAt:
    preserved

Zod issues:
    separate from ValidationErrorCode

JSON Schema artifact:
    project.schema.json as latest canonical

Wall.roomIds:
    Zod max 2 and unique
    plus reference-consistency validation

legacy v1 with both fields:
    migration-only and only when consistent

legacy v1 with boundary only:
    invalid legacy shape

draft rooms:
    boundary: [] structurally valid

normalization:
    migration-only
```
