# 13 - Project Schema Design

## 1. Purpose

This document defines the canonical data contract for CasaStudio project files.

The target file name is:

```text
project.json
```

The file represents the `Project` root directly. It does not wrap the Project inside an additional `project` property.

It defines:

- the canonical JSON structure;
- required and optional properties;
- ownership and reference rules;
- validation expectations;
- draft versus renderable states;
- the contract implemented by the current schema package.

The following artifacts must derive from this document:

- JSON Schema;
- Zod schemas;
- TypeScript types;
- example `project.json` files;
- future persistence mappings;
- Geometry Engine input validation.

This specification evolves through explicit schema-version changes.

## 2. Design Principles

### 2.1 Root-first structure

The JSON document is the Project.

```json
{
  "id": "casa-simone",
  "name": "Casa Simone",
  "schemaVersion": "2.0.0",
  "building": {}
}
```

No redundant wrapper is used.

### 2.2 Human-readable project files

The MVP uses readable string identifiers.

Examples:

```text
ground-level
living-room
living-wall-tv
main-window
living-mezzanine-staircase
```

Identifiers must be unique across the entire Project.

### 2.3 Physical data and workflow data remain separated

The physical Building hierarchy is nested.

Observation and design-rendering data remain at Project scope.

```text
Project
├── Building
│   └── Level[]
│       ├── Room[]
│       ├── Wall[]
│       └── Staircase[]
├── viewpoints[]
├── baseImages[]
├── designBriefs[]
├── renderRequests[]
└── renderResults[]
```

### 2.4 Explicit geometry

The Project file stores the physical measurements required to reproduce the Building faithfully.

Walls therefore store their own:

- start point;
- end point;
- height;
- thickness.

The MVP does not depend on Level-level defaults for Wall dimensions.

### 2.5 Local coordinates

The schema follows the conventions defined in:

```text
docs/12-spatial-coordinate-system.md
```

Persisted coordinates are local where possible.

Duplicated global coordinates should be avoided.

### 2.6 Drafts must remain saveable

A Project may be structurally valid while still incomplete for rendering.

The application distinguishes:

```text
Structurally Valid
Renderable
```

### 2.7 Validation Pipeline

`ProjectSchema` intentionally validates only the structural composition of a Project.

Additional validation phases are executed after structural parsing has succeeded.

The validation pipeline is organized as follows:

```text
ProjectSchema
        │
        ▼
Cross-reference Validation
        │
        ▼
Reference Consistency Validation
        │
        ▼
Renderability Validation
        │
        ▼
Geometry Validation
```

Each phase has a distinct responsibility:

- **ProjectSchema** validates structural composition, required properties, types, enums, and local entity invariants.
- **Cross-reference Validation** verifies that referenced entities exist.
- **Reference Consistency Validation** verifies that relationships between existing entities are semantically coherent.
- **Renderability Validation** verifies that the Project contains the minimum information required by the rendering workflow.
- **Geometry Validation** verifies persisted architectural and geometric correctness that can be checked before constructing future Geometry Engine runtime objects.

Keeping these responsibilities separate ensures that structural validation remains deterministic while more advanced validation phases can evolve independently.

These are validation outcomes, not persisted status fields.

Future Geometry Engine build validation may perform additional checks while deriving runtime geometry. Those runtime classes are not part of the canonical project schema.

## 3. Project File

### 3.1 File name

The canonical file name is:

```text
project.json
```

A project directory may later contain:

```text
project.json
assets/
  base-images/
  renders/
  references/
```

### 3.2 Project root

The root object is the Project itself.

Required properties:

```text
id
name
schemaVersion
revision
createdAt
updatedAt
units
building
viewpoints
baseImages
designBriefs
renderRequests
renderResults
```

Optional properties may be introduced only when they represent concrete domain requirements.

Empty placeholder objects such as `settings: {}` must not be added preemptively.

## 4. Common Conventions

### 4.1 Identifiers

MVP identifier type:

```text
string
```

Requirements:

- human-readable;
- stable;
- unique across the entire Project;
- suitable for references;
- should use lowercase kebab-case where practical.

Future versions may adopt generated identifiers, but that is outside the MVP.

### 4.2 Names

`name` is required for:

- Project;
- Building;
- Level;
- Room.

`name` is optional for:

- Wall;
- Opening;
- Staircase;
- Viewpoint;
- BaseImage;
- DesignBrief;
- RenderRequest;
- RenderResult.

