# AI-C3 owner quality diagnosis — 10 October 2026

This audit examines the current working tree, including the AI-C3 implementation
already present when this task started. It does not attribute those earlier
changes to this task. All new regression data is synthetic and independent of the
owner's Bedroom. No canonical schema, geometry, Furniture, or revision was edited.

1. **Browser request-body verdict: EXPECTED.** The root payload contains
   `levelId`, `roomId`, `instructions`, and `referenceViews`; each reference has a
   target. The Project ID comes from the route. Canonical Furniture belongs to the
   authorized server reload, not the browser DTO. There is no need to duplicate it.

2. **Actual root path.** `AiRoomDesignPanel.generate`
   (`apps/web/src/features/project-3d/AiRoomDesignPanel.tsx`) calls
   `CasaStudioApiClient.generateRoomDesign` (`apps/web/src/core/api/`).
   POST `/api/v1/projects/:id/design-proposals` enters
   `DesignProposalsController.generate` with `GenerateRoomDesignRequestDto`.
   `GenerateDesignProposalService.generate` calls `AuthorizedProjectLoader.load`;
   `PrismaProjectRepository.findLoadedByDomainId` reloads the persisted aggregate;
   `ProjectAggregateMapper.toProject` in `project-aggregate.mapper.ts` restores its
   canonical Furniture fields. The loader authorizes the authenticated subject
   against persisted ownership through `ProjectReadAuthorizationPolicy`.
   `deriveDesignContext` and `deriveFurnitureLayout` in `packages/ai/src/` derive
   the provider-neutral snapshot. `InteriorDesignService.generate` validates
   required matching Room references and invokes
   `OpenAIInteriorDesignProvider.generateDesign → edit → client.create`.
   `buildOpenAIInteriorDesignInstructions` and
   `buildOpenAIInteriorDesignPrompt` supply the same Responses request that invokes
   the image-generation tool. `AiModule` wires `client.responses.create` from the
   official SDK. `PersistDesignProposalService.persist` saves the result with the
   same loaded revision and a context/reference fingerprint.

3. **Canonical Furniture.** `FurnitureItemSchema` holds ID, optional
   name/description, definition ID, owning Room ID, center X/Z, arbitrary finite
   rotation, width/depth/height. Category and definition name are catalog facts,
   not duplicated instance fields. Room ownership resolves its Level and floor.
   Units are cm and degrees. Position is footprint center in Project X/Z; width
   spans local X, depth local Z; height rises from the owning Room floor. Rotation
   is about +Y by the right-hand rule and is not normalized in ProjectSchema.

4. **Exact derived representation.** Each `DesignFurnitureContext` retains ID,
   optional name, definition ID, resolved built-in definition name/category,
   cloned world position, `rotationDegrees`, instance width/depth/height,
   optional `roomLocalPosition`, and optional `nearestBoundary` containing
   `boundaryIndex`, `centerDistance`, and `widthAxisRelation`.
   `furnitureLayout` holds `intent: preserve-by-default`, optional origin, and
   `nearbyPairs` with both item IDs, center distance, and width-axis relation.
   Room-relative coordinates translate the axes; they do not rotate or normalize
   them. Room ownership is implicit in the enclosing target context rather than
   copied into every item. Unknown external definitions deliberately remain
   unresolved. Descriptions and asset URLs are not emitted as Furniture facts.
   No footprint polygon, normalized 0–1 coordinates, clearance, containment,
   functional role pairing, or category-specific facing/headboard vector is derived.

   The synthetic regression's derived items have the following facts (cm/deg).
   Their IDs are `a`, `b`, `c`; layout origin is `(-200, 500)` and intent is
   `preserve-by-default`. Names/categories resolve from the built-in definitions.

   | Item | Category | World center | Room-local center | Rotation | Width × depth × height | Nearest boundary                     |
   | ---- | -------- | ------------ | ----------------- | -------- | ---------------------- | ------------------------------------ |
   | a    | SOFA     | (-80, 600)   | (120, 100)        | 90       | 190 × 85 × 82          | index 0, distance 100, perpendicular |
   | b    | TABLE    | (100, 620)   | (300, 120)        | 0        | 140 × 80 × 74          | index 0, distance 120, parallel      |
   | c    | CABINET  | (260, 780)   | (460, 280)        | -30      | 95 × 42 × 165          | index 1, distance 140, oblique       |

   The derived nearby pairs are a/b (distance approximately 181.1077,
   perpendicular) and b/c (approximately 226.2742, oblique). a/c is beyond the
   proximity threshold and is not invented as a pair.

