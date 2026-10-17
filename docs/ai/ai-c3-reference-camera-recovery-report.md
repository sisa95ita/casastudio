# AI-C3 reference-camera recovery — 11 October 2026

The interrupted implementation was recovered and completed within **AI-C3 —
Conversational Quality & Validation**. Engineering checks pass as recorded below;
owner reference inspection and visual quality acceptance remain pending. No new
roadmap phase, reference kind, provider semantics, or canonical editing operation
was introduced. All work remains unstaged.

## Recovery checkpoint

Before editing, this session inspected `git status --short`, `git diff --stat`,
`git diff`, all relevant untracked source/tests/reports, and the existing camera,
Furniture derivation, triangulation, reference isolation, and capture path. No
`AGENTS.md` was found in the workspace or its parent development tree.

The checkpoint contained **14 modified and 14 untracked files**. It included two
earlier stages of useful work: AI-C3 Furniture conditioning/conversation validation,
then its persisted-root diagnosis; these were retained. The new camera work already
contained deterministic seeds/candidates, interior photography policy, prism-based
visibility, explicit overview/complement scores, reference-plan integration, and
30 synthetic planner/visibility tests. Existing camera fixtures had been expanded
to carry full Furniture geometry. No unfinished TODO, second renderer, random
sampling, or competing planner was found. The 49 recovered focused tests passed
before this session's corrections.

Modified on entry:

```text
apps/api/src/ai/api/design-workflow.integration.test.ts
apps/api/src/ai/openai/openai-interior-design.provider.test.ts
apps/api/src/ai/openai/openai-prompt-builder.ts
apps/web/src/features/project-3d/camera/room-reference-camera-3d.test.ts
apps/web/src/features/project-3d/camera/room-reference-camera-3d.ts
apps/web/src/features/project-3d/presentation/room-reference-visibility-3d.test.ts
docs/05-ai-integration.md
docs/06-roadmap.md
docs/ai/conversational-design-ux.md
e2e/ai-b5-workflow.spec.ts
packages/ai/src/contracts.ts
packages/ai/src/design-context.test.ts
packages/ai/src/design-context.ts
tools/ai-b5-server.mjs
```

Untracked on entry:

```text
apps/api/src/ai/openai/furniture-conditioning.test.ts
apps/web/src/features/project-3d/FurnitureAsset3D.capture.test.tsx
apps/web/src/features/project-3d/camera/room-interior-geometry-3d.ts
apps/web/src/features/project-3d/camera/room-interior-planner-3d.test.ts
apps/web/src/features/project-3d/camera/room-interior-planner-3d.ts
apps/web/src/features/project-3d/camera/room-interior-policy-3d.ts
apps/web/src/features/project-3d/camera/room-interior-score-3d.ts
apps/web/src/features/project-3d/camera/room-interior-test-fixtures-3d.ts
apps/web/src/features/project-3d/camera/room-interior-visibility-3d.test.ts
apps/web/src/features/project-3d/camera/room-interior-visibility-3d.ts
docs/ai/ai-c3-milestone-report.md
docs/ai/ai-c3-owner-quality-diagnosis.md
docs/ai/conversational-quality-validation.md
packages/ai/src/furniture-layout.ts
```

The camera design was substantially complete, but final recovery validation and
camera-specific documentation were absent. Two integration details needed correction:
the heavier planner inherited a `useMemo` executed during React rendering, and
the minimum/default height rules could override the available height of a low Room.
The nearby-wall rays also still scanned every wall section rather than using the
bounded occlusion query. Seed spreading repeatedly recomputed all previous distances.

## Preserved design and corrections

The original planner/geometry/visibility/score separation was preserved. This
session moved planning into the existing reference-capture callback, so it runs
only during preparation/refresh. Low walls now retain their actual height instead
of being clamped to a 2.4 m default; that default applies only without relevant
walls. Eye height respects available headroom, and no camera is invented below
the policy's practical minimum. Near-wall checks use the same bounded broad-phase
query as other visibility rays. Farthest-point spreading now maintains nearest
distances in O(points × selected limit), preserving its deterministic selections.
Static prism planes and each candidate's existing architectural projection basis
are compiled once instead of recomputed for every sample. New parity tests compare
the reusable projector against the actual Three perspective camera.

Provider prompts, DesignContext, schemas, image ordering/configuration,
Proposal persistence and lineage received **no new edits in this session**. Their
existing dirty changes belong to the recovered earlier AI-C3 work. The original
axonometric pose/bounds/direction derivation is preserved.

## Candidate generation and photography

