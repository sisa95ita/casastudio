# Geometry Runtime Model

> **Status:** Draft

---

# Purpose

This document describes the in-memory geometry model used by CasaStudio.

Unlike the persisted `ProjectSchema`, which represents architectural concepts, the Geometry Runtime Model represents the building from a geometric and topological perspective.

Its primary purpose is to support:

- geometric algorithms;
- topology traversal;
- 2D rendering;
- 3D rendering;
- exporters;
- future spatial analysis.

The runtime model is produced by the `GeometryEngine` and exists only in memory.

---

# Relationship with ADR-006

ADR-006 defines the architecture of the Geometry Engine and the boundaries between:

- `ProjectSchema`;
- `GeometryEngine`;
- `GeometryModel`;
- renderers and exporters.

This document specifies the runtime objects that compose the `GeometryModel`.

Whenever possible:

- architectural decisions belong to ADR-006;
- runtime object design belongs to this document;
- implementation-specific details belong to the source code.

The `GeometryModel` is the public contract between the Geometry Engine and every downstream consumer.

Renderers, exporters, and external geometric algorithms must consume the `GeometryModel` and must not access `ProjectSchema` directly.

The conceptual `BoundaryEdge ↔ Loop` relationship described by ADR-006 is represented concretely through `BoundaryEdgeUse`:

```text
BoundaryEdge ↔ BoundaryEdgeUse ↔ Loop
```

This preserves one physical boundary identity while allowing different loops to traverse it in different directions.

---

# Document Status

This document is a living technical design document.

Unlike an accepted ADR, it may evolve as the Geometry Runtime Model gains new capabilities.

Changes to this document must remain compatible with the architectural constraints established by ADR-006.

---

# Design Principles

## Geometry over Architecture

Runtime objects represent geometry rather than architectural semantics.

For example:

- a domain `Room` produces a runtime `Polygon`;
- a domain `Wall` produces a runtime `BoundaryEdge`;
- a domain `Opening` produces a runtime `OpeningGeometry`;
- a domain `Level` produces a runtime `LevelGeometry`;
- a domain `Staircase` produces runtime staircase geometry.

The runtime model is optimized for geometric and topological reasoning.

Architectural objects may be retained as traceability references, but they do not define runtime topology.

---

## Explicit Topology

Topology is represented explicitly.

Objects know their neighboring objects whenever doing so simplifies traversal and geometric algorithms.

For example:

- vertices know their incident boundary edges;
- boundary edges know their endpoint vertices;
- boundary edge uses know the loop in which an edge is traversed;
- loops know their ordered boundary edge uses;
- polygons know their outer and inner loops.

Ordinary topology traversal should not require reconstructing relationships from source identifiers.

---

## Shared Geometry

Every physical geometric entity exists only once within its ownership scope.

If two rooms share one physical wall, both polygons reference the same `BoundaryEdge`.

Duplicated runtime geometry is not allowed.

The direction in which a shared edge is traversed does not belong to the `BoundaryEdge` itself. It belongs to a `BoundaryEdgeUse` contained by a specific loop.

---

## Stateless Construction

The Geometry Model is entirely reconstructed by the `GeometryEngine`.

Runtime objects:

- are not persisted;
- are not the source of truth;
- must not mutate the input `ProjectSchema`;
- may be discarded and rebuilt when the domain model changes.

The `GeometryEngine` is responsible for producing a coherent runtime object graph from the persisted domain model.

---

## Immutable Public Runtime

The Geometry Engine may use mutable builders or intermediate data structures while constructing the runtime graph.

After construction, public runtime objects are read-only.

Topology mutation is an internal concern of the Geometry Engine and is not part of the initial public runtime API.

Conceptually:

```text
ProjectSchema
    │
    ▼
Mutable Geometry Builders
    │
    ▼
Immutable GeometryModel
```

---

## Renderer Neutrality

The Geometry Model contains geometric and topological information, not renderer-specific data.

It must not contain:

- Three.js objects;
- GPU resources;
- renderer-specific meshes;
- SVG nodes;
- Canvas objects;
- PDF drawing commands;
- renderer-specific triangulation results.

A renderer may derive those resources from the Geometry Model.

Renderer-required domain-derived measurements must be exposed by the Geometry Model in a technology-independent form.

Renderers must not compensate for missing runtime data by reading `ProjectSchema` directly.

---

## One Model for 2D and 3D

The same Geometry Model supports both 2D and 3D consumers.

A 2D renderer primarily consumes planar coordinates and level-local topology.

