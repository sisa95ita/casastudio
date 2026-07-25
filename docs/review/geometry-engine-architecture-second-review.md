# Geometry Engine Architecture Second Review

Date: 2026-07-21

Reviewed documents:

- `docs/adr/ADR-006-geometry-engine-architecture.md`
- `docs/geometry/geometry-runtime-model.md`

Related context reviewed:

- `docs/adr/ADR-005-room-boundary-semantics.md`
- `packages/schema/src/physical-building/room.ts`
- `packages/schema/src/physical-building/wall.ts`
- `packages/schema/src/validation/geometry.ts`
- `packages/schema/src/validation/cross-reference.ts`
- `packages/geometry/src/index.ts`
- `apps/web/src/App.tsx`

## Executive Summary

The revised runtime model is now broadly consistent with ADR-006 and addresses the major architectural issues identified in the previous review.

The most important corrections are present:

- shared physical boundaries are represented once through `BoundaryEdge`;
- loop-specific traversal direction is separated into `BoundaryEdgeUse`;
- level-scoped planar geometry is grouped under `LevelGeometry`;
- staircases are represented as independent runtime geometry owned by `GeometryModel`;
- runtime ownership and lifecycle are explicit;
- renderer neutrality is clearly preserved;
- geometry-specific build errors are separated from schema validation errors.

The design is ready to move toward implementation after resolving a small set of remaining ambiguities. The highest-priority unresolved issue is still the current persisted schema: `Room` uses unordered `wallIds`, while ADR-005 requires ordered and oriented room boundaries. That is not a flaw in the revised runtime model, but it is a real implementation blocker for deterministic geometry construction unless handled explicitly.

## Overall Verdict

Recommendation: proceed with implementation planning, but clarify the remaining API and construction rules below before writing the first production classes.

The architecture is internally sound. The remaining risks are not structural showstoppers; they are mostly contract-definition issues that could otherwise become inconsistent implementations:

- side assignment for `BoundaryEdge.leftPolygon` and `rightPolygon`;
- how `BoundaryEdge` adjacency relates to `BoundaryEdgeUse` traversal;
- mutable construction APIs versus read-only public model APIs;
- deterministic vertex identity and coordinate tolerance;
- source-domain traceability shape;
- the transitional gap between current `Room.wallIds` and ADR-005 `Room.boundary`.

## 1. Consistency Between ADR-006 and the Runtime Model

The runtime model now aligns well with ADR-006.

ADR-006 states that renderers consume `GeometryModel`, not `ProjectSchema`, and that the Geometry Engine is a stateless transformation service. The runtime model repeats this boundary clearly by making `GeometryModel` the public contract for renderers, exporters, and external geometric algorithms.

ADR-006 identifies the initial core primitives as:

- `Vertex`
- `BoundaryEdge`
- `Loop`
- `Polygon`

The runtime model keeps those primitives and adds implementation-level support objects:

- `LevelGeometry`
- `BoundaryEdgeUse`
- `StairGeometry`
- `StairFlightGeometry`
- `StairLandingGeometry`

These additions are consistent with ADR-006. They do not violate the core primitive model; they clarify ownership, traversal direction, and independent staircase handling.

The one mild wording mismatch is that ADR-006 still describes navigation as `BoundaryEdge ↔ Loop`, while the runtime model correctly routes that relationship through `BoundaryEdgeUse`. This is acceptable conceptually, but implementers should treat `BoundaryEdgeUse` as the concrete relationship object:

```text
- Conceptual ADR relationship: BoundaryEdge <-> Loop
- Runtime implementation: BoundaryEdge <-> BoundaryEdgeUse <-> Loop
```

Suggested documentation tweak: add one sentence to ADR-006 stating that concrete runtime models may represent `BoundaryEdge <-> Loop` through an edge-use object when shared boundaries require loop-specific traversal direction.

## 2. Object Responsibilities

### GeometryModel

The responsibilities are coherent:

- owns the complete runtime graph;
- organizes geometry by level;
- owns inter-level staircase geometry;
- provides source-project traceability;
- provides model-level lookup.

Remaining ambiguity: model-level lookup methods such as `getVertex(id)` and `getBoundaryEdge(id)` must define whether runtime IDs are globally unique across the whole `GeometryModel`.

The identity section implies global uniqueness through deterministic prefixes such as `level:<level-id>`, `edge:<wall-id>`, and `polygon:<room-id>`. This should become an explicit invariant:

```text
All runtime object IDs are unique within one GeometryModel.
```

If IDs are only unique within a level, model-level `getVertex(id)` is ambiguous.

