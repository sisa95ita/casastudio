# Furniture 2D authoring — implementation and verification

The 2D editor now supports Room-aware Furniture placement and instance editing using the existing canonical v4 domain and complete-Project persistence. The implementation preserves the toolbar/Properties/canvas interaction grammar. See [the durable interaction contract](../furniture-2d-authoring.md) and [the domain boundary](../furniture-domain.md).

## Audit and implementation report

| # | Requested topic | Result |
|---|---|---|
| 1 | Initial repository audit | The checkout was clean. Inspected schema Furniture items, built-in catalog, creation/resolution/editing operations, v4 Project composition, Room deletion/dissolution, editor tool registry, transient/selection/history reducers, Room/Stair authoring, Inspector priority, SVG hit/pointer/viewport behavior, snapping, shortcuts, API types/client, full-Project save/discard, and existing unit/browser/persistence tests. The existing domain already supplied all required canonical operations and persistence fields. |
| 2 | Furniture tool | Added between Stair and Measure using the existing toolbar control and capability registry. No shortcut assigned: F remains Fit to view; no clear unused mnemonic was selected. |
| 3 | Catalog UI | Inspector-owned Catalog selection; semantic categories accompany display names. No canvas authoring form or new tool popover. |
| 4 | Built-in definitions | Reads all eight canonical `builtinFurnitureDefinitions`; there is no frontend-only catalog. |
| 5 | Placement state | Serializable `FurnitureInteraction` in the existing transient interaction union; `useFurnitureEditor` coordinates proposals and commands. Nothing enters Project/history until confirmation. |
| 6 | Room candidates | Uses the centered X/Z anchor and ordered Wall/free/mixed boundaries on the active plan. Edges count as contained. The full rotated footprint is intentionally not a containment constraint. |
| 7 | Overlapping Rooms | Requires an explicit eligible Room choice for placement. Names include unit-aware global floor elevations. Explicit targeting persists while the Room remains a candidate. |
| 8 | No Room | Visible invalid proposal with concise guidance; placement/movement/reassignment cannot commit an invalid target. Outside-Room moves leave the canonical item unchanged. |
| 9 | Preview | Live centered vector footprint with current instance dimensions and rotation. Invalid proposals have restrained error styling. Preview does not rebuild or modify canonical Furniture. |
| 10 | Placement commit | Revalidates the actual click anchor and Room, then calls canonical create with a stable UUID identity. Exactly one Project snapshot. |
| 11 | After placement | Keeps Furniture active with the same definition and effective parameters. The next pointer movement begins another preview. Escape/Cancel leaves a clean Furniture catalog context. |
| 12 | Presentation architecture | `FurnitureItem → FurniturePresentationModel2D → FurnitureSvgLayer`, using the shared viewport projection. The immutable model owns neutral geometry and semantic identity; selection/hover remain separate. |
| 13 | Symbols | BED has mattress/pillow cues; SOFA has back/arm/cushion cues; TABLE a tabletop; CHAIR a seat/back; CABINET doors/handles; DESK a worktop/storage cue; GENERIC a neutral footprint. All scale from actual instance dimensions and rotate around the center. |
| 14 | Unknown definitions | Generic footprint and safe identity/category fallback; actual dimensions/rotation remain authoritative. Selection, numeric edits, duplication, and deletion work. |
| 15 | Hover | Uses the existing selection/hover state vocabulary and restrained architectural blue styling, without changing geometry. |
| 16 | Selection | Dedicated `FURNITURE` selection kind resolves directly to canonical instance identity. Room deletion removes stale Furniture selection/hover references. |
| 17 | Hit targets | Whole-footprint transparent polygon plus practical stroke; deterministic paint order; hidden symbols have no active hit targets. |
| 18 | Properties | Coherent identity, Room, paired X/Z fields, paired dimensions/rotation, read-only definition/floor elevation, and visible Duplicate/Delete actions. Display rounding does not rewrite unchanged precise values. Context changes reset Inspector scrolling. |
| 19 | Numeric move | Canonical move operation plus Room resolution. Preserves the current Room if eligible, auto-reassigns a unique new candidate, retains ambiguous edits as proposals for explicit choice/confirmation, and rejects outside-Room edits. |
| 20 | Drag move | Preserves pointer-to-anchor offset; starts after five CSS pixels; transient preview; pointer-up commits once. Space-pan retains precedence. |
| 21 | Drag history | Pointer movement adds no snapshots. A completed valid gesture adds one; canceled/invalid movement adds none. |
| 22 | Numeric rotation | Accepts finite arbitrary degrees through the canonical rotate operation, preserving the domain's unnormalized angle convention. |
| 23 | Rotation handle | Single selected-item handle in Edit, centered positive-Y rotation, transient movement and one commit. Exact Properties rotation is the keyboard-accessible alternative. |
| 24 | Numeric resize | Width/depth/height must be finite and positive. Uses canonical resize; width/depth immediately update symbols. No resize handles. |
| 25 | Room reassignment | Candidate-only Room selector; changes derived floor elevation without storing Y or Level ownership. |
| 26 | Duplicate | Detached placement carrying source definition, effective dimensions, rotation, and metadata; new identity and one snapshot only on confirmation. Proposal dimension/rotation edits are preserved. |
| 27 | Delete | Properties action and existing Delete/Backspace shortcut call canonical delete. Only the selected instance is removed. |
| 28 | Undo/redo | Complete snapshots cover create, numeric/drag move, numeric/handle rotation, resize, reassignment, duplicate, and delete. Browser coverage also verifies deletion undo/redo and discard. |
| 29 | Furniture layer | Visible by default. Hiding removes symbols/hits and clears selection. Authoring overlays remain visible independently. |
| 30 | Elevated Room workflow | Generic Living Room at 0 and Elevated Study at +200 cm support Furniture at identical X/Z. Properties reports 0.00 m and 2.00 m through the Room resolver. Exact persisted ownership/dimensions/position/rotation survive reload. |
| 31 | Stacked selection | Stable persisted paint order; last drawn overlapping footprint gets the hit. Richer overlap cycling is deferred to the later presentation work. |
| 32 | API/schema | No API contract, canonical schema, schema-version, endpoint, or Prisma migration changes. Existing full-Project API is used. |
| 33 | Geometry Engine/Snapshot | No Furniture runtime objects or Snapshot changes. A separate frontend presentation derives from canonical Furniture and Room ownership. |
| 34 | Exact files | Listed below. |
| 35 | Tests added/updated | New authoring, controller/Properties, presentation, and authenticated browser coverage; SVG gesture/hover/pan regressions; toolbar expectation updated; generic deterministic fixture added. |
| 36 | Playwright | Furniture workflow passes, including layer visibility, keyboard deletion, undo/redo, discard, save/reload, and elevated overlap. All seven existing editor smoke scenarios also pass. |
| 37 | DB-backed tests | Direct API test run with repository `.env`: 116/116 passed, no skips, including Furniture normalized persistence/FKs/cascades and full-Project round trips. Final full-suite result recorded below. |
| 38 | Lint | `pnpm lint`: passed, six tasks successful. |
| 39 | Tests | Final serialized, uncached, environment-enabled monorepo run: passed, 11 tasks successful, 1,008 Vitest tests plus 16 repository version tests, no skips. |
| 40 | Build | `pnpm build`: passed, seven tasks successful. Vite reports its existing large-chunk warning. |
| 41 | Diff check | `git diff --check`: passed. |
| 42 | Working tree | Recorded below; changes are unstaged and uncommitted. |