A 3D renderer additionally consumes:

- level elevations;
- wall heights;
- wall thicknesses;
- opening elevations;
- staircase geometry;
- other vertical information.

Separate 2D and 3D geometry engines are not required.

---

# Object Overview

The runtime model is organized by building level, with independent geometry for elements that connect or span multiple levels.

```text
GeometryModel
│
├── LevelGeometry
│   ├── Vertex
│   ├── BoundaryEdge
│   ├── OpeningGeometry
│   ├── BoundaryEdgeUse
│   ├── Loop
│   └── Polygon
│
└── StairGeometry
    ├── StairFlightGeometry
    └── StairLandingGeometry
```

The core planar topology is composed of:

```text
Vertex
   │
   ▼
BoundaryEdge
   ▲
   │
BoundaryEdgeUse
   │
   ▼
Loop
   │
   ▼
Polygon
```

`BoundaryEdgeUse` separates physical edge identity from loop traversal direction.

`OpeningGeometry` is associated with a `BoundaryEdge` and does not split boundary topology.

---

# GeometryModel

Represents the complete in-memory geometric model of one project.

The `GeometryModel` is the root aggregate of the runtime geometry graph.

Every runtime object ultimately belongs to exactly one `GeometryModel` instance.

## Responsibilities

- own all runtime geometry objects;
- organize planar geometry by level;
- own staircase geometry connecting or spanning levels;
- provide model-level lookup and traversal;
- retain project-level traceability;
- retain the source project revision;
- define the lifetime of all runtime objects.

## Typical Properties

```text
id
sourceProjectId
sourceRevision
levels
staircases
```

Possible future properties:

```text
metadata
```

## Expected API

```text
sourceProjectId()

sourceRevision()

levels()

staircases()

getLevel(id)

getVertex(id)

getBoundaryEdge(id)

getBoundaryEdgeUse(id)

getOpeningGeometry(id)

getLoop(id)

getPolygon(id)

getStairGeometry(id)

findPolygonByRoomId(roomId)

findBoundaryEdgeByWallId(wallId)

findOpeningGeometryBySourceId(openingId)

findStairGeometryByStaircaseId(staircaseId)
```

All model-level lookup methods rely on the invariant that every runtime object identifier is unique within one `GeometryModel`.

The Geometry Model owns runtime objects even when those objects contain bidirectional references to one another.

---

# LevelGeometry

Represents all planar geometry belonging to one building level.

## Responsibilities

- group geometric objects by level;
- provide the elevation required to place planar geometry in 3D space;
- provide efficient access to the geometry of one level;
- preserve traceability to the source domain level.

## Typical Properties

```text
id
sourceLevelId
elevation
vertices
boundaryEdges
openingGeometries
boundaryEdgeUses
loops
polygons
```

`id` is the runtime identifier.

`sourceLevelId` is the persisted domain identifier from which the runtime level geometry was derived.

## Expected API

```text
sourceLevelId()

elevation()

vertices()

boundaryEdges()

openingGeometries()

boundaryEdgeUses()

loops()

polygons()

getVertex(id)

getBoundaryEdge(id)

getOpeningGeometry(id)

getBoundaryEdgeUse(id)

getLoop(id)

getPolygon(id)

findPolygonByRoomId(roomId)

findBoundaryEdgeByWallId(wallId)
```

A 2D blueprint renderer may consume one `LevelGeometry`.

A whole-building 3D renderer may consume all level geometries from the `GeometryModel`.

All returned collections are read-only.

---

# Vertex

Represents a unique geometric point within a level.

## Responsibilities

- store planar coordinates;
- identify one unique point in level-local space;
- provide adjacency information;
- act as the endpoint of one or more boundary edges.

## Typical Properties

```text
id
position
incidentEdges
level
```

The planar position is expressed using the coordinate convention established by the CasaStudio coordinate-system documentation.

Conceptually:

```text
position.x
position.z
```

Vertical placement is normally derived from the owning `LevelGeometry` elevation rather than duplicated in every vertex.

A renderer or algorithm may obtain a world-space position equivalent to:

```text
x = position.x
y = level.elevation
z = position.z
```

The exact axis convention remains governed by the project coordinate-system specification.

## Expected API

```text
position()

level()

incidentEdges()

degree()
```

A vertex has no knowledge of architectural concepts such as rooms or walls.

Vertex adjacency is populated internally by the Geometry Engine during construction and is read-only afterward.

---

# BoundaryEdge

