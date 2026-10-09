# AI-B5 — Complete Interior Designer workflow validation

Validation date: 2026-10-09. Scope: AI-B closure; no AI-C work or version bump.

## Closure decision

**READY TO CLOSE.** The integrated lifecycle is coherent across Room targeting,
references, generation, Proposal identity, persistence, reload, scoped history
and deletion. Required automated validation passes with no known AI-B blocking
regression. One nested-dialog accessibility defect was fixed and covered by
browser/component regressions. AI-A and AI-B1/B2/B3/B4/B4.1/B5 are complete;
**AI-B — Generative Interior Design Image ✅**. The owner final manual procedure
below remains the owners' responsibility.
No live provider call, OpenAI network request, or API-credit consumption is
authorized or performed. Automated checks establish behavior and data integrity;
they do not establish photorealism, reference composition, visual UX quality, or
generated architectural fidelity. Final visual acceptance belongs to the owners.

## Implemented architecture and boundaries

The existing architecture documentation remains authoritative:
[AI integration](../05-ai-integration.md), [durable proposals](durable-design-proposals.md),
and [Design Studio workspace](design-studio-workspace.md). No additional diagram
implementation was introduced.

The real path traced before validation changes is:

1. `ProjectWorkspacePage` derives the immutable architectural scene from canonical
   Project data and owns selection, Level visibility, and `useDesignGeneration`.
   Active Level mounts only that Level's interactive geometry; inactive geometry
   cannot intercept pointer events. All Levels intentionally permits selections
   across the visible building.
2. `Project3DInspector` resolves the canonical selection and exposes Properties and
   Designer tabs. A selected Room mounts `AiRoomDesignPanel`; deselection has an
   intentional empty state. Hiding Designer preserves the panel and references.
3. `createRoomReferencePlans3D` derives axonometric/Interior A/Interior B cameras from
   the Room contour and triangulated floor. `Project3DViewer` captures three 960×720
   JPEGs offscreen, applying reference-specific visibility and restoring renderer
   state. OrbitControls is independent. The renderer crosses into AI contracts
   only through plain camera/target metadata and transient image data URLs.
4. One explicit Generate/Try another invokes `CasaStudioApiClient.generateRoomDesign`
   once. The workspace's synchronous lock survives panel mode changes and Room
   deselection. Context and capture epochs suppress obsolete completions.
5. `DesignProposalsController` applies the JWT guard, DTO validation and Project ID
   validation. `GenerateDesignProposalService` uses `AuthorizedProjectLoader` to
   reload and authorize the Project; client-provided geometry/context is not trusted.
6. `@casastudio/ai.deriveDesignContext` derives one Room's boundary, Walls, Openings,
   elevations, Furniture, Stairs and direct local spatial context. Canonical passage
   topology belongs to `@casastudio/schema`, not the renderer or provider adapter.
7. Provider-neutral `InteriorDesignService` validates references and creates the
   stable Proposal identity. The OpenAI adapter is the SDK boundary: one Responses
   image edit, Interior A first/base, axonometric and Interior B supporting, distinct
   architectural/target/local/user sections, one tool call, no parallel calls,
   zero SDK retries, and no model/action/quality fallback. Its tests mock the SDK
   request boundary; the milestone browser uses a fake provider instead.
8. `PersistDesignProposalService` validates output, writes bytes through
   `DesignArtifactStore`, fingerprints canonical context/references, and creates
   metadata through `PrismaDesignProposalsRepository`. It compensates a failed
   metadata write by best-effort artifact deletion. The response contains an
   application artifact route and the same Proposal ID, never filesystem paths
   or base64 metadata. No Project write/revision advance is involved.
9. The panel reconciles that identity with bounded session comparisons and
   `useRoomDesignHistory`. `ProposalReview` owns focused inspection;
   `ProposalArtifactView` owns artifact presentation. History fetches one bounded
   metadata page; `useDesignArtifact` fetches only the selected image using auth,
   creates a Blob URL, aborts obsolete reads, and revokes URLs on replacement/unmount.
10. List/fetch/delete use `DesignProposalHistoryService` and the owning Project's
    authorization. Delete revokes metadata before best-effort byte cleanup;
    session/history selection reconciles the same ID. Project deletion cascades
    metadata and attempts artifact cleanup. Proposal records are independent of
    Room geometric replacement and retain their original revision provenance.

`ProjectSchema` remains geometric truth. The schema/domain packages contain no
provider SDK or artifact storage. Renderer models are derived and transient.
The AI package contains neutral context/contracts/orchestration. Nest owns auth,
provider construction, storage and persistence. Frontend state/object URLs own
only session presentation. Proposal bytes and metadata never enter ProjectSchema.

