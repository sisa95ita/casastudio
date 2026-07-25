# ADR-005: Room Boundary Semantics

## Status

Accepted

---

## Context

A `Room` references the walls that compose its perimeter.

The original schema represented this relationship as:

```ts
wallIds: Identifier[]
```

This representation was sufficient for structural and cross-reference validation because it could assert that a room referred to existing walls. However, it is not expressive enough for deterministic geometry processing.

The Geometry Engine, the 2D editor, the 3D renderer, and exporters require an explicit and deterministic representation of a room boundary.

Room perimeter semantics must therefore encode:

- which walls participate in the boundary;
- the order in which those walls are traversed;
- the direction in which each wall is traversed.

---

## Problem

An unordered list of wall identifiers does not define a deterministic polygon.

Downstream systems would have to reconstruct topology before performing geometric operations.

An ordered list of wall identifiers improves determinism, but still does not specify how each wall is traversed by the room boundary.

The Geometry Engine would still need to infer whether the room follows a wall from `wall.start` to `wall.end` or from `wall.end` to `wall.start`.

This inference would introduce ambiguity into:

- polygon generation;
- loop closure;
- winding validation;
- normal calculation;
- adjacency assignment;
- mesh generation;
- editing operations;
- interoperability with CAD-like algorithms.

Room topology must therefore be explicit in the persisted domain model.

---

## Considered Alternatives

### Alternative A: Unordered Wall Identifiers

Represent the room perimeter as an unordered list of wall identifiers.

**Rejected**, because topology would have to be reconstructed by downstream systems.

### Alternative B: Ordered Wall Identifiers

Represent the room perimeter as an ordered list of wall identifiers.

**Rejected**, because the Geometry Engine would still need to infer wall traversal direction.

### Alternative C: Ordered and Oriented Wall References

Represent the room perimeter as an ordered list of boundary edges, where each boundary edge references a wall and a traversal direction.

**Accepted.**

---

## Decision

A `Room` boundary SHALL be represented as an ordered list of boundary edges.

Each boundary edge references:

- a `Wall`;
- a traversal direction.

The persisted model SHALL conceptually follow:

```ts
type RoomBoundaryDirection = "FORWARD" | "REVERSE";

type RoomBoundaryEdge = {
  wallId: Identifier;
  direction: RoomBoundaryDirection;
};

type Room = {
  // ...
  boundary: RoomBoundaryEdge[];
};
```

`Room.wallIds` SHALL be replaced by `Room.boundary`.

The stable persisted model SHALL NOT keep `wallIds` and `boundary` as equivalent long-term representations of the same topology.

`boundary` is the canonical room-boundary representation for schema version `2.0.0` and later.

Projects using the previous `wallIds` representation SHALL be migrated before canonical schema validation.

---

## Schema Version

Replacing `Room.wallIds` with `Room.boundary` is a breaking persisted-schema change.

The first canonical schema version requiring `Room.boundary` SHALL be:

```text
2.0.0
```

A project declaring schema version `2.0.0` or later:

- SHALL use `Room.boundary`;
- SHALL NOT use `Room.wallIds`;
- SHALL fail canonical schema validation if both fields are present.

Legacy project versions MAY be accepted only by an explicit migration or compatibility entry point.

Canonical parsing SHALL emit and expose only the latest persisted representation.

---

## Traversal Semantics

The order of entries in `Room.boundary` defines the canonical traversal order of the room perimeter.

Consumers SHALL NOT:

- reorder boundary entries;
- infer an alternative traversal order;
- silently reverse the complete boundary;
- silently replace persisted traversal directions.

Traversal direction is relative to the referenced wall definition.

`FORWARD` means:

```text
wall.start -> wall.end
```

`REVERSE` means:

```text
wall.end -> wall.start
```

Traversal direction is independent from:

- geographic orientation;
- project orientation;
- camera orientation;
- viewport orientation.

It only represents how the `Room` traverses the `Wall` while walking along its boundary.

The direction belongs to the relationship:

```text
Room -> Wall
```

It is **NOT** a property of `Wall` itself.

For a boundary entry, the traversal endpoints are defined conceptually as:

```text
FORWARD:
    traversalStart = wall.start
    traversalEnd   = wall.end

REVERSE:
    traversalStart = wall.end
    traversalEnd   = wall.start
```

---

## Same-Level Ownership

Every `RoomBoundaryEdge.wallId` SHALL resolve to a `Wall` owned by the same `Level` that owns the `Room`.

Cross-level room boundaries are invalid in the initial model.

The Geometry Engine SHALL NOT construct a room loop from walls belonging to different levels.

---

## Draft and Buildable Room States

A project may contain structurally valid draft rooms that do not yet define buildable geometry.

The persisted schema SHALL allow:

```text
boundary.length == 0
```

for an incomplete draft room.