### 4.3 Dates

Persisted timestamps use ISO 8601.

```json
{
  "createdAt": "2026-07-11T15:30:00+02:00",
  "updatedAt": "2026-07-11T15:30:00+02:00"
}
```

### 4.4 Units

```json
{
  "units": {
    "length": "cm",
    "angle": "deg"
  }
}
```

MVP values:

```text
length = cm
angle = deg
```

### 4.5 Revision

```json
{
  "revision": 1
}
```

The revision identifies a meaningful version of the structured Project Model.

BaseImages and future derived artifacts may reference the revision from which they were generated.

## 5. Project

### 5.1 Required properties

```text
id
name
schemaVersion
revision
createdAt
updatedAt
units
building
viewpoints
baseImages
designBriefs
renderRequests
renderResults
```

### 5.2 Canonical shape

```json
{
  "id": "casa-simone",
  "name": "Casa Simone",
  "schemaVersion": "2.0.0",
  "revision": 1,
  "createdAt": "2026-07-11T15:30:00+02:00",
  "updatedAt": "2026-07-11T15:30:00+02:00",
  "units": {
    "length": "cm",
    "angle": "deg"
  },
  "building": {},
  "viewpoints": [],
  "baseImages": [],
  "designBriefs": [],
  "renderRequests": [],
  "renderResults": []
}
```

### 5.3 Invariants

- The JSON document represents exactly one Project.
- A Project contains exactly one Building in the MVP.
- `schemaVersion` is required and the canonical version is `2.0.0`.
- Legacy `1.0.0` projects require explicit migration before canonical parsing.
- `revision` is required.
- identifiers must be unique across the entire Project.
- all Project-level collections are always present, even when empty.

### 5.4 Schema version and migration

`ProjectSchema` accepts only canonical version `2.0.0`.

Legacy version `1.0.0` used `Room.wallIds` and is accepted only through the explicit migration entry point. Migration reconstructs deterministic ordered and oriented `Room.boundary` entries from legacy wall references and may perform migration-only winding normalization.

Migration preserves `revision`, `createdAt`, and `updatedAt`. Expected migration failures are returned as structured results rather than thrown exceptions.

## 6. Building

### 6.1 Required properties

```text
id
name
type
levels
```

### 6.2 Building type

```text
HOUSE
APARTMENT
VILLA
OFFICE
OTHER
```

### 6.3 Canonical shape

```json
{
  "id": "main-building",
  "name": "Main Building",
  "type": "HOUSE",
  "levels": []
}
```

### 6.4 Excluded properties

The initial schema does not include:

- street address;
- cadastral data;
- geolocation;
- external survey coordinates.

## 7. Level

### 7.1 Required properties

```text
id
name
elevation
rooms
walls
staircases
```

### 7.2 Origin

Every Level conceptually defines its own local coordinate system. For the MVP, if an explicit origin is omitted, the origin is implicitly assumed to be `(0, 0, 0)`.

An optional `origin` field may be introduced later for CAD import or advanced transformations.

### 7.3 Canonical shape

```json
{
  "id": "ground-level",
  "name": "Ground Level",
  "elevation": 0,
  "rooms": [],
  "walls": [],
  "staircases": []
}
```

### 7.4 Empty collections

The arrays `rooms`, `walls`, and `staircases` are always present.

A Level may temporarily contain empty collections while being edited.

The normal UI flow should encourage creating a Room immediately after creating a Level.

## 8. Room

### 8.1 Required properties

```text
id
name
type
boundary
```

### 8.2 Optional properties

```text
description
elevation
```

### 8.3 Room type

```text
LIVING_ROOM
KITCHEN
BEDROOM
BATHROOM
STUDIO
CORRIDOR
STORAGE
OTHER
```

### 8.4 Elevation

If `elevation` is omitted, its semantic value is `0`.

It represents the Room floor elevation relative to its parent Level.

```json
{
  "id": "mezzanine-studio",
  "name": "Mezzanine Studio",
  "type": "STUDIO",
  "elevation": 195,
  "boundary": []
}
```

No Slab or Platform entity is persisted in the MVP.

### 8.5 Hierarchy references

A Room does not persist `buildingId` or `levelId`.

Its ownership is defined by its position inside:

```text
Building → Level → Room
```

### 8.6 Persisted room boundary

The canonical schema version `2.0.0` represents a Room boundary as ordered and oriented wall references.

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

