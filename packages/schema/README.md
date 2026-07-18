# @casastudio/schema

Shared TypeScript and Zod contract for CasaStudio project data.

This package represents the structured CasaStudio domain model: the physical
building, staircases, saved viewpoints, base images, design briefs, render
requests, render results, and the root `Project` aggregate that ties those
parts together.

The package is intentionally focused on schemas, inferred types, JSON Schema
export, and first-layer domain validation. It does not generate geometry,
render scenes, call AI providers, or persist projects.

## Monorepo Usage

From another workspace package, import public symbols from the package root:

```ts
import {
  ProjectSchema,
  validateProjectCrossReferences,
  validateProjectReferenceConsistency,
  validateProjectRenderability,
  type Project
} from "@casastudio/schema";
```

`@casastudio/schema` is private to this monorepo today. Use normal workspace
installation from the repository root:

```sh
pnpm install
```

## Parsing A Project

Use `ProjectSchema.parse` when invalid structure should throw a Zod error:

```ts
import { ProjectSchema, type Project } from "@casastudio/schema";

const project: Project = ProjectSchema.parse(projectJson);
```

`ProjectSchema` validates structural shape and local field constraints: required
properties, object shapes, primitive types, enums, timestamps, positive numbers,
and local schema refinements.

Parsing alone does not guarantee complete project validity. A parsed project can
still reference missing entities, contain inconsistent ownership relationships,
or be incomplete for rendering.

## Safe Parsing

Use `safeParse` when loading user-provided or external project JSON:

```ts
import { ProjectSchema } from "@casastudio/schema";

const parsed = ProjectSchema.safeParse(projectJson);

if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    console.error(issue.path.join("."), issue.message);
  }

  throw new Error("Project JSON is structurally invalid.");
}

const project = parsed.data;
```

Run domain validators only after structural parsing succeeds:

```ts
import {
  ProjectSchema,
  validateProjectCrossReferences,
  validateProjectReferenceConsistency,
  validateProjectRenderability
} from "@casastudio/schema";

const parsed = ProjectSchema.safeParse(projectJson);

if (!parsed.success) {
  throw parsed.error;
}

const project = parsed.data;

const crossReferences = validateProjectCrossReferences(project);
const referenceConsistency = validateProjectReferenceConsistency(project);
const renderability = validateProjectRenderability(project);
```

## Domain Validation

Domain validators check cross-entity and workflow invariants that are outside
the structural responsibility of `ProjectSchema`.

The current conceptual validation order is:

```text
ProjectSchema
-> validateProjectCrossReferences
-> validateProjectReferenceConsistency
-> validateProjectRenderability
```

Responsibilities:

- `validateProjectCrossReferences` checks that referenced entities exist, such
  as room, wall, level, viewpoint, base image, design brief, render request, and
  render result references.
- `validateProjectReferenceConsistency` checks semantic consistency between
  references that already resolve, such as room/level ownership and render
  request viewpoint/base-image alignment.
- `validateProjectRenderability` checks the minimum workflow data required for a
  project to be renderable, such as viewpoints, base images, design briefs, and
  render requests.

Each validator returns a `ValidationResult`:

```ts
type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};
```

Validators collect domain errors instead of throwing for validation failures.

## Aggregating Validator Errors

The package does not provide a validator-composition API. Applications can keep
composition explicit:

```ts
import {
  ProjectSchema,
  type ValidationError,
  validateProjectCrossReferences,
  validateProjectReferenceConsistency,
  validateProjectRenderability
} from "@casastudio/schema";

const parsed = ProjectSchema.safeParse(projectJson);

if (!parsed.success) {
  throw parsed.error;
}

const project = parsed.data;
const validationErrors: ValidationError[] = [
  ...validateProjectCrossReferences(project).errors,
  ...validateProjectReferenceConsistency(project).errors,
  ...validateProjectRenderability(project).errors
];

if (validationErrors.length > 0) {
  for (const error of validationErrors) {
    console.error(error.code, error.path, error.message);
  }
}
```

For user-facing workflows, keep structural parsing errors and domain validation
errors separate. They answer different questions:

- structural parsing: "Is this JSON shaped like a CasaStudio project?"
- domain validation: "Do the project relationships and rendering workflow make
  sense?"

## Canonical Project Example

The canonical project example is:

```text
packages/schema/examples/project.json
```

