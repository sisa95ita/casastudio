# ADR-005 Room Boundary Review

Review date: 2026-07-25

Reviewed primary document:

- `docs/adr/ADR-005-room-boundary-semantics.md`

Reviewed related context:

- `docs/adr/ADR-006-geometry-engine-architecture.md`
- `docs/geometry/geometry-runtime-model.md`
- `packages/schema/src/physical-building/room.ts`
- `packages/schema/src/physical-building/wall.ts`
- `packages/schema/src/validation/geometry.ts`
- `packages/schema/src/validation/cross-reference.ts`
- `packages/schema/src/validation/reference-consistency.ts`
- `packages/schema/src/validation/validation-error-code.ts`
- `packages/schema/examples/project.json`
- `packages/schema/json-schema/project.schema.json`
- `packages/schema/scripts/generate-project-schema.ts`
- relevant schema tests and docs references found by repository search

## Executive Summary

ADR-005 is directionally sound and substantially precise. The canonical shift from `Room.wallIds` to ordered and oriented `Room.boundary` is the right architectural move for deterministic polygon generation, runtime `BoundaryEdgeUse` construction, winding validation, adjacency assignment, and future renderer/exporter independence.

Most persisted model semantics are now explicit:

- array order is canonical traversal order;
- direction is relative to `Wall.start` and `Wall.end`;
- boundaries must be continuous, closed, non-self-intersecting, and at least three entries long;
- duplicate wall references inside one room boundary are rejected for the initial simple-loop model;
- outer boundaries must be persisted counter-clockwise;
- shared walls are represented once and may be referenced by up to two room boundaries;
- `wallIds` and `boundary` must not become long-term equivalent sources of truth.

The main remaining risks are not in the core idea. They are in migration/versioning and validation-layer ownership:

- there is no migration or schema-versioning implementation in the current codebase;
- current schema/docs/examples/tests still use `wallIds`;
- ADR-005 allows migration to normalize winding, but ordinary consumers are forbidden from silently reordering/reversing topology, so migration must be clearly scoped as a versioned transformation;
- the ADR should say exactly where bidirectional `Room.boundary` and `Wall.roomIds` consistency is validated;
- geometry-build errors versus schema validation errors are conceptually separated, but the handoff needs sharper wording for closed-loop, winding, self-intersection, partial-overlap, and non-manifold checks.

## Overall Verdict

**Status: risky but close to implementation-ready.**

The ADR is internally consistent with ADR-006 and the revised runtime model. It is implementable if the project makes a few remaining decisions before implementation planning:

- **blocking:** decide schema-versioning and migration ownership for replacing `wallIds`;
- **blocking:** decide whether the stable schema cut removes `wallIds` immediately or accepts legacy inputs through an isolated compatibility resolver;
- **important:** define exact validation-layer ownership for `Room.boundary` versus `Wall.roomIds` bidirectional consistency;
- **important:** define whether migration normalization may reorder/reverse topology only inside an explicit migration step;
- **important:** add missing error-code categories or equivalent diagnostics for boundary-specific validation.

No architectural disagreement with the core ADR decision. The proposed `RoomBoundaryEdge -> BoundaryEdgeUse` mapping is the right design.

## 1. Persisted Model Contract

### Canonical Shape

**Finding: accepted as currently designed.**

The proposed persisted model is clear:

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

The ADR explicitly says `Room.wallIds` shall be replaced by `Room.boundary`, and that the stable model shall not retain both as equivalent long-term representations.

### Array Ordering Semantics

**Finding: accepted as currently designed.**

ADR-005 states that the order of entries in `Room.boundary` defines canonical traversal order and that consumers must not reorder entries or infer an alternative order. This is precise enough for implementation.

### Traversal Direction Semantics

**Finding: accepted as currently designed.**

`FORWARD` and `REVERSE` are defined relative to the referenced `Wall`:

- `FORWARD`: `wall.start -> wall.end`
- `REVERSE`: `wall.end -> wall.start`

The ADR correctly locates direction on the `Room -> Wall` relationship, not on `Wall` itself.