5. **Provider-facing representation.** The provider receives F1…Fn labels in
   deterministic item-ID order, B1…Bn perimeter endpoints in boundary order, the
   explained plan frame, definition/category, translated center, yaw, footprint,
   height, nearest-boundary facts, and bounded item-pair facts. These labels avoid
   exposing unrelated Project/entity IDs. This is substantially more than a list
   of Furniture names. The mocked SDK regression asserts this synthetic layout's
   Furniture facts and selected relationships. Relevant emitted semantic text
   for its lounge with origin `(-200, 500)` is:

   ```text
   CANONICAL FURNITURE — INTENTIONAL LAYOUT, PRESERVE BY DEFAULT
   B1 (free): (0, 0) to (600, 0).
   F1: Sofa; definition generic-sofa, category SOFA; center (120, 100); rotation 90 deg; footprint width 190 × depth 85, height 82 cm. Nearest boundary B1: center-to-segment distance 100 cm; width axis perpendicular to boundary.
   F2: Dining table; definition generic-dining-table, category TABLE; center (300, 120); rotation 0 deg; footprint width 140 × depth 80, height 74 cm. Nearest boundary B1: center-to-segment distance 120 cm; width axis parallel to boundary.
   F3: Cabinet; definition generic-cabinet, category CABINET; center (460, 280); rotation -30 deg; footprint width 95 × depth 42, height 165 cm. Nearest boundary B2: center-to-segment distance 140 cm; width axis oblique to boundary.
   F1 / F2: centers separated by 181.11 cm; width axes perpendicular.
   F2 / F3: centers separated by 226.27 cm; width axes oblique.
   Distances describe centers, not footprint clearance or containment; do not infer functional associations.
   ```

6. **Final mocked OpenAI request.** New integrated regressions use the actual
   authorization loader, root application service, neutral derivation/service,
   and OpenAI adapter, replacing persistence and the SDK network boundary only.
   They assert exact Furniture facts, architectural/layout/style contracts,
   spatial-context section, user direction, reference roles/order and high-detail
   image inputs in one request. Configuration is server-owned: orchestration
   model, image model, quality, size, format. Defaults in `app-configuration.ts`
   are `gpt-5.6-sol`, `gpt-image-2.5-flare`, `medium`, `1536x1024`, PNG; environment
   can override them. Tool action is `edit`, `partial_images: 0`, forced
   `image_generation` tool choice, `max_tool_calls: 1`, `parallel_tool_calls: false`.
   SDK timeout is 180,000 ms and `maxRetries: 0`; `ai.module.test.ts` asserts this
   wiring. There is no retry loop, variant, separate intent/planning request,
   model/quality fallback, or edit-to-generate fallback. Responses orchestration
   occurs inside the one existing generation request.

7. **Reference Furniture inclusion.** `createFurnitureModels3D` resolves the
   canonical Room/Level, converts cm to meters, and derives exact rotated bounds.
   `createRoomReferencePlans3D` selects the requested Level and Room, includes its
   Furniture IDs and bounds in all three plans, and excludes other Rooms/Levels.
   `ArchitecturalLevel3D` mounts Furniture separately from floors.
   `captureRoomReference` renders that mounted scene offscreen with
   `applyRoomReferenceVisibility3D`, which enables target Furniture and masks
   unrelated levels/Furniture, grid, ground, and outline lines; then restores
   prior visibility and renderer state. No Furniture omission was demonstrated.
   Furniture can still be occluded or off-camera in an individual view.

   `FurnitureAsset3D` places its parent at the canonical center/floor with yaw,
   uses a local Suspense fallback while GLB loading is pending, and an error
   boundary fallback on failure. Unavailable/non-adaptable assets use that same
   fallback. The volume retains instance width/depth/height. Capture does not wait
   for every GLB or automatically replace already captured images when one loads;
   references can therefore contain neutral volumes. New regressions exercise
   the actual component's pending, failed, and unavailable paths, with GPU
   primitives mocked. These prove component/fallback semantics, not visible pixel
   coverage behind an occluding wall.

8. **Root base ordering.** `orderedReferences` sorts incoming views to Interior A
   first, axonometric second, Interior B third; optional current-user view is last.
   Each image follows its semantic text label. Interior A is the base image to
   edit and its composition/camera is authoritative. Axonometric supplies
   structure/layout and Interior B complementary architecture/Furniture evidence.
   Interior A's plan/mask includes canonical target Furniture on the same terms
   as the other two references.