## Product audit

Reviewed real Chromium screenshots from the authenticated Furniture scenario after refining the layout. The toolbar feels consistent with existing tools, the catalog stays in Properties, Room/elevation ambiguity is explicit, Sofa/Desk symbols are recognizable, and selection remains legible. Exact editing, rotation, duplicate/delete, and read-only floor/definition values fit together in the desktop Inspector. Dragging preserves the grab offset; a gesture-click suppression regression found by browser testing was fixed and unit-tested. Phone/tablet behavior remains under the existing workspace strategy and its passing browser smoke coverage.

The confirmed workflow includes two items at the same exact X/Z, owned by different vertically overlapping Rooms. Save reloads the authoritative View state as established by the existing workspace. Re-entering Edit starts with the established neutral tool state; selection requires activating Select. Discard restores the authoritative Furniture collection. No UI exposes Furniture Y or a direct Furniture Level field.

## Validation details

Initial sandboxed HTTP tests could not bind local ports; they were rerun outside the sandbox. Turbo's normal environment filtering omitted database environment variables, so the API suite was also run directly with `.env` loaded. An uncached full run with the environment enabled hit existing 5-second PostgreSQL transaction deadlines and 15-second API test deadlines under concurrent load. The final retry passed using `--concurrency=1` to serialize Turbo tasks, with the same tests, assertions, and timeouts. No test or timeout was weakened.

The final full-suite command loaded the repository environment without printing its values:

```sh
node --env-file=.env -e 'const result = require("node:child_process").spawnSync("pnpm", ["test", "--env-mode=loose", "--force", "--concurrency=1"], { stdio: "inherit", env: process.env }); process.exit(result.status ?? 1)'
```

It completed successfully in 3m 5.211s with 11 successful tasks and no cached tasks. All 1,008 Vitest tests passed: schema 429, geometry 56, API 116, web 405, AI 1, and shared 1. All 16 repository version tests also passed. There were no skipped tests in this final run.

- Furniture Playwright workflow: 1 passed in 37.0 seconds total; the test itself completed in 33.3 seconds, under its original 60-second limit.
- Existing editor smoke suite: all 7 scenarios passed, covering authenticated editor actions, CORS deletion, tablet/phone layout, Room shapes, plan presentation, elevated Rooms/Stairs, and precision authoring.
- Focused Furniture/SVG tests: passed; the full final suite includes their latest revisions.
- No Jenkins pipeline was run. Repository version tests inspect Jenkins configuration as static text only.
- Disposable browser Projects were deleted; one Project left by a timed-out test was separately verified by its test identity and removed through the authenticated local API.