### Minimum Cardinality

**Finding: accepted as currently designed.**

The ADR states `boundary.length >= 3`. This is correct for the initial simple-loop model.

### Duplicate Wall References

**Finding: accepted as currently designed for MVP, with future limitation understood.**

The ADR rejects the same wall appearing more than once in one room boundary. That is appropriate for simple room loops.

This excludes valid but more complex future cases, such as non-simple loops or rooms with repeated boundary segments, but the ADR correctly says those require a separate architectural decision.

### Continuity and Closure

**Finding: accepted as currently designed.**

The ADR defines continuity and closure in traversal endpoint terms:

```text
current.traversalEnd == next.traversalStart
last.traversalEnd == first.traversalStart
```

This is concrete and implementable.

### Canonical Winding

**Finding: accepted as currently designed, but migration scope is risky.**

The ADR requires external room boundaries to be persisted counter-clockwise in level-local XZ space and says the Geometry Engine must validate winding without silently modifying source data.

This is consistent with ADR-006 and the runtime model. The risky part is migration, discussed later: migration may normalize winding, but ordinary load/build behavior must not.

### Ownership by Level

**Finding: accepted but should be stated more explicitly.**

The ADR says cross-reference validation must verify that referenced walls belong to the room's level when level ownership requires it. Current schema ownership already implies this because rooms and walls are both nested under `Level`.

Recommended ADR wording:

```text
Every RoomBoundaryEdge.wallId must resolve to a Wall owned by the same Level that owns the Room. Cross-level room boundaries are invalid in the MVP.
```

This removes the conditional phrase "when level ownership requires it."

### Shared-Wall Behavior

**Finding: accepted as currently designed.**

The ADR states that a wall may participate in one room boundary for exterior/non-room space or two room boundaries for shared rooms, and that more than two room-boundary references are non-manifold for the initial model.

This matches ADR-006 and the runtime model's `BoundaryEdge` plus up to two adjacent polygons.

### Invalid and Non-Manifold Cases

**Finding: mostly accepted, with one missing explicit case.**

The ADR covers:

- open loops;
- missing references;
- self-intersections;
- degenerate walls;
- partial overlaps;
- more than two room-boundary references to one wall;
- duplicate wall references in one room boundary.

Missing explicit persisted-model case:

- a wall references a room in `Wall.roomIds`, but that room does not reference the wall in `Room.boundary`.

The project schema document currently treats bidirectional `Room.wallIds` and `Wall.roomIds` consistency as structurally invalid. ADR-005 should preserve the same invariant for `Room.boundary`.

Recommended ADR addition:

```text
Bidirectional consistency between Room.boundary[].wallId and Wall.roomIds must be validated: if a room boundary references a wall, that wall must reference the room; if a wall references a room as an adjacent room, that room must reference the wall in its boundary unless a future non-room adjacency model is introduced.
```

## 2. Validation Responsibilities

### Schema Validation

**Finding: accepted as currently designed.**

ADR-005 correctly assigns purely structural checks to schema validation:

- `boundary` exists when required;
- `boundary` is an array;
- each entry contains `wallId`;
- each entry contains valid `direction`;
- direction is one of `FORWARD` or `REVERSE`;
- duplicate wall references inside one room boundary are rejected.

This maps naturally to Zod schemas in `packages/schema/src/physical-building/room.ts`.

### Cross-Reference Validation

**Finding: accepted but incomplete.**

ADR-005 correctly assigns missing wall references to cross-reference validation.

It should also explicitly assign same-level ownership resolution to cross-reference or reference-consistency validation. Given current nesting, `RoomBoundaryEdge.wallId` should be looked up only in the owning level's `walls` collection, replacing the current `room.wallIds` logic in `packages/schema/src/validation/cross-reference.ts`.

### Reference Consistency Validation

**Finding: ambiguous.**

ADR-005 does not explicitly name reference-consistency validation, but the current codebase has this phase in `packages/schema/src/validation/reference-consistency.ts`.

The following should be assigned to reference consistency rather than raw cross-reference existence:

