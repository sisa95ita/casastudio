# AI-D1 — Canonical Furniture Editing

> Owner acceptance follow-up: the first real provider attempt failed. See [offline provider diagnosis and schema fix](ai-d1-provider-failure-diagnosis.md) before retrying. The results below describe the original deterministic milestone validation.

AI-D1 is one milestone. It introduces an ephemeral natural-language command workflow over the existing Furniture editor. It adds no database models, migrations, architecture operations, assets, image application, layout optimizer, provider settings, or second history stack.

The provider interprets intent; CasaStudio validates the typed commands. Request, clarification, unsupported result, failure, review and Cancel never change ProjectSchema. Apply makes one normal editor history commit. Save remains the existing revision-checked Project replacement operation.

## Implementation report

| #   | Requested topic                    | Implementation / evidence                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Existing architecture reused       | `createFurniture`, `createFurnitureItemFromDefinition`, `moveFurniture`, `rotateFurniture`, `updateFurniture`, `resolveFurnitureRoom`; `editingDraftReplaced`; complete-Project history, base snapshot, dirty tracking, ordinary save; both existing renderers.                                                                                                                                                           |
| 2   | Provider-neutral contract          | `FurnitureEditRequest`, `FurnitureEditResult`, `FurnitureEditResponse`, `FurnitureEditProvider` in `@casastudio/ai`. Strict runtime schemas, discriminated results, no provider structures in editor/domain code.                                                                                                                                                                                                         |
| 3   | Supported operations               | `MOVE_FURNITURE`, `ROTATE_FURNITURE`, `ADD_FURNITURE`, `TRANSFER_FURNITURE`; 1–8 typed canonical commands, defined in `@casastudio/schema`.                                                                                                                                                                                                                                                                               |
| 4   | Ambiguity / clarification          | `CLARIFICATION_REQUIRED` with a concise message; the structured interpretation instructions require clarification for ambiguous identity/destination/catalog choice, missing destination, or missing “here” anchor. No production keyword parser.                                                                                                                                                                         |
| 5   | Furniture / Room target resolution | Server verifies selection, active Room and active Level against the authorized persisted Project. Source Furniture is limited to selected/active/anchor Rooms. Explicit selection constrains existing-item operations. Only supplied destination Rooms and catalog IDs are accepted.                                                                                                                                      |
| 6   | “Here”                             | “Set here on 2D plan” reuses `SvgViewportPointer.worldPoint` and the established SVG/world transform. Picking is transient and intercepts editor gestures. The anchor is Project X/Z centimeters with explicit Room ownership and active-Level context. Overlapping Rooms require an eligible Room choice. The server checks containment; ADD must honor an explicit anchor exactly. The anchor can then be used from 3D. |
| 7   | Persisted / unsaved invariant      | Requests use an exact `baseRevision`. Dirty drafts and unfinished gestures block Request and Apply with clear UI messages. The server accepts selectors, instructions and an anchor, never client Project geometry.                                                                                                                                                                                                       |
| 8   | Provider context                   | Project ID/revision; active Level; active Room; selected and relevant Room-local Furniture IDs, definitions/categories, dimensions, position and degrees; Room names/types, floor elevations, exact boundary vertices and direct Room connections; canonical catalog; optional anchor. Bounded to 8 selections, 16 destination Rooms, 100 relevant items and 1024 boundary segments.                                      |
| 9   | Deterministic validation           | Strict output schema → context/selection/catalog authority checks → pure `applyFurnitureCommands` simulation → existing canonical helper/schema/reference/geometry validation → shared placement policy for each operation. Invalid batches reject atomically.                                                                                                                                                            |
| 10  | Catalog authority                  | ADD accepts only an existing built-in catalog definition ID. CasaStudio supplies dimensions/defaults. Provider dimensions, asset URLs, new IDs, GLBs and unknown fields are rejected.                                                                                                                                                                                                                                     |
| 11  | Move                               | Exact footprint-center X/Z in Project centimeters. Retains Room and rotation; changing ownership requires Transfer. Room containment and existing collision policy apply.                                                                                                                                                                                                                                                 |
| 12  | Rotate                             | Sets exact finite degrees about positive Y. Relative intent is resolved to an absolute value by interpretation. Existing canonical rotation deliberately permits arbitrary finite degrees without normalization; 450 and −90 remain canonical, with no position drift.                                                                                                                                                    |
| 13  | Add                                | Uses catalog factory defaults. Allocates `furniture-${crypto.randomUUID().toLowerCase()}` only during Apply, matching manual editing. Review/validation IDs are detached and never persisted. Undo removes the instance; Redo restores the same allocated ID.                                                                                                                                                             |
| 14  | Transfer                           | Atomically updates `roomId`, X/Z and optional rotation using the existing mutation helper. Omitted rotation preserves the original. No Furniture LevelId/Y/elevation fields. Elevation derives from the target Room. AI-D1 follows the manual active-Level Room-candidate scope; cross-Level AI transfer is rejected.                                                                                                     |
| 15  | Preview                            | Structured textual review identifies operation, Furniture, current and proposed position/rotation/Room, and added definition/catalog dimensions. A detached simulation validates the review. No canonical or history changes; no new ghost-rendering architecture.                                                                                                                                                        |
| 16  | Explicit Apply                     | Only “Apply changes” commits. Apply reads the latest persisted revision, rechecks the current editor snapshot, revalidates the typed commands and dispatches the ordinary draft-replacement action. No additional AI call.                                                                                                                                                                                                |
| 17  | Undo / Redo                        | One complete-Project history entry per batch, normal dirty state, existing Undo/Redo/Save and 2D/3D derivations. Undo/Redo retains the manual editor’s normal selection-reset behavior.                                                                                                                                                                                                                                   |
| 18  | Stale proposals                    | Exact local snapshot and base revision must still match. Apply performs an authenticated Project read and checks persisted revision again after the asynchronous read. The existing optimistic Save conflict check remains authoritative if another save occurs later.                                                                                                                                                    |
| 19  | Authorization                      | JWT guard, Project ID pipe and `AuthorizedProjectLoader` reuse owner/admin policy. Provider calls occur only after authorization and request-context validation. Foreign provider IDs fail deterministic validation. The endpoint never writes a Project.                                                                                                                                                                 |
| 20  | Architecture requests              | Structured provider instructions require `UNSUPPORTED_REQUEST` for architecture or mixed architecture/Furniture requests, whole-room redesign and unavailable types. Architecture command discriminants are structurally rejected. No approximation as Furniture.                                                                                                                                                         |
| 21  | UI integration                     | “AI Furniture editing” accordion in the existing edit-mode Inspector for both 2D and 3D, visibly described as editing the actual Project. Existing image Designer remains separate. Supports instructions, context, anchor, clarification, unsupported/failure, review, Apply and Cancel.                                                                                                                                 |
| 22  | Files changed                      | See the complete file inventory below.                                                                                                                                                                                                                                                                                                                                                                                    |
| 23  | Automated tests                    | Contract/validation tests; mocked Structured Outputs adapter and no-retry factory tests; authenticated HTTP authorization and untrusted IDs; PostgreSQL/JWT ownership/revision test; API client response checks; React review/Apply/history/Cancel/failure/dirty/stale/late-response/anchor tests.                                                                                                                        |
| 24  | Database / API validation          | Dedicated `casastudio_ai_d1_validation` database with only the repository’s existing migrations. API suite run serially to avoid pre-existing global row-count assertions interfering across test files. No migration added. Final results recorded below.                                                                                                                                                                |
| 25  | Playwright                         | Two focused Chromium workflows with real local auth/API/PostgreSQL and a deterministic fixture provider: Rotate and Add-at-anchor. They verify no change before Apply, Cancel, normal history, provider-call count, 2D/3D state, Save/revision and reload.                                                                                                                                                                |
| 26  | Full checks                        | `pnpm lint`, `pnpm test`, `pnpm build`, Prisma validation and `git diff --check`; final results below.                                                                                                                                                                                                                                                                                                                    |
| 27  | Live provider calls                | **ZERO live provider calls. ZERO API credits consumed.** Tests use mocks/fixtures. The isolated validation launcher strips `OPENAI_API_KEY` and `AI_PROVIDER`, uses `NODE_ENV=test` (no environment-file reload), injects the Furniture fixture provider and disables image generation.                                                                                                                                   |
| 28  | Limitations                        | Textual review; 2D-only anchor picking; active-Level destinations; bounded context; no clarification conversation persistence. Refine the instruction and request again. Real model language understanding and spatial intent still require separately authorized owner acceptance.                                                                                                                                       |
| 29  | Owner acceptance                   | Exact zero-cost replay and future manual checks below.                                                                                                                                                                                                                                                                                                                                                                    |
| 30  | Recommendation / primary answer    | Final validation and recommendation below.                                                                                                                                                                                                                                                                                                                                                                                |