9. **Coordinates.** The prompt explicitly explains cm, (X,Z), +Y up, the origin
   at B1 start, unchanged Project axes, and footprint-center meaning. The same
   translated frame describes Furniture and perimeter segments. There is no
   claim that X/Z means image left/right. Raw world coordinates survive in neutral
   context; provider prose normally uses translated coordinates. Camera metadata
   is transported by the browser and fingerprinted, but is not translated into
   provider text. Association of text axes/F labels with RGB objects is left to
   the multimodal model; no metric registration or per-item projected labels are
   supplied. This is a conditioning limitation, not demonstrated loss of a
   canonical Furniture field.
   Noninteger provider-facing numbers are formatted to two decimal places;
   neutral context retains the original numeric values.

10. **Rotation.** Raw canonical degrees survive as `rotationDegrees` and provider
    `rotation … deg`. The frame explains: at 0, width is +X and depth +Z; at +90,
    width turns toward −Z and depth toward +X. Thus yaw is explained, not an
    unexplained numeric angle. Boundary/pair relations reinforce it. The Three
    renderer reflects Project Z and uses negated yaw, consistent with that
    canonical convention. Pair/boundary axis relations are modulo 180; full item
    yaw remains signed and retains 180-degree distinctions numerically. Semantic
    front/headboard direction is conveyed by RGB assets rather than a separate
    catalog-derived text vector.

11. **Dimensions/footprint.** Effective instance dimensions, rather than catalog
    defaults, survive reload, derivation, and prompt. Width/depth are labeled as
    local footprint dimensions and height as above-floor height, all in cm.
    Renderer assets/fallbacks use those same physical dimensions. The provider
    contract requests approximate footprint preservation, not CAD accuracy.

12. **Relationships.** The closest nondegenerate finite perimeter segment is
    chosen by clamped point-to-segment center distance, ties by boundary index.
    Width-axis alignment is parallel/perpendicular/oblique using a 1-degree
    tolerance and modulo-180 comparison. Boundary yaw uses
    `-atan2(dz, dx)` in degrees, consistent with canonical +Y rotation.
    Nearby pairs use center distance at most half the sum of the two footprint
    diagonals plus 100 cm. Each item selects its two nearest candidates (ties by
    item ID), pairs are deduplicated, sorted by distance then stable IDs, and
    capped at 24 globally. Every selected relationship is emitted to provider
    prose. This is a proximity heuristic, not rotated-footprint clearance.
    Items themselves are not capped. Pair search is quadratic CPU work; pair
    prose is bounded and does not grow quadratically.

13. **Prompt-conflict audit.** NO CLEAR CONFLICT was found in the current C3
    hierarchy. It says to preserve category, position, orientation, footprint,
    relative arrangement and relationships by default; style-only instructions
    do not authorize rearrangement. Explicit requested layout changes override
    only their scope. The later phrase “Change ONLY interior-design content:
    Furniture and its appearance…” is a POSSIBLE AMBIGUITY when read alone, but
    the preceding layout contract explicitly bounds it. There is no current
    “arrange/optimize/reorganize unless asked to preserve” instruction. The
    earlier C3 milestone documents that such a conflict existed before C3; it
    is already removed in the working tree examined here. This audit did not
    demonstrate that another wording edit would fix the owner's drift.

14. **Persisted versus unsaved.** Backend semantic context uses the persisted
    authorized Project. Browser references use the current scene, including
    unsaved edits and temporary rendering state. A moved/rotated item that has
    not been saved can therefore conflict with server Furniture facts in a root
    request. Scene changes invalidate local evidence/comparisons, but root
    generation itself is not gated on `unsavedChanges`. Refinement is gated.
    Existing product documentation acknowledges that revisions do not model
    unsaved geometry. This audit records the limitation; no evidence establishes
    it as the cause of the owner's particular P1, and the task explicitly
    forbids changing that behavior without such evidence.
    The root uses the same loaded Project object's revision for context and
    Proposal provenance. There is no generation-long Project lock: a subsequent
    save may make the completed root historical, but generation does not relabel
    its original snapshot as the newer revision. There is no cached AI context,
    global latest-Room lookup, or fallback to a different Level.