- `Room.boundary[].wallId` and `Wall.roomIds` bidirectional consistency;
- a wall referencing more than two rooms via `roomIds`;
- a wall being used by more room boundaries than its `roomIds` declares;
- a room referenced by a wall but not geometrically using that wall in its boundary.

This keeps cross-reference validation focused on existence and reference-consistency validation focused on semantic coherence.

### Geometry Validation and Geometry Engine Build Validation

**Finding: accepted as currently designed, with a handoff ambiguity.**

ADR-005 correctly assigns these to geometry validation or Geometry Engine build validation:

- traversal continuity;
- loop closure;
- canonical winding;
- non-degenerate walls;
- non-degenerate polygons;
- self-intersection;
- shared-wall cardinality;
- adjacency consistency;
- coincident or partial overlaps.

The phrase "Geometry validation or Geometry Engine build validation" is flexible, but implementation planning will need a sharper boundary. Some checks can run before runtime object construction; others naturally occur during construction.

Suggested split:

- persisted geometry validation: wall degeneracy, opening placement, duplicate/reversed duplicate wall geometry, obvious partial overlap within a level;
- Geometry Engine build validation: boundary order, traversal continuity, loop closure, winding, polygon area, self-intersection, adjacency assignment, non-manifold `BoundaryEdgeUse` counts.

### Specific Checks

**Missing wall references:** accepted. Cross-reference validation.

**Duplicate wall references:** accepted. Structural schema validation within one room boundary.

**Open loops:** accepted. Geometry validation or build validation.

**Invalid order:** accepted. Build validation.

**Invalid traversal direction:** accepted. Structural schema validation if not `"FORWARD" | "REVERSE"`; build validation if direction is valid enum but produces discontinuity.

**Clockwise outer boundaries:** accepted. Geometry validation or build validation should reject.

**Self-intersections:** accepted. Geometry validation or build validation should reject.

**Degenerate walls:** accepted but duplicated with current schema. `WallSchema` already rejects identical endpoints in `packages/schema/src/physical-building/wall.ts`, and `validateProjectGeometry` also checks zero length.

**Partial overlaps:** accepted, but implementation needs a named error. Current validation only catches exact same-direction duplicates.

**More than two rooms referencing one wall:** risky. ADR-005 says it is rejected, but current `Wall.roomIds` uses an unconstrained identifier array in `packages/schema/src/physical-building/wall.ts`. This needs validation ownership and error code decisions.

## 3. Runtime Mapping

### `RoomBoundaryEdge -> BoundaryEdgeUse`

**Finding: accepted as currently designed.**

ADR-005 cleanly separates persisted relationship data from runtime traversal:

- persisted `RoomBoundaryEdge`: source wall identity plus persisted traversal direction;
- runtime `BoundaryEdgeUse`: shared `BoundaryEdge`, traversal direction, loop ownership, runtime identity, traversal-relative endpoints.

This matches `docs/geometry/geometry-runtime-model.md`, where `BoundaryEdgeUse` is the concrete relationship between `BoundaryEdge` and `Loop`.

### Shared Physical Boundaries

**Finding: accepted as currently designed.**

The ADR supports one persisted `Wall` referenced by two room boundaries. ADR-006 and the runtime model map this to one runtime `BoundaryEdge` with two `BoundaryEdgeUse` instances and up to two adjacent polygons.

### Ordered Runtime Loops

**Finding: accepted as currently designed.**

Preserving persisted order and direction is compatible with immutable `GeometryModel` construction. The engine can construct one `Loop` per room outer boundary and fail if the persisted order is invalid.

### Loop Winding and Left/Right Assignment

**Finding: accepted, but dependent on runtime model definitions.**

ADR-005 requires counter-clockwise persisted outer boundaries. The runtime model defines side-aware `BoundaryEdge.leftPolygon` and `rightPolygon` based on canonical edge direction and polygon interior side.

No mismatch found. The remaining requirement is implementation discipline: adjacency must be derived from the validated loop traversal, not from `Wall.roomIds` ordering.

### Immutable GeometryModel Construction

