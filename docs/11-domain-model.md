# 11 - Domain Model

## 1. Purpose

This document defines the conceptual domain model of CasaStudio.

Its purpose is to describe the core entities, responsibilities, relationships, and invariants that represent the real-world problem CasaStudio is designed to solve.

This document is intentionally not a schema document. It does not define JSON properties, Zod schemas, database tables, REST APIs, frontend state, rendering primitives, or provider-specific AI integrations.

Those artifacts must be derived from this domain model.

The domain model provides the conceptual foundation for:

- the project file format;
- JSON Schemas;
- Zod schemas;
- shared TypeScript models;
- future database design;
- 2D blueprint generation;
- 3D geometry generation;
- viewpoint management;
- AI-assisted design rendering;
- render gallery and decision history.

CasaStudio is expected to evolve over time. The concepts in this document should remain stable even when implementation technologies, rendering engines, persistence mechanisms, or AI providers change.

## 2. Domain Philosophy

CasaStudio must be designed from the domain outward.

The domain must not be shaped around a specific framework, rendering engine, database, file format, or AI provider. Technologies implement the domain. They do not define it.

CasaStudio does not model an image.

CasaStudio does not model an SVG drawing.

CasaStudio does not model a Three.js scene.

CasaStudio models a real building through structured project data.

Every other representation is derived from that structured model.

```text
Real-world building data
        |
        v
Structured project model
        |
        v
2D blueprint
        |
        v
Navigable 3D scene
        |
        v
Saved viewpoints
        |
        v
Base images
        |
        v
AI-generated design renders
```

The Project model is the source of truth.

The following are derived representations:

- 2D blueprints;
- generated 3D scenes;
- exported screenshots;
- BaseImages;
- RenderRequests;
- RenderResults;
- gallery entries;
- design comparison timelines.

An AI-generated RenderResult must never become the source of truth for the physical Building model.

## 3. Domain Boundaries

CasaStudio knows about architectural, spatial, observational, and design-rendering concepts.

The following concepts belong to the CasaStudio domain:

- Project;
- Building;
- Level;
- Room;
- Wall;
- Opening;
- Door;
- Window;
- Staircase;
- Viewpoint;
- BaseImage;
- DesignBrief;
- RenderRequest;
- RenderResult.

The following concepts do not define the core domain:

- React;
- NestJS;
- Three.js;
- SVG;
- PostgreSQL;
- Prisma;
- REST;
- Azure;
- OpenAI;
- Stability AI;
- Replicate;
- Jenkins;
- Docker.

Some of those technologies may be used by the application. They remain implementation details. Domain language must not be replaced with implementation language.

The domain model is also distinct from the Geometry Engine. The Geometry Engine consumes the Physical Building Model and produces derived geometric representations. It does not own the meaning of the building.

Spatial conventions used by the Geometry Engine and by future schemas are defined in `docs/12-spatial-coordinate-system.md`.

## 4. Core Subdomains

The CasaStudio domain is organized into three conceptual subdomains.

### 4.1 Physical Building Model

The Physical Building Model describes the real property being modeled.

It contains:

- Project;
- Building;
- Level;
- Room;
- Wall;
- Opening;
- Door;
- Window;
- Staircase.

This subdomain is the authoritative source for architectural geometry and spatial relationships. It describes what the building is, not how it is rendered.

The Physical Building Model is the primary input to the Geometry Engine.

### 4.2 Observation Model

The Observation Model describes reproducible views of the building.

It contains:

- Viewpoint;
- BaseImage.

A Viewpoint is a saved observation of the project. It records enough information to reproduce a visual perspective.

A BaseImage is a derived image exported from a Viewpoint. It is used as a reference image for AI-assisted design rendering.

Observation concepts are deliberately separate from physical building concepts. A Viewpoint observes the Building, but it does not modify the Building. A BaseImage is generated from the Building through a Viewpoint, but it is not building data.

### 4.3 Design Rendering Model

The Design Rendering Model describes AI-assisted design generation and its outputs.

It contains:

- DesignBrief;
- RenderRequest;
- RenderResult.

A DesignBrief expresses the user intent for a design exploration.

A RenderRequest records an attempt to generate a design image from a BaseImage and a DesignBrief.

A RenderResult records the generated artifact and associated result metadata.

Design rendering concepts are derived workflow concepts. They support exploration, comparison, and decision-making. They do not modify the Physical Building Model.