15. **Coverage before this task.** AI-C3 tests already assert catalog semantics,
    canonical positions/yaw/dimensions, translated concave/rotated boundaries,
    nearest boundaries, axis relationships, deterministic ordering, immutability,
    unknown definitions and the 24-pair cap. Provider tests assert exact local
    center/yaw/footprint prose, hierarchy, image order/configuration, and SDK
    retries. Signed-JWT database/browser workflows check canonical context at a
    fake provider, Room/Level exclusions, lineage, immutability and stale work.
    Camera/mask tests check target Furniture inclusion. The main gap was that
    final mocked SDK requests did not themselves assert a complete _derived_
    multi-item Furniture layout; pending GLB fallback evidence also lacked a
    direct component regression. Separate passing layers do not prove pixels.

16. **Earliest failure classification: F — NO DETERMINISTIC CASA STUDIO DEFECT
    FOUND in the current persisted-root conditioning path.** No A/B field loss,
    C translation omission of canonical position/yaw/dimensions/derived
    relationships, D mask exclusion, or clear E preservation inversion was
    demonstrated. Unsaved/reference readiness and multimodal interpretability
    limitations remain qualified above; they do not prove the observed P1 cause.

17. **Fixes implemented.** None to production behavior. This task adds evidence
    and regression coverage only; it preserves all pre-existing unstaged C3 work.

18. **Owning abstractions.** The root-to-SDK regression belongs beside the OpenAI
    adapter because that boundary must preserve both neutral geometry and edit
    instructions. The GLB fallback regression belongs beside `FurnitureAsset3D`,
    which owns resource readiness and its exact physical fallback. No browser
    Furniture serialization, schema change, geometry hack, or provider setting
    change was introduced.

19. **Regressions added.** `furniture-conditioning.test.ts` adds three tests:
    styling-only root, explicitly requested scoped layout override, and access
    denial before any SDK call. They assert the exact three-item synthetic
    layout, unrelated Room/Level exclusion, same saved revision passed to
    persistence, Project immutability and single edit request. The override
    test proves that direction and scoped-override rules reach the model; it
    cannot prove model obedience. `FurnitureAsset3D.capture.test.tsx` adds three
    tests for pending/failed/unavailable resources, exact fallback body dimensions
    and placement/yaw. No owner-specific IDs, coordinates, Room name, category
    combination, thresholds, or acceptance data enter the new tests.

20. **Deterministic validation: PASSED in the final validation configurations.**
    Database suites use the existing isolated
    `casastudio_ai_b5` database with paid-provider configuration removed. Browser
    design workflows use the repository's fake-provider runner. Sandbox
    listener/database restrictions require approved execution outside it.
    A parallel DB attempt had timeouts and interference between suites that
    assert global proposal counts; the final DB run is serial. Parallel ordinary
    web runs also hit the existing 15-second UI deadlines; final `CI=1 pnpm test`
    uses the repository's supported serial web-file configuration, with the same
    assertions and deadlines. Two broader browser workflows hit their 60-second
    deadlines under concurrent load; both passed separately with a 180-second
    deadline. No production changes or weakened assertions were needed.

    | Check                                                           | Final result                                                                                                        |
    | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
    | `pnpm lint`                                                     | All 6 tasks passed                                                                                                  |
    | `CI=1 pnpm test`                                                | All 11 tasks passed; web 783, API 185 + 58 DB skips, schema 460, geometry 62, AI 24, shared 1; version tests passed |
    | `pnpm build` / final build script rerun                         | All 7 tasks passed                                                                                                  |
    | `git diff --check`                                              | Passed                                                                                                              |
    | Final derived Furniture → mocked SDK regression                 | 3 passed; distinct PNG/JPEG/WebP reference bytes and role order verified                                            |
    | Existing OpenAI provider + SDK wiring tests                     | 45 + 2 passed                                                                                                       |
    | AI-C neutral derivation/service/spatial tests                   | 24 passed                                                                                                           |
    | Focused reference mask/camera/fallback tests                    | 16 passed                                                                                                           |
    | Prisma validation                                               | Valid                                                                                                               |
    | Migration status                                                | 9 existing migrations; up to date                                                                                   |
    | Isolated datasource/schema migration diff                       | No difference, exit 0                                                                                               |
    | Serial full database-backed API suite                           | 243 passed, 21 files, no skips                                                                                      |
    | Isolated AI-B / AI-C3 Playwright                                | Both passed; real auth/API/database/artifacts, fake provider, retries 0                                             |
    | Furniture assets/visibility and multi-Level 3D smoke Playwright | Both passed                                                                                                         |
    | Furniture 3D interaction and canonical authoring Playwright     | Both passed on separate rerun: 51.9s and 33.0s                                                                      |
    | New-file Prettier check                                         | Passed                                                                                                              |

    Reproducible final commands include:

    ```sh
    pnpm lint
    CI=1 pnpm test
    pnpm build
    git diff --check
    pnpm db:validate
    pnpm db:migrate:status
    node tools/ai-b5-validation.mjs --filter @casastudio/api prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
    node tools/ai-b5-validation.mjs --filter @casastudio/api test --no-file-parallelism --maxWorkers=1 --testTimeout=30000
    pnpm test:e2e --config playwright.ai-b5.config.ts
    pnpm test:e2e e2e/furniture-3d.spec.ts e2e/project-3d.smoke.spec.ts --project=chromium
    pnpm test:e2e e2e/furniture-3d-interaction.spec.ts e2e/furniture-workflow.spec.ts --project=chromium --timeout=180000
    ```

    The final build rerun used
    `pnpm --config.verify-deps-before-run=false build` after pnpm's pre-run
    dependency-state check attempted an automatic install while switching test
    environments. The dependency check reported the lockfile up to date and
    installation already up to date; no dependency or lockfile changed. This
    flag skips only that pnpm preflight, not compilation. Earlier ordinary
    `pnpm build` runs also passed. No migrations were created or deployed because
    both migration checks were clean. Two synthetic Projects left by interrupted
    browser cleanup were removed by their exact generated test names. Successful
    reruns performed their own cleanup. The owner's Bedroom was never inspected
    or modified.