**Finding: accepted as currently designed.**

ADR-005 does not conflict with immutable runtime construction. Persisted `Room.boundary` is stable input; runtime builders can construct `BoundaryEdgeUse` instances and finalize a read-only model.

## 4. Editing Semantics

### Reverse Wall Direction

**Finding: accepted as currently designed, but incomplete for full editor behavior.**

Swapping `wall.start` and `wall.end` and inverting every referencing `RoomBoundaryEdge.direction` is sufficient to preserve room boundary topology.

This is mathematically correct:

- the wall's canonical direction changes;
- each room's traversal direction flips;
- each room still traverses the same physical segment in the same world-space direction as before.

### Additional Affected Data

**Finding: important but non-blocking.**

ADR-005 should document additional affected data:

- `Opening.offsetFromStart` must be transformed when wall direction is reversed.
- Any future wall-relative metadata must be updated or explicitly defined as direction-invariant.

Current `Opening` placement is measured from wall start. If a wall of length `L` has an opening with `offsetFromStart = o` and `width = w`, reversing the wall while preserving the physical opening location requires:

```text
newOffsetFromStart = L - o - w
```

ADR-005 currently updates room boundary directions but does not mention openings. This is a correctness gap in the editing operation.

### Transaction and Undo/Redo Semantics

**Finding: important but non-blocking.**

ADR-005 correctly says reverse-wall-direction must be atomic and must not expose an intermediate invalid state.

Recommended additions:

- the operation should be one undoable command;
- emitted domain events, if introduced, should describe the whole operation rather than separate uncoordinated endpoint and boundary changes;
- validation should run on the complete post-operation state;
- failures should roll back all affected fields.

These can also live in an editor-command ADR, but ADR-005 should at least mention wall-relative data such as openings.

## 5. Migration Strategy

### Deterministic Reconstruction

**Finding: risky.**

Migration from unordered `wallIds` to ordered `boundary` is not always deterministic. ADR-005 correctly says migration must fail for missing loops, multiple valid loops, ambiguous order, ambiguous direction, and self-intersections.

This is implementable only if migration tooling is allowed to reject legacy projects that cannot be reconstructed uniquely.

### Winding Normalization

**Finding: ambiguous unless scoped to explicit migration.**

ADR-005 says migration should normalize the resulting outer boundary to counter-clockwise winding. Elsewhere, the ADR says consumers and the Geometry Engine must not silently reorder entries, reverse complete boundaries, or invert traversal directions.

These are compatible only if normalization is explicitly a versioned migration/import transformation, not ordinary load-time geometry building.

Recommended ADR wording:

```text
Winding normalization is allowed only inside an explicit migration or import-normalization operation that produces a new canonical ProjectSchema revision. Geometry Engine build operations must validate and reject invalid winding rather than normalize it.
```

### Migration Location

**Finding: blocking.**

The codebase currently has no migration framework or schema-versioning code beyond `schemaVersion` and `revision`. Repository search found no migration files. `packages/schema/src/project/project.ts` accepts `schemaVersion` as any non-empty string.

Before implementation planning, the project needs to decide where migration lives:

- schema package migration module;
- application-level import normalization;
- compatibility resolver used only before canonical parsing;
- one-off fixture/document migration.

This is a blocking architecture decision because `RoomSchema` cannot simply require `boundary` while legacy examples and tests still use `wallIds` unless there is a chosen compatibility path.

### Dual Source of Truth

**Finding: accepted as currently designed.**

ADR-005 correctly rejects keeping both `wallIds` and `boundary` as long-term equivalent representations.

Temporary coexistence is dangerous. If accepted during a transition, the ADR should require:

- one field is canonical;
- the other is legacy-only;
- both-present input either fails or requires exact consistency validation;
- canonical output emits only `boundary`.

### Schema Versioning

**Finding: blocking.**

Replacing `wallIds` with `boundary` is a breaking project-file change. The ADR should explicitly say whether this increments `schemaVersion`.

Given current examples use `"schemaVersion": "1.0.0"`, replacing a required field should likely produce a new schema version, for example `1.1.0` or `2.0.0`, depending on the project's versioning convention.

