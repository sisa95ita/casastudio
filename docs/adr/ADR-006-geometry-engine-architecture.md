# ADR-006 — Geometry Engine Architecture

- **Status:** Accepted
- **Date:** 2026-07-20

---

## Context

CasaStudio represents a building through a persisted domain model called `ProjectSchema`.

The domain model contains architectural concepts such as:

- `Project`
- `Level`
- `Room`
- `Wall`
- `Opening`
- `Staircase`

This model is designed for persistence, application workflows, and user-facing concepts.

However, it is not suitable as the direct input for geometric algorithms or rendering systems.

A dedicated architecture is therefore required to:

- separate domain concepts from geometric concepts;
- provide a navigable in-memory geometric representation;
- support both 2D and 3D rendering;
- keep rendering technologies independent from the domain model;
- allow future exporters such as DXF, IFC, SVG, or PDF;
- keep the Geometry Engine independent from libraries such as Three.js.

---

## Decision

CasaStudio will use the following geometry pipeline:

```text
ProjectSchema
        │
        ▼
Geometry Engine
        │
        ▼
Geometry Model
        │
        ├────────────► 2D Renderer
        ├────────────► 3D Renderer
        ├────────────► DXF Exporter
        ├────────────► IFC Exporter
        ├────────────► PDF Renderer
        └────────────► ...
```

Each layer has a distinct responsibility.

---

## ProjectSchema

`ProjectSchema` represents the persisted domain model.

It contains the real architectural data of the house and remains the source of truth for the project.

The Geometry Engine may read, validate, and interpret this data, but it must never mutate it implicitly.

Persistence is handled outside the Geometry Engine.

The expected application flow is:

```text
Load ProjectSchema from persistence
        │
        ▼
Build Geometry Model in memory
        │
        ▼
Edit in memory
        │
        ▼
Persist only on explicit user save
```

The Geometry Engine must not know whether the source data came from a database, a file, an API, or any other persistence mechanism.

---

## Geometry Engine

The Geometry Engine is a stateless transformation service.

Its responsibility is to:

1. receive a `ProjectSchema`;
2. interpret its architectural data;
3. validate its geometric consistency;
4. build a navigable in-memory Geometry Model.

Conceptually:

```text
ProjectSchema
        │
        ▼
Geometry Engine
        │
        ▼
Geometry Model
```

The Geometry Engine is an algorithmic component, not the runtime data structure itself.

Once the Geometry Model has been built, the Geometry Engine has completed its task.

The Geometry Engine:

- does not know the database;
- does not persist data;
- does not render;
- does not depend on Three.js;
- does not create GPU meshes;
- does not triangulate polygons for a specific graphics engine.

---

## Geometry Model

The Geometry Model is the in-memory geometric representation produced by the Geometry Engine.

It is independent from both:

- the persisted domain model;
- the rendering technology.

Its initial core primitives are:

- `Vertex`
- `BoundaryEdge`
- `Loop`
- `Polygon`

The Geometry Model represents the geometry in the most natural form for geometric algorithms.

It does not represent how the geometry must be drawn by a specific rendering technology.

---

## Fundamental Primitive

The fundamental runtime primitive is `Vertex`.

The Geometry Model is built in the following logical order:

```text
Vertex
   │
   ▼
BoundaryEdge
   │
   ▼
Loop
   │
   ▼
Polygon
```

This reflects the dependency structure of the geometry:

- edges depend on vertices;
- loops depend on edges;
- polygons depend on loops.

Although `Wall` is a central concept in the domain model, the Geometry Model must use geometric terminology.

Therefore, the runtime geometric equivalent of a domain wall is represented as a `BoundaryEdge`, not as a runtime `Wall`.

---

## Coordinates

All coordinates originate from `ProjectSchema`.

The Geometry Engine may:

- copy them;
- normalize them;
- validate them;
- reject invalid configurations.

It must not invent missing coordinates or silently alter the building geometry.

The persisted domain model remains the source of truth.

---

## Room Transformation

`Room` remains a domain concept.

The Geometry Model does not need to reason about rooms as architectural or semantic entities.

Instead, a domain `Room` is transformed into a geometric `Polygon`.

