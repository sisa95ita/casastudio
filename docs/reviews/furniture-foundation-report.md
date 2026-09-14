# Furniture foundation implementation report

## Audit and architecture

The initial checkout was clean. The audit covered Project/Building/Level/Room schemas, common metadata and identifier conventions, centimeter/degree primitives, separate structural/reference/uniqueness/geometry validation, migrations and generated JSON Schema, architectural editing, GeometryModel/Polygon identity and floor elevation, normalized Prisma aggregate loading/writing, DTO and lifecycle services, frontend schema-derived types, full draft history, Room selection/deletion, and the domain/coordinate/runtime documentation.

The checkout used canonical schema v3 with explicit v1/v2 migration, Room ownership under Level, optional local Room elevation, deterministic caller-supplied domain IDs, per-entity-kind Project ID uniqueness, and optional name/description metadata. Geometry runtime objects are immutable and renderer-neutral, with deterministic IDs and Room-derived global floor elevation. Persistence reconstructs ordered collections from normalized rows; the frontend imports the Project type and uses complete JSON draft snapshots.

| Requested report item | Result |
| --- | --- |
| 1. Initial repository audit | Summarized above; existing architecture determined the implementation. |
| 2–3. Ownership and collection location | Required ordered `building.furniture[]`, with exactly one mandatory `roomId` per item. This avoids redundant Room nesting plus roomId and makes cross-Room reassignment a single-reference edit. |
| 4. FurnitureItem | `id`, `roomId`, `definitionId`, `{x,z}` position, rotation, width/depth/height, optional name/description. Strict object with no Level, Y, renderer or editor fields. |
| 5. FurnitureDefinition | Stable catalog ID, broad semantic category, product-facing name, default width/depth/height. |
| 6. Catalog | `packages/schema/src/furniture/builtin-catalog.ts`: eight frozen generic definitions—single bed, double bed, sofa, dining table, chair, cabinet, desk, generic furniture. Separate from Project composition, with no DB table or network loading. |
| 7. Room validation | Required syntactic reference; cross-reference validation requires a Room in this Project; identifier validation rejects conflicting Room/Furniture identities. Database composite FK enforces same-Project ownership. |
| 8–9. Level and floor derivation | `resolveFurnitureRoom` resolves Level through Room and derives `Level.elevation + (Room.elevation ?? 0)`. Elevated Rooms automatically elevate their Furniture. Stacked items can share X/Z. |
| 10. Anchor | Center of the local width × depth footprint in canonical Project X/Z. Anchor/footprint containment is deferred. |
| 11. Rotation | Arbitrary finite degrees about positive Y using the right-hand rule; no normalization or compass enum. |
| 12. Dimensions | Strictly positive finite centimeters, persisted as effective instance dimensions; width follows local X and depth local Z at zero rotation. |
| 13. Unknown definitions | Structurally acceptable, including provider namespaces. Catalog resolution can return undefined without invalidating Project data. |
| 14–16. Schema and migration | v4.0.0 adds required Building Furniture collection. v3 migration adds an empty collection and preserves all existing content; v1/v2 chain correctly. No IDs are generated. |
| 17. Room deletion | Deletes all owned Furniture atomically, including elevated standalone Rooms; existing restrictions for other references remain. |
| 18. Dissolution/partition | Dissolution transfers Furniture to the existing unique same-elevation surviving Room. Ambiguous dissolution retains its existing rejection. Partition/subdivision preserve source Room ID and its Furniture, with no spatial reassignment. |
| 19. Operations | create, update, move, rotate, resize, reassign, delete, duplicate; immutable established `ProjectEditingResult` with semantic errors. Separate definition-to-instance factory copies defaults. |
| 20. Duplication | Caller-supplied new ID and position, effective properties and metadata preserved, optional destination Room; no arbitrary offset. |
| 21. Reassignment | Mandatory existing target Room, optional new X/Z; derived vertical placement changes without persisted Y. |
| 22–23. Geometry/runtime snapshot | Unchanged. No Furniture geometry consumer exists; the pure Room resolver supplies the required vertical fact without unused runtime objects. |
| 24. Project API | Complete Project DTO and mapper transport ordered Furniture. Initial Project creation starts empty; replacements/read preserve all fields. No Furniture REST resource or Geometry API change. |
| 25. Prisma | Normalized FurnitureItem scalar rows; Project and same-Project Room FKs, cascade deletes, per-Project ID/order uniqueness, finite/positive checks. Generated migration applied; existing v3 roots advance without changing domain revision/timestamps. |
| 26. Exact changed files | Listed below, including required fixture version/empty-collection updates. |
| 27–29. Schema/operations/migrations | 429 schema tests pass, including 21 Furniture tests, five new migration regressions, v1/v2 chain tests, and extended partition/subdivision/dissolution regressions. |
| 30–31. DB/API tests | All 116 API tests passed with real PostgreSQL enabled: 20 persistence tests and five authenticated write integration tests included. DTO round-trip and RFC 9457/OpenAPI regressions pass. |
| 32. JSON Schema | Regenerated through `pnpm generate:schema`; inspected diff adds required Furniture contract and v4 version, without a catalog inventory. Generation tests pass. |
| 33. Lint | `pnpm lint` passed. |
| 34. Tests | `pnpm test --concurrency=1` passed with DATABASE_URL loaded and Turbo loose environment propagation: 993 package tests across 103 files, plus 16 repository tooling tests (1,009 total). No skips. The default concurrent run was also attempted and hit existing transaction limits as described below. |
| 35. Build | `pnpm build` passed across all packages. Vite reports a large-chunk warning. |
| 36. Whitespace | `git diff --check` passed. |
| 37. Git status | Included below; all changes remain unstaged. |