## 6. Compatibility With Current Codebase

### Schema Definitions

**Finding: blocking current-code conflict.**

`packages/schema/src/physical-building/room.ts` currently requires `wallIds` and has no `boundary` type.

Relevant code:

- `RoomSchema` properties at `packages/schema/src/physical-building/room.ts:18`
- `wallIds: IdentifierArraySchema` at `packages/schema/src/physical-building/room.ts:24`

`packages/schema/src/physical-building/wall.ts` still uses `roomIds` with no max cardinality:

- `roomIds: IdentifierArraySchema` at `packages/schema/src/physical-building/wall.ts:27`

### Inferred TypeScript Types

**Finding: blocking current-code conflict.**

`Room` is inferred from `RoomSchema`, so every TypeScript consumer currently sees `wallIds`, not `boundary`.

Affected export path:

- `packages/schema/src/index.ts` exports `./physical-building`, so downstream packages consume the current `Room` type transitively.

### Fixtures and Examples

**Finding: blocking current-code conflict.**

`packages/schema/examples/project.json` uses `wallIds` in every room:

- ground-floor living room at lines 27-32;
- kitchen at lines 39-44;
- first-floor studio at lines 276-281;
- bathroom at lines 288-293.

These fixtures must become `boundary` fixtures or explicitly legacy migration fixtures.

### Tests

**Finding: blocking current-code conflict.**

Tests hard-code `wallIds` throughout:

- `packages/schema/src/physical-building/room.test.ts:5-10`
- `packages/schema/src/physical-building/room.test.ts:30-34`
- `packages/schema/src/index.test.ts:43`
- `packages/schema/src/validation/cross-reference.test.ts:31-39`
- `packages/schema/src/validation/cross-reference.test.ts:153-168`
- `packages/schema/src/validation/geometry.test.ts:27-33`

These are not architectural problems, but they are hidden implementation blast radius.

### Cross-Reference Validation

**Finding: blocking current-code conflict.**

`validateProjectCrossReferences` iterates `room.wallIds` directly:

- `packages/schema/src/validation/cross-reference.ts:36-47`

Error paths currently use:

```text
building.levels[...].rooms[...].wallIds[...]
```

Those paths must move to:

```text
building.levels[...].rooms[...].boundary[...].wallId
```

### Geometry Validation

**Finding: risky current-code gap.**

`validateProjectGeometry` currently does not validate room boundary order, closure, winding, self-intersection, non-manifold wall usage, or partial overlap. Its header explicitly says it does not perform room polygon reconstruction or shared wall topology validation.

This was acceptable before ADR-005 implementation. After ADR-005, the geometry/build validation layer must cover those checks.

Current exact-duplicate wall detection is directional:

- key is `${start}->${end}` at `packages/schema/src/validation/geometry.ts:24-25`;
- lookup is same-direction only at lines 79-91.

ADR-005 and the runtime model require detecting reversed duplicate geometry too.

### JSON Schema Generation

**Finding: blocking current-code conflict.**

The generated JSON Schema currently contains `wallIds`:

- `packages/schema/json-schema/project.schema.json` reports `wallIds` around lines 106 and 114.

The generation script simply derives from `ProjectSchema`:

- `packages/schema/scripts/generate-project-schema.ts:7`
- generation at lines 12-15.

No separate migration/versioning behavior exists there.

### Project Schema Documentation

**Finding: blocking documentation conflict.**

`docs/13-project-schema.md` still names `wallIds` as a required room property:

- required property at lines 424-430;
- example at lines 459-466;
- wall-reference semantics at lines 481-487 says `wallIds` order is not geometrically authoritative.

This directly conflicts with ADR-005 and must be reconciled before implementation planning.

### Public Package Exports

**Finding: important but non-blocking.**

Because `RoomSchema` and inferred `Room` are exported from `@casastudio/schema`, this is a public internal package contract change. Any app/package using `Room.wallIds` will break.

The web app is currently a placeholder and does not assume room boundaries:

- `apps/web/src/App.tsx` only renders static text.

The geometry package is also a placeholder:

- `packages/geometry/src/index.ts` only exports package status.

### Migrations and Schema Versioning

**Finding: blocking missing infrastructure.**

No project migration or schema-versioning implementation was found. Only schema fields exist:

- `schemaVersion` in `packages/schema/src/project/project.ts`
- `revision` in the same project schema

The ADR needs an architectural answer before implementation planning.

## 7. Naming and API Ambiguities

### `RoomBoundaryEdge`

**Finding: acceptable but slightly risky.**

The name is close to runtime `BoundaryEdge`, but the `Room` prefix helps distinguish persisted relationship data.

Alternative names:

- `RoomBoundarySegment`
- `RoomWallBoundaryRef`
- `RoomBoundaryWallRef`

I do not recommend changing it unless maintainers expect frequent confusion. `RoomBoundaryEdge -> BoundaryEdgeUse` is readable once documented.

### `RoomBoundaryDirection`

**Finding: accepted as currently designed.**

The name is clear and persisted-domain scoped.

### `boundary`

**Finding: accepted for current simple-loop model, future caveat.**

`boundary` is good for one outer loop. Future holes may require a shape such as:

```ts
boundary: {
  outer: RoomBoundaryEdge[];
  inner: RoomBoundaryEdge[][];
}
```

or:

```ts
boundaries: RoomBoundaryLoop[]
```

ADR-005 already defers holes. The current `boundary: RoomBoundaryEdge[]` is acceptable for MVP.

### `FORWARD` and `REVERSE`

**Finding: accepted as currently designed.**

These are precise because they are explicitly relative to `Wall.start` and `Wall.end`.

Avoid alternatives like `CLOCKWISE` or `COUNTER_CLOCKWISE` for per-wall direction because winding is loop-level, not wall-reference-level.

### Relationship to Runtime Names

**Finding: accepted as currently designed.**

ADR-005 explicitly states persisted `RoomBoundaryEdge` and runtime `BoundaryEdgeUse` are not the same object. This resolves the most likely naming confusion.

## 8. Missing Decisions

### Schema version for the breaking change

**Classification: blocking.**

Decision needed: which `schemaVersion` first requires `Room.boundary` and rejects `Room.wallIds`?

### Migration ownership

**Classification: blocking.**

Decision needed: does migration live in `@casastudio/schema`, app import code, a one-off migration tool, or a temporary compatibility resolver?

### Both-present input behavior

**Classification: blocking.**

Decision needed: if a project contains both `wallIds` and `boundary`, should parsing fail, should migration compare them, or should one field be ignored?

Recommendation: fail canonical parsing; optionally allow both only in an explicit migration parser that verifies consistency and emits canonical `boundary` only.

### Winding normalization scope

**Classification: blocking.**

Decision needed: confirm that winding normalization is allowed only during explicit migration/import normalization, never during ordinary Geometry Engine build.

### Bidirectional consistency layer

**Classification: important but non-blocking.**

Decision needed: should `Room.boundary <-> Wall.roomIds` consistency be cross-reference validation or reference-consistency validation?

Recommendation: reference-consistency validation.

### Non-manifold wall cardinality source

**Classification: important but non-blocking.**

Decision needed: should `Wall.roomIds.length > 2` be rejected structurally, through reference consistency, or by geometry build validation?

Recommendation: reference-consistency or geometry validation, not Zod structural schema, because future non-room adjacency may affect this.

### Error code taxonomy

**Classification: important but non-blocking.**

Decision needed: add schema validation codes for boundary-specific persisted validation, or keep them in geometry build errors only.

At minimum, callers need stable diagnostics for:

- duplicate room boundary wall reference;
- missing boundary wall;
- open boundary;
- invalid boundary order;
- clockwise outer boundary;
- self-intersecting boundary;
- partial boundary overlap;
- non-manifold wall reference count;
- room/wall bidirectional mismatch.

### Coordinate equality tolerance

**Classification: implementation detail for MVP, important later.**