## Architecture details

Placement policy was already stricter than basic Project parsing: Room-center containment, oriented footprint overlap against physical Wall bodies (including opening intervals and junctions), and same-floor Furniture overlap are blocking. Stair overlap is a warning. Full-footprint containment inside a Room is not a separate rule. These exact existing calculations were moved to `@casastudio/geometry`; manual authoring now imports/re-exports them. Stair plan derivation and footprint primitives moved with them, preserving their web import paths. Existing manual 2D/3D tests remain regression coverage for that extraction.

The reusable command executor is provider-agnostic and UI-independent. It applies existing canonical mutations to detached values, validates each resulting placement, and returns the final Project only if the complete batch succeeds. The editor performs the history transaction. No React code edits raw Furniture JSON.

The OpenAI adapter makes one Responses text request with strict JSON Schema Structured Outputs, `store:false`, a bounded output budget and no image tool. It maps the adapter’s nullable optional transfer rotation to omission. The SDK factory sets `maxRetries:0`; failures have the existing sanitized AI Problem Details codes. There is no automatic retry, fallback provider, or call at Apply.

Mocked interpretation tests prove the transport/contract/control flow for relative rotation, absolute rotation, clarification and unsupported requests. They do not claim to prove a real model’s interpretation quality. Deterministic validation proves supplied operations obey canonical authority and placement rules.