## Milestone invariants and evidence

| Invariant | Automated evidence |
| --- | --- |
| No canonical mutation or Proposal-induced revision increment | Browser compares full authoritative Project responses after every generation and deletion; API/database suites compare persisted root fields and revision. Only an explicit canonical save advances N to N+1. |
| One canonical Room target; Level and async isolation | Browser selects vertically overlapping synthetic Rooms in Active Level mode, switches Rooms/Levels and checks scoped history. Focused tests cover Room changes during capture/generation, direction edits, mode switches, deselection/reselection, stale success/failure, and lock release only on settlement. |
| Exactly three deterministic automatic references | Browser inspects three reference images and verifies provider-facing kinds, target and 960×720 dimensions. Camera metadata is identical across explicit requests surrounding an OrbitControls change. Refresh performs zero provider requests and clears comparisons. |
| Generic architecture represented without unrelated geometry | Reference camera/relevance/visibility tests cover rotated, elevated concave L/U/T/free contours, both interior eyes inside the footprint, non-boundary/thickness-overlap Walls, hosted Openings, connected Stairs and Room Furniture, same-Level isolation and renderer restoration. |
| One action produces at most one intended provider request | Browser dispatches duplicate click events in the same task; one API request and fake-provider call occur per explicit action. Pending progress is indeterminate, names the original Room, and disables repeat submission. No navigation, inspection, refresh, delete or reload generates. |
| Edit/base/supporting roles and budget policy preserved | Mocked adapter tests assert Interior A first/base, edit action, all references, distinct architectural/user/local context, `max_tool_calls=1`, `parallel_tool_calls=false`, no fallback/retry; factory tests assert `maxRetries=0`. |
| One successful identity across session and persistence | Browser checks response ID against the active artifact and newest durable history ID; diagnostics check one filesystem write and one DB row per success. Four explicit successes retain at most three session entries; evicted proposals remain saved. |
| Reload/revisit/history preserve provenance | Browser reload drops comparisons and retains saved metadata/image access; a revision N proposal remains saved at N+1 and Review marks it historical. History is newest first and scoped by Project/Level/Room. |
| Deletion revokes access and reconciles state | Browser confirms/cancels deletion, deletes an entry still in comparison, verifies session reconciliation and authorized artifact 404, then deletes a historical entry and reloads without resurrection. Project fields/revision remain unchanged. |
| Artifact security | Signed-JWT API tests exercise real auth and PostgreSQL for own/other/no credentials, cross-Project Proposal IDs, list/fetch/generate/delete and revoked access. Storage tests reject traversal/unsupported keys, malformed/oversized/corrupted images, symlinks and modified bytes. Binary delivery checks Content-Type/private caching/nosniff. No raw path/base64 metadata reaches the browser. |
| Storage/database consistency | Disk failure creates no metadata; DB failure after a successful write compensates bytes; neither regenerates. Existing history remains accessible through normalized provider failures. Existing integration tests cover Project deletion during pending generation, cascade cleanup and geometric/Room replacement. |
| Adjacency is canonical and supporting only | Retained schema/AI/adapter tests cover direct Door/Wall Opening, exclude Window/nearby unrelated/other-Level overlap, omit ambiguous/non-manifold relations, avoid recursive traversal and internal IDs in provider prose. FREE-boundary contact intentionally creates no inferred passage. |
| Normalized and ambiguous error UX | API matrix covers configuration/auth/model/rate/unavailable/generation/invalid-output/timeout; focused UI tests cover allowance exhaustion, connection loss, missing references, invalid target and persistence failure. Timeout/network wording says a paid generation may have completed, never that no generation/charge occurred. Prior successes remain inspectable after failed alternatives. |
| Inspector/UI/accessibility boundaries | Browser and component tests exercise Properties/Designer selected states and keyboard navigation, textbox input, named Generate/Try another, live indeterminate announcements, pressed Proposal selectors, reference preview Escape/focus restoration, Review focus containment/restoration, history keyboard controls, confirmation and Alert semantics, editor shortcut isolation. References/history/telemetry remain secondary; Designer is not a viewport overlay. |
| Memory/performance sanity | Capture is effect/context driven, not frame driven; mode switching preserves scene/reference identity. History is metadata-only; selected artifact reads share one URL across surfaces and revoke obsolete URLs. Session comparisons remain bounded to three. No benchmarking or subjective pixel snapshots were added. |

## Zero-cost test strategy and reproducibility