### LevelGeometry

The level grouping is a strong addition. It matches the coordinate model and gives 2D renderers a natural input.

Remaining ambiguity: `LevelGeometry.id` and `sourceLevelId` may be redundant if runtime IDs are deterministic as `level:<level-id>`. That is not a problem, but the API should define their relationship:

```text
id = runtime identifier
sourceLevelId = persisted domain identifier
```

### Vertex

The responsibilities are clean: a vertex is a unique level-local planar point and knows incident boundary edges.

Potential issue: `addIncidentEdge(edge)` and `removeIncidentEdge(edge)` appear in the public expected API, while the public API section says mutable topology after construction is outside the initial runtime API.

Recommended alternative:

- expose mutation methods only to builders or constructors;
- expose read-only methods on public runtime objects.

For example:

```ts
interface Vertex {
  id(): GeometryId;
  position(): Point2D;
  level(): LevelGeometry;
  incidentEdges(): readonly BoundaryEdge[];
  degree(): number;
}
```

The builder can use an internal mutable representation and freeze or seal the public model after construction.

### BoundaryEdge

`BoundaryEdge` now has the right responsibilities:

- physical boundary identity;
- endpoint vertices;
- source wall traceability;
- adjacent polygon references;
- opening access;
- no single parent loop.

Remaining ambiguity: the model says `leftPolygon` and `rightPolygon` depend on canonical edge direction, but it does not define the algorithm for assigning sides. This matters for normals, wall thickness offsets, selection, and exporters.

Recommended clarification:

```text
Given a BoundaryEdge traversed from startVertex to endVertex in XZ space, leftPolygon is the polygon whose interior lies to the mathematical left of that directed segment; rightPolygon is the polygon whose interior lies to the right.
```

This also requires a clear sign convention for XZ orientation. Because CasaStudio uses XZ as the plan plane, the implementation should explicitly define the 2D cross-product convention used for "left".

### BoundaryEdgeUse

This is the most important correction in the revised model. It resolves the previous conflict between shared edges and singular loop ownership.

Responsibilities are well-scoped:

- references one physical edge;
- records `FORWARD` or `REVERSE`;
- belongs to one loop;
- exposes traversal-relative start/end vertices.

Recommended addition: define the maximum valid number of uses for a boundary edge in the initial model.

For simple room topology, a physical edge should usually have:

- one use for an exterior boundary;
- two uses for a shared boundary;
- more than two uses should produce `NON_MANIFOLD_BOUNDARY`.

This constraint is implied by the build error list but should be stated near `BoundaryEdgeUse` or `Shared Boundaries`.

### Loop

`Loop` is now correctly modeled as ordered `BoundaryEdgeUse` objects rather than physical edges.

The closure rule is clear.

Remaining issue: `edges()` may be misleading because it returns underlying `BoundaryEdge` objects and loses traversal direction. Consumers that need ordered drawing or area computation must use `edgeUses()` or `vertices()`.

Recommended alternative:

- keep `edgeUses()` as the primary API;
- either remove `edges()` from the initial public API, or document it as a convenience method that must not be used for directional traversal.

Suggested wording:

```text
edges() returns physical boundary edges in loop order but intentionally discards traversal direction. Consumers that need ordered geometry must use edgeUses() or vertices().
```

### Polygon

The responsibilities are coherent:

- owns one outer loop;
- owns zero or more inner loops;
- represents a room-derived geometric region;
- provides measurements;
- retains `sourceRoomId`.

The `containsPoint(point)` correction is good. It avoids tying point containment to existing topology vertices.

Remaining ambiguity: the point type should be named or linked to the coordinate convention. For MVP it should likely be a level-local planar point:

```ts
containsPoint(point: Point2D): boolean
```

This method should also define boundary behavior:

- is a point exactly on the boundary considered inside?
- are inner loops ignored initially because `innerLoops = []`?

### StairGeometry

The staircase design is now aligned with ADR-006. It is independent from room boundary loops and owned directly by `GeometryModel`.

Remaining ambiguity: `connectedLevelIds`, `startLevelId()`, and `endLevelId()` should be explicitly mapped to domain `fromLevelId` and `toLevelId`. The implementation should not infer start/end solely from geometry because stairs may be represented in local level coordinates.

Recommended shape:

```text
sourceStaircaseId
fromLevelId
toLevelId
fromRoomId?
toRoomId?
flights
landings
```

This preserves useful topology without making renderers read `ProjectSchema`.

### StairFlightGeometry and StairLandingGeometry