It is a realistic golden sample for the current domain model and is used by
regression tests. It is not a minimal unit-test fixture.

The example satisfies `ProjectSchema` and all current domain validators. It is
not yet a geometrically certified model because Geometry Validation has not been
implemented.

In repository scripts or tests, load it as JSON and then parse it:

```ts
import { readFileSync } from "node:fs";

import {
  ProjectSchema,
  validateProjectCrossReferences,
  validateProjectReferenceConsistency,
  validateProjectRenderability
} from "@casastudio/schema";

const projectJson = JSON.parse(
  readFileSync("packages/schema/examples/project.json", "utf8")
);

const project = ProjectSchema.parse(projectJson);

const results = [
  validateProjectCrossReferences(project),
  validateProjectReferenceConsistency(project),
  validateProjectRenderability(project)
];

if (results.every((result) => result.valid)) {
  console.log("Canonical project is valid.");
}
```

The JSON file is not currently exported through the package `exports` map, so
package consumers should treat it as a repository example rather than a runtime
module import.

## JSON Schema

The generated JSON Schema for `ProjectSchema` is:

```text
packages/schema/json-schema/project.schema.json
```

It is generated from `ProjectSchema`, targets JSON Schema Draft 2020-12, and
must not be edited manually.

Regenerate it from the repository root with:

```sh
pnpm generate:schema
```

External tools can use this artifact for structural JSON validation before
CasaStudio-specific domain validation runs:

```ts
import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020";

const schema = JSON.parse(
  readFileSync("packages/schema/json-schema/project.schema.json", "utf8")
);

const ajv = new Ajv2020();
const validate = ajv.compile(schema);

if (!validate(projectJson)) {
  console.error(validate.errors);
}
```

The AJV snippet is conceptual; `ajv` is not a dependency of this package.

## Public API Overview

Public symbols are exported from `@casastudio/schema`.

Core project:

- `ProjectSchema`
- `type Project`

Physical building model:

- `BuildingSchema`, `LevelSchema`, `RoomSchema`, `WallSchema`, `OpeningSchema`
- `DoorSchema`, `WindowSchema`
- `type Building`, `type Level`, `type Room`, `type Wall`,
  `type Opening`, `type Door`, `type Window`

Staircase model:

- `StaircaseSchema`, `StairFlightSchema`, `StairLandingSchema`
- `type Staircase`, `type StairFlight`, `type StairLanding`

Observation model:

- `ViewpointSchema`, `BaseImageSchema`
- `type Viewpoint`, `type BaseImage`

Design rendering model:

- `DesignBriefSchema`, `RenderRequestSchema`, `RenderResultSchema`
- `type DesignBrief`, `type RenderRequest`, `type RenderResult`

Shared primitives and enums:

- `IdentifierSchema`, `IsoDateTimeSchema`, `CommonMetadataSchema`,
  `UnitsSchema`, `PositiveNumberSchema`, `PositiveIntegerSchema`,
  `Point2DSchema`, `Point3DSchema`
- `type Identifier`, `type IsoDateTime`, `type CommonMetadata`, `type Units`,
  `type PositiveNumber`, `type PositiveInteger`, `type Point2D`,
  `type Point3D`
- `BuildingTypeSchema`, `RoomTypeSchema`, `OpeningTypeSchema`,
  `ProjectionTypeSchema`, `RenderStatusSchema`
- `BuildingTypeValues`, `RoomTypeValues`, `OpeningTypeValues`,
  `ProjectionTypeValues`, `RenderStatusValues`
- `type BuildingType`, `type RoomType`, `type OpeningType`,
  `type ProjectionType`, `type RenderStatus`

Validation:

- `validateProjectCrossReferences`
- `validateProjectReferenceConsistency`
- `validateProjectRenderability`
- `ValidationErrorCode`
- `type ValidationError`
- `type ValidationResult`

## Current Scope And Limitations

- `ProjectSchema` is structural. It does not perform full domain validation.
- Domain validators must be called explicitly by application code after parsing.
- Geometry Validation and the Geometry Engine are out of scope for this package
  today.
- Renderability validation checks first-layer workflow prerequisites. It does
  not validate provider payloads, prompt quality, image assets, render lifecycle
  transitions, or generated output quality.
- The canonical project is a golden domain sample, not proof of geometric
  correctness.
- The generated JSON Schema is structural and does not replace the TypeScript
  domain validators.