Array order is the canonical traversal order of the persisted room boundary.

Direction is relative to the referenced Wall:

```text
FORWARD = Wall.start -> Wall.end
REVERSE = Wall.end -> Wall.start
```

`boundary: []` represents a draft room. A geometry-buildable room requires at least three boundary edges. One- and two-edge non-empty boundaries are structurally invalid.

A Room boundary must not reference the same Wall more than once in the MVP simple-loop model.

Boundary Walls must belong to the Room's owning Level. Cross-level Room boundaries are invalid.

Outer Room boundaries must be persisted counter-clockwise in the owning Level's XZ plane. Canonical validation does not reorder, reverse, or normalize persisted boundaries.

### 8.7 Room-wall consistency

Room and Wall references must agree:

```text
Room.boundary contains Wall.id
    <=>
Wall.roomIds contains Room.id
```

Any mismatch is rejected by reference-consistency validation.


## 9. Wall

### 9.1 Required properties

```text
id
start
end
height
thickness
roomIds
openings
```

### 9.2 Optional properties

```text
name
description
```

### 9.3 Canonical shape

```json
{
  "id": "living-wall-tv",
  "name": "TV Wall",
  "start": { "x": 0, "z": 0 },
  "end": { "x": 488, "z": 0 },
  "height": 390,
  "thickness": 15,
  "roomIds": ["living-room"],
  "openings": []
}
```

### 9.4 Geometry invariants

- non-zero length;
- positive height;
- positive thickness.

### 9.5 Room associations

A shared Wall is represented once and may reference two Rooms.

The MVP does not introduce an explicit `EXTERIOR` spatial reference.

`Wall.roomIds` contains at most two unique Room identifiers:

- zero Room IDs is valid for an unassigned or draft Wall;
- one Room ID is valid for an exterior Wall;
- two Room IDs is valid for a shared Wall.

Reference-consistency validation enforces reciprocal agreement between `Wall.roomIds` and `Room.boundary`.

### 9.6 Reversing wall direction

Reversing a Wall changes only its internal canonical orientation. It swaps `start` and `end` while preserving the physical segment, Room boundary traversal in world coordinates, Room topology, and Room winding.

Every referencing Room boundary edge must invert its direction when the Wall direction is reversed.

Opening placement is also wall-relative, so each Opening offset is transformed as:

```text
newOffsetFromStart =
    wallLength
    - oldOffsetFromStart
    - opening.width
```

This preserves the physical location of the Opening along the unchanged Wall segment.

## 10. Opening

### 10.1 Collection model

Walls contain one discriminated collection:

```text
openings[]
```

### 10.2 Opening type

```text
DOOR
WINDOW
```

### 10.3 Required common properties

```text
id
type
offsetFromStart
width
height
elevation
```

### 10.4 Optional common properties

```text
name
description
```

### 10.5 Canonical shape

```json
{
  "id": "main-window",
  "name": "Main Window",
  "type": "WINDOW",
  "offsetFromStart": 220,
  "width": 120,
  "height": 165,
  "elevation": 90
}
```

### 10.6 Door connectivity

Door-specific optional property:

```text
connectedRoomIds
```

An external Door may reference one Room in the MVP.

## 11. Staircase

### 11.1 Required properties

```text
id
fromLevelId
toLevelId
width
flights
landings
```

### 11.2 Optional properties

```text
name
description
fromRoomId
toRoomId
```

### 11.3 Canonical shape

```json
{
  "id": "living-mezzanine-staircase",
  "name": "Living Room to Mezzanine Staircase",
  "fromLevelId": "ground-level",
  "toLevelId": "ground-level",
  "fromRoomId": "living-room",
  "toRoomId": "mezzanine-studio",
  "width": 62,
  "flights": [],
  "landings": []
}
```

## 12. Stair Flight
StairFlight represents architectural layout information persisted in the Project Model. It is not generated geometry. The Geometry Engine derives meshes, individual steps, and renderable primitives from this persisted layout.

### 12.1 Required properties

```text
id
start
end
width
stepCount
startElevation
endElevation
```

### 12.2 Canonical shape

```json
{
  "id": "short-flight",
  "start": { "x": 0, "z": 225 },
  "end": { "x": 0, "z": 385 },
  "width": 62,
  "stepCount": 4,
  "startElevation": 0,
  "endElevation": 110
}
```