These are adequate for MVP rendering and exporting.

Potential issue: `startPosition` and `endPosition` are not explicitly scoped. They likely come from the domain stair flight and are level-local XZ positions. Because staircases can connect levels, each position should define its coordinate frame.

Recommended clarification:

```text
StairFlightGeometry.startPosition and endPosition are planar XZ coordinates in the source staircase's owning level coordinate space unless a future design introduces explicit per-point coordinate frames.
```

If a staircase may be owned by one level but end on another level with a different local origin in the future, this assumption must be revisited.

## 3. Ownership and Lifecycle

The ownership hierarchy is consistent:

```text
GeometryModel
├── LevelGeometry
│   ├── Vertex
│   ├── BoundaryEdge
│   ├── BoundaryEdgeUse
│   ├── Loop
│   └── Polygon
└── StairGeometry
    ├── StairFlightGeometry
    └── StairLandingGeometry
```

The lifecycle rules are also coherent:

- runtime objects are derived;
- they are not persisted;
- rebuilding invalidates references;
- runtime objects are not shared between model instances;
- complete reconstruction is preferred initially.

Remaining implementation pitfall: bidirectional references plus lifecycle invalidation can create stale references in UI state. Selection state should store source IDs or runtime IDs plus a model revision token, not direct object references across rebuilds.

Recommended implementation rule:

```text
Application state may temporarily hold runtime object references during a render/update pass, but durable UI state should hold source IDs or deterministic runtime IDs.
```

## 4. Topology Representation

The topology representation is now sound for MVP room polygons:

```text
Vertex
BoundaryEdge
BoundaryEdgeUse
Loop
Polygon
```

The revised model correctly separates:

- physical boundary identity: `BoundaryEdge`;
- loop traversal: `BoundaryEdgeUse`;
- closed ordered boundary: `Loop`;
- room-derived region: `Polygon`.

Remaining topology points to clarify before implementation:

1. Define whether a `BoundaryEdgeUse` may appear twice in the same loop.

   For normal simple polygons, this should be invalid. If future non-simple boundaries are needed, they should be introduced deliberately.

2. Define whether self-intersecting loops are invalid.

   The current build errors include `DEGENERATE_POLYGON`, but self-intersection deserves either its own error or explicit inclusion under invalid boundary order.

3. Define whether touching-at-vertex polygons are allowed.

   Rooms may meet at corners without sharing a wall. That should be valid. More complex cases, such as two polygons sharing only a partial overlapping boundary, should produce a build error unless partial edge splitting is explicitly introduced.

4. Define handling of collinear consecutive wall segments.

   These can be valid geometry, but they complicate area, labels, and simplification. The engine should accept them if they form a closed loop, but should not merge them silently because ADR-006 says coordinates must not be silently altered.

5. Define partial overlap behavior.

   If wall A spans `0..10` and wall B spans `0..5` on the same line, the engine cannot represent both as one shared `BoundaryEdge` without splitting or adding a more complex edge model. For MVP, this should produce a build error such as `PARTIAL_BOUNDARY_OVERLAP`.

## 5. Missing Concepts

The revised model intentionally excludes many future concepts, and most exclusions are appropriate.

The following concepts are still worth adding or clarifying before implementation:

### Runtime Opening Geometry

The opening section intentionally defers detailed representation, allowing `BoundaryEdge` to retain source opening information or lightweight derived geometry.

This is acceptable for a first pass, but it creates a renderer boundary risk: ADR-006 says renderers must not read `ProjectSchema`. Therefore, if any initial renderer needs doors or windows, `BoundaryEdge.openings()` must return enough technology-independent data.

Recommended MVP type:

```text
OpeningGeometry
├── id
├── sourceOpeningId
├── sourceWallId
├── type
├── offsetFromStart
├── width
├── height
├── elevation
├── startPositionOnEdge
└── endPositionOnEdge
```

This still does not split topology.

### Wall Height and Thickness

ADR-006 says the 3D renderer uses wall height and extrusion depth. The runtime model lists wall height and thickness only as future `BoundaryEdge` extensions.

If the first 3D renderer needs wall solids, then `BoundaryEdge` must expose source wall height and thickness from the beginning. Otherwise the 3D renderer would need to read `ProjectSchema`, violating ADR-006.

Recommended MVP addition:

```text
BoundaryEdge
├── height
└── thickness
```

These are geometric measurements, not renderer-specific meshes.

### GeometryModel Source Revision

`sourceRevision` is currently listed as a possible future property. The lifecycle model would benefit from including it immediately because the current `Project` has a `revision` field.