For MVP integer centimeters, exact point equality is acceptable. Decimal imports will need an explicit tolerance/normalization policy.

### Empty draft rooms

**Classification: important but non-blocking.**

ADR-005 says a valid boundary has at least three entries. Current project schema philosophy allows draft states. Decide whether draft rooms without a boundary remain structurally saveable, or whether `boundary.length >= 3` is required structurally.

Recommendation: distinguish "structurally parseable draft" from "geometry-buildable room." If draft rooms must be saveable, schema validation may allow `boundary: []`, while geometry validation rejects it for renderable/buildable geometry. ADR-005 currently leans toward structural minimum cardinality, so this needs an explicit product decision.

## Blocking Issues

1. **Current `RoomSchema` still requires `wallIds`.**

   `packages/schema/src/physical-building/room.ts:18-25` conflicts with ADR-005's canonical model.

2. **No migration/schema-versioning mechanism exists.**

   A repository search found no migration files. Replacing a required field needs a versioned compatibility strategy.

3. **`docs/13-project-schema.md` still defines `wallIds` as required and non-authoritative.**

   This conflicts directly with ADR-005 and can mislead implementation planning.

4. **Examples, generated JSON Schema, and tests still encode `wallIds`.**

   The affected surfaces include `packages/schema/examples/project.json`, `packages/schema/json-schema/project.schema.json`, `room.test.ts`, `index.test.ts`, `cross-reference.test.ts`, and `geometry.test.ts`.

5. **Both-present legacy behavior is undecided.**

   Without a decision, implementation can accidentally create dual sources of truth.

6. **Reverse Wall Direction omits `Opening.offsetFromStart`.**

   Swapping wall endpoints and inverting room boundary directions preserves room topology, but not physical opening placement unless opening offsets are transformed.

7. **Draft-room cardinality behavior is undecided.**

   ADR-005 says `boundary.length >= 3`, while earlier schema philosophy allows incomplete drafts. This must be reconciled before schema implementation.

## Recommended ADR Changes

1. **Add explicit same-level ownership wording.**

   State that every `RoomBoundaryEdge.wallId` must resolve to a wall owned by the same `Level` as the room.

2. **Add bidirectional consistency wording.**

   Preserve the existing `Room <-> Wall` invariant using `Room.boundary[].wallId` and `Wall.roomIds`.

3. **Clarify migration normalization scope.**

   Say winding/order normalization is allowed only during explicit migration/import normalization and produces a new canonical project representation.

4. **Add schema-version decision requirement.**

   State that replacing `wallIds` with `boundary` is a schema-versioned breaking change.

5. **Document both-present input behavior.**

   Recommended: canonical schema rejects both; migration parser may accept both only to verify and emit canonical `boundary`.

6. **Expand Reverse Wall Direction side effects.**

   Add `Opening.offsetFromStart` transformation:

   ```text
   newOffsetFromStart = wallLength - oldOffsetFromStart - opening.width
   ```

   Also mention future wall-relative metadata.

7. **Clarify draft-room behavior.**

   Decide whether `boundary.length >= 3` is structural schema validation or geometry-build validation. If draft rooms must remain saveable, allow empty boundaries structurally and reject them during geometry build/renderability.

8. **Name boundary-specific diagnostics.**

   Add expected validation/build error categories for room-boundary failures, especially bidirectional mismatch, partial overlap, self-intersection, and non-manifold wall usage.

## Final Assessment

ADR-005 is the right architectural direction and is consistent with ADR-006 and the revised runtime model.

The canonical persisted boundary contract is clear enough for deterministic runtime mapping:

```text
Room.boundary[] -> BoundaryEdgeUse[]
```

The current design should not change in its fundamentals. The remaining changes should sharpen the ADR around migration/versioning, validation-layer ownership, reverse-wall side effects, and draft-room behavior.

Implementation planning should wait until the blocking decisions are made, especially schema versioning and migration ownership. Once those are settled, the ADR provides a solid basis for replacing `Room.wallIds` with `Room.boundary` without leaking topology reconstruction into renderers or the Geometry Engine.