`playwright.ai-b5.config.ts` runs one complete Chromium journey against a separate
API at `127.0.0.1:3105` and Vite at `localhost:8081` (an existing allowed Keycloak
redirect origin). Server reuse and test retries are disabled. The default browser
configuration excludes this test, so it cannot accidentally target a configured
paid development provider.

`tools/ai-b5-server.mjs` uses the normal compiled Nest AppModule, config/bootstrap,
real Keycloak JWT validation, application services and Prisma repositories.
`@nestjs/testing` replaces only `INTERIOR_DESIGN_PROVIDER` and the artifact store.
The store is the real filesystem implementation rooted in `mkdtemp`; the wrapper
counts successful writes. The fake returns a validated deterministic 1×1 PNG and
distinct per-request normalized telemetry. It waits for an explicit test-only
completion endpoint, which proves pending state without timing sleeps. Diagnostics
contain reference metadata/counters, not image payloads, paths or secrets. These
loopback control endpoints exist only in the test executable, never the app.

`tools/ai-b5-environment.mjs` removes provider selection/API credentials and selects
the dedicated `casastudio_ai_b5` database using the local repository connection.
It never touches the manual “3D Workflow” Project or real artifact directory.
Fixtures use generic Room/Level identities and synthetic contours. Focused fixtures
cover adjacency, concavity, hosted architecture, Furniture and Stairs separately.

Prerequisites: repository dependencies/Chromium, normal PostgreSQL and Keycloak
containers, and the development demo password in the ignored environment.
Create the dedicated database once, then run:

```sh
docker exec casastudio-postgres-1 psql -U casastudio -d postgres -c 'CREATE DATABASE casastudio_ai_b5'
node tools/ai-b5-validation.mjs db:migrate:deploy
node tools/ai-b5-validation.mjs db:seed
node tools/ai-b5-validation.mjs --filter @casastudio/api test
pnpm test:e2e:ai-b5
pnpm lint
pnpm test
pnpm build
git diff --check
```

Run the database suite and browser journey sequentially. The browser creates and
deletes its disposable Project in `finally`; server shutdown removes its temporary
artifact directory. Failure traces/screenshots are under `test-results/ai-b5` and
the browser report is under `playwright-report/ai-b5`. They are test diagnostics,
not evidence of manual visual acceptance.

## Validation results

| Check | Result |
| --- | --- |
| Clean Prisma migration deploy | PASS — all 8 existing migrations applied to a new database, including durable Proposals; no historical migration edits. |
| Prisma schema validation | PASS. |
| Migration status/repeat deployment | PASS — up to date; repeat deployment has no pending migrations. No separate schema-diff convention is configured in this repository. |
| Normal seed/startup | PASS — standard demo seed succeeds; real application bootstrap is used by the browser harness. |
| Database-backed complete API suite | PASS — 19 files, 209 tests, zero skipped with DATABASE_URL configured. |
| Milestone Chromium lifecycle | PASS — 1 integrated journey, 1.1 minutes (1.4 minutes including startup), four explicit fake generations, two confirmed deletions, reload/revision/Room/Level checks, and temporary artifact/Project cleanup. |
| `pnpm lint` | PASS — all 6 workspace packages; standalone E2E/config lint and harness syntax checks also pass. |
| `pnpm test` | PASS — 11 Turbo tasks; 1,469 workspace Vitest tests plus 16 version-tool tests. Web: 66 files/756 tests. Normal API: 171 passing/38 database tests intentionally skipped without DATABASE_URL; all 209 API tests pass separately with the isolated database configured. |
| `pnpm build` | PASS — all workspace build tasks. Existing large frontend chunk sizes remain a follow-up. |
| `git diff --check` | PASS — all changes remain unstaged; no add/commit/push/rebase/amend. |
| Supplemental test-source `tsc --noEmit` | Existing API test-source errors outside this change (CommonJS/import.meta and stale test doubles). The repository-standard production build passes and excludes tests; this extra command is not an established acceptance script. |

Initial failures were validation setup issues: sandbox socket/DB restrictions,
browser-only CORS leaking into normal API tests, an invalid first draft fixture,
raw canvas input during closing dialog transitions, and expecting Active Level
selection semantics while All Levels was selected. They were corrected in the
test harness without changing production behavior or weakening assertions.

## Defects, limits and consistency semantics

One reproducible accessibility defect was found: opening deletion confirmation
above both Room History and Proposal Review left focus on the confirmation's
container instead of its Cancel button. React mount-time autofocus could run while
the underlying modal still enforced focus. The owning confirmation now focuses
Cancel in its transition's `onEntered`, after its focus trap is active. Browser
assertions cover session deletion and historical deletion over nested surfaces;
the component regression also checks reopening after Cancel. No provider,
persistence, geometry or unrelated UI abstraction was changed by this fix.