`room-interior-planner-3d.ts` uses the existing triangulated `Floor3D.contour`.
For each triangle it generates the centroid, three vertex insets, and nine edge
insets. Convex combinations stay within that triangle, including in concave Rooms.
Stable spatial spreading retains at most 192 seeds, then at most 24 safe positions.
Safety tests use the actual floor polygon and every canonical solid, rather than
the Room's rectangular bounds or a fixed number of walls.

The central `room-interior-policy-3d.ts` specifies:

- 1.7 m eye height, adapting to wall height minus 0.3 m headroom; practical minimum
  1.2 m. Wall-free Rooms use the existing conservative 2.4 m envelope.
- At least 0.18 m perimeter clearance, reduced to 0.06 m only when no standard
  candidate survives. Physical wall/door/stair solid clearance remains 0.12 m.
- Furniture footprint clearance of 0.25 m, with a proximity penalty below 0.65 m.
  Rotated footprints matter; standing above a low item is not treated as a free eye.
- Perspective vertical FOVs of 54° and 62°, with a separate wider-FOV penalty.
- At most 12° downward pitch, toward a nominal 1.05 m composition height, using
  existing architectural near/far plane derivation.

These remain interior photographs, with no orthographic/top-down/ceiling-mounted
fallback. If the bounded search finds no safe practical pose, preparation reports
its existing failure rather than fabricating a camera inside solids. This is not
proof that every mathematically possible pose has been searched.

## Layout-aware targets and meaningful visibility

Targets combine an area-weighted Room center, a footprint-weighted Furniture
distribution center, and spatially separated item centers (or triangle centers for
empty Rooms). Layout targets blend 80% layout evidence with 20% Room composition.
There are at most four targets per position. No categories, definition names,
assets, or owner's Bedroom measurements drive selection.

`room-interior-visibility-3d.ts` evaluates up to three camera-facing prism faces,
with nine deterministic points per face. Canonical center, yaw, width, depth and
height determine those surfaces. Existing screen projection determines framing,
near/far clipping, projected size and frame-edge cropping. Rays distinguish
surfaces actually visible from surfaces merely inside the frustum. Small projected
specks receive less coverage.

Occlusion uses rotated Furniture prisms, resolved wall body sections (therefore
architectural voids remain open), door leaves, and conservative staircase envelopes.
The static broad-phase tree includes **all** solids; detailed item scoring is
capped at 48 spatially distributed Furniture items. Sampled floor/Room and
wall/opening evidence supplies context and composition quality. Six short bounded
wall-only rays penalize nearby wall-dominated frames.

This is renderer-neutral geometry analysis, not computer vision. The existing
Three offscreen renderer still captures three 960 × 720 references with temporary
perspective cameras and the existing isolation/restoration mask.

## Interior A overview and Interior B complementarity

A ranks normalized, separately inspectable rewards for meaningful item instances,
footprint-weighted surface coverage, spatial diversity, Room coverage, and
architectural context. Separate penalties cover cropping, occlusion, proximity,
foreground/wall domination, distortion and empty frames. Stable candidate indices
break equal-score ties. Diagnostics remain internal; no score enters provider
contracts or ProjectSchema.

B evaluates the same candidates after A. It rewards coverage of items/samples A
represents weakly (`B coverage × (1 − A coverage)`), including Room and architecture,
while retaining overview quality. It penalizes similar visible-item coverage and
similar camera poses. When alternatives exist, candidates must be at least 0.6 m
apart and differ in plan direction by at least 25°. Limited-diversity Rooms fall
back to other candidates, or the same safe view only if necessary. Neither view
requires 100% Furniture visibility.

Reference roles remain Interior A as primary edit image, Axonometric as structural
whole-layout evidence, and Interior B as complementary interior evidence. Exactly
the existing three references are prepared. Provider image ordering is unchanged.

## Edge cases, determinism and performance

Recovered tests cover empty, single-item, sparse, compact, rectangular, rotated,
concave L/T/U-like, and irregular/free geometry. Wall partitions, openings, door
leaves, dense layouts and fully obstructed Rooms are exercised. Other Room/Level
objects remain excluded by the existing capture mask. Repeated/reordered input
preserves camera results without mutating the source scene/canonical Project.

Bounds per planning operation:

| Operation                                         | Maximum |
| ------------------------------------------------- | ------- |
| Position seeds retained                           | 192     |
| Safe positions evaluated                          | 24      |
| Targets per position                              | 4       |
| FOV alternatives                                  | 2       |
| Total candidate poses                             | 192     |
| Furniture items receiving detailed scores         | 48      |
| Surface samples per item/candidate                | 27      |
| Room / architecture samples                       | 24 / 24 |
| Nearby-wall rays per candidate                    | 6       |
| Broad-phase node/solid intersection tests per ray | 128     |
| Total visibility rays, worst case                 | 259,200 |

Traversal exhaustion is conservatively occluded, never falsely rewarded as visible.
Geometry preprocessing/collision filtering scales with supplied triangles/solids;
it does not truncate physical occluders. Search/rays have fixed bounds, no random
sampling or optimization loop. Planning consults no OrbitControls, mounted camera,
GLB load state, or animation frame and runs only on preparation/refresh.

A local synthetic timing check (one run per scenario, not a timing guarantee)
measured 168 candidates / three items at 127 ms and 184 candidates / 70 items at
5,951 ms before compiling repeated transforms. The same cases then took 62 ms
and 611 ms respectively. The dense case still scores 48 spatially distributed
items and retains every one of its 70 Furniture occluders; no bounds or quality
criteria were reduced to obtain this improvement. Device/browser/load influence
wall-clock time; dense preparation can still cause a short main-thread pause.

## Files completed in this recovery session

New file: this report. Existing recovered camera files were completed at their
owning abstractions: `room-reference-camera-3d.ts`, `room-interior-planner-3d.ts`,
`room-interior-geometry-3d.ts`, `room-interior-visibility-3d.ts`, and their planner/
visibility tests. `room-interior-policy-3d.ts`, `room-interior-score-3d.ts` and the
synthetic fixture helper retain their recovered logic. `architectural-camera-3d.ts`
adds a reusable projection basis without changing pose/FOV mathematics, and its
tests check Three parity at both interior FOVs. `Project3DViewer.tsx` moves
planning into capture. The recovered visibility-mask test was formatted, and
`e2e/ai-b5-workflow.spec.ts` now verifies refreshed furnished camera metadata and
user-camera restoration. Integration/roadmap/quality documentation links this
targeted AI-C3 correction; earlier dated reports remain historical records.

## Tests and validation

The 30 recovered planner/visibility tests were preserved. Three regressions were
added: low-ceiling height/failure (including reference-plan integration), rotation
changing measured visibility at an unchanged center, and stable bounded seed spread.
Two architectural projection cases additionally compare reused screen coordinates
and depth against Three at 54°/62°, including elevated tilted views and behind-eye
rejection.
Existing tests already demonstrate better overview ranking, complementary B,
occlusion/cropping/distortion penalties, safe positions, generic targeting,
L/T/U/rotated geometry, empty/sparse/single fallback, immutability and bounds.

Playwright refreshes furnished references after an actual OrbitControls gesture,
checks user-camera position/direction restoration, verifies exactly three previews
and no provider invocation for inspection/refresh, then compares canonical camera
metadata across root/refinement/reload. Generation in this suite uses the isolated
fake provider only; retries are disabled.

| Check                                                  | Recovery-session result                                                                                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recovered focused tests before edits                   | 49 passed                                                                                                                                                  |
| Completed focused camera/mask/Furniture fallback tests | 60 passed, 7 files                                                                                                                                         |
| OpenAI/Furniture final mocked boundary + SDK wiring    | 50 passed                                                                                                                                                  |
| Signed-JWT database-backed AI-C3 workflow              | 12 passed                                                                                                                                                  |
| `pnpm lint`                                            | Passed, 6 tasks                                                                                                                                            |
| `pnpm test`                                            | Passed on final post-optimization run, 11 tasks; web 818 (69 files), API 185 + 58 DB skips, schema 460, geometry 62, AI 24, shared 1; version tests passed |
| `pnpm build`                                           | Passed, 7 tasks; existing Vite chunk-size warning                                                                                                          |
| `git diff --check`                                     | Passed on final completed tree                                                                                                                             |
| Isolated AI-B / AI-C3 Playwright                       | Both passed on final run: AI-B 1.1 minutes, AI-C3 44 seconds, Chromium, fake provider, retries 0                                                           |

Initial dependency links were missing (`vitest: command not found`); pnpm's cached
repeat-install shortcut incorrectly reported up to date. A frozen-lockfile install
with `--config.optimistic-repeat-install=false --force` restored generated links.
No dependency/lockfile changed. Local HTTP/Playwright/tsx initially hit sandbox
`listen EPERM`; those commands were rerun with escalation, not production changes.
Database validation used only the existing `casastudio_ai_b5` database. No migration
was created or deployed. One exact synthetic Project left by this session's timed-out
AI-B test was removed from that isolated database. Cleanup initially overlapped
Prisma client generation and could not load the generated module; it completed once
generation finished. No owner Project or earlier recovery fixture was removed.
Existing pg/fixture React/Three warnings remain.