Represents one physical geometric boundary segment.

A `BoundaryEdge` commonly derives from one domain `Wall`, but it remains a runtime geometric object.

## Responsibilities

- connect two vertices;
- represent one physical boundary only once;
- reference adjacent polygons;
- provide geometric measurements;
- expose renderer-neutral wall dimensions;
- preserve traceability to the source wall;
- provide access to opening geometry associated with the boundary.

## Typical Properties

```text
id
startVertex
endVertex
leftPolygon
rightPolygon
sourceWallId
height
thickness
openings
```

The interpretation of `leftPolygon` and `rightPolygon` depends on the canonical direction from `startVertex` to `endVertex`.

Given a `BoundaryEdge` directed from `startVertex` to `endVertex` in level-local XZ space:

- `leftPolygon` is the polygon whose interior lies to the mathematical left of the directed segment;
- `rightPolygon` is the polygon whose interior lies to the mathematical right of the directed segment.

The exact interpretation of mathematical left and right follows the project's coordinate-system specification and its XZ orientation convention.

An exterior boundary has only one adjacent polygon.

A shared interior boundary may have two adjacent polygons.

## Expected API

```text
start()

end()

otherVertex(vertex)

leftPolygon()

rightPolygon()

adjacency()

adjacentPolygons()

isExterior()

length()

height()

thickness()

sourceWallId()

openings()
```

`adjacency()` returns side-aware adjacency:

```text
left
right
```

`adjacentPolygons()` returns the non-null adjacent polygons without side metadata.

## Constraints

A `BoundaryEdge`:

- must not own a single `parentLoop`;
- may participate in multiple loops;
- must not be duplicated merely because different loops traverse it in different directions;
- must not be split solely because it contains a door or window;
- must reference exactly two valid endpoint vertices;
- must contain zero, one, or two adjacent polygons in the initial manifold model.

Future extensions may include:

- direction vector;
- normal calculation;
- geometric offset helpers;
- richer wall profile geometry.

---

# OpeningGeometry

Represents one renderer-neutral opening associated with a `BoundaryEdge`.

An opening may derive from a domain door, window, or another wall opening type.

Opening geometry does not split boundary topology.

## Responsibilities

- preserve source opening traceability;
- preserve source wall traceability;
- represent placement along a boundary edge;
- expose horizontal and vertical dimensions;
- provide technology-independent data required by 2D renderers, 3D renderers, and exporters.

## Typical Properties

```text
id
sourceOpeningId
sourceWallId
type
edge
offsetFromStart
width
height
elevation
startPositionOnEdge
endPositionOnEdge
```

`offsetFromStart` is measured from the canonical `BoundaryEdge.startVertex` toward `BoundaryEdge.endVertex`.

`elevation` represents the opening's vertical offset relative to the owning level or wall reference frame, according to the project coordinate-system specification.

## Expected API

```text
sourceOpeningId()

sourceWallId()

type()

edge()

offsetFromStart()

width()

height()

elevation()

startPositionOnEdge()

endPositionOnEdge()
```

The opening type is renderer-neutral and may reflect a domain-level category such as:

```text
DOOR
WINDOW
GENERIC
```

The exact set of opening types may evolve with the persisted schema.

## Constraints

An `OpeningGeometry`:

- belongs to exactly one `BoundaryEdge`;
- must lie within the usable length of its boundary edge;
- must not change loop closure;
- must not create additional vertices or boundary edges solely to represent the opening;
- must retain enough data that renderers do not need to read `ProjectSchema`.

---

# BoundaryEdgeUse

Represents the traversal of one `BoundaryEdge` inside one `Loop`.

This object separates the identity of a physical boundary from the direction in which that boundary is traversed by a loop.

## Responsibilities

- reference one shared `BoundaryEdge`;
- define the traversal direction of that edge;
- reference the containing loop;
- expose traversal-relative start and end vertices.

## Typical Properties

```text
id
edge
direction
loop
index
```

The direction is explicit:

```text
FORWARD
REVERSE
```

`FORWARD` traverses the edge from its canonical `startVertex` to its canonical `endVertex`.

`REVERSE` traverses it from its canonical `endVertex` to its canonical `startVertex`.

## Expected API

```text
edge()

direction()

loop()

index()

startVertex()

endVertex()

isForward()

isReverse()
```

## Shared Boundary Example

```text
Polygon A outer loop
└── BoundaryEdgeUse(shared-edge, FORWARD)

Polygon B outer loop
└── BoundaryEdgeUse(shared-edge, REVERSE)
```

