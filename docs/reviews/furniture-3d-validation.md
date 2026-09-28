# Furniture asset implementation and validation

## Audit and implementation

| Requested area | Result |
| --- | --- |
| 1. Initial audit | Clean `feature/3d-mvp-completion` checkout; no AGENTS.md found. Inspected 3D scene/model/interaction/Inspector, 2D Furniture authoring/symbols, schema/geometry, API Furniture mappers and persistence, workspace/Vite/dependencies and asset locations. No existing GLB/GLTF resources or public asset directory. |
| 2. Canonical catalog | Eight definitions in `packages/schema/src/furniture/builtin-catalog.ts`; see table below. Existing `FurnitureItem` supplies centered position, arbitrary degrees, effective dimensions and mandatory Room. `resolveFurnitureRoom` supplies Room/Level/global floor. |
| 3–4. Acquisition/license | External local-asset path: seven unchanged Kenney Furniture Kit GLBs, verified CC0. Original license, source URL and archive hash preserved/documented. No questionable or commercial models. |
| 5–7. Registry/resources | One presentation registry keyed by actual definition IDs, explicit native min/max, yaw and deformation policies. Generic deliberately maps to fallback; unknown IDs resolve safely. Vite static local URLs include every GLB in production output. No duplicate names/categories/default dimensions. |
| 8–11. Loading/cache/fallback | Existing Drei 10.7.8 `useGLTF` / R3F 9.7.0 `useLoader` cache audited in installed source. One cached parse per URL; static hierarchy clones share geometry/materials. Suspense and per-item boundary retain exact-size fallback while pending/rejected. No custom parser/cache or per-frame fetches. |
| 12–13. Normalization/bounds | Explicit native precise bounds audited with Three 0.185.1 GLTFLoader; native yaw → center/ground translation → independent physical-axis scaling. Tests load all shipped GLBs and measure their final real vertices. No runtime Box3 traversals. |
| 14–17. Derived model/dimensions/policy | Renderer-neutral Furniture model joins the architectural Level model before JSX. Effective instance dimensions govern bounds/rendering. Relative scale anisotropy limits choose asset versus exact-envelope fallback; no clamping or Project mutation. Bed 2.5, sofa 2, chair 1.6, table/desk 3, cabinet 6; generic fallback. |
| 18–19. Orientation/rotation | All audited assets have back/head toward native -Z, so registry corrections are zero. Offset/quarter-turn normalization is tested synthetically. Canonical right-hand degrees become negative Three yaw after Z reflection; footprint/forward tests cover 0°, 90°, 180°, 37°, negative and multi-turn rotations. |
| 20–21. Floor/elevated Rooms | Canonical Room resolver supplies Level elevation plus local Room elevation. Floor slab thickness is not added. Tests place items at the same X/Z at 0, 270 and 340 cm, preserving independent ownership and elevations. |
| 22–23. Materials/textures | Existing embedded standard PBR materials preserved. No external or embedded textures, hence no texture dimensions/budget. Existing lighting unchanged. |
| 24–26. Styling/selection/Inspector | Transient thin envelope outline leaves shared asset materials untouched. Existing semantic handlers/store resolve any bubbled child-mesh hit to Furniture item ID. Pointer-handler test excludes GLTF node identity and orbit drags. Inspector displays definition/name/category, Room/Level, floor elevation, dimensions and degrees as text only. |
| 27–28. Visibility/bounds | Room-derived Level membership follows existing active/all visibility; hidden selection rules unchanged. Rotated/elevated canonical envelopes expand Level and scene bounds/finite camera Fit. |
| 29–32. Lazy loading/performance/compression | Existing lazy viewer boundary retained. No full-catalog or initial-2D preload. Only mounted visible adaptable definitions request assets. No GPU instancing, per-frame bounds computation or repeated parsing. Shared resources are cache-owned and not disposed by individual instances. Draco/Meshopt disabled; tiny uncompressed resources do not justify decoder overhead. |
| 33. Size | 109,608 bytes total (107.04 KiB), largest 23,368 bytes. Per-file table below. |
| 34. Files | Exact file inventory below. |
| 35–37. Domain/API status | No ProjectSchema, schemaVersion, Prisma migration, API contract or Geometry Snapshot changes. Existing 2D behavior unchanged. No new dependencies/lockfile edits. |
| 38. Tests | Added pure model/registry/transform/elevation/visibility/selection/bounds coverage, actual GLB loader/bounds/sharing tests, rejected-resource boundary test, semantic child-hit test, read-only Inspector case and one focused browser scenario. Existing architecture/2D regressions included in full suite. |
| 39–43. Validation | See validation results below. |
| 44. Manual checklist | All 27 requested checks are in [Furniture asset architecture](../furniture-3d-assets.md#manual-visual-acceptance). Unchecked items are available for product review rather than claimed as manual passes. |
| 45. Limitations | Stylized low-poly furniture, not photoreal product scans. Root scaling deforms internal details within policy; extreme proportions use a neutral volume. Cache lives for the session; failed resources do not automatically retry. Browser acceptance uses the Vite development server; production resource presence/lazy chunk separation are audited separately. |
| 46. Git status | Working-tree status recorded below; no staging, commit, push, rebase or amend performed. |

## Catalog and resources

Canonical dimensions below are an audit of the schema catalog, not a second production catalog.

| Canonical ID | Category | Default W×D×H (cm) | Local GLB | Bytes |
| --- | --- | --- | --- | ---: |
| generic-single-bed | BED | 90×200×50 | bedSingle.glb | 18,636 |
| generic-double-bed | BED | 160×200×50 | bedDouble.glb | 23,368 |
| generic-sofa | SOFA | 200×90×85 | loungeDesignSofa.glb | 9,128 |
| generic-dining-table | TABLE | 160×90×75 | table.glb | 8,196 |
| generic-chair | CHAIR | 45×50×85 | chairCushion.glb | 12,588 |
| generic-cabinet | CABINET | 100×45×180 | bookcaseClosedDoors.glb | 22,644 |
| generic-desk | DESK | 120×60×75 | desk.glb | 15,048 |
| generic-furniture | GENERIC | 100×100×100 | Intentional fallback | 0 |

## Explicit invariants

- FurnitureDefinition remains the semantic source of truth. Asset metadata lives outside ProjectSchema; no asset path is persisted.
- All GLBs are local with documented CC0 provenance; there is no remote runtime asset or texture dependency.
- Canonical effective width/depth/height and arbitrary rotation remain authoritative.
- Furniture Y derives from its Room floor, and no canonical Furniture levelId was added. Lower/elevated items can share X/Z independently.
- Unknown definitions remain renderable. An asset rejection cannot take down the complete scene; semantic selection survives fallback.
- Selection exposes Furniture identity, not GLTF mesh identity. Shared materials are not changed for hover/selection.
- 3D remains read-only: no Furniture direct manipulation or authoring controls were added.
- No ProjectSchema, schemaVersion, Prisma migration, API or Geometry Snapshot change occurred. Existing 2D Furniture semantics were not redesigned.
- No timeout was increased and no test was skipped as a workaround. Jenkins was not run.
- No Git stage/commit/push/rebase/amend operation was performed.

## Validation results

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed, 6 tasks. Final run after the viewer-copy update: 8.359 seconds. |
| Full `pnpm test` | Passed uncached: 11 tasks, 1,228 Vitest tests plus 16 version tests, zero skips. Schema 437, geometry 56, API 116, web 617, AI 1, shared 1. Duration 4m15.743s. |
| Final focused tests | After the viewer help-text update, 157 3D/i18n tests passed across 11 files. |
| `pnpm build` | Passed, 7 tasks. Final run: 35.671 seconds. Existing Vite >500 kB chunk warning remains. |
| `git diff --check` | Passed. |
| Chromium | One focused scenario passed in 16.9 seconds (21.0 seconds including setup). It took three executions: two test-harness defects were corrected before the passing execution. No historical browser suite was run. |

The full test command used the repository's documented serialized local database
validation pattern, with `.env` loaded without printing secrets:

```sh
node --env-file=.env -e 'const result = require("node:child_process").spawnSync("pnpm", ["test", "--env-mode=loose", "--force", "--concurrency=1"], { stdio: "inherit", env: process.env }); process.exit(result.status ?? 1)'
```

Serialization was limited to Turbo tasks, following the existing resource-constraint
report in `docs/reviews/furniture-2d-authoring-report.md`; test assertions/timeouts
were unchanged. API tests ran with database access, including all 116 persistence,
HTTP and service cases. Jenkins configuration is inspected by existing static version
tests; no Jenkins job was run.

Production output contains all seven hashed GLBs totaling exactly 109,608 bytes.
Resource URL strings are in the workspace chunk, while `GLTFLoader` remains in
`Project3DViewer-BzgxrnFG.js` (1,150.92 kB / 311.61 kB gzip), reached through a dynamic
import. Browser evidence confirms zero GLB requests in 2D and exactly seven successful
local GLB downloads after entering 3D, despite three instances of the chair resource.

The scenario saves all eight built-ins plus unknown/custom fallback, repeated chairs,
a desk with edited width/depth/height, 37° rotations, a Room at +270 cm and another at
Level 300 + Room 40 cm. It exercises Fit, actual child-mesh cabinet selection,
read-only semantic Inspector, active/all Level visibility, unchanged resource counts,
return to 2D, and exact before/after persisted Project equality. The disposable
Project is deleted in cleanup. There were no page errors in the passing run.

The first attempt incorrectly used the browser resource-timing buffer to await assets;
its trace showed seven HTTP 200 GLBs and rendered furniture, while that buffer had no
GLB entries. The final assertion tracks successful completed responses instead. The
second attempt selected the cabinet correctly but used a locator matching both
responsive Inspector copies. It now scopes to the desktop Inspector using the same
pattern as existing acceptance tests. Neither fix disables an assertion or changes a
timeout. The viewer description/selection hint was also updated to include Furniture;
subsequent targeted tests, lint and build passed before the final browser execution.

Reviewed screenshots show distinct single/double beds and pillows, rotated sofa,
chairs, tabletop/supports, desk drawers, cabinet/handles and neutral fallback volumes.
Raised chairs rest on their separate slab tops. The blue cabinet outline leaves its
material readable. Fine-detail/catalog-quality approval remains a manual product
judgment; these small assets are intentionally stylized.

Screenshots (local, ignored test artifacts):

- [Catalog view](../../test-results/furniture-3d-local-Furnitu-0b2a7-bility-preserve-the-Project-chromium/furniture-catalog.png)
- [Cabinet selection](../../test-results/furniture-3d-local-Furnitu-0b2a7-bility-preserve-the-Project-chromium/furniture-selection.png)

Logs: `/tmp/casastudio-furniture-lint.log`, `/tmp/casastudio-furniture-test.log`,
`/tmp/casastudio-furniture-final-focused.log`, `/tmp/casastudio-furniture-build.log`,
`/tmp/casastudio-furniture-chromium.log`.

## Exact changed files

- `apps/web/scripts/inspect-furniture-assets.mjs`
- `apps/web/src/core/i18n/locales/en/project-viewer.json`
- `apps/web/src/features/project-3d/FurnitureAsset3D.test.tsx`
- `apps/web/src/features/project-3d/FurnitureAsset3D.tsx`
- `apps/web/src/features/project-3d/Project3DInspector.test.tsx`
- `apps/web/src/features/project-3d/Project3DInspector.tsx`
- `apps/web/src/features/project-3d/Project3DViewer.tsx`
- `apps/web/src/features/project-3d/assets/furniture-asset-registry.ts`
- `apps/web/src/features/project-3d/assets/furniture-assets.test.ts`
- `apps/web/src/features/project-3d/assets/models/Kenney-LICENSE.txt`
- `apps/web/src/features/project-3d/assets/models/bedDouble.glb`
- `apps/web/src/features/project-3d/assets/models/bedSingle.glb`
- `apps/web/src/features/project-3d/assets/models/bookcaseClosedDoors.glb`
- `apps/web/src/features/project-3d/assets/models/chairCushion.glb`
- `apps/web/src/features/project-3d/assets/models/desk.glb`
- `apps/web/src/features/project-3d/assets/models/loungeDesignSofa.glb`
- `apps/web/src/features/project-3d/assets/models/table.glb`
- `apps/web/src/features/project-3d/interaction/architectural-selection-3d.ts`
- `apps/web/src/features/project-3d/interaction/architectural-viewer-interaction-3d.test.ts`
- `apps/web/src/features/project-3d/interaction/architectural-viewer-interaction-3d.ts`
- `apps/web/src/features/project-3d/model/architectural-scene-3d-model.ts`
- `apps/web/src/features/project-3d/model/furniture-3d-model.test.ts`
- `apps/web/src/features/project-3d/model/furniture-3d-model.ts`
- `apps/web/src/test/furniture-3d-fixture.ts`
- `docs/furniture-3d-assets.md`
- `docs/reviews/furniture-3d-validation.md`
- `e2e/furniture-3d.spec.ts`

## Working-tree status

```text
 M apps/web/src/core/i18n/locales/en/project-viewer.json
 M apps/web/src/features/project-3d/Project3DInspector.test.tsx
 M apps/web/src/features/project-3d/Project3DInspector.tsx
 M apps/web/src/features/project-3d/Project3DViewer.tsx
 M apps/web/src/features/project-3d/interaction/architectural-selection-3d.ts
 M apps/web/src/features/project-3d/interaction/architectural-viewer-interaction-3d.test.ts
 M apps/web/src/features/project-3d/interaction/architectural-viewer-interaction-3d.ts
 M apps/web/src/features/project-3d/model/architectural-scene-3d-model.ts
?? apps/web/scripts/
?? apps/web/src/features/project-3d/FurnitureAsset3D.test.tsx
?? apps/web/src/features/project-3d/FurnitureAsset3D.tsx
?? apps/web/src/features/project-3d/assets/
?? apps/web/src/features/project-3d/model/furniture-3d-model.test.ts
?? apps/web/src/features/project-3d/model/furniture-3d-model.ts
?? apps/web/src/test/furniture-3d-fixture.ts
?? docs/furniture-3d-assets.md
?? docs/reviews/furniture-3d-validation.md
?? e2e/furniture-3d.spec.ts
```
