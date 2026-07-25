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

Legacy input may be migrated or handled by an explicit compatibility layer, but `boundary` is the canonical representation.

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

## Continuity and Closure

A valid room boundary SHALL form one closed and continuous loop.

For every consecutive pair of boundary entries:

```text
current.traversalEnd == next.traversalStart
```

The final boundary entry SHALL connect back to the first:

```text
last.traversalEnd == first.traversalStart
```

A valid room boundary SHALL contain at least three entries:

```text
boundary.length >= 3
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

## Validation Responsibilities

Validation is divided by responsibility.

### Structural Validation

Structural schema validation SHALL verify:

- `boundary` exists when required;
- `boundary` is an array;
- the minimum cardinality is satisfied;
- every entry contains `wallId`;
- every entry contains a valid traversal direction;
- traversal directions are limited to `FORWARD` and `REVERSE`;
- duplicate wall references within the same boundary are rejected for the initial model.

Structural validation does not need to reconstruct geometric topology.

### Cross-Reference Validation

Cross-reference validation SHALL verify:

- every `RoomBoundaryEdge.wallId` references an existing wall;
- referenced walls belong to the appropriate project context;
- referenced walls belong to the room's level when level ownership requires it.

### Geometry Validation and Geometry Build Validation

Geometry validation or Geometry Engine build validation SHALL verify:

- traversal continuity;
- loop closure;
- canonical winding;
- non-degenerate walls;
- non-degenerate polygons;
- self-intersection;
- supported shared-wall cardinality;
- adjacency consistency;
- unsupported coincident or partially overlapping boundaries;
- any geometric relationship that cannot be validated structurally.

Schema validation errors and Geometry Engine build errors remain separate contracts, even when they describe related failures.

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

---

## Editing Semantics

The orientation of a `Wall` is defined by its `start` and `end` endpoints.

Changing this orientation is considered a semantic editing operation rather than a simple geometric modification.

The editor SHALL provide a dedicated **Reverse Wall Direction** operation when the orientation of a wall needs to be inverted.

Executing this operation SHALL:

1. swap the `start` and `end` endpoints of the `Wall`;
2. locate every `RoomBoundaryEdge` referencing that wall;
3. invert each traversal direction:
   - `FORWARD` → `REVERSE`;
   - `REVERSE` → `FORWARD`.

Reversing a wall and updating all referencing room-boundary directions SHALL be performed as one atomic domain operation.

The operation SHALL NOT expose or persist an intermediate state in which:

- the wall endpoints have been swapped;
- referencing room boundaries have not yet been updated.

This guarantees that reversing the internal orientation of a wall does not alter the topological meaning of any room boundary.

As a consequence, room topology remains stable while only the wall's internal geometric representation changes.

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

The preferred migration strategy is:

1. resolve referenced walls;
2. reconstruct one deterministic closed traversal;
3. assign `FORWARD` or `REVERSE` for each wall;
4. normalize the resulting outer boundary to counter-clockwise winding;
5. persist `boundary`;
6. remove `wallIds`.

Migration SHALL fail explicitly when:

- no closed loop exists;
- multiple valid loops exist;
- wall order is ambiguous;
- wall direction is ambiguous;
- referenced walls are missing;
- the loop self-intersects;
- the result violates the canonical winding or topology rules.

A temporary `LegacyRoomBoundaryResolver` MAY be used during transition.

Such a resolver SHALL:

- be isolated from the canonical Geometry Engine contract;
- produce deterministic output only;
- reject ambiguous input;
- report explicit migration or compatibility errors;
- never silently choose between multiple valid loops.

The compatibility resolver is transitional and SHALL NOT redefine `wallIds` as a supported canonical room-boundary model.

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
- easier interoperability with CAD-like algorithms;
- direct mapping to runtime `BoundaryEdgeUse` objects.

The cost is:

- a more verbose persisted model;
- migration work for legacy projects;
- additional structural and geometric validation rules;
- editor responsibilities for maintaining boundary consistency;
- atomic update requirements when wall direction changes;
- explicit failure handling for ambiguous legacy topology.

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