## Validation results

Validation completed on 17 October 2026, with zero live provider calls.

| Check                                                                                            | Result                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                                                                      | PASS — all 6 packages.                                                                                                                                                                                                                        |
| `pnpm test`                                                                                      | PASS — all 11 Turbo tasks; tools 16, schema 460, geometry 62, AI 53, shared 1, API 206, web 836 tests passed. The standard run skips 59 database-dependent API tests; the separate database run below executes them.                          |
| `pnpm build`                                                                                     | PASS — all 7 tasks, including API, web and Prisma client generation. Vite reports its existing large-chunk advisory.                                                                                                                          |
| `node tools/ai-d1-validation.mjs db:validate`                                                    | PASS — Prisma schema valid.                                                                                                                                                                                                                   |
| `node tools/ai-d1-validation.mjs --filter @casastudio/api exec vitest run --no-file-parallelism` | PASS — 23 files, 265 tests, including real PostgreSQL ownership/revision checks for AI-D1. Serial execution avoids interference from existing global row-count assertions across test files.                                                  |
| `pnpm test:e2e:ai-d1`                                                                            | PASS — 2 Chromium workflows: Rotate and Add-at-anchor, real local authentication/API/PostgreSQL, injected fixture provider. Review, Cancel, Apply, Undo/Redo, 2D/3D, catalog dimensions, no provider call at Apply, Save and reload verified. |
| `git diff --check`                                                                               | PASS.                                                                                                                                                                                                                                         |
| Persistence / Git                                                                                | No new migrations; 42 changed/new files; all changes remain unstaged. No add, commit, push, rebase or amend performed.                                                                                                                        |

**Primary answer: YES.** A natural-language instruction can now produce a typed, validated, previewed Furniture edit; only explicit Apply changes the canonical draft, using the same history/dirty/Undo/Redo/Save path as manual editing. Deterministic fixtures prove the complete workflow. Real-provider interpretation quality remains for separately authorized owner acceptance.

**AI-D1 recommendation: READY FOR OWNER ACCEPTANCE.** There are no implementation-validation blockers. No live acceptance was attempted and no provider credits were consumed.

## Exact owner acceptance procedure

Zero-cost visual replay:

1. Ensure the repository’s local PostgreSQL and Keycloak are running: `pnpm e2e:infra:up`.
2. Build the workspace: `pnpm build`.
3. Prepare only the isolated validation database with existing migrations: `node tools/ai-d1-validation.mjs --prepare`.
4. Run `pnpm test:e2e:ai-d1 --headed`. For step-by-step inspection, use `pnpm test:e2e:ai-d1 --debug` instead. The existing local demo credentials are read from the repository environment and are never printed by this harness.
5. Observe the synthetic Project’s selected Furniture and “AI Furniture editing” panel. The Rotate workflow submits an instruction, reviews a typed rotation, verifies the unchanged draft, cancels, requests again and explicitly applies. It checks Undo, Redo, 2D/3D, Save and reload.
6. Observe the Add workflow set “here” by a real plan click, send the canonical anchor, review an existing catalog definition, Apply, Undo/Redo, inspect 3D, Save and reload. Both test Projects are removed after the tests. Review screenshots are saved in `test-results/ai-d1/`.
7. For zero-cost regression evidence, run `node tools/ai-d1-validation.mjs --filter @casastudio/api exec vitest run --no-file-parallelism` and `pnpm --filter @casastudio/web exec vitest run src/features/editor-2d/tools/furniture/AiFurnitureEditPanel.test.tsx`.

The replay uses deterministic responses; changing its natural-language text does not turn the fixture provider into a real interpreter.