The physical boundary exists once.

Its traversal exists once per participating loop.

## Constraints

For the initial implementation:

- an exterior boundary normally participates in one `BoundaryEdgeUse`;
- an interior shared boundary normally participates in two `BoundaryEdgeUse` instances;
- more than two uses indicate a non-manifold boundary and must produce `NON_MANIFOLD_BOUNDARY`;
- the same `BoundaryEdgeUse` instance must not appear more than once in a loop;
- a simple loop must not traverse the same physical `BoundaryEdge` more than once.

More complex non-simple topology requires a separate design decision.

---

# Loop

Represents one closed, ordered boundary traversal.

A loop contains ordered `BoundaryEdgeUse` objects rather than owning physical boundary edges directly.

## Responsibilities

- maintain an ordered boundary traversal;
- preserve edge direction;
- identify closed topology;
- provide ordered vertices and edges;
- compute planar orientation and area;
- reference its owning polygon.

## Typical Properties

```text
id
edgeUses
polygon
role
```

The loop role may distinguish:

```text
OUTER
INNER
```

## Expected API

```text
edgeUses()

edges()

vertices()

polygon()

role()

isClosed()

orientation()

signedArea()

area()
```

`edgeUses()` is the primary directional traversal API.

`edges()` returns the underlying physical `BoundaryEdge` objects in loop order but intentionally discards traversal direction. Consumers that need ordered geometry must use `edgeUses()` or `vertices()`.

`vertices()` must respect each `BoundaryEdgeUse.direction`.

## Closure Rule

For every consecutive pair of edge uses:

```text
current.endVertex == next.startVertex
```

For a closed loop:

```text
last.endVertex == first.startVertex
```

## Orientation

Loop orientation is determined from the ordered traversal.

The canonical winding convention for outer and inner loops must be defined consistently by the Geometry Engine.

For example:

```text
outer loops: counter-clockwise
inner loops: clockwise
```

The specific convention must remain consistent across:

- adjacency assignment;
- area calculation;
- renderer consumption;
- exporter consumption.

`orientation()` returns one of:

```text
CLOCKWISE
COUNTER_CLOCKWISE
COLLINEAR
```

A valid non-degenerate polygon loop must not be `COLLINEAR`.

`signedArea()` follows the project XZ winding convention.

`area()` returns the absolute planar area of the loop.

## Constraints

A valid loop:

- is closed;
- contains at least three non-degenerate edge uses;
- does not self-intersect;
- does not contain an edge-use discontinuity;
- does not traverse the same physical boundary twice in the initial simple-loop model.

Future extensions may include:

- cached signed area;
- cached bounding box;
- spatial indexing;
- loop normalization.

---

# Polygon

Represents one geometric region, normally derived from one domain `Room`.

## Responsibilities

- own one outer loop;
- own zero or more inner loops;
- represent one room-derived geometric region;
- provide geometric measurements;
- preserve source-room traceability.

## Typical Properties

```text
id
outerLoop
innerLoops
sourceRoomId
level
```

`innerLoops` exists in the initial API even when no current persisted domain concept produces polygon holes.

For the initial implementation:

```text
innerLoops = []
```

Support for generating holes from the domain model is outside the MVP unless introduced by a separate design decision.

## Expected API

```text
outerLoop()

innerLoops()

loops()

edgeUses()

edges()

vertices()

level()

sourceRoomId()

containsPoint(point)

area()

centroid()
```

`edgeUses()` returns ordered traversal uses from the polygon loops.

`edges()` returns physical boundaries and must not be used when traversal direction is required.

The initial `containsPoint` contract operates on a level-local planar `Point2D` rather than a `Vertex`, because point containment is not limited to existing topology vertices.

Unless otherwise specified by a later algorithm contract:

- the input point uses the owning level's coordinate frame;
- a point on the outer boundary is considered contained;
- a point on an inner-loop boundary is not considered contained;
- the method assumes the polygon has already passed runtime geometry validation.

`area()` returns the outer-loop area minus all inner-loop areas.

Future extensions may include:

- bounding box;
- spatial index;
- geometric metadata;
- cached measurements.

Triangulation data does not belong to `Polygon`.

---

# StairGeometry

Represents the runtime geometry of one domain staircase.

Staircases are independent geometric elements and do not participate in room boundary loops by default.

## Responsibilities

- preserve source staircase traceability;
- preserve level and optional room connectivity;
- represent geometry connecting or spanning levels;
- own runtime stair flights and landings;
- provide all staircase information required by renderers and exporters.