## 13. Stair Landing
StairLanding represents an architectural landing as part of the staircase layout stored in the Project Model. Generated geometry derived from the landing remains the responsibility of the Geometry Engine.

### 13.1 Required properties

```text
id
position
width
depth
elevation
```

### 13.2 Canonical shape

```json
{
  "id": "stair-landing-1",
  "position": { "x": 0, "z": 353 },
  "width": 62,
  "depth": 32,
  "elevation": 110
}
```

The landing is modelled explicitly.

## 14. Viewpoint

### 14.1 Required properties

```text
id
levelId
cameraPosition
cameraTarget
fieldOfView
projection
```

### 14.2 Optional properties

```text
name
description
roomId
```

### 14.3 Projection type

```text
PERSPECTIVE
ORTHOGRAPHIC
```

### 14.4 Canonical shape

```json
{
  "id": "living-tv-view",
  "name": "Living Room TV View",
  "levelId": "ground-level",
  "roomId": "living-room",
  "cameraPosition": { "x": 250, "y": 165, "z": 320 },
  "cameraTarget": { "x": 250, "y": 120, "z": 120 },
  "fieldOfView": 60,
  "projection": "PERSPECTIVE"
}
```

Viewpoints are stored at Project scope.

## 15. BaseImage

### 15.1 Required properties

```text
id
viewpointId
assetRef
projectRevision
createdAt
```

### 15.2 Optional properties

```text
name
description
width
height
```

### 15.3 Canonical shape

```json
{
  "id": "base-image-living-tv-001",
  "viewpointId": "living-tv-view",
  "assetRef": "assets/base-images/living-tv-001.png",
  "projectRevision": 3,
  "createdAt": "2026-07-11T16:00:00+02:00"
}
```

The binary image is not embedded in `project.json`.

## 16. DesignBrief

### 16.1 Purpose

`DesignBrief` represents structured design intent.

It is broader than a plain prompt string.

The MVP should already support a meaningful structured brief so that the design workflow is not reduced to free-form prompt engineering.

### 16.2 Required properties

```text
id
promptText
constraints
palette
referenceAssetRefs
```

### 16.3 Optional properties

```text
name
description
style
notes
```

### 16.4 Canonical shape

```json
{
  "id": "warm-industrial-living",
  "name": "Warm Industrial Living Room",
  "promptText": "Design a warm industrial living room with a calm and contemporary atmosphere.",
  "style": "WARM_INDUSTRIAL",
  "constraints": [
    "Preserve all wall geometry",
    "Preserve the staircase",
    "Preserve the mezzanine",
    "Preserve all doors and windows"
  ],
  "palette": [
    "warm white",
    "black metal",
    "light concrete",
    "natural wood"
  ],
  "referenceAssetRefs": [],
  "notes": "Keep the TV wall visually clean and avoid oversized furniture."
}
```

### 16.5 Structured intent

The MVP DesignBrief supports:

- free-form prompt text;
- optional style;
- explicit constraints;
- preferred palette;
- optional reference assets;
- optional notes.

`style` should initially remain a free string rather than a rigid enum.

### 16.6 Provider independence

DesignBrief remains provider-independent.

Provider adapters may convert the structured brief into provider-specific requests.

## 17. RenderRequest

### 17.1 Required properties

```text
id
viewpointId
baseImageId
designBriefId
status
createdAt
```

### 17.2 Optional properties

```text
name
requestedProviderId
requestedModelId
requestedResultCount
startedAt
completedAt
error
```

### 17.3 Status enum

```text
PENDING
RUNNING
SUCCEEDED
FAILED
CANCELLED
```

### 17.4 Canonical shape

```json
{
  "id": "render-request-001",
  "viewpointId": "living-tv-view",
  "baseImageId": "base-image-living-tv-001",
  "designBriefId": "warm-industrial-living",
  "status": "SUCCEEDED",
  "requestedProviderId": "openai",
  "requestedModelId": "image-model-id",
  "requestedResultCount": 4,
  "createdAt": "2026-07-11T16:05:00+02:00",
  "startedAt": "2026-07-11T16:05:03+02:00",
  "completedAt": "2026-07-11T16:05:45+02:00"
}
```

One RenderRequest may produce zero or more RenderResults.

## 18. RenderResult

### 18.1 Required properties

```text
id
renderRequestId
status
createdAt
```

`assetRef` is conditionally required according to the RenderResult status, as defined in section 18.4.

### 18.2 Optional properties