Added coverage also closes the integrated browser/JWT-database validation seam,
extends normalized reference/target UX failures and stale direction outcomes, and
checks generic elevated rotated reference footprints. No feature/refactor was added.

Documented limits remain:

- PostgreSQL and external bytes are not one transaction. A crash after blob write
  and before metadata commit can leave an orphan; failed compensation or crashes
  after metadata deletion can also leave bytes. Access is revoked through metadata;
  there is no background orphan sweep. Project cleanup is best effort.
- The synchronous generation lock belongs to one workspace lifetime. Independent
  tabs/workspaces can submit independently; there is no server idempotency key,
  global concurrency limit or application allowance ledger. Cost safeguards here
  mean explicit requests, single image edit, no retries/fallback and sanitized
  provider allowance failures, not a universal monetary cap.
- Browser disconnect cannot guarantee provider cancellation or billing cessation.
  Stale generation can complete and persist; it cannot enter a different active
  context. Revision provenance is the server-loaded snapshot used for generation.
- Context/reference invalidation is local to the loaded immutable scene. There is
  no cross-tab live revision synchronization; a concurrently edited Project is
  reloaded server-side, while client references reflect the client's loaded scene.
- History lists 20 metadata entries per page and loads only the selected artifact.
  Comparisons are current-session only; returning to a Room restores history,
  not discarded comparison state. FREE-edge geometric contact is not adjacency.
- The fake validates lifecycle/storage, not paid provider availability, output
  quality or architectural fidelity. No paid smoke test was run.

## POST-MVP AI REFACTOR NOTES

| Category | Observed evidence and bounded follow-up |
| --- | --- |
| Correctness risk | `useDesignGeneration` is workspace-local and POST has no idempotency protocol. Consider server-level admission/idempotency if cross-tab/reconnection usage requires it. Context snapshots and references lack an explicit client revision precondition; cross-client freshness deserves a separate contract decision. |
| Maintainability | `AiRoomDesignPanel` owns generation/reference epochs, comparisons, history selection, artifact state and several dialogs in one large component. Existing hooks/surfaces are useful seams; future decomposition should preserve their lock/identity behavior. |
| UX | History is a bounded page with explicit older-page navigation; count describes the loaded page, not a total. A future refinement could clarify that distinction without eagerly fetching images or generating. |
| Performance | Current build emits large renderer/application chunks. Asset/code loading is a broader frontend optimization; AI-B5 found no per-frame capture or eager full-history artifact load. |
| Future extensibility | `ProposalArtifactView` is a real presentation seam, but current durable DB/storage contracts still encode image dimensions/MIME and image telemetry. Richer/3D artifacts require a deliberate later contract/migration, not a speculative AI-B refactor. |

## Owner final manual acceptance (zero cost)

Use the isolated database with a disposable generic Project. In one terminal:
`pnpm api:build && node tools/ai-b5-server.mjs`. In another:
`node tools/ai-b5-validation.mjs --filter @casastudio/web dev --port 8081 --strictPort`.
Open `http://localhost:8081`, sign in normally and author/select generic Rooms;
do not use the owners' manual Project as the automated fixture.

1. In 3D choose Active Level, select a Room, and switch Properties/Designer by
   pointer and keyboard. Check target identity and the deselected empty state.
2. Inspect all three references, preview/close, orbit the normal camera and Refresh.
   Check readiness/disabled Generate and responsive layout; make the visual
   composition assessment yourselves.
3. Enter direction and Generate once. Inspect the named indeterminate wait.
   Finish the local fake using `curl -X POST http://localhost:3105/__ai-b5/complete`.
   Inspect Proposal Review, keyboard containment, Escape/focus restoration and
   secondary telemetry. No provider credentials are present in this executable.
4. Try another explicitly and complete the next fake the same way. Select both
   proposals and confirm image/telemetry identity follows selection.
5. Open history; reload/revisit and reopen the saved artifact. Change/save the
   Project in 2D, revisit 3D and verify the earlier proposal is historical.
6. Switch Rooms and Levels, return to the original Room, and verify separate
   histories and discarded transient comparisons.
7. Cancel then confirm deletion, reload, and check it stays deleted. Verify design
   generation/history/delete did not advance revision; only your canonical save did.
8. Check narrow viewport and keyboard use for tabs, direction, reference previews,
   comparison, Review, history and confirmation. Delete the disposable Project
   before stopping the fake server (its artifact root is intentionally temporary).

Owners may separately authorize and perform one paid real-provider smoke test.
This milestone execution does not authorize or perform it. Next milestone:
**AI-C — Conversational Design Iteration**; it has not begun.