## 5. Core Entities

### Project

`Project` is the application root.

It represents the complete CasaStudio work context for one design effort. A Project contains information that is not part of the physical building itself, such as identity, metadata, measurement units, format version, settings, saved observations, and generated design outputs.

For the MVP, a Project contains exactly one Building.

If a real future requirement emerges for multiple buildings inside one Project, the model may evolve from a single Building reference to a Building collection. That evolution is intentionally postponed until a concrete use case requires it.

A Project is responsible for preserving the integrity of the structured project model as the source of truth for all derived representations.

### Building

`Building` represents the real physical property being modeled.

Examples include:

- house;
- villa;
- apartment;
- office;
- residential unit;
- professional interior space.

A Building contains one or more Levels.

The Building is the central physical entity of the domain. It is the object that the Project describes, observes, and uses as the basis for design rendering.

### Level

`Level` represents a vertical organizational layer of a Building.

The term `Level` is preferred over `Floor` because it is more general. A Level may represent a ground level, first level, basement, technical level, or any other vertical layer of the Building.

A Building contains one or more Levels.

Each Level defines its own local origin and elevation according to the spatial conventions in `docs/12-spatial-coordinate-system.md`.

A Level contains:

- Rooms;
- Walls;
- Openings through its Walls;
- Staircases associated with movement from or to that Level;
- future level-scoped architectural elements when required.

### Room

`Room` represents a functional architectural space.

Examples include:

- living room;
- kitchen;
- bedroom;
- bathroom;
- studio;
- mezzanine studio;
- corridor;
- storage room.

Each Room belongs to exactly one Level.

A Room is not the authoritative source for its physical boundary geometry. Walls are the authoritative source describing room boundaries. Room boundaries are derived from, or validated against, the Walls associated with the Room.

A Room may define functional metadata and an optional local elevation relative to its parent Level.

The optional elevation allows CasaStudio to represent raised spaces without promoting them to separate Levels.

#### Mezzanine as a Room

A mezzanine is modeled as a Room.

It is not modeled as a Level.

A mezzanine Room may define an optional local elevation relative to its parent Level.

Example:

```text
Ground Level
├── Living Room
└── Mezzanine Studio
    └── elevation: 195 cm
```

This keeps the model aligned with the functional nature of the mezzanine as a usable and designable space.

CasaStudio does not introduce `Slab` or `Platform` as domain entities for the MVP. The Geometry Engine may later generate supporting physical geometry, such as mezzanine slabs or platforms, from elevated Rooms and their wall relationships. Those generated shapes are derived geometry, not independent domain entities.

### Wall

`Wall` represents a physical wall segment.

Walls are the authoritative source describing room boundaries.

A Wall belongs to exactly one Level.

A Wall may be associated with one or more Rooms:

- an external Wall may delimit one Room;
- an internal Wall may be shared by two Rooms;
- future cases may associate a Wall with circulation, exterior space, or other spatial concepts.

A Wall must not be duplicated only because it is shared by multiple Rooms.

Walls are organized at Level scope so shared walls remain single physical entities.

The spatial definition of a Wall is based on a start point and an end point in Level coordinate space. Details of coordinate conventions are defined in `docs/12-spatial-coordinate-system.md`.

### Opening

`Opening` is the general concept for an architectural opening in a Wall.

Concrete opening types include:

- Door;
- Window.

Every Opening belongs to exactly one Wall.

An Opening may define:

- its position along the Wall;
- width;
- height;
- elevation from the relevant local floor reference;
- opening-specific behavior;
- functional connections.

Openings belong to Walls, not directly to Rooms. A Room may be visually or functionally affected by an Opening through its association with the Wall.

### Door

`Door` is an Opening that allows passage.

A Door belongs to exactly one Wall.

A Door may connect Rooms functionally, but this relationship does not replace its physical relationship with the Wall.

Door connectivity should be understood as a functional navigation relationship. The Wall remains the physical owner of the Door.

### Window

`Window` is an Opening in a Wall.

A Window belongs to exactly one Wall.

A Window does not belong directly to a Room, even though one or more Rooms may be visually associated with it through the Wall.

Window placement, dimensions, and elevation must be compatible with the Wall on which the Window is defined.

### Staircase

`Staircase` is an independent architectural entity that represents vertical circulation.

A Staircase should preserve its architectural meaning and must not be reduced to a rendering-only primitive.