## Architectural confirmation

Furniture is canonical Project data. Every persisted item belongs to exactly one Room. Direct Furniture Level ownership and persisted Y/elevation are absent; Level and vertical placement are derived through Room. Furniture cannot survive Room/Project deletion as an orphan. Vertically stacked items may share X/Z. Catalog identity is independent of instance identity; persisted effective dimensions remain stable as defaults evolve. Definitions stay outside every Project, and unknown definition IDs remain compatible. All persistence is normalized and uses the complete Project boundary.

No retailer/brand-specific Furniture, user furnishings, toolbar/UI, SVG, 3D rendering/assets, collision, snapping, or AI-specific fields were added. No timeout was increased, no test was skipped as a workaround, and Jenkins and Playwright were not run. No Git stage, commit, push, rebase, or amend operation was performed.

The initial full checks exposed missing fixture fields and Swagger primitive metadata; these were fixed. A concurrent database-enabled test/build run hit existing five-second transaction limits, including an unchanged Room-boundary test. The final validation runs packages sequentially after build completion with the same timeouts and the database environment loaded. The Furniture DB fixture uses only generic Rooms/items.

## Changed files and final git status

`git status --short --untracked-files=all` expands every new path, providing the exact changed-file inventory:

```text
 M apps/api/prisma/schema.prisma
 M apps/api/src/projects/api/project-api.mapper.test.ts
 M apps/api/src/projects/api/project-api.mapper.ts
 M apps/api/src/projects/api/project-write.integration.test.ts
 M apps/api/src/projects/api/project.dto.ts
 M apps/api/src/projects/geometry-api/geometry-snapshot-api.mapper.test.ts
 M apps/api/src/projects/geometry-api/get-project-geometry.service.test.ts
 M apps/api/src/projects/persistence/project-aggregate.mapper.ts
 M apps/api/src/projects/persistence/project-persistence-aggregate.ts
 M apps/api/src/projects/persistence/project-persistence-writer.ts
 M apps/api/src/projects/persistence/project-persistence.test.ts
 M apps/web/src/features/editor-2d/state/project-editor-slice.test.ts
 M apps/web/src/features/editor-2d/tools/opening/project-opening-editing.test.ts
 M apps/web/src/features/editor-2d/tools/stair/project-stair-authoring.test.ts
 M apps/web/src/features/geometry-playground/geometry-playground-fixture.ts
 M apps/web/src/features/projects/workspace/inspector/ProjectOpeningSelectionDetails.test.tsx
 M docs/11-domain-model.md
 M docs/12-spatial-coordinate-system.md
 M docs/13-project-schema.md
 M docs/geometry/geometry-runtime-model.md
 M packages/geometry/src/elevated-room-geometry.test.ts
 M packages/geometry/src/geometry-engine.test.ts
 M packages/geometry/src/topology-editing-integration.test.ts
 M packages/schema/README.md
 M packages/schema/examples/project.json
 M packages/schema/json-schema/project.schema.json
 M packages/schema/src/index.test.ts
 M packages/schema/src/index.ts
 M packages/schema/src/json-schema-export.test.ts
 M packages/schema/src/migrations/index.ts
 M packages/schema/src/migrations/migrate-project.test.ts
 M packages/schema/src/migrations/migrate-project.ts
 M packages/schema/src/migrations/v1-to-v2.test.ts
 M packages/schema/src/migrations/v2-to-v3.test.ts
 M packages/schema/src/migrations/v2-to-v3.ts
 M packages/schema/src/physical-building/architectural-editing.test.ts
 M packages/schema/src/physical-building/architectural-editing.ts
 M packages/schema/src/physical-building/building.test.ts
 M packages/schema/src/physical-building/building.ts
 M packages/schema/src/physical-building/opening-editing.test.ts
 M packages/schema/src/physical-building/reverse-wall-direction.test.ts
 M packages/schema/src/physical-building/room-shape-authoring.test.ts
 M packages/schema/src/physical-building/staircase-editing.test.ts
 M packages/schema/src/physical-building/wall-editing.test.ts
 M packages/schema/src/physical-building/wall-topology-editing.test.ts
 M packages/schema/src/project/create-initial-project.ts
 M packages/schema/src/project/project-example.test.ts
 M packages/schema/src/project/project.test.ts
 M packages/schema/src/project/schema-version.ts
 M packages/schema/src/validation/cross-reference.test.ts
 M packages/schema/src/validation/cross-reference.ts
 M packages/schema/src/validation/geometry.test.ts
 M packages/schema/src/validation/identifier-uniqueness.ts
 M packages/schema/src/validation/reference-consistency.test.ts
 M packages/schema/src/validation/renderability.test.ts
 M packages/schema/src/validation/validation-error-code.ts
?? apps/api/prisma/migrations/20260906120000_add_room_furniture/migration.sql
?? docs/furniture-domain.md
?? docs/reviews/furniture-foundation-report.md
?? packages/schema/src/furniture/builtin-catalog.ts
?? packages/schema/src/furniture/furniture-editing.ts
?? packages/schema/src/furniture/furniture.test.ts
?? packages/schema/src/furniture/furniture.ts
?? packages/schema/src/furniture/index.ts
?? packages/schema/src/migrations/v3-to-v4.test.ts
?? packages/schema/src/migrations/v3-to-v4.ts
```

