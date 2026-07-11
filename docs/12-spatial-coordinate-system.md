# 12 - Spatial Coordinate System

## 1. Purpose

This document defines the spatial conventions used by CasaStudio.

Its purpose is to provide a stable reference for future JSON Schemas, Zod schemas, TypeScript models, geometry utilities, 2D blueprint generation, 3D scene generation, viewpoint export, and BaseImage generation.

This document defines spatial meaning. It does not define implementation APIs, rendering primitives, database tables, or UI behavior.

The conventions in this document apply to the Physical Building Model and to derived geometry generated from it.

## 2. Design Goals

CasaStudio spatial conventions must support:

- deterministic geometry generation;
- clear correspondence between 2D blueprint data and 3D scene data;
- real-world proportions;
- stable measurement semantics;
- human-readable project files;
- future schema generation;
- future persistence;
- future CAD or BIM import workflows;
- derived BaseImages suitable for AI-assisted rendering.

The model should prefer explicit local relationships over duplicated global values.

The spatial model should be simple enough for the MVP while remaining coherent enough for future evolution.

## 3. Measurement Units

The canonical unit is centimeters.

All project geometry should be interpreted in centimeters unless a future format version explicitly defines a conversion layer.

Integer centimeters are preferred.

Decimal centimeters are allowed when necessary, for example when importing from external CAD data or representing measurements that do not round cleanly to whole centimeters.

The Project must define its measurement units explicitly.

For the MVP, the expected unit is:

```text
cm
```

Derived representations may use other units internally if required by a rendering engine or export format. Such conversions must be performed by the relevant adapter or Geometry Engine layer. They must not change the meaning of the persisted project data.

## 4. Coordinate System

CasaStudio uses a right-handed coordinate system compatible with Three.js conventions.

The canonical axes are:

```text
X = horizontal axis
Y = elevation axis
Z = depth axis
```

The 2D blueprint plane is the XZ plane.

Elevation is represented on the Y axis.

Conceptually:

```text
          Y
          |
          |
          o------ X
         /
        /
       Z
```

The right-handed convention must be preserved in generated 3D geometry.

2D blueprint data should be understood as a projection of spatial data onto the XZ plane.

## 5. Local vs Global Coordinates

CasaStudio prefers hierarchical local coordinates.

The project model should avoid persisting duplicated global coordinates when the same position can be derived from parent relationships.

Local coordinates provide:

- clearer ownership;
- easier validation;
- simpler editing;
- lower risk of inconsistent duplicate values;
- better support for imported data;
- easier future transformation of Levels, Rooms, or derived views.

Global coordinates may be computed by the Geometry Engine when needed.

Persisted domain data should normally describe:

- a Level relative to the Building;
- a Room relative to its Level;
- a Wall relative to its Level;
- an Opening relative to its Wall;
- a Viewpoint relative to its Level or another clearly defined spatial frame.

## 6. Building Coordinate Space

The Building coordinate space is the conceptual top-level physical coordinate space of a Building.

It provides the reference frame for Levels.

For the MVP, the Building coordinate space does not require complex geolocation, rotation relative to north, or external survey coordinates.

Future integrations may add richer location metadata, but those concerns must not be required for the initial project model.

Each Level defines its elevation relative to the Building coordinate space.

The Building coordinate space is therefore used primarily to align Levels vertically and to provide a common frame for generated 3D geometry.

## 7. Level Coordinate Space

Each Level defines its own local origin.

The standard convention is:

```text
origin = bottom-left corner of the Level's local blueprint space
```

The Level coordinate plane is the XZ plane.

Within a Level:

- X increases horizontally to the right in blueprint space;
- Z increases in depth;
- Y represents elevation above the Level's base elevation.

A Level has its own elevation.

The global elevation of a point on a Level is computed from:

```text
Building reference elevation + Level elevation + local Y offset
```

For MVP scenarios, the Building reference elevation may be treated as zero unless explicitly modeled later.

Walls are defined in Level coordinate space.

Rooms belong to a Level and derive their boundary from Walls defined in that Level.

Viewpoints belong to a Level and use that Level as their primary spatial frame.

## 8. Room Coordinate Space

A Room belongs to exactly one Level.

Room boundaries are derived from, or validated against, the Walls associated with the Room.