CasaStudio avoids generic polymorphic ownership for Staircases. Instead, a Staircase uses explicit conceptual references:

- `fromLevelId`;
- `toLevelId`;
- optional `fromRoomId`;
- optional `toRoomId`.

The Level references express the primary vertical connection. The optional Room references express the functional spaces from which the staircase starts and into which it arrives.

This model is preferred because:

- vertical movement is fundamentally level-to-level or elevation-to-elevation;
- Room references alone are insufficient when a staircase starts in circulation space, an open area, or a future non-room spatial concept;
- Level references provide stable validation boundaries;
- optional Room references preserve useful design intent without making Room ownership mandatory;
- future schema and database models can validate the relationship without relying on broad `Room | Level` polymorphism.

For a mezzanine modeled as an elevated Room, a Staircase may connect the parent Level to itself through optional Room references when the vertical transition occurs inside the same Level. In that case, `fromLevelId` and `toLevelId` may identify the same Level, while `fromRoomId` and `toRoomId` identify the functional start and destination Rooms.

A Staircase must preserve enough conceptual information for the Geometry Engine to reconstruct its derived geometry, including vertical direction, approximate footprint, and connection intent. Detailed flights, landings, step geometry, and generated meshes remain geometry concerns unless they become required domain concepts later.
The Project Model may persist architectural staircase layout information, such as StairFlights and StairLandings, when that information represents real architectural measurements. The Geometry Engine derives renderable meshes, individual steps, risers, treads, and other geometric primitives from that persisted layout. Therefore, StairFlights and StairLandings belong to the Project Model as architectural input, while generated geometry remains outside the Core Domain.

### Viewpoint

`Viewpoint` represents a saved observation of the Building.

A Viewpoint belongs to exactly one Level.

A Viewpoint may optionally reference a Room.

The Room reference is optional because not every useful observation belongs cleanly to one Room. A Viewpoint may observe a staircase, a mezzanine edge, an open-plan area, a level-wide view, or a cross-room perspective.

A Viewpoint must contain enough conceptual information to reproduce the same visual perspective.

Conceptually, this includes:

- Level reference;
- optional Room reference;
- camera position;
- camera target or orientation;
- field of view;
- projection type;
- descriptive name;
- optional description.

Viewpoints are part of the Observation Model. They observe the Physical Building Model and provide stable starting points for BaseImage generation and design rendering.

### BaseImage

`BaseImage` represents an exported visual reference generated from a Viewpoint.

A BaseImage is a derived artifact.

It is generated from:

- one Project;
- one Building state;
- one Viewpoint;
- one rendering/export operation.

A BaseImage is used as the visual reference for a RenderRequest.

A BaseImage must not modify the Building model. It captures a visual state of the project at a moment in time. It may become historically important if the Building model changes later, because it documents what the RenderRequest used as its visual input.

### DesignBrief

`DesignBrief` represents the design intent supplied by a user or future structured design tool.

A DesignBrief may include:

- free-form prompt text;
- style intent;
- constraints;
- preservation instructions;
- optional notes;
- future structured design parameters.

A DesignBrief is provider-independent.

It must not contain provider-specific payloads, SDK objects, or implementation details.

A DesignBrief expresses what the user wants to explore. It does not describe the physical truth of the Building.

### RenderRequest

`RenderRequest` represents a generation request.

It records the intent and inputs used to ask an AI image provider, or another future rendering mechanism, to create a design proposal.

A RenderRequest is derived from:

- one Project;
- one Viewpoint;
- one BaseImage;
- one DesignBrief;
- generation parameters;
- provider selection metadata when relevant.

A RenderRequest may succeed, fail, be cancelled, or remain pending.

A RenderRequest does not modify the Physical Building Model.

The purpose of RenderRequest is traceability. It describes what was asked, from which visual reference, with which design intent, and under which generation context.

### RenderResult

`RenderResult` represents a generated design artifact.

It is the output of a RenderRequest.

A RenderResult may contain:

- generated image reference;
- status;
- timestamp;
- provider metadata;
- model metadata;
- notes;
- favorite state;
- comparison metadata;
- future decision metadata.

A RenderResult is a derived visual interpretation.

It does not modify the Building model, Room geometry, Wall definitions, Opening placement, or Staircase relationships.