Recommended addition:

```text
sourceRevision
```

This supports cache invalidation, debug output, and selection safety.

### Level or Model Units

The coordinate-system document defines centimeters as canonical, but the runtime model does not expose units. If the Geometry Engine accepts a `Project` with `units.length`, consumers may need to know what units the runtime model uses.

Recommended rule:

```text
The Geometry Engine normalizes all runtime geometry to centimeters for MVP and records the normalized length unit on GeometryModel.
```

Alternatively, the engine can reject non-centimeter projects until conversion is designed.

## 6. Ambiguous APIs

### `getVertex(id)` at GeometryModel Scope

Ambiguity: if vertex IDs are coordinate-derived, the same coordinate can exist on different levels.

Recommended rule:

```text
Vertex IDs must include source level context, for example vertex:<level-id>:<coordinate-key>.
```

### `findBoundaryEdgeByWallId(wallId)`

The project schema intends identifiers to be globally unique, but the implementation should not quietly depend on that if future imports violate it.

Recommended behavior:

- if source IDs are guaranteed globally unique, return one edge;
- otherwise expose level-scoped lookup first:

```ts
level.findBoundaryEdgeByWallId(wallId)
```

and make model-level lookup either return all matches or require a level ID.

### `adjacentPolygons()`

This should define ordering. Options:

- return `[left, right]` with nulls removed;
- return unordered non-null polygons;
- return an object `{ left, right }`.

Recommended alternative:

```ts
adjacency(): { left: Polygon | null; right: Polygon | null }
adjacentPolygons(): readonly Polygon[]
```

This keeps side-aware and side-agnostic uses separate.

### `orientation()`

The return type should be explicit:

```text
CLOCKWISE | COUNTER_CLOCKWISE | COLLINEAR
```

For degenerate loops, `COLLINEAR` or a build error should be defined.

### `area()` Versus `signedArea()`

The runtime model includes both, which is good. The contract should specify:

- `signedArea()` returns positive or negative according to the XZ winding convention;
- `area()` returns absolute area and subtracts inner loops if present.

### `containsPoint(point)`

The method should specify:

- expected coordinate frame;
- boundary inclusion behavior;
- hole behavior;
- whether it assumes the polygon has already been validated as simple.

## 7. Potential Implementation Pitfalls

### Builder Mutability Leaking Into Public Objects

Several expected APIs include mutating methods or mutable-sounding collections. This conflicts with the public API expectation that topology mutation is outside the initial runtime API.

Recommended implementation pattern:

```text
Mutable builders -> immutable/read-only runtime objects
```

The engine can build with internal mutable structures, then expose read-only arrays and no public topology mutation methods.

### Direct Object Cycles

The runtime graph will contain cycles:

```text
Polygon -> Loop -> BoundaryEdgeUse -> BoundaryEdge -> Polygon
Vertex -> BoundaryEdge -> Vertex
```

This is acceptable for in-memory traversal, but debug serialization must not naively JSON-stringify runtime objects.

Recommended addition:

```text
Debug serialization should be explicit and ID-based.
```

### Floating-Point Coordinate Keys

Vertex deduplication by coordinate key is necessary, but exact floating-point matching can be brittle if future imports use decimals.

Recommended rule:

- for authored MVP integer-centimeter data, exact keys are acceptable;
- for imported decimal data, introduce an explicit tolerance policy;
- do not silently snap coordinates without reporting normalization.

### Partial Boundary Overlap

The model supports shared complete boundaries, but not partial coincident wall segments unless edges are split. Because ADR-006 rejects silent topology changes, the initial engine should reject partial overlaps.

Recommended build error:

```text
PARTIAL_BOUNDARY_OVERLAP
```

### Room Boundary Inference

The current schema has unordered `wallIds`; inferring order and direction can produce surprising results. This is the largest practical risk.

Recommended approach:

1. Implement ADR-005 persisted `Room.boundary` before the Geometry Engine, or
2. Implement a temporary `LegacyRoomBoundaryResolver` that:
   - accepts `wallIds`;
   - attempts deterministic reconstruction;
   - rejects ambiguous or non-unique loops;
   - labels errors as legacy-boundary inference failures.

Do not silently infer when multiple valid loops are possible.

### Renderer Bypass Pressure

If `BoundaryEdge` does not expose wall height/thickness/openings soon enough, renderers will be tempted to read `ProjectSchema` directly. ADR-006 explicitly forbids this.

Recommendation: include any renderer-required domain-derived measurement in technology-independent runtime objects before renderer implementation begins.