21. **Does OpenAI receive enough canonical Furniture information? YES for known
    canonical definitions at the request boundary.** Position, explained yaw,
    footprint/height, perimeter geometry and the supported spatial relations
    reach the same generation request with preservation semantics. This answer
    describes the supplied information. It does not establish that the model
    reliably binds it to pixels or obeys it. Unknown definitions have unresolved
    categories; model-facing geometry has no hard spatial enforcement.

22. **Live-generation decision: NOT JUSTIFIED.** This decision was made after
    all zero-cost checks completed. No new production conditioning change needs
    visual validation. Another output from the unchanged pipeline would sample
    its stochastic behavior, but would not isolate why the earlier P1 drifted or
    distinguish unsaved/reference-readiness conditions from model interpretation
    in that past request. The actual request-boundary evidence answers the primary
    data-delivery question without another paid experiment.

23. **Live result and usage.** ZERO live design-generation requests. No live
    root, refinement, retry, fallback, alternate variant, AI judge, or separate
    intent/planning call occurred. There is no live result classification or
    provider usage telemetry to report. All generation exercised by automated
    validation used injected mocks or the isolated fake provider.

24. **Why a live call would not materially improve this diagnosis.** The
    unresolved question is practical visual obedience and the particular past
    run's conditions. No retained snapshot establishes those conditions, and
    this task found no production variable to change for a controlled comparison.
    One more stochastic output could inform subjective quality acceptance, but
    would not identify the prior cause. The paid-call budget was therefore saved.

25. **Likely explanation of owner P1 drift.** Given the current saved-root code,
    provider interpretation of RGB references plus textual geometry is a plausible
    explanation. Conflicting unsaved references or references captured as neutral
    volumes are also possible. No retained request/reference snapshot or before/
    after visual comparison from that particular paid run was supplied, so this
    audit cannot establish which explanation applies or what code version served
    the run. The historical pre-C3 prose loss is not evidence that it persisted
    in the current request.

26. **Remaining limit.** RGB multi-image editing and textual canonical geometry
    express intent but do not enforce spatial layout. Occlusion, symmetric
    geometry, fallback appearance, semantic front ambiguity, unsaved-state
    mismatch and probabilistic image edits limit guarantees. Depth conditioning,
    semantic segmentation, Furniture masks, structured spatial conditioning,
    a CasaStudio adapter/LoRA/fine-tuning or specialized edit models are research
    directions only; none were implemented. No CAD fidelity claim is made.

27. **Owner quality acceptance readiness: NOT READY to sign off layout quality.**
    The deterministic implementation and regressions pass, but the reported
    owner's layout drift remains unresolved and no new visual evidence establishes
    acceptable fidelity. This task does not declare the problem solved. The
    current information-delivery pipeline can pass engineering validation while
    practical provider obedience remains unproven.

28. **Git.** All changes remain unstaged. No add, commit, push, rebase or amend.
    The task began with pre-existing C3 modifications and untracked reports;
    those were retained. New work is limited to the two regression files and
    this diagnostic report.