The render gallery and decision timeline are organized around RenderResults and their relationship to RenderRequests, Viewpoints, BaseImages, and DesignBriefs.

## 6. Relationships

The primary physical hierarchy is:

```text
Project
└── Building
    └── Level[]
        ├── Room[]
        ├── Wall[]
        │   └── Opening[]
        │       ├── Door
        │       └── Window
        └── Staircase[]
```

The observation and design rendering relationships are:

```text
Project
├── Viewpoint[]
│   ├── Level reference
│   ├── optional Room reference
│   └── BaseImage[]
└── RenderRequest[]
    ├── Viewpoint reference
    ├── BaseImage reference
    ├── DesignBrief
    └── RenderResult[]
```

The main conceptual relationships are:

```text
Project -> Building

Building -> Level[]

Level -> Room[]
Level -> Wall[]
Level -> Staircase[]

Room -> Level
Room -> Wall references
Room -> optional elevation

Wall -> Level
Wall -> Room references
Wall -> Opening[]

Opening -> Wall

Door -> Wall
Door -> optional connected Room references

Window -> Wall

Staircase -> fromLevelId
Staircase -> toLevelId
Staircase -> optional fromRoomId
Staircase -> optional toRoomId

Viewpoint -> Level
Viewpoint -> optional Room

BaseImage -> Viewpoint

DesignBrief -> RenderRequest

RenderRequest -> Viewpoint
RenderRequest -> BaseImage
RenderRequest -> DesignBrief
RenderRequest -> RenderResult[]

RenderResult -> RenderRequest
```

Bidirectional navigation may be useful in derived models, but the conceptual domain should preserve a clear source of ownership:

- Building owns Levels.
- Levels own Rooms, Walls, and Staircases.
- Walls own Openings.
- Viewpoints belong to Projects and reference Levels.
- BaseImages are derived from Viewpoints.
- RenderRequests own generation attempts.
- RenderResults are outputs of RenderRequests.

## 7. Domain Invariants

### Project invariants

- A Project is the application root.
- A Project contains exactly one Building in the MVP.
- A Project defines explicit measurement units.
- A Project defines or references the project format version.
- A Project is the source of truth for all derived representations.
- Derived artifacts must never override physical Building data.

### Building invariants

- A Building belongs to exactly one Project.
- A Building contains one or more Levels.
- A Building represents the real physical property being modeled.

### Level invariants

- A Level belongs to exactly one Building.
- A Level contains zero or more Rooms.
- A Level owns the Wall entities defined within its architectural scope.
- A Level may contain Staircases associated with movement from or to that Level.
- A Level defines its own local origin.
- A Level defines its own elevation.

### Room invariants

- A Room belongs to exactly one Level.
- A Room represents a functional architectural space.
- A Room may define an optional local elevation.
- A Room may reference one or more Walls.
- A Room boundary is derived from, or validated against, its associated Walls.
- A mezzanine is represented as a Room with optional elevation.
- A mezzanine is not represented as a Level.

### Wall invariants

- A Wall belongs to exactly one Level.
- A Wall is associated with one or more Rooms.
- A shared Wall must be represented once and referenced by multiple Rooms.
- Walls are the authoritative source describing room boundaries.
- A Wall is defined by a start point and an end point in Level coordinate space.
- Openings belong to Walls, not directly to Rooms.

### Opening invariants

- Every Opening belongs to exactly one Wall.
- Every Door is an Opening.
- Every Window is an Opening.
- Opening placement is expressed relative to its Wall.
- Opening dimensions must be compatible with the Wall that owns the Opening.

### Door invariants

- A Door belongs to exactly one Wall.
- A Door may reference connected Rooms.
- Door connectivity is functional and does not replace Wall ownership.

### Window invariants

- A Window belongs to exactly one Wall.
- A Window does not belong directly to a Room.
- A Window remains physically associated with its Wall.

### Staircase invariants

- A Staircase is an independent architectural entity.
- A Staircase has `fromLevelId` and `toLevelId`.
- A Staircase may have `fromRoomId` and `toRoomId`.
- Optional Room references must be consistent with the referenced Levels.
- A Staircase must preserve enough information for derived geometry generation.
- A Staircase must not be reduced to a rendering-only primitive.

### Viewpoint invariants

- A Viewpoint belongs to exactly one Level.
- A Viewpoint may optionally reference one Room.
- If a Viewpoint references a Room, that Room must belong to the same Level.
- A Viewpoint must contain enough camera information to reproduce the same perspective.
- A Viewpoint does not modify the Physical Building Model.