A geometry-buildable room SHALL contain at least three boundary entries:

```text
boundary.length >= 3
```

Boundary lengths of one or two entries are invalid.

This distinction preserves the ability to save incomplete editing states without treating them as valid room polygons.

Conceptually:

```text
structurally valid room
    !=
geometry-buildable room
```

---

## Continuity and Closure

A geometry-buildable room boundary SHALL form one closed and continuous loop.

For every consecutive pair of boundary entries:

```text
current.traversalEnd == next.traversalStart
```

The final boundary entry SHALL connect back to the first:

```text
last.traversalEnd == first.traversalStart
```

For the initial simple-loop model:

- the same wall SHALL NOT appear more than once in one room boundary;
- no referenced wall may be geometrically degenerate;
- the boundary SHALL NOT be open;
- the boundary SHALL NOT self-intersect;
- consecutive wall segments MAY be collinear if they still form a valid loop;
- unsupported partial wall overlaps SHALL NOT be silently normalized.

More complex non-simple room topology requires a separate architectural decision.

---

## Winding Convention

All external room boundaries SHALL be stored in counter-clockwise order.

Counter-clockwise orientation is evaluated in the level-local XZ plan according to the CasaStudio coordinate-system specification.

Future support for holes MAY use clockwise winding.

Persisted room boundaries SHALL already satisfy the canonical winding convention.

The Geometry Engine SHALL validate winding.

The Geometry Engine SHALL NOT silently:

- reorder boundary entries;
- reverse the full boundary;
- invert traversal directions;
- modify source coordinates.

A boundary with invalid winding SHALL produce an explicit validation or geometry-build error.

Winding normalization is permitted only inside an explicit migration or import-normalization operation that produces a new canonical project representation.

Ordinary project loading and Geometry Engine construction SHALL validate and reject invalid winding rather than normalize it.

---

## Shared Wall Semantics

A wall may participate in:

- one room boundary when it separates a room from the exterior or from non-room space;
- two room boundaries when it is shared by two rooms.

A wall shared by two room boundaries will normally be referenced with opposite traversal directions because both external room loops use counter-clockwise winding.

Conceptually:

```text
Room A:
    shared wall -> FORWARD

Room B:
    shared wall -> REVERSE
```

The exact result depends on the wall's canonical `start` and `end` orientation.

More than two room-boundary references to the same physical wall indicate non-manifold room topology in the initial model and SHALL be rejected unless explicitly supported by a future design.

The persisted schema does not duplicate a wall merely because multiple rooms reference it.

---

## Bidirectional Room and Wall Consistency

The persisted model retains bidirectional room-wall references through:

```text
Room.boundary[].wallId
Wall.roomIds[]
```

These references SHALL remain consistent.

If a room boundary references a wall:

```text
Room.boundary contains Wall.id
```

then that wall SHALL reference the room:

```text
Wall.roomIds contains Room.id
```

If a wall references a room:

```text
Wall.roomIds contains Room.id
```

then that room SHALL reference the wall in its boundary unless a future adjacency model explicitly permits non-boundary room references.

For the initial model:

```text
Wall.roomIds.length <= 2
```

More than two room references indicate non-manifold room topology.

This cardinality is a semantic consistency rule rather than a purely structural schema rule.

---

## Validation Responsibilities

Validation is divided by responsibility.

### Structural Validation

Structural schema validation SHALL verify:

- `boundary` exists;
- `boundary` is an array;
- an empty boundary is allowed for draft rooms;
- a non-empty boundary does not contain only one or two entries;
- every entry contains `wallId`;
- every entry contains a valid traversal direction;
- traversal directions are limited to `FORWARD` and `REVERSE`;
- duplicate wall references within the same boundary are rejected for the initial model;
- canonical schema version `2.0.0` does not accept `wallIds`.

Structural validation does not need to reconstruct geometric topology.

### Cross-Reference Validation

Cross-reference validation SHALL verify:

- every `RoomBoundaryEdge.wallId` references an existing wall;
- every referenced wall belongs to the same level as the room;
- every `Wall.roomIds` entry references an existing room in the same level.

Cross-reference validation answers whether referenced entities exist in the correct scope.

### Reference-Consistency Validation

Reference-consistency validation SHALL verify:

- `Room.boundary[].wallId` and `Wall.roomIds` are bidirectionally consistent;
- a wall does not reference more than two rooms in the initial model;
- a wall is not used by more room boundaries than declared by `Wall.roomIds`;
- a room referenced by a wall also uses that wall in its boundary.

Reference-consistency validation answers whether existing references agree semantically.

### Persisted Geometry Validation

Persisted geometry validation MAY verify geometry that does not require construction of the complete runtime topology, including:

- degenerate walls;
- exact duplicate wall geometry;
- reversed duplicate wall geometry;
- invalid opening placement;
- obvious unsupported coincident or partially overlapping walls.