The Room does not replace the Level coordinate system. For the MVP, Room geometry should be expressed through Level-scoped Walls rather than independent duplicated Room coordinates.

A Room may define an optional local elevation relative to its parent Level.

The global elevation of a Room's local floor reference is computed as:

```text
Level elevation + Room elevation
```

If Room elevation is omitted, it is treated as zero.

This rule supports elevated Rooms such as mezzanines without modeling them as separate Levels.

Example:

```text
Level elevation: 0 cm
Room elevation: 195 cm
Global room floor elevation: 195 cm
```

Room coordinate space may be introduced later for advanced editing, furniture placement, or imported layouts. When introduced, it must be derived from or explicitly related to Level coordinate space.

## 9. Wall Coordinate Space

Walls are defined by a start point and an end point in Level coordinate space.

A Wall's start and end points lie on the XZ plane.

Conceptually:

```text
Wall
├── start: (x, z)
└── end: (x, z)
```

Wall height, thickness, and other physical measurements may be defined as Wall properties or inherited from Level or Project defaults in future schemas.

The direction from start point to end point defines the Wall's local direction.

This direction is important for:

- Opening placement;
- derived wall geometry;
- labels and dimensions;
- future side-specific metadata;
- deterministic 2D and 3D generation.

Walls are the authoritative source describing room boundaries.

Room outlines must be derived from, or validated against, the collection of Walls associated with the Room.

## 10. Opening Coordinate Space

Openings are positioned relative to their owning Wall.

Every Opening belongs to exactly one Wall.

Opening placement uses:

```text
offsetFromStart
```

`offsetFromStart` is measured along the Wall direction, starting from the Wall's start point.

An Opening may also define:

- width;
- height;
- elevation from the relevant floor reference;
- optional opening-specific metadata.

For a Door or Window, the opening's horizontal placement is therefore derived from:

```text
Wall start point
Wall end point
offsetFromStart
Opening width
```

This model avoids duplicating absolute Opening coordinates.

The Geometry Engine may compute the exact start and end points of the Opening in Level or global coordinate space when generating derived geometry.

Opening elevation is measured on the Y axis.

For a Room on an elevated local floor, the effective global Opening elevation depends on the Level elevation, the relevant Room elevation when applicable, and the Opening's own elevation.

When an Opening is associated with a Wall shared by multiple Rooms at different elevations, future schema design must define validation rules explicitly. The MVP should avoid ambiguous cases.

## 11. Elevation Model

Elevation is represented on the Y axis.

Each Level has an elevation.

Each Room may define an optional local elevation.

If a Room has no explicit elevation, its local elevation is zero.

Global elevation for a Room's floor reference is computed as:

```text
Level elevation + Room elevation
```

For example:

```text
Ground Level elevation: 0 cm
Living Room elevation: 0 cm
Living Room global floor elevation: 0 cm

Ground Level elevation: 0 cm
Mezzanine Studio elevation: 195 cm
Mezzanine Studio global floor elevation: 195 cm
```

A mezzanine is represented as a Room with elevation.

CasaStudio does not introduce Slab or Platform as domain entities for the MVP. The Geometry Engine may generate supporting physical geometry from elevated Rooms when producing 3D geometry.

Level-to-Level vertical circulation is represented conceptually by Staircases.

Staircases define their connection intent through:

- `fromLevelId`;
- `toLevelId`;
- optional `fromRoomId`;
- optional `toRoomId`.

The Geometry Engine may use those references, together with coordinate and elevation data, to generate stair geometry.

## 12. Rotation Conventions

Persisted rotations are expressed in degrees.

The Geometry Engine converts degrees to radians when required by a rendering engine or mathematical API.

Using degrees in persisted project data improves readability for humans and aligns with common architectural and design notation.

Rotation direction must be interpreted consistently with the right-handed coordinate system.

For horizontal plan rotations, the rotation occurs around the Y axis.

Conceptually:

```text
0 degrees   = aligned with the positive X direction unless a more specific local convention applies
90 degrees  = quarter turn around the Y axis
180 degrees = opposite direction
```

When a concept can be represented without persisting rotation, derived orientation is preferred.

For example:

- a Wall's orientation is derived from its start and end points;
- an Opening's orientation is derived from its Wall;
- a Room boundary is derived from Walls.