### BaseImage invariants

- A BaseImage is derived from exactly one Viewpoint.
- A BaseImage represents an exported visual reference.
- A BaseImage does not modify the Physical Building Model.
- A BaseImage should preserve enough metadata to understand which Project state and Viewpoint produced it.

### DesignBrief invariants

- A DesignBrief expresses design intent.
- A DesignBrief is provider-independent.
- A DesignBrief must not contain provider SDK objects or provider-specific request payloads.
- A DesignBrief does not modify the Physical Building Model.

### RenderRequest invariants

- A RenderRequest is a generation request.
- A RenderRequest references exactly one Viewpoint.
- A RenderRequest references exactly one BaseImage.
- A RenderRequest uses exactly one DesignBrief.
- A RenderRequest does not modify the Physical Building Model.
- A RenderRequest may produce zero or more RenderResults depending on provider behavior and retry strategy.

### RenderResult invariants

- A RenderResult is a generated artifact.
- A RenderResult belongs to exactly one RenderRequest.
- A RenderResult does not modify the Physical Building Model.
- A RenderResult is a derived visual interpretation.
- The maximum number of RenderResults is an application policy, not a domain invariant.

## 8. Validation Architecture

CasaStudio validates a Project through multiple independent phases.

Each phase has a well-defined responsibility and builds upon the guarantees provided by the previous one.

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

### ProjectSchema

Validates structural composition, required properties, primitive types, enums, and entity-local invariants.

### Cross-reference Validation

Verifies that every identifier reference resolves to an existing entity.

Examples include:

- Room → Wall
- Wall → Room
- Viewpoint → Level
- BaseImage → Viewpoint
- RenderRequest → BaseImage

### Reference Consistency Validation

Verifies that existing references are semantically coherent.

Examples include:

- a Viewpoint Room belongs to the referenced Level;
- a Staircase fromRoom belongs to fromLevel;
- a Staircase toRoom belongs to toLevel;
- a RenderRequest BaseImage belongs to the referenced Viewpoint.

### Renderability Validation

Determines whether a structurally valid Project contains the minimum workflow information required for rendering.

### Geometry Validation

Verifies architectural and geometric correctness required by the Geometry Engine.

This layered approach keeps each validator focused on a single responsibility and allows validation rules to evolve independently without increasing the complexity of the structural schemas.

## 9. Geometry Engine Boundary

The Geometry Engine is not part of the Core Domain.

The Geometry Engine consumes the Physical Building Model and produces derived geometric representations.

The Geometry Engine may generate:

- SVG geometry for 2D blueprints;
- Three.js-compatible geometry for navigable 3D scenes;
- exported BaseImages from Viewpoints;
- intermediate geometric primitives;
- helper geometry such as mezzanine slabs or platforms derived from elevated Rooms.

Generated geometry must not become the authoritative Building model.

For example, a mezzanine Room may have an elevation in the domain model. The Geometry Engine may generate a platform or slab shape to represent that elevated Room visually. That generated platform is not a domain entity unless a future domain requirement proves it needs independent identity, lifecycle, or behavior.

The Geometry Engine must respect the coordinate, elevation, rotation, and precision conventions defined in `docs/12-spatial-coordinate-system.md`.

The domain model defines what exists. The Geometry Engine defines how that existence is converted into geometric representations.

## 10. AI Boundary

AI-assisted rendering is part of the application domain, but provider-specific integrations are infrastructure concerns.

The domain understands:

- DesignBrief;
- RenderRequest;
- RenderResult;
- Viewpoint;
- BaseImage;
- render status;
- design comparison metadata.

The domain must not depend on:

- provider SDK objects;
- provider-specific request payloads;
- provider-specific image formats beyond generic artifact references;
- vendor-specific model names as domain concepts;
- provider authentication details.

Conceptually:

```text
Design Rendering Model
├── DesignBrief
├── RenderRequest
└── RenderResult

Infrastructure
├── OpenAI image provider adapter
├── Stability provider adapter
├── Replicate provider adapter
└── future provider adapters
```

The provider may influence metadata recorded on a RenderRequest or RenderResult, but it must not redefine the domain model.

AI-generated images are design proposals. They may influence human decisions, but they do not mutate the Project's physical Building data.