Future manual acceptance with a real provider requires separate owner authorization and is not performed by this implementation task. Once authorized, use a saved synthetic Project with several catalog Furniture items and two generically named Rooms on one Level:

1. Enter Edit mode, select exactly one Furniture item, open “AI Furniture editing”, submit `Ruota questo mobile di 90 gradi.` Check review shows current rotation +90 and unchanged X/Z. Verify nothing changes before Apply. Apply, Undo, reselect, Redo, reselect, inspect both views, Save, reload.
2. Set an empty valid “here” anchor in the 2D plan. Select a Chair and submit `Sposta questa sedia qui.` Review the exact Room/X/Z, then Apply; Undo and Redo normally.
3. Set an empty valid anchor with enough space and submit `Aggiungi un letto singolo qui.` Check the existing single-bed definition and catalog dimensions. Plain `Aggiungi un letto qui.` may correctly request clarification between single and double beds. Apply only after review.
4. Select an item and submit `Porta questo mobile nella camera accanto.` If there is more than one plausible destination, expect clarification. Resubmit with an explicit generic Room name and destination coordinates/anchor if needed. Check target Room, X/Z and preserved rotation, Apply, then Undo; verify ownership and original placement return.
5. With several Chairs and none selected, ask to move “the chair”; expect clarification and no edit. Ask to move “here” with no anchor; expect clarification. Ask `Aggiungi una porta tra queste stanze.`; expect an unsupported architectural-edit message and no Furniture command.
6. Make an unsaved manual edit; Request must be disabled with “Save your Project…” guidance. Save and request a proposal, then make another manual edit; Apply must be disabled as stale. For a remote revision test, save a different change from another tab before Apply; Apply must reject the stale revision without changing the local draft.
7. Cancel a review and test a provider technical failure; verify Project contents/history stay unchanged. In browser network inspection, each Request produces one Furniture proposal POST; Apply produces an authenticated Project GET and no AI POST. Only the normal Save PUT persists canonical changes.

## File inventory

- `apps/api/src/ai/ai.module.test.ts`
- `apps/api/src/ai/ai.module.ts`
- `apps/api/src/ai/api/furniture-edits.controller.test.ts`
- `apps/api/src/ai/api/furniture-edits.controller.ts`
- `apps/api/src/ai/application/propose-furniture-edit.service.ts`
- `apps/api/src/ai/furniture-edit-provider.token.ts`
- `apps/api/src/ai/openai/openai-furniture-edit.provider.test.ts`
- `apps/api/src/ai/openai/openai-furniture-edit.provider.ts`
- `apps/api/src/ai/openai/openai-interior-design.provider.ts`
- `apps/api/src/ai/test/furniture-edit-fixture.ts`
- `apps/api/src/projects/api/project-write.integration.test.ts`
- `apps/web/src/core/api/CasaStudioApiClient.test.ts`
- `apps/web/src/core/api/CasaStudioApiClient.ts`
- `apps/web/src/features/editor-2d/tools/furniture/AiFurnitureEditPanel.test.tsx`
- `apps/web/src/features/editor-2d/tools/furniture/AiFurnitureEditPanel.tsx`
- `apps/web/src/features/editor-2d/tools/furniture/project-furniture-authoring.ts`
- `apps/web/src/features/geometry-2d/presentation/plan-footprints-2d.ts`
- `apps/web/src/features/geometry-2d/viewer/GeometrySvgViewer.tsx`
- `apps/web/src/features/geometry-2d/viewer/GeometryViewerPanel.tsx`
- `apps/web/src/features/projects/workspace/ProjectWorkspacePage.tsx`
- `apps/web/src/features/stair/model/stair-plan-geometry.ts`
- `docs/ai-d1-canonical-furniture-editing.md`
- `e2e/ai-d1-workflow.spec.ts`
- `package.json`
- `packages/ai/package.json`
- `packages/ai/src/furniture-edit.test.ts`
- `packages/ai/src/furniture-edit.ts`
- `packages/ai/src/index.ts`
- `packages/ai/src/test/furniture-edit-fixture.ts`
- `packages/geometry/src/furniture-commands.ts`
- `packages/geometry/src/furniture-placement.ts`
- `packages/geometry/src/index.ts`
- `packages/geometry/src/plan-footprints.ts`
- `packages/geometry/src/stair-plan-geometry.ts`
- `packages/schema/src/furniture/furniture-commands.ts`
- `packages/schema/src/furniture/index.ts`
- `playwright.ai-d1.config.ts`
- `playwright.config.ts`
- `pnpm-lock.yaml`
- `tools/ai-d1-environment.mjs`
- `tools/ai-d1-server.mjs`
- `tools/ai-d1-validation.mjs`