## Typical Properties

```text
id
sourceStaircaseId
fromLevelId
toLevelId
fromRoomId
toRoomId
flights
landings
```

`fromRoomId` and `toRoomId` may be absent when the source schema does not define room connectivity.

## Expected API

```text
sourceStaircaseId()

fromLevelId()

toLevelId()

fromRoomId()

toRoomId()

flights()

landings()

connectedLevelIds()

startLevelId()

endLevelId()
```

`startLevelId()` maps to `fromLevelId()`.

`endLevelId()` maps to `toLevelId()`.

Stair geometry belongs to the `GeometryModel`, not directly to one polygon.

A staircase renderer must not access the source `ProjectSchema` to reconstruct stair geometry.

---

# StairFlightGeometry

Represents one runtime stair flight.

## Responsibilities

- represent the geometric path and rise of one stair flight;
- preserve traceability to its source flight;
- expose data needed for 2D and 3D rendering.

## Typical Properties

```text
id
sourceFlightId
startPosition
endPosition
startElevation
endElevation
width
stepCount
```

`startPosition` and `endPosition` are planar XZ coordinates in the staircase's source coordinate frame as defined by the project coordinate-system specification.

## Expected API

```text
startPosition()

endPosition()

startElevation()

endElevation()

width()

stepCount()

length()

rise()
```

The exact flight representation may evolve when detailed stair rendering requirements are introduced.

---

# StairLandingGeometry

Represents one runtime stair landing.

## Responsibilities

- represent landing position and dimensions;
- preserve traceability to its source landing;
- provide geometry required by renderers and exporters.

## Typical Properties

```text
id
sourceLandingId
position
elevation
width
depth
```

## Expected API

```text
position()

elevation()

width()

depth()

sourceLandingId()
```

---

# Openings

Doors and windows belong to domain walls and are projected onto runtime `BoundaryEdge` objects as `OpeningGeometry`.

Openings do not split boundary topology.

## Principles

- a wall with one opening still produces one `BoundaryEdge`;
- an opening is represented as geometry associated with that edge;
- opening placement is measured relative to the edge's canonical direction;
- opening geometry contains horizontal and vertical information;
- renderers may use opening geometry to generate gaps, symbols, or wall cut-outs;
- renderers must not read `ProjectSchema` to reconstruct opening placement or dimensions.

Detailed wall-cut solid generation remains renderer-specific or belongs to a future solid-geometry layer.

---

# Relationships

```mermaid
classDiagram
    class GeometryModel
    class LevelGeometry
    class Vertex
    class BoundaryEdge
    class OpeningGeometry
    class BoundaryEdgeUse
    class Loop
    class Polygon
    class StairGeometry
    class StairFlightGeometry
    class StairLandingGeometry

    GeometryModel "1" *-- "*" LevelGeometry
    GeometryModel "1" *-- "*" StairGeometry

    LevelGeometry "1" *-- "*" Vertex
    LevelGeometry "1" *-- "*" BoundaryEdge
    LevelGeometry "1" *-- "*" OpeningGeometry
    LevelGeometry "1" *-- "*" BoundaryEdgeUse
    LevelGeometry "1" *-- "*" Loop
    LevelGeometry "1" *-- "*" Polygon

    Vertex "*" -- "*" BoundaryEdge : incident edges
    BoundaryEdge "1" *-- "*" OpeningGeometry : openings
    BoundaryEdge "1" <-- "*" BoundaryEdgeUse : edge
    Loop "1" *-- "*" BoundaryEdgeUse : ordered traversal
    Polygon "1" *-- "1" Loop : outer loop
    Polygon "1" *-- "*" Loop : inner loops

    BoundaryEdge "*" --> "0..2" Polygon : adjacency
    Loop "1" --> "1" Polygon : owner

    StairGeometry "1" *-- "*" StairFlightGeometry
    StairGeometry "1" *-- "*" StairLandingGeometry
```

In textual form:

```text
GeometryModel
 ├── LevelGeometry
 └── StairGeometry

LevelGeometry
 ├── Vertex
 ├── BoundaryEdge
 ├── OpeningGeometry
 ├── BoundaryEdgeUse
 ├── Loop
 └── Polygon

Vertex
 └── incident BoundaryEdges

BoundaryEdge
 ├── startVertex
 ├── endVertex
 ├── leftPolygon
 ├── rightPolygon
 ├── height
 ├── thickness
 ├── OpeningGeometry[]
 └── referenced by BoundaryEdgeUses

OpeningGeometry
 ├── BoundaryEdge
 ├── sourceOpeningId
 ├── dimensions
 └── placement

BoundaryEdgeUse
 ├── BoundaryEdge
 ├── direction
 └── Loop

Loop
 ├── ordered BoundaryEdgeUses
 └── Polygon

Polygon
 ├── outerLoop
 ├── innerLoops
 └── LevelGeometry

StairGeometry
 ├── StairFlightGeometry
 └── StairLandingGeometry
```

Relationships are direct object references where runtime traversal benefits from them.

Identifiers remain available for lookup, diagnostics, explicit debug serialization, and traceability.

---

# Ownership and Lifecycle

Ownership follows this hierarchy:

```text
GeometryModel
│
├── LevelGeometry
│   ├── Vertices
│   ├── BoundaryEdges
│   ├── OpeningGeometries
│   ├── BoundaryEdgeUses
│   ├── Loops
│   └── Polygons
│
└── StairGeometries
    ├── StairFlightGeometries
    └── StairLandingGeometries
```

Objects may reference one another bidirectionally, but their lifetime is managed by their owning model.

Removing or rebuilding a `GeometryModel` invalidates all runtime references belonging to it.

Runtime objects must not be shared between different Geometry Model instances.

Application state may temporarily hold runtime object references during a single render or update pass.

Durable UI state should store:

- source-domain identifiers;
- deterministic runtime identifiers;
- the source revision or another model revision token.

Durable UI state should not retain direct runtime object references across Geometry Model rebuilds.

Because the runtime graph contains cycles, debug serialization must be explicit and ID-based.

Runtime objects must not be serialized by naïvely applying generic JSON serialization to the object graph.

---

# Identity

Every runtime object owns a stable runtime identifier.

Every runtime object identifier is unique within one `GeometryModel`.

Runtime identifiers are not persisted as replacements for domain identifiers.

## Deterministic Identity

When a runtime object derives directly from a domain entity, its runtime identifier should normally be deterministically derived from the source identifier.

Examples:

```text
level:<level-id>
edge:<wall-id>
opening:<opening-id>
polygon:<room-id>
stair:<staircase-id>
stair-flight:<flight-id>
stair-landing:<landing-id>
```

Runtime objects that do not have a one-to-one domain equivalent may use deterministic composite identifiers.

Examples:

```text
loop:<polygon-id>:outer
loop:<polygon-id>:inner:<index>
edge-use:<loop-id>:<index>
```

Vertex identity must include level context.

A typical deterministic vertex identifier is:

```text
vertex:<level-id>:<coordinate-key>
```

Vertex identity may be derived from:

- canonical source information;
- a deterministic coordinate key within a level;
- another deterministic strategy defined by the Geometry Engine.

For authored MVP integer-coordinate data, exact coordinate keys are acceptable.

If decimal imports or normalization are introduced later, the Geometry Engine must define an explicit tolerance and normalization policy.

Coordinates must not be silently snapped or altered without a documented rule.

## Goals

Deterministic runtime identifiers improve:

- tests;
- diagnostics;
- selection mapping;
- rebuild comparison;
- domain-to-runtime traceability;
- cache invalidation;
- debug serialization.

They remain runtime identifiers and must not become persisted domain identity by accident.

---

# Coordinate Model

Planar room topology belongs to a `LevelGeometry`.

Vertices normally store level-local planar coordinates.

Level elevation is stored once by `LevelGeometry` and is used to derive world-space positions.

Conceptually:

```text
worldPosition.x = vertex.position.x
worldPosition.y = level.elevation
worldPosition.z = vertex.position.z
```

This avoids duplicating identical level elevation across every planar vertex.

Elements with vertical extent, such as:

- walls;
- openings;
- stair flights;
- stair landings;

store additional elevation, height, or thickness information when required.

The Geometry Runtime Model must follow the coordinate system established by the project coordinate-system documentation.

This document does not independently redefine axis orientation, units, origin, or handedness.

---

# Exterior Boundaries

The initial model does not introduce a dedicated `Exterior` polygon.

A boundary is exterior when it has only one adjacent polygon.

Conceptually:

```text
leftPolygon = polygon
rightPolygon = null
```

or:

```text
leftPolygon = null
rightPolygon = polygon
```

The side used depends on the canonical boundary direction and polygon winding.

`BoundaryEdge.isExterior()` returns true when exactly one adjacent polygon is present.

