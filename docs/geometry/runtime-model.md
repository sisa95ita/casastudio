# Geometry Runtime Model

> **Status:** Draft

---

# Purpose

This document describes the in-memory geometry model used by CasaStudio.

Unlike the persisted `ProjectSchema`, which represents architectural concepts, the Geometry Runtime Model represents the building from a purely geometric and topological perspective.

Its primary purpose is to support:

- geometric algorithms;
- topology traversal;
- rendering;
- exporters;
- future spatial analysis.

The runtime model is produced by the `GeometryEngine` and exists only in memory.

---

# Relationship with ADR-006

ADR-006 defines the architecture of the Geometry Engine.

This document specifies the runtime objects that compose the Geometry Model.

Whenever possible:

- architectural decisions belong to ADR-006;
- runtime object design belongs to this document.

---

# Design Principles

The runtime model follows a few fundamental principles.

## Geometry over Architecture

Runtime objects represent geometry rather than architectural semantics.

For example:

- `Room` becomes `Polygon`;
- `Wall` becomes `BoundaryEdge`.

The runtime model is optimized for geometric reasoning.

---

## Explicit Topology

Topology is represented explicitly.

Objects know their neighboring objects whenever doing so simplifies algorithms.

For example:

- vertices know incident edges;
- edges know their vertices;
- loops know their edges;
- polygons know their loops.

---

## Shared Geometry

Every physical geometric entity exists only once.

If two rooms share a wall, they reference the same `BoundaryEdge`.

Duplicated runtime geometry is not allowed.

---

## Stateless Construction

The Geometry Model is entirely reconstructed by the `GeometryEngine`.

Runtime objects are never persisted.

---

# Object Overview

The runtime model currently consists of four core objects.

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

---

# Vertex

Represents a geometric point.

## Responsibilities

- store coordinates;
- identify a unique point in space;
- provide adjacency information.

## Typical Properties

```text
id
position
incidentEdges
```

## Expected API

```text
addIncidentEdge(edge)
removeIncidentEdge(edge)

incidentEdges()

degree()
```

A vertex has no knowledge of architectural concepts.

---

# BoundaryEdge

Represents one geometric boundary segment.

## Responsibilities

- connect two vertices;
- separate adjacent polygons;
- provide geometric measurements.

## Typical Properties

```text
id
startVertex
endVertex
leftPolygon
rightPolygon
parentLoop
```

## Expected API

```text
start()

end()

otherVertex(vertex)

isExterior()

length()
```

Future extensions may include:

- direction vector;
- outward normal;
- wall reference.

---

# Loop

Represents one closed boundary.

## Responsibilities

- maintain ordered edges;
- preserve winding;
- identify closed topology.

## Typical Properties

```text
id
edges
polygon
```

## Expected API

```text
edges()

vertices()

isClosed()

orientation()

area()
```

Future extensions may include:

- cached area;
- cached bounding box;
- hole detection.

---

# Polygon

Represents one geometric region.

## Responsibilities

- own one outer loop;
- optionally own inner loops;
- represent one navigable area.

## Typical Properties

```text
id
outerLoop
innerLoops
domainRoom
```

## Expected API

```text
outerLoop()

innerLoops()

edges()

vertices()

contains(vertex)

area()

centroid()
```

Future extensions may include:

- triangulation cache;
- spatial index;
- geometric metadata.

---

# Relationships

```text
Vertex
 ├── incidentEdges

BoundaryEdge
 ├── startVertex
 ├── endVertex
 ├── leftPolygon
 ├── rightPolygon
 └── parentLoop

Loop
 ├── edges
 └── polygon

Polygon
 ├── outerLoop
 ├── innerLoops
 └── domainRoom
```

Relationships are direct object references.

Topology traversal should not require lookup tables.

---

# Ownership

Ownership follows this hierarchy.

```text
GeometryModel
    │
    ├── Vertices
    ├── BoundaryEdges
    ├── Loops
    └── Polygons
```

Objects reference one another, but their lifetime is managed by the `GeometryModel`.

---

# Identity

Every runtime object owns a stable runtime identifier.

Runtime identifiers exist only for the lifetime of the Geometry Model.

They do not replace identifiers from the persisted domain model.

---

# Synchronization

The Geometry Model is derived from `ProjectSchema`.

It is never considered the source of truth.

Whenever the domain changes, the application is responsible for synchronizing or rebuilding the runtime model.

---

# Future Extensions

The following concepts are intentionally excluded from the initial implementation.

- curved edges;
- B-Rep solids;
- boolean geometry;
- structural members;
- terrain;
- renderer-specific meshes;
- GPU resources.

They should only be introduced when concrete requirements justify their existence.

---

# Non-Goals

This document intentionally does not define:

- rendering algorithms;
- persistence;
- triangulation;
- Three.js integration;
- DXF generation;
- IFC generation;
- editing workflows.

Those concerns belong to other architectural documents.