### Geometry Engine Build Validation

Geometry Engine build validation SHALL verify:

- traversal continuity;
- loop closure;
- canonical winding;
- non-degenerate polygons;
- self-intersection;
- invalid boundary order;
- valid-enum directions that nevertheless produce discontinuity;
- adjacency assignment;
- supported `BoundaryEdgeUse` cardinality;
- non-manifold runtime topology;
- any geometric relationship requiring the constructed runtime graph.

Schema validation errors and Geometry Engine build errors remain separate contracts, even when they describe related failures.

---

## Expected Diagnostics

The validation and Geometry Engine layers SHALL expose stable diagnostics for room-boundary failures.

Expected diagnostic categories include:

```text
DUPLICATE_ROOM_BOUNDARY_WALL
MISSING_ROOM_BOUNDARY_WALL
CROSS_LEVEL_ROOM_BOUNDARY
ROOM_WALL_REFERENCE_MISMATCH
OPEN_ROOM_BOUNDARY
INVALID_ROOM_BOUNDARY_ORDER
INVALID_ROOM_BOUNDARY_DIRECTION
CLOCKWISE_OUTER_ROOM_BOUNDARY
SELF_INTERSECTING_ROOM_BOUNDARY
DEGENERATE_ROOM_BOUNDARY
PARTIAL_BOUNDARY_OVERLAP
NON_MANIFOLD_WALL_REFERENCE
LEGACY_ROOM_BOUNDARY_MIGRATION_FAILED
```

The exact division between persisted validation codes and Geometry Engine build-error codes may differ, but callers SHALL receive precise and stable diagnostics rather than generic failures.

---

## Geometry Engine Mapping

The Geometry Engine is responsible for transforming the persisted `Room.boundary` into runtime geometric structures.

The persistence model and the runtime geometry model are intentionally separated.

The persisted relationship is:

```text
RoomBoundaryEdge
```

The corresponding runtime traversal relationship is:

```text
BoundaryEdgeUse
```

They are not the same object.

A persisted `RoomBoundaryEdge` contains:

- source wall identity;
- persisted traversal direction.

A runtime `BoundaryEdgeUse` contains:

- a reference to one shared runtime `BoundaryEdge`;
- traversal direction;
- loop ownership;
- traversal-relative start and end vertices;
- runtime identity and ordering information.

The Geometry Engine SHALL preserve the persisted order and direction when constructing runtime loops.

The runtime model may contain concepts such as:

- `GeometryModel`;
- `LevelGeometry`;
- `Vertex`;
- `BoundaryEdge`;
- `BoundaryEdgeUse`;
- `Loop`;
- `Polygon`.

Runtime geometry objects are derived data and SHALL never be persisted as replacements for the domain model.

Renderers and exporters SHALL consume the runtime Geometry Model and SHALL NOT reconstruct room boundaries directly from `ProjectSchema`.

Runtime polygon adjacency SHALL be derived from validated room-loop traversal and shared boundary use, not from the ordering of `Wall.roomIds`.

---

## Editing Semantics

The orientation of a `Wall` is defined by its `start` and `end` endpoints.

Changing this orientation is considered a semantic editing operation rather than a simple geometric modification.

The editor SHALL provide a dedicated **Reverse Wall Direction** operation when the orientation of a wall needs to be inverted.

Executing this operation SHALL:

1. record the wall length;
2. swap the `start` and `end` endpoints of the `Wall`;
3. locate every `RoomBoundaryEdge` referencing that wall;
4. invert each traversal direction:
   - `FORWARD` → `REVERSE`;
   - `REVERSE` → `FORWARD`;
5. transform every opening offset measured from the wall start.

For an opening with:

```text
oldOffsetFromStart
opening.width
wallLength
```

the transformed offset SHALL be:

```text
newOffsetFromStart =
    wallLength
    - oldOffsetFromStart
    - opening.width
```

This preserves the physical location of the opening after the wall's canonical direction is reversed.

Any future wall-relative metadata SHALL either:

- be transformed by the same domain operation; or
- be explicitly defined as invariant under wall-direction reversal.

Reversing a wall and updating all referencing room boundaries, openings, and wall-relative data SHALL be performed as one atomic domain operation.

The operation SHALL:

- validate the complete post-operation state;
- fail without partial persistence;
- be represented as one undoable editor command;
- avoid exposing intermediate inconsistent states.

This guarantees that reversing the internal orientation of a wall does not alter:

- room topology;
- opening placement;
- other wall-relative geometric meaning.

---

## Migration Ownership

Migration from legacy project schemas SHALL live in the schema package or in a schema-owned migration entry point.

Conceptually:

```text
Raw project document
        │
        ▼
Schema-version detection
        │
        ▼
Versioned migration
        │
        ▼
Latest ProjectSchema validation
```