A boundary with no adjacent polygons is invalid or unattached geometry and should normally produce a build error.

---

# Shared Boundaries

A physical shared wall produces one `BoundaryEdge`.

Each polygon loop references that edge through its own `BoundaryEdgeUse`.

```text
Shared BoundaryEdge
├── used by Polygon A loop in FORWARD direction
└── used by Polygon B loop in REVERSE direction
```

The Geometry Engine must detect duplicated wall geometry, including duplicates whose domain start and end coordinates are reversed.

Shared geometry must not be represented by two coincident `BoundaryEdge` objects.

For the initial manifold topology:

- an exterior edge has one use;
- a shared interior edge has two uses;
- an edge with more than two uses is non-manifold.

---

# Inner Loops

`Polygon.innerLoops` is part of the runtime API from the initial implementation.

Initially:

```text
innerLoops = []
```

This preserves an extensible polygon contract without prematurely implementing:

- domain representation of holes;
- nesting algorithms;
- hole validation;
- courtyards;
- shafts;
- complex polygon containment.

When domain support for holes is introduced, the Geometry Engine may populate this collection without changing the public shape of `Polygon`.

---

# Construction Sequence

The Geometry Engine should conceptually construct the model in phases.

```mermaid
sequenceDiagram
    participant Schema as ProjectSchema
    participant Engine as GeometryEngine
    participant Builder as Mutable Builders
    participant Model as GeometryModel

    Schema->>Engine: build(project)
    Engine->>Builder: create project and level builders
    Engine->>Builder: create and deduplicate vertices
    Engine->>Builder: create shared boundary edges
    Engine->>Builder: create opening geometry
    Engine->>Builder: create polygons
    Engine->>Builder: create boundary edge uses
    Engine->>Builder: create and validate loops
    Engine->>Builder: assign polygon adjacency
    Engine->>Builder: create staircase geometry
    Engine->>Model: finalize immutable runtime graph
    Engine-->>Schema: input remains unchanged
    Engine-->>Model: return completed GeometryModel
```

The exact implementation may use intermediate builders, factories, adapters, or internal mutable classes.

The resulting public object graph must respect the ownership, identity, immutability, and topology rules in this document.

---

# Geometry Build Errors

Geometry construction has different responsibilities from persisted-schema validation.

Schema validation answers questions such as:

> Is the persisted document structurally valid?

Geometry build validation answers questions such as:

> Can this domain model produce a coherent geometric and topological runtime model?

The Geometry Engine should therefore define geometry-specific build errors rather than directly reusing schema validation errors.

Example error categories include:

```text
OPEN_BOUNDARY
INVALID_BOUNDARY_ORDER
INVALID_BOUNDARY_DIRECTION
DUPLICATE_BOUNDARY
UNKNOWN_WALL_REFERENCE
DEGENERATE_EDGE
DEGENERATE_POLYGON
SELF_INTERSECTING_LOOP
NON_MANIFOLD_BOUNDARY
INVALID_ADJACENCY
INVALID_OPENING_PLACEMENT
INVALID_STAIR_GEOMETRY
```

Build errors should retain enough source identifiers and context to support:

- diagnostics;
- tests;
- editor feedback;
- migration tooling.

Geometry build errors may map to schema validation errors when useful, but the two error contracts remain distinct.

No geometry build error may be hidden by silently altering persisted coordinates or topology.

---

# Canonical Room Boundary Input

The runtime model requires ordered and oriented room boundaries.

The canonical persisted representation is defined by ADR-005 and conceptually follows:

```text
RoomBoundaryEdge
├── wallId
└── direction
```

with:

```text
Room.boundary: RoomBoundaryEdge[]
```

Geometry Engine construction should consume canonical `Room.boundary` data only. Legacy `Room.wallIds` input belongs to schema-owned migration before canonical project validation, not to runtime topology construction.

---

# Synchronization

The Geometry Model is derived from `ProjectSchema`.

It is never considered the source of truth.

Whenever the domain changes, the application is responsible for rebuilding or explicitly synchronizing the runtime model.

The initial implementation should prefer complete reconstruction over incremental mutation unless incremental synchronization is introduced through a separate design decision.

Complete rebuilding provides:

- simpler lifecycle rules;
- fewer stale references;
- deterministic results;
- easier testing;
- clear source-revision tracking.

---

# Public API Expectations

The Geometry Model is the public internal API exposed by the Geometry Engine.

Downstream consumers may depend on:

- runtime object identity;
- documented traversal relationships;
- documented geometric measurements;
- level grouping;
- source traceability;
- source revision;
- deterministic construction;
- read-only collections;
- post-construction immutability.

Downstream consumers must not depend on:

- construction order unless documented;
- mutable internal collections;
- renderer-specific representations;
- undocumented private caches;
- direct access to `ProjectSchema`;
- direct object references surviving a Geometry Model rebuild.

Public collections are exposed as read-only views.

Public runtime objects are immutable after construction.

Mutable topology exists only inside the Geometry Engine during model construction.

---

# Initial Implementation Scope

The initial implementation should include:

- `GeometryModel`;
- `LevelGeometry`;
- `Vertex`;
- `BoundaryEdge`;
- `OpeningGeometry`;
- `BoundaryEdgeUse`;
- `Loop`;
- `Polygon`;
- `StairGeometry`;
- `StairFlightGeometry`;
- `StairLandingGeometry`;
- source project revision tracking;
- globally unique runtime identifiers;
- deterministic runtime identifiers;
- outer room loops;
- empty `innerLoops`;
- shared boundary representation;
- exterior boundary detection;
- wall height and thickness;
- minimal renderer-neutral opening geometry;
- source-domain traceability;
- geometry-specific build results and errors;
- immutable/read-only public runtime objects;
- explicit support for ADR-005 ordered and oriented room boundaries.

The initial implementation does not need to include every future geometric algorithm.

Functionality should be added incrementally when required by concrete consumers.

---

# Future Extensions

The following concepts are intentionally excluded from the initial implementation:

- curved edges;
- arcs and splines;
- B-Rep solids;
- boolean solid operations;
- structural members;
- terrain;
- arbitrary non-planar polygons;
- detailed wall solids;
- detailed opening cut geometry;
- navigation meshes;
- renderer-specific meshes;
- GPU resources;
- persisted runtime geometry;
- incremental topology editing.

They should only be introduced when concrete requirements justify their existence.

Possible future runtime additions include:

- bounding boxes;
- spatial indexes;
- cached area and centroid values;
- surface or face representations;
- richer opening geometry;
- detailed staircase solids;
- vertical adjacency;
- multi-level voids;
- polygon holes;
- geometric query services;
- explicit partial-edge splitting;
- tolerance-aware import normalization.

---

# Non-Goals

This document intentionally does not define:

- persisted domain schemas;
- rendering algorithms;
- persistence of runtime objects;
- GPU triangulation;
- Three.js integration;
- SVG implementation;
- Canvas implementation;
- PDF drawing implementation;
- DXF generation;
- IFC generation;
- editor commands;
- undo and redo behavior;
- incremental synchronization;
- detailed migration from legacy room boundaries;
- detailed wall-solid construction;
- renderer-specific opening cut generation.

Those concerns belong to other architectural or implementation documents.

---

# Architectural Invariants

The following invariants must hold for a valid Geometry Model:

1. Every runtime object belongs to exactly one `GeometryModel`.
2. Every planar runtime object belongs to exactly one `LevelGeometry`.
3. Every runtime object identifier is unique within one `GeometryModel`.
4. Every `BoundaryEdge` references two valid endpoint vertices.
5. Every `OpeningGeometry` belongs to exactly one `BoundaryEdge`.
6. Every `BoundaryEdgeUse` references exactly one boundary edge and one loop.
7. Every loop contains ordered boundary edge uses.
8. Every valid loop is closed.
9. Every valid polygon loop is non-self-intersecting.
10. Every polygon has exactly one outer loop.
11. Every shared physical boundary exists as one `BoundaryEdge`.
12. A shared boundary may be traversed by different loops in different directions.
13. A boundary with more than two loop uses is non-manifold in the initial model.
14. Openings do not split boundary topology.
15. Wall height, wall thickness, and opening placement required by renderers are exposed through renderer-neutral runtime objects.
16. Stair geometry is owned by the Geometry Model and does not require renderer access to `ProjectSchema`.
17. Runtime objects are not persisted.
18. Runtime geometry is not the source of truth.
19. Public runtime objects are immutable after model construction.
20. Public runtime collections are read-only.
21. Renderers and exporters consume the Geometry Model rather than `ProjectSchema`.
22. Renderer-specific objects are not part of the Geometry Model.
23. Rebuilding a `GeometryModel` invalidates all runtime object references from the previous model.
24. Debug serialization of the runtime graph is explicit and ID-based.
25. Geometry construction must not silently alter persisted coordinates or topology.