```text
Room
  │
  ▼
Polygon
```

A reference back to the originating domain entity may be retained for traceability, selection, editing, and synchronization.

However, geometric algorithms operate on the polygon, not on the domain `Room`.

---

## Loop

`Loop` is a first-class runtime object.

It is not represented as a plain list of edges.

A `Loop` owns the geometric meaning of a closed boundary and may later contain or cache information such as:

- orientation;
- winding order;
- signed area;
- bounding box;
- outer-boundary status;
- inner holes;
- geometric validation results.

This identity allows the Geometry Model to evolve without reducing loops to anonymous collections.

---

## Bidirectional Navigation

The Geometry Model uses bidirectional relationships where they simplify geometric algorithms.

The expected navigation structure is:

```text
Vertex ↔ BoundaryEdge
BoundaryEdge ↔ Loop
Loop ↔ Polygon
```

This allows algorithms to traverse the model in both directions without repeatedly reconstructing adjacency information.

For example:

- a vertex can discover its incident edges;
- an edge can discover its vertices and owning loop;
- a loop can discover its polygon;
- a polygon can traverse its loops.

---

## Shared Boundaries

A shared wall or boundary exists only once in the Geometry Model.

When two rooms share the same wall, their polygons reference the same geometric boundary object.

The Geometry Model must not create duplicated copies of the same physical wall.

This prevents synchronization errors and preserves topological consistency.

A boundary may therefore reference adjacent polygons on both sides.

Conceptually:

```text
BoundaryEdge
├── leftPolygon
└── rightPolygon
```

---

## Exterior Boundaries

An exterior boundary may have a polygon on only one side.

For example:

```text
leftPolygon  = livingRoomPolygon
rightPolygon = null
```

No special `Exterior`, `Outside`, or `Void` object will be introduced for the MVP.

The absence of an adjacent polygon is sufficient to represent an exterior boundary.

A dedicated exterior face may be introduced later only if a concrete use case requires it.

---

## Openings

Doors and windows belong to the domain `Wall`.

An `Opening` must not split the wall into multiple independent wall entities.

The topology remains stable:

```text
Wall
└── Opening
```

rather than:

```text
Wall
Door
Wall
```

The Geometry Engine may derive the geometric position of an opening along the corresponding `BoundaryEdge`, but the opening remains associated with the original wall.

This avoids unnecessary fragmentation of the topology.

---

## Staircases

A staircase is an independent architectural element that connects levels.

It does not define the boundary loop of a room and does not become part of the room polygon topology by default.

Staircases are therefore handled as independent geometric elements.

Their inter-level relationship belongs to building topology rather than to the closed boundary topology of a single room.

---

## 2D and 3D

CasaStudio uses one Geometry Engine and one Geometry Model for both 2D and 3D.

There will not be separate 2D and 3D geometry engines.

Both renderers consume the same Geometry Model.

```text
                  Geometry Model
                  /            \
                 /              \
        2D Renderer          3D Renderer
```

The fundamental geometric reasoning is the same.

The 2D renderer uses the planar data and ignores vertical information when it is not required.

The 3D renderer uses the same geometry together with additional information such as:

- wall height;
- level elevation;
- extrusion depth;
- opening height;
- material information;
- vertical relationships.

The distinction between 2D and 3D therefore belongs to the rendering layer, not to the Geometry Engine.

---

## Renderers

Renderers consume the Geometry Model.

They must not read `ProjectSchema` directly.

A renderer is responsible for adapting the abstract geometry to a specific output technology.

Examples include:

- SVG renderer;
- Canvas renderer;
- Three.js renderer;
- PDF renderer;
- DXF exporter;
- IFC exporter.

Each renderer is independent from the others.

Replacing one renderer must not require changes to the Geometry Engine or Geometry Model.

---

## Three.js

Three.js is outside the Geometry Engine.

The Geometry Engine must not depend on the Three.js package or on Three.js-specific classes such as:

- `BufferGeometry`
- `Mesh`
- `Shape`
- `Vector3`
- `Material`

Three.js is one possible consumer of the Geometry Model.

If Three.js is replaced in the future, the Geometry Engine and Geometry Model must remain unchanged.

Only the Three.js-specific rendering adapter should be replaced.

