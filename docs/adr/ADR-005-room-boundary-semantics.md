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

This representation was sufficient for structural validation because it could assert that a room referred to existing walls. However, it is not expressive enough for future geometry processing.

The Geometry Engine, the 2D editor, and the 3D renderer require an explicit and deterministic representation of a room boundary. Room perimeter semantics must therefore encode not only which walls participate in the boundary, but also the order in which they are traversed and the direction of traversal for each wall.

---

## Problem

An unordered list of wall identifiers does not define a deterministic polygon. It requires downstream systems to reconstruct topology before performing geometric operations.

An ordered list of wall identifiers improves determinism, but still does not specify how each wall is traversed by the room boundary. The Geometry Engine would still need to infer whether the room follows a wall from `wall.start` to `wall.end` or from `wall.end` to `wall.start`.

This inference would introduce ambiguity into polygon generation, normal calculation, mesh generation, validation, and interoperability with CAD-like algorithms.

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

The traversal direction is relative to the wall definition.

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

The direction belongs to the relationship `Room -> Wall`. It is **NOT** a property of `Wall` itself.

The JSON model should conceptually evolve towards something equivalent to:

```ts
type RoomBoundaryEdge = {
  wallId: Identifier;
  direction: "FORWARD" | "REVERSE";
}
```

and:

```ts
boundary: RoomBoundaryEdge[]
```

---

## Winding Convention

All external room boundaries SHALL be stored in counter-clockwise order within the local coordinate system of the corresponding `Level`.

Future support for holes MAY use clockwise winding.

---

## Geometry Engine

The Geometry Engine is responsible for transforming the persisted `Room` boundary into runtime geometric structures.

The persistence model and the runtime geometry model are intentionally separated.

Runtime geometry objects are considered derived data and SHALL never be persisted.

The runtime model may contain concepts such as:

- `Vertex`;
- `Edge`;
- `HalfEdge`;
- `Loop`;
- `Polygon`;
- `Face`;
- `Mesh`.

These runtime structures are **NOT** part of the persisted schema.

---

## Editing Semantics

The orientation of a `Wall` is defined by its `start` and `end` endpoints.

Changing this orientation is considered a semantic editing operation rather than a simple geometric modification.

The editor SHALL provide a dedicated **Reverse Wall Direction** operation when the orientation of a wall needs to be inverted.

Executing this operation SHALL:

1. swap the `start` and `end` endpoints of the `Wall`;
2. locate every `RoomBoundaryEdge` referencing that `Wall`;
3. automatically invert its traversal direction:
   - `FORWARD` → `REVERSE`
   - `REVERSE` → `FORWARD`

This guarantees that reversing the internal orientation of a wall does **not** alter the topological meaning of any room boundary.

As a consequence, the room topology remains stable while only the wall's internal geometric representation changes.

---

## Consequences

The chosen representation provides:

- deterministic polygon generation;
- deterministic inward and outward normals;
- simpler mesh generation;
- explicit room topology;
- easier validation;
- easier interoperability with CAD-like algorithms.

The cost is:

- a slightly more verbose persisted model;
- additional validation rules ensuring consistency between geometry and traversal direction;
- editor responsibilities for maintaining boundary consistency when wall orientation changes.

---

## Future Work

Future schema work SHALL evolve `Room` persistence from:

```ts
wallIds: Identifier[]
```

towards an explicit:

```ts
boundary: RoomBoundaryEdge[]
```

representation.

Validation rules SHALL verify that the ordered and oriented boundary is geometrically consistent with the referenced walls.

Future support for holes MAY introduce additional boundary loops using clockwise winding while preserving counter-clockwise winding for external room boundaries.

Future Geometry Engine implementations SHALL consume the explicit boundary representation as the canonical topological description of a room.

Future editor implementations MAY provide higher-level topology editing operations (such as room splitting, room merging, or automatic boundary reconstruction) built upon the `RoomBoundaryEdge` representation.