Persist rotation only when the domain concept requires independent orientation, such as a Viewpoint camera orientation or future object placement.

## 13. Precision Rules

Integer centimeters are preferred.

Decimals are allowed when necessary.

Schema validation should support decimal values where legitimate precision is required.

Precision rules should avoid false accuracy. CasaStudio should not imply millimeter-level certainty unless the source data actually supports it.

Recommended principles:

- preserve imported precision when meaningful;
- avoid repeated rounding during transformations;
- avoid persisting computed global coordinates solely for convenience;
- compute derived values deterministically from canonical local data;
- use consistent numeric precision when exporting derived geometry.

The Project model should remain readable and stable across edits.

## 14. Geometry Engine Responsibilities

The Geometry Engine consumes the Physical Building Model and applies the spatial conventions in this document.

It is responsible for deriving:

- 2D blueprint geometry on the XZ plane;
- 3D scene geometry in XYZ space;
- Wall meshes or equivalent geometry;
- Opening cutouts or markers;
- elevated Room representations;
- generated support geometry for elevated Rooms when needed;
- Staircase geometry;
- camera placement helpers;
- exported BaseImages from Viewpoints.

The Geometry Engine may compute:

- global coordinates;
- bounding boxes;
- wall normals;
- room outlines;
- opening positions;
- derived elevations;
- generated meshes;
- measurement labels.

The Geometry Engine must not redefine:

- Project identity;
- Building identity;
- Level ownership;
- Room ownership;
- Wall ownership;
- Opening ownership;
- Staircase relationships;
- Viewpoint meaning;
- RenderRequest or RenderResult meaning.

Generated geometry is derived output.

It must remain traceable to the Project model.

## 15. Examples

### 15.1 Level and Room Elevation

```text
Building
└── Ground Level
    ├── elevation: 0 cm
    ├── Living Room
    │   └── elevation: 0 cm
    └── Mezzanine Studio
        └── elevation: 195 cm
```

Computed floor elevations:

```text
Living Room: 0 + 0 = 0 cm
Mezzanine Studio: 0 + 195 = 195 cm
```

### 15.2 Wall in Level Coordinate Space

```text
Level origin: bottom-left corner

Wall A
├── start: (0, 0)
└── end: (488, 0)
```

This defines a Wall running along the X axis on the blueprint plane.

The Wall's orientation is derived from its start and end points.

### 15.3 Opening Positioned Along a Wall

```text
Wall A
├── start: (0, 0)
└── end: (488, 0)

Door Opening
├── offsetFromStart: 120 cm
├── width: 80 cm
├── height: 210 cm
└── elevation: 0 cm
```

The Door begins 120 cm from the Wall start point and extends 80 cm along the Wall direction.

The exact global coordinates of the Door are derived by the Geometry Engine.

### 15.4 Viewpoint on a Level

```text
Viewpoint
├── levelId: ground-level
├── roomId: living-room
├── cameraPosition: (250, 165, 320)
├── cameraTarget: (250, 120, 120)
└── fieldOfView: 60 degrees
```

The Viewpoint belongs to the Level and optionally references the Room.

The camera position uses the Level's spatial frame unless a future schema explicitly defines another frame.

### 15.5 Level-Scoped Viewpoint Without Room

```text
Viewpoint
├── levelId: ground-level
├── roomId: omitted
├── cameraPosition: (300, 180, 500)
└── cameraTarget: (300, 120, 100)
```

This Viewpoint may represent a cross-room, stair-focused, or whole-level perspective.

It is valid because Viewpoints belong to Levels, not necessarily Rooms.

## 16. Best Practices

Prefer local coordinates over persisted global coordinates.

Use centimeters as the canonical unit.

Use integer centimeters unless decimal precision is necessary.

Define Walls with start and end points in Level coordinate space.

Position Openings with `offsetFromStart`.

Derive Room boundaries from Walls.

Use Room elevation for mezzanines and other raised functional spaces.

Do not model mezzanines as Levels.

Do not introduce Slab or Platform as domain entities for the MVP.

Persist rotations in degrees.

Convert rotations to radians only in geometry or rendering layers that require radians.

Keep generated geometry derived and reproducible.

Avoid storing duplicate coordinates that can drift from their authoritative source.

Use `docs/11-domain-model.md` for conceptual entity meaning and this document for spatial conventions.