---

## Triangulation

The Geometry Engine produces polygons, not rendering triangles.

Triangulation is required because GPU rendering pipelines operate on triangles.

However, this is a rendering concern rather than a property of the architectural geometry.

The pipeline is therefore:

```text
Geometry Model
        │
        ▼
Polygon
        │
        ▼
Renderer-specific triangulation
        │
        ▼
Triangles
        │
        ▼
GPU
```

The renderer is responsible for converting polygons into the format required by its rendering technology.

For example, a Three.js renderer may triangulate a polygon and use the resulting triangles to create a `BufferGeometry`.

A 2D SVG renderer may instead draw the polygon directly without triangulating it.

---

## Runtime and Persistence

The Geometry Model exists in memory while the project is being edited.

The persisted `ProjectSchema` and the runtime Geometry Model are separate representations with different responsibilities.

The expected lifecycle is:

```text
Persisted ProjectSchema
        │
        ▼
Geometry Engine
        │
        ▼
In-memory Geometry Model
        │
        ▼
User editing
        │
        ▼
Explicit save
        │
        ▼
Updated ProjectSchema
```

Synchronization and persistence orchestration are handled by the application layer, not by the Geometry Engine itself.

---

## MVP Scope

The Geometry Model will initially support only the entities and relationships required by the MVP.

The architecture must remain extensible, but it will not pre-design unsupported concepts such as:

- structural columns;
- courtyards;
- shafts;
- curved walls;
- complex solids;
- arbitrary B-Rep geometry;
- advanced exterior face models.

These concepts will be introduced only when a concrete use case requires them.

The design must support extension without attempting to solve all future geometry requirements in advance.

---

## Consequences

### Positive

- Domain concepts are cleanly separated from geometric concepts.
- The Geometry Engine remains independent from persistence.
- The Geometry Engine remains independent from rendering libraries.
- The same Geometry Model supports both 2D and 3D.
- Renderers can be replaced independently.
- New exporters can be added without modifying the domain model.
- Geometric algorithms operate on explicit and navigable topology.
- Shared boundaries remain consistent because they are represented once.
- The Geometry Engine can be tested without a graphics environment.
- Renderer-specific triangulation does not leak into the core geometry.

### Negative

- The system introduces an additional intermediate representation.
- Domain and Geometry Model synchronization must be explicitly managed.
- Bidirectional relationships require careful construction and maintenance.
- More runtime classes are required than in a direct `ProjectSchema` rendering approach.
- Renderers may need their own adaptation and triangulation logic.
- Errors may occur at the boundary between domain transformation and geometric representation if validation is insufficient.

---

## Rejected Alternatives

### Render directly from ProjectSchema

Rejected because it would tightly couple renderers to the domain and persistence structure.

Any domain-model change could then affect all renderers and exporters.

### Use domain Walls directly as runtime edges

Rejected because domain and geometry concepts have different responsibilities.

A `Wall` is an architectural entity.

A `BoundaryEdge` is a geometric and topological entity.

### Create separate 2D and 3D geometry engines

Rejected because both modes derive from the same geometric structure.

The 2D renderer simply does not use vertical information that is relevant only to 3D.

### Put Three.js inside the Geometry Engine

Rejected because it would couple the geometry architecture to one rendering library.

### Generate triangles inside the Geometry Engine

Rejected because triangulation is renderer-specific.

Some consumers require triangles, while others can consume polygons directly.

### Split walls at every opening

Rejected because it would fragment the topology and create unnecessary synchronization complexity.

### Represent the exterior as a special object

Rejected for the MVP because a missing adjacent polygon already represents an exterior boundary adequately.

---

## Architectural Principle

The Geometry Engine describes the geometry of the house.

The renderer describes how that geometry is visualized or exported.

The Geometry Model is the public contract of the Geometry Engine.

> **The Geometry Model is the only point of contact between the Geometry Engine and the rest of the system. No renderer, exporter, or external algorithm may access `ProjectSchema` directly.**

If a renderer or exporter needs information that is not currently available in the Geometry Model, that information must be added through an explicit and technology-independent extension of the Geometry Model rather than by bypassing it and reading `ProjectSchema`.