## 11. MVP Constraints

The MVP intentionally supports a constrained version of the domain.

Initial scope:

```text
Project
└── one Building
    └── one or more Levels
        ├── Rooms
        ├── Walls
        ├── Openings
        └── Staircases
```

The first real example will focus on the living room and mezzanine of the initial CasaStudio project.

The MVP does not require:

- Users;
- Workspaces;
- multiple Buildings per Project;
- BIM import;
- IFC export;
- collaborative editing;
- plugin architecture;
- advanced furniture modeling;
- material management;
- AI-generated navigable 3D furnishing;
- render queue or worker model.

These constraints are implementation scope decisions.

They do not redefine the core meaning of the domain entities.

## 12. Future Evolution

The domain should support incremental evolution.

Potential future additions include:

```text
User
└── Workspace
    └── Project[]
```

Other possible evolutions include:

- multiple Projects per Workspace;
- multiple Buildings per Project if a concrete use case requires it;
- CAD import;
- IFC interoperability;
- richer outdoor spaces;
- professional client workflows;
- collaborative editing;
- structured AI design proposals;
- navigable furnished 3D scenes;
- plugin-based import or export;
- multiple rendering providers;
- material and lighting management.

These features are not part of the MVP.

They must not introduce premature complexity into the current implementation.

Future additions should preserve the distinction between:

- physical building truth;
- generated geometric representations;
- saved observations;
- AI-generated design artifacts;
- application and collaboration concerns.

## 13. Professional Workflow

A future professional workflow may be:

```text
2D CAD drawing
        |
        v
Import into CasaStudio
        |
        v
Structured CasaStudio project model
        |
        v
Validated Physical Building Model
        |
        v
Navigable 3D viewer
        |
        v
Saved Viewpoints
        |
        v
BaseImages
        |
        v
AI-assisted design RenderRequests
        |
        v
RenderResults
        |
        v
Client presentation and decision timeline
```

This use case reinforces the need for:

- stable identifiers;
- explicit units;
- clear architectural entities;
- explicit relationships;
- deterministic geometry;
- traceable BaseImages;
- provider-independent design rendering;
- durable decision history.

## 14. Final Structure

```text
Project
├── metadata
├── units
├── format version
├── settings
├── Building
│   ├── metadata
│   └── Level[]
│       └── Level
│           ├── elevation
│           ├── origin
│           ├── Room[]
│           │   └── Room
│           │       ├── optional elevation
│           │       └── Wall references
│           ├── Wall[]
│           │   └── Wall
│           │       ├── start point
│           │       ├── end point
│           │       ├── Room references
│           │       └── Opening[]
│           │           ├── Door
│           │           └── Window
│           └── Staircase[]
│               └── Staircase
│                   ├── fromLevelId
│                   ├── toLevelId
│                   ├── optional fromRoomId
│                   └── optional toRoomId
├── Viewpoint[]
│   └── Viewpoint
│       ├── Level reference
│       ├── optional Room reference
│       ├── camera position
│       ├── camera target or orientation
│       └── projection information
├── BaseImage[]
│   └── BaseImage
│       └── Viewpoint reference
├── RenderRequest[]
│   └── RenderRequest
│       ├── Viewpoint reference
│       ├── BaseImage reference
│       ├── DesignBrief
│       └── RenderResult[]
```

This structure is conceptual. Future JSON Schemas, Zod schemas, TypeScript models, and database models may organize references differently for validation, normalization, or persistence. Those representations must preserve the domain semantics defined here.

A project-level gallery or decision timeline may index RenderResults for retrieval and presentation. That does not change the conceptual ownership rule: a RenderResult is the output of a RenderRequest.

## 15. Guiding Principles

The Project is the application root.

The Building is the central physical entity.

Levels organize the Building vertically.

Rooms represent functional architectural spaces.

A mezzanine is a Room, not a Level.

Walls are the authoritative source describing room boundaries.

Openings belong to Walls.

Staircases connect Levels and may optionally identify start and destination Rooms.

Observation is separate from physical building data.

Viewpoints belong to Levels and may optionally reference Rooms.

BaseImages are exported visual references derived from Viewpoints.

DesignBriefs express design intent.

RenderRequests record generation attempts.

RenderResults are generated artifacts.

AI-generated images are derived design interpretations.

The Geometry Engine consumes the domain model but does not define it.

The Project model remains the single source of truth.