```text
name
assetRef
providerId
modelId
notes
favorite
error
width
height
```

### 18.3 Canonical shape

```json
{
  "id": "render-result-001",
  "renderRequestId": "render-request-001",
  "assetRef": "assets/renders/render-result-001.png",
  "status": "SUCCEEDED",
  "providerId": "openai",
  "modelId": "image-model-id",
  "createdAt": "2026-07-11T16:05:45+02:00",
  "favorite": false
}
```

Provider and model identifiers are stored as generic strings.

### 18.4 Conditional validation
If status is SUCCEEDED, assetRef is required.

If status is FAILED or CANCELLED, assetRef may be omitted.

This conditional rule will be expressed explicitly in the future JSON Schema and Zod schemas.

## 19. Asset References

`assetRef` represents a generic asset reference.

Examples:

```text
assets/base-images/living-tv-001.png
assets/renders/render-result-001.png
assets/references/moodboard-001.jpg
```

The schema must not assume that an asset is always local.

Future adapters may interpret `assetRef` as a relative path, object-storage key, database-backed identifier, or cloud reference.

## 20. Project-Level Collections

Observation and design-rendering entities are stored at Project scope.

```json
{
  "viewpoints": [],
  "baseImages": [],
  "designBriefs": [],
  "renderRequests": [],
  "renderResults": []
}
```

Reasons:

- preserves separation from physical Building data;
- simplifies gallery queries;
- supports filtering and traceability;
- avoids deeply nested workflow artifacts;
- supports future API and persistence models.

## 21. Structural Validity and Renderability

### 21.1 Structurally Valid

A Project is structurally valid when:

- required properties exist;
- required arrays exist;
- values use valid types and enums;
- local entity invariants are satisfied.

Structural validity is intentionally limited to validation performed by `ProjectSchema`.

Cross-reference resolution, relationship consistency, renderability, and geometry validation are performed by dedicated validation phases.

### 21.2 Renderable

A Project, Level, or Room is renderable when it additionally contains enough valid geometry for the Geometry Engine.

Renderability rules may include:

- at least one Level;
- at least one Room;
- geometry-buildable Room boundaries with at least three ordered and oriented edges;
- non-zero Wall dimensions;
- valid Opening placement;
- coherent Staircase geometry where present.

These outcomes are not persisted as boolean fields.

## 22. Minimum Valid Project

The minimum structurally valid Project follows this shape:

```text
Project
└── Building
    └── Level[]
```

A Level may temporarily contain empty collections and still be valid as a draft.

The normal application flow should guide users toward creating a Room immediately after creating a Level.

## 23. Canonical Top-Level Structure

```text
Project
├── id
├── name
├── schemaVersion
├── revision
├── createdAt
├── updatedAt
├── units
│   ├── length
│   └── angle
├── building
│   ├── id
│   ├── name
│   ├── type
│   └── levels[]
│       └── Level
│           ├── id
│           ├── name
│           ├── elevation
│           ├── rooms[]
│           ├── walls[]
│           └── staircases[]
├── viewpoints[]
├── baseImages[]
├── designBriefs[]
├── renderRequests[]
└── renderResults[]
```

## 24. Implementation Sequence

```text
1. Common scalar and point schemas
2. Project metadata and units
3. Building
4. Level
5. Room
6. Wall
7. Opening
8. Staircase
9. Viewpoint
10. BaseImage
11. DesignBrief
12. RenderRequest
13. RenderResult
14. Cross-reference validation
15. Reference Consistency validation
16. Renderability validation
17. First example project.json
```

## 25. Expected Revisions

Likely areas of future revision include:

- additional Room types;
- Building type expansion;
- exact StairFlight properties;
- precise StairLanding geometry;
- advanced Viewpoint projection properties;
- asset-reference normalization;
- provider metadata;
- design-style structure;
- external spaces;
- imported CAD precision;
- Wall and Opening edge cases.

Any revision must remain consistent with:

- `docs/11-domain-model.md`;
- `docs/12-spatial-coordinate-system.md`.

## 26. Final Principle

`project.json` is the portable structured representation of one CasaStudio Project.

It must be:

- readable;
- versioned;
- explicit;
- deterministic;
- validatable;
- suitable for human inspection;
- suitable for AI agents;
- suitable for 2D and 3D generation;
- independent from persistence and rendering technologies.

The Project Schema translates the conceptual Domain Model into a concrete data contract without allowing implementation details to redefine the domain.