An initial browser run exposed a new test assertion querying the underlying region
while the reference modal hid it from accessibility, and a subsequent run compared
the user camera while OrbitControls damping was still active. The test now waits
on the visible Refresh control and for stable camera telemetry after pointer-up.
The broader recovered AI-B run also encountered a detached history button during
focus; it passed on the final run with settled-camera waits. Earlier failed runs
are not counted as passes. No UI redesign or relaxed layout/immutability assertion
was used.

```sh
pnpm --filter @casastudio/web test src/features/project-3d/camera/room-interior src/features/project-3d/camera/room-reference-camera-3d.test.ts src/features/project-3d/presentation/room-reference src/features/project-3d/FurnitureAsset3D.capture.test.tsx
pnpm --filter @casastudio/api test src/ai/openai/furniture-conditioning.test.ts src/ai/openai/openai-interior-design.provider.test.ts src/ai/ai.module.test.ts
node tools/ai-b5-validation.mjs --filter @casastudio/api test src/ai/api/design-workflow.integration.test.ts --no-file-parallelism --maxWorkers=1
pnpm lint
pnpm test
pnpm build
pnpm test:e2e --config playwright.ai-b5.config.ts
git diff --check
```

## Zero-cost owner reference acceptance

1. Open a furnished Room; save intentional canonical edits before comparing references.
2. Open Design Studio → **Inspect references**.
3. Inspect **Interior perspective A**: credible human-scale interior view, useful
   overall Furniture arrangement, no severe clipping/foreground domination.
4. Inspect **Axonometric**: the same canonical whole-layout structural evidence.
5. Inspect **Interior perspective B**: items/relationships weak in A should gain
   useful evidence when physically possible.
6. Close the inspector and orbit the normal 3D camera.
7. Open **Inspect references → Refresh**; confirm the automatic compositions remain
   deterministic for unchanged canonical geometry, and the user camera is preserved.
8. Repeat on a non-rectangular Room if useful. GLB readiness may change appearance
   between captures, but must not change planned camera metadata.

This procedure makes no paid request. Do not press Generate design, Try another,
or Generate revision as part of zero-cost reference acceptance.

## Live provider decision and remaining limitations

**LIVE GENERATION NOT JUSTIFIED. ZERO live requests in this recovery session.**
Owner inspection is needed to establish that the new primary/complementary RGB
conditioning actually improves the relevant Room views. A paid stochastic output
before that inspection would not establish that prerequisite. There is no A/B/C
live-result classification, usage telemetry, retry, fallback, refinement, alternate
model, or hidden judge to report. The owner's Bedroom was not inspected or modified.

The search maximizes a bounded geometric approximation, not all possible poses or
actual photometric visibility. Furniture envelopes can overestimate GLB occlusion;
stairs use a conservative bound. Large layouts analyze only a spatially distributed
subset in detail, while retaining all occluders. Very tight/obstructed/low spaces may
yield no safe candidate. Wall height supplies headroom policy, not a ceiling-surface
model. Text plus RGB cannot enforce CAD-exact positions, and actual owner visual
quality has not passed.

**AI-C3 recommendation: NOT READY to close until owner reference/quality acceptance.**
No known deterministic canonical pipeline blocker remains after this recovery;
the concrete outstanding acceptance gate is whether A is an informative overview
and B usefully fills its gaps. The earlier reported provider layout failure remains
unresolved by an accepted visual result. This report does not promote an engineering
score or a fake-provider test to image quality acceptance.

If the owner confirms informative A, complementary B, correct Axonometric and
structured context, yet the model still substantially rearranges Furniture, stop
additional AI-C3 prompt tuning/reference proliferation. Record the likely limitation:
the current general-purpose image model/API lacks sufficiently hard spatial
conditioning for the desired layout fidelity. AI-C3 may then close with that
documented provider limitation and owner agreement; it does not require CAD-exact
pixels. Depth, normals, segmentation, instance masks, adapters/LoRA/fine-tuning and
specialized geometry conditioning remain post-MVP research only. AI-D owns future
typed canonical AI edits.

## Git safety

Every recovered file was retained. All recovered and completed work is unstaged;
the index is empty. No reset, restore, clean, checkout, add, commit, push, rebase or
amend was performed. The dirty working tree remains the recovery checkpoint.