## 8. Remaining Conflicts With Current Codebase

### Geometry Package Is Still Placeholder

`packages/geometry/src/index.ts` currently exports only package status. There is no existing implementation to migrate.

Impact: low. Implementation can start cleanly.

### Current Room Schema Conflicts With ADR-005

`packages/schema/src/physical-building/room.ts` still defines:

```ts
wallIds: IdentifierArraySchema
```

This conflicts with ADR-005, which requires ordered and oriented room boundary edges.

Impact: high. The runtime model expects ordered `BoundaryEdgeUse` objects, but current persisted data does not provide direction or reliable ordering.

Recommended resolution: implement `RoomBoundaryEdge` and `boundary` before or alongside the Geometry Engine.

### Cross-reference Validation Still Uses `room.wallIds`

`validateProjectCrossReferences` validates `room.wallIds` directly. This must evolve when `Room.boundary` is introduced.

Expected migration:

```text
room.wallIds[index]
```

becomes:

```text
room.boundary[index].wallId
```

### Geometry Validation Sequence Mentions Renderability

`validateProjectGeometry` says it should run after renderability validation. That is not consistent with ADR-006's separation between geometric buildability and rendering workflow readiness.

Recommended change during implementation:

```text
ProjectSchema
Cross-reference Validation
Reference Consistency Validation
Geometry Validation / Geometry Build
Renderability Validation
```

Or keep renderability as an independent workflow check that is not a prerequisite for geometry construction.

### Duplicate Wall Detection Is Still Directional

The current `validateProjectGeometry` duplicate key uses `start -> end`, so reversed duplicates are not detected there.

The revised runtime model explicitly requires detection of reversed duplicates. This must be implemented in the Geometry Engine, and schema validation should probably be updated too.

### No Renderer Exists Yet

`apps/web/src/App.tsx` is still a placeholder. There is no current renderer violation, but future renderer work must be designed around `GeometryModel` from the start.

## Recommended Design Changes Before Implementation

### 1. Make Boundary Side Semantics Explicit

Add a precise definition for `leftPolygon` and `rightPolygon`.

Recommended wording:

```text
For a BoundaryEdge directed from startVertex to endVertex in level-local XZ space, leftPolygon is the polygon whose interior lies to the left of that directed segment according to the model's XZ orientation convention; rightPolygon is the polygon whose interior lies to the right. If no polygon exists on a side, that side is null.
```

### 2. Add Wall Height and Thickness to BoundaryEdge MVP

Move `wall height` and `wall thickness` out of future extensions if the first 3D renderer is in scope soon.

This prevents renderer bypass of `GeometryModel`.

### 3. Add Minimal OpeningGeometry

If doors/windows will appear in the first blueprint or 3D view, define a small runtime opening object now.

It should remain associated with `BoundaryEdge` and must not split topology.

### 4. Explicitly Require Globally Unique Runtime IDs

Add the invariant:

```text
Every runtime object ID is unique within one GeometryModel.
```

For vertex IDs, include level context.

### 5. Resolve Current Room Boundary Schema Gap

Either implement ADR-005 before geometry construction or define a temporary legacy resolver.

Preferred path:

```ts
type RoomBoundaryEdge = {
  wallId: Identifier;
  direction: "FORWARD" | "REVERSE";
};

boundary: RoomBoundaryEdge[];
```

### 6. Clarify Public Immutability

Remove mutating methods from the public runtime API or mark them as builder-only/internal.

Recommended implementation style:

```text
GeometryEngineBuilder uses mutable objects.
GeometryModel exposes read-only runtime objects.
```

### 7. Add Build Errors For Self-Intersection And Partial Overlap

Extend the build error list with:

```text
SELF_INTERSECTING_LOOP
PARTIAL_BOUNDARY_OVERLAP
```

These are common failure cases and deserve precise diagnostics.

## Final Assessment

The revised runtime model is now architecturally coherent with ADR-006.

The addition of `BoundaryEdgeUse` is the key fix. It makes shared boundaries, loop traversal direction, and polygon ownership compatible without duplicating physical geometry. `LevelGeometry` and `StairGeometry` also close the earlier ownership gaps.

The design should change slightly before implementation in the areas above, especially around side semantics, public immutability, runtime ID uniqueness, and the current schema gap around unordered `Room.wallIds`.

The most important implementation warning is this:

```text
Do not let renderers compensate for missing GeometryModel data by reading ProjectSchema directly.
```

If a renderer needs wall height, wall thickness, opening placement, staircase metadata, or level information, that data should be added to the Geometry Model in a renderer-neutral form.