A preferred package structure is:

```text
packages/schema/src/migrations/
├── migrate-project.ts
├── v1-to-v2.ts
└── migration-error.ts
```

The Geometry Engine SHALL receive only projects already migrated to and validated against the current canonical schema.

Migration SHALL NOT be performed by:

- renderers;
- exporters;
- the Geometry Engine;
- arbitrary downstream consumers.

---

## Migration

Existing persisted projects may contain:

```ts
wallIds: Identifier[]
```

These projects require an explicit migration to:

```ts
boundary: RoomBoundaryEdge[]
```

The migration from schema version `1.x` to `2.0.0` SHALL:

1. resolve referenced walls in the room's owning level;
2. reconstruct one deterministic closed traversal;
3. assign `FORWARD` or `REVERSE` for each wall;
4. normalize the resulting outer boundary to counter-clockwise winding;
5. verify room-wall bidirectional consistency or migrate it coherently;
6. persist `boundary`;
7. remove `wallIds`;
8. update `schemaVersion` to `2.0.0`;
9. validate the complete migrated project against the latest canonical schema.

Migration SHALL fail explicitly when:

- no closed loop exists;
- multiple valid loops exist;
- wall order is ambiguous;
- wall direction is ambiguous;
- referenced walls are missing;
- referenced walls belong to another level;
- the loop self-intersects;
- topology is non-manifold;
- room-wall references cannot be reconciled deterministically;
- opening or wall-relative data cannot be preserved;
- the result violates canonical topology rules.

Winding normalization and boundary reordering are permitted during this explicit migration because the operation creates a new canonical project representation.

They are not permitted during ordinary Geometry Engine construction.

### Legacy Compatibility Resolver

A temporary `LegacyRoomBoundaryResolver` MAY be used during transition.

Such a resolver SHALL:

- be isolated from the canonical Geometry Engine contract;
- be invoked only by migration or import-normalization code;
- produce deterministic output only;
- reject ambiguous input;
- report explicit migration or compatibility errors;
- never silently choose between multiple valid loops;
- emit canonical `boundary` data only.

The compatibility resolver is transitional and SHALL NOT redefine `wallIds` as a supported canonical room-boundary model.

### Both-Present Input

Canonical schema version `2.0.0` SHALL reject a room containing both:

```text
wallIds
boundary
```

An explicit migration parser MAY accept both fields only to:

- verify that they describe the same wall membership;
- reject inconsistent data;
- emit canonical `boundary` only.

No ordinary consumer may choose one field and ignore the other.

---

## Consequences

The chosen representation provides:

- deterministic polygon generation;
- deterministic loop traversal;
- deterministic inward and outward normals;
- simpler mesh generation;
- explicit room topology;
- easier validation;
- easier shared-wall analysis;
- stable editing semantics;
- preservation of opening placement during wall reversal;
- easier interoperability with CAD-like algorithms;
- direct mapping to runtime `BoundaryEdgeUse` objects;
- clear distinction between draft validity and geometry buildability;
- versioned migration from legacy persisted data.

The cost is:

- a more verbose persisted model;
- a breaking schema-version change;
- migration infrastructure in the schema package;
- migration work for legacy projects;
- additional structural, cross-reference, consistency, and geometric validation rules;
- editor responsibilities for maintaining boundary and wall-relative consistency;
- atomic update requirements when wall direction changes;
- explicit failure handling for ambiguous legacy topology;
- updates to fixtures, tests, generated JSON Schema, and documentation.

---

## Implementation Impact

Implementing this ADR affects at least:

- `packages/schema/src/physical-building/room.ts`;
- `packages/schema/src/physical-building/wall.ts`;
- schema-inferred TypeScript types;
- cross-reference validation;
- reference-consistency validation;
- geometry validation;
- validation error codes;
- schema migrations and schema-version handling;
- project fixtures and examples;
- generated JSON Schema;
- schema tests;
- project-schema documentation;
- any consumer of `Room.wallIds`.

The implementation SHALL update canonical examples and generated artifacts so that schema version `2.0.0` consistently uses `Room.boundary`.

Legacy `wallIds` examples SHOULD be retained only as migration fixtures.

---

## Future Work

Future support for holes MAY introduce multiple persisted boundary loops.

A future room representation may distinguish:

- one outer boundary with counter-clockwise winding;
- zero or more inner boundaries with clockwise winding.

Future editor implementations MAY provide higher-level topology operations such as:

- room splitting;
- room merging;
- automatic boundary reconstruction;
- shared-wall creation;
- wall-direction normalization;
- hole creation and removal.

Future schema evolution MAY introduce dedicated types for outer and inner room loops while preserving the ordered and oriented `RoomBoundaryEdge` semantics established by this ADR.

Future Geometry Engine implementations SHALL consume the explicit persisted boundary as the canonical topological description of a room.