## Explicit scope confirmations

Every persisted Furniture item still belongs to exactly one Room. No direct Furniture `levelId` or persisted Furniture Y/elevation was added. New placement, move, duplicate, and Room reassignment cannot commit outside a valid containing Room. Vertically overlapping Rooms and stacked X/Z Furniture are supported.

No 3D Furniture rendering or assets, collision system, Furniture snapping system, multi-selection CAD manipulation, resize handles, Furniture-specific REST resource, AI fields/behavior, ProjectSchema version bump, or Prisma migration was added. No timeout was increased. No test was skipped as a workaround. Jenkins was not run. No Git stage, commit, push, rebase, or amend operation was performed.

## Exact changed files and working tree

- `apps/web/src/core/i18n/locales/en/project-viewer.json`
- `apps/web/src/features/editor-2d/components/EditorToolbar.tsx`
- `apps/web/src/features/editor-2d/components/ProjectLayerControls.tsx`
- `apps/web/src/features/editor-2d/hooks/useEditorKeyboardShortcuts.ts`
- `apps/web/src/features/editor-2d/state/project-editor-slice.ts`
- `apps/web/src/features/editor-2d/state/project-editor-tools.ts`
- `apps/web/src/features/editor-2d/tools/furniture/ProjectFurnitureProperties.tsx`
- `apps/web/src/features/editor-2d/tools/furniture/project-furniture-authoring.test.ts`
- `apps/web/src/features/editor-2d/tools/furniture/project-furniture-authoring.ts`
- `apps/web/src/features/editor-2d/tools/furniture/useFurnitureEditor.test.tsx`
- `apps/web/src/features/editor-2d/tools/furniture/useFurnitureEditor.ts`
- `apps/web/src/features/geometry-2d/presentation/furniture-presentation-model-2d.test.ts`
- `apps/web/src/features/geometry-2d/presentation/furniture-presentation-model-2d.ts`
- `apps/web/src/features/geometry-2d/selection/geometry-selection-state.ts`
- `apps/web/src/features/geometry-2d/viewer/FurnitureSvgLayer.tsx`
- `apps/web/src/features/geometry-2d/viewer/GeometrySvgViewer.test.tsx`
- `apps/web/src/features/geometry-2d/viewer/GeometrySvgViewer.tsx`
- `apps/web/src/features/geometry-2d/viewer/GeometryViewerPanel.tsx`
- `apps/web/src/features/projects/workspace/ProjectWorkspacePage.test.tsx`
- `apps/web/src/features/projects/workspace/ProjectWorkspacePage.tsx`
- `apps/web/src/features/projects/workspace/inspector/ProjectWorkspaceInspector.tsx`
- `apps/web/src/test/furniture-project-fixture.ts`
- `docs/furniture-2d-authoring.md`
- `docs/furniture-domain.md`
- `docs/reviews/furniture-2d-authoring-report.md`
- `e2e/furniture-workflow.spec.ts`

`git status --short`:

```text
 M apps/web/src/core/i18n/locales/en/project-viewer.json
 M apps/web/src/features/editor-2d/components/EditorToolbar.tsx
 M apps/web/src/features/editor-2d/components/ProjectLayerControls.tsx
 M apps/web/src/features/editor-2d/hooks/useEditorKeyboardShortcuts.ts
 M apps/web/src/features/editor-2d/state/project-editor-slice.ts
 M apps/web/src/features/editor-2d/state/project-editor-tools.ts
 M apps/web/src/features/geometry-2d/selection/geometry-selection-state.ts
 M apps/web/src/features/geometry-2d/viewer/GeometrySvgViewer.test.tsx
 M apps/web/src/features/geometry-2d/viewer/GeometrySvgViewer.tsx
 M apps/web/src/features/geometry-2d/viewer/GeometryViewerPanel.tsx
 M apps/web/src/features/projects/workspace/ProjectWorkspacePage.test.tsx
 M apps/web/src/features/projects/workspace/ProjectWorkspacePage.tsx
 M apps/web/src/features/projects/workspace/inspector/ProjectWorkspaceInspector.tsx
 M docs/furniture-domain.md
?? apps/web/src/features/editor-2d/tools/furniture/
?? apps/web/src/features/geometry-2d/presentation/furniture-presentation-model-2d.test.ts
?? apps/web/src/features/geometry-2d/presentation/furniture-presentation-model-2d.ts
?? apps/web/src/features/geometry-2d/viewer/FurnitureSvgLayer.tsx
?? apps/web/src/test/furniture-project-fixture.ts
?? docs/furniture-2d-authoring.md
?? docs/reviews/furniture-2d-authoring-report.md
?? e2e/furniture-workflow.spec.ts
```
