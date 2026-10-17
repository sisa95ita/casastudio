# AI-C milestone report — 9 October 2026

AI-C3 implements targeted quality hardening and zero-cost conversational validation.
Owner visual quality acceptance is pending. This report does not claim visually
correct Furniture fidelity or narrow-delta preservation. Changes are unstaged.

1. **Furniture semantics found:** `ProjectSchema` Furniture position is the footprint
   center in Project X/Z centimeters; width/depth span local X/Z, rotation uses the
   right-hand rule about +Y, and height extends above the owning Room floor. The
   original neutral context copied ID/name/definition ID, center, rotation and instance
   dimensions, filtered by Room. It did not resolve catalog category/name or derive
   spatial relationships. The OpenAI prose emitted only optional name and dimensions.
   Its root instructions explicitly allowed visual reorganization unless preservation
   was requested. Refinement anchored architecture and previous pixels but gave no
   canonical Furniture-layout authority. All three references already included Furniture.
2. **Root-cause analysis:** the root contract contradicted the newly explicit product
   invariant, and provider translation discarded available spatial/category facts.
   Supporting reference roles emphasized architecture alone. Refinement's preserve
   rule could retain root layout mistakes and did not explicitly require visible target
   change. These are evidence-backed deterministic weaknesses, not proof that prompting
   alone accounts for observed model behavior. Visibility omission was not found; visual
   conditioning/model limitations remain possible and require owner acceptance.
3. **Invariant implemented:** canonical existing Furniture is intentional layout in both
   root and refinement instructions. Preserve category/definition role, center position,
   rotation, approximate footprint/dimensions, arrangement and relevant spatial
   relationships by default. This is no longer optional inspiration.
4. **Constraint hierarchy:** immutable architecture → default-preserved Furniture
   layout with explicit visual exceptions → generative styling. Architecture includes
   Room footprint, boundary/internal Walls, Doors, Windows, Wall Openings, Stairs,
   elevations, dimensions and connectivity. Furniture is not immutable architecture.
5. **DesignContext changes:** immutable catalog definition name/category when known;
   unknown categories remain unresolved; translated local centers, one nearest boundary
   relation per item, layout intent/frame and bounded nearby pair relations. Effective
   instance dimensions and raw arbitrary-degree yaw remain authoritative. No ProjectSchema
   fields, renderer dependencies or external catalog inference were introduced.
6. **Spatial representation:** stable-ID F1…Fn labels; ordered B1…Bn boundary endpoints;
   translation-only origin at B1 start, canonical axes retained; explained center,
   dimensions and yaw convention. Nearest finite segment distances and width-axis
   relations work for rotated, concave and irregular perimeters and free edges. Center
   distances are explicitly not footprint-clearance/containment/functional claims.
   Select two nearby relations per item, deduplicate, retain 24 shortest globally with
   deterministic ties. All items stay in context; pair prose cannot grow quadratically.
   Pair enumeration/sorting costs O(n² log n) worst-case CPU work, documented separately
   from the bounded prompt output.
7. **Initial prompt hardening:** removed the rearrange-unless-preserved rule. Root
   instructions now preserve layout by default and permit visual styling. Axonometric
   and Interior B explicitly carry Furniture layout evidence without replacing Interior
   A's camera. An empty additional preserve list no longer implies layout freedom.
8. **Refinement hardening:** previous Proposal is current visual design state; fresh
   canonical Furniture context is spatial authority. Canonical layout wins over
   conflicting previous pixels. Base camera/composition remains stable; supporting
   views supply architecture/layout, never another design state.
9. **Delta adherence:** explicit target-must-change-visibly rule; “Change only the bed”
   means a clearly different bed design at canonical placement/orientation. Preservation
   does not justify an unchanged target. Narrow instructions strongly preserve non-target
   content; broad design deltas receive only their implied scope. No keyword parser or
   second classification request was added.
10. **Explicit layout override:** requested movement/removal/category replacement or a
    different arrangement may change Proposal pixels for the requested scope only.
    Styling alone does not authorize rearrangement. “Create more free space” allows the
    changes needed for that goal. The integrated test requests moving only the desk and
    verifies the entire canonical Project and revision remain unchanged by AI actions.
    Past pixels alone cannot authorize a persistent exception; owners can restate an
    intentional layout exception in later instructions.
11. **Canonical re-anchoring:** existing application services reload the authorized
    Project and derive context every turn. Tests require separate fresh context objects
    matching a newly derived current canonical context across root/refinements/branch.
    Historical base revisions remain blocked before provider work. No Proposal-derived
    geometry is trusted.
12. **Multi-turn safeguards:** a P1→P2→P3→P4 linear path plus root sibling is exercised
    structurally. Every turn receives the same authoritative current layout, architecture
    references, explicit base ID and saved base bytes. The owner rubric compares every
    turn with both predecessor and canonical truth. No automated image drift score is
    claimed or implemented.
13. **Branch independence:** root sibling uses P1 after later descendants exist; its
    instruction excludes another branch's beige-bed change. Different PNG/JPEG base
    artifacts prove selected-parent replay rather than latest-image global state.
    Reloaded parent/conversation IDs and history identities are asserted. Browser
    workflow navigates root/siblings/grandchild and reconstructs paths after reload.
14. **Provider/API semantics:** production request configuration is unchanged. Initial
    order: Interior A + Axonometric + Interior B. Refinement: previous Proposal +
    Axonometric + Interior A + Interior B. `action=edit`, one Responses request,
    `max_tool_calls=1`, parallel calls disabled, one output, zero SDK retries, no model,
    quality or generation fallback; local artifact replay and provider continuation
    isolation retained. No mask, input-fidelity, output-quality or model-setting change.
15. **Conversation/lineage regressions:** existing C1 database/unit and C2 72-case UI
    suite remain active: parent/child/grandchild/branch, reload, stale blocking, deletion
    conflicts/leaves, shared generation/refinement lock and stale async isolation.
    Durable identity uses conversation and parent lineage, not transient session fields.
16. **Persistence/security regressions:** signed JWT/Project ownership and cross-Project
    access checks, artifact authorization, safe history/provenance, compensation on
    disk/metadata failure, timeout/rate-limit normalization and no resubmission remain
    covered. Database tests use temporary stores and clean synthetic Projects; browser
    tests use the unmodified controllers, guards and repositories.
17. **Furniture-context tests:** synthetic Bed/Desk/Chair with differing dimensions,
    rotated Furniture, perpendicular pair, boundary proximity, translated rotated concave
    Room, unknown definition, negative multi-turn yaw, immutable Project/frozen context,
    Room/Level exclusions, deterministic sorting, changed center/yaw affecting derivation,
    unresolved boundary fallback and 80-item/24-pair bound. The AI package has 24 tests;
    provider suite has 45 including new hierarchy/translation/refinement contracts.
    All three camera plans and visibility masks are checked for Furniture inclusion.
18. **Zero-cost integrated workflow:** real signed JWT, API, PostgreSQL, temporary
    artifacts and fake provider exercise canonical Furniture → root → three successive
    refinements → root sibling → history/lineage reads → parent-delete conflict → stale
    revision conflict → leaf deletions. One fake invocation per action; fresh canonical
    context; explicit saved-image replay; no Project or revision mutation by AI actions.
    The focused HTTP suite passes all 12 tests.
19. **Playwright:** final result recorded in the validation table below. Chromium uses
    deterministic fake generation with retries 0, real login/API/database/artifacts,
    three canonical Furniture items plus excluded Room/Level items. Covers root,
    siblings/grandchild, duplicate-submit protection, reload, history, path/branch
    navigation, focus, 1050px layout, leaf deletion, parent conflict, canonical Furniture
    movement save and resulting UI/API stale blocking. No image quality assertions.
20. **Database/migrations:** Prisma schema valid; all nine existing migrations deployed,
    no pending migrations; status up to date; datasource-to-schema diff exits 0 with no
    difference. No schema or migration edits. Full database-backed suite result appears
    below; commands target only `casastudio_ai_b5`.
21. **Lint/test/build/diff:** results and exact commands below. Ordinary tests skip 58
    database-dependent API cases; dedicated database validation enables them. Existing
    Vite large-chunk, pg concurrent-query deprecation and fixture-only React/Three
    warnings are not Furniture quality claims or newly introduced product features.
22. **Defects fixed:** root preservation inversion, loss of category/position/orientation
    in provider prose, architecture-only reference guidance and weak target-change
    language. No production persistence/lineage/reference visibility defect was found.
    During validation, corrected a new test's transient-session assumption and projected
    a clear canonical floor point through the user camera because Furniture obscured
    the original Room click. Also asserted stale-input disabling without trying to fill
    that disabled control. No production camera/selection/UX change was needed.
    Sandbox HTTP/DB failures required approved escalation; concurrent DB workload hit
    transaction timing limits, so final database execution is serial.
23. **Remaining limitations:** image editing is probabilistic. Exact Furniture placement,
    exact “change only X” pixel preservation and cumulative fidelity cannot be
    mathematically guaranteed. Some Furniture may be occluded/small in individual
    references. Unknown external categories cannot be inferred safely. No live results
    from C3 establish visual correctness; owner acceptance remains mandatory.
24. **Post-MVP research:** if the owner still sees drift, record whether provider behavior,
    visual evidence, structured spatial conditioning, prompt ambiguity or API conditioning
    appears limiting. Depth/normals/segmentation/object masks/layout conditioning and
    CasaStudio adapters/fine-tuning are research notes only. No custom model, ControlNet,
    quality judge, ratings, training collection or external comparison service was built.
25. **No live provider call:** no OpenAI or other paid-provider generation, live image
    generation, credit consumption, paid validation call, automatic regeneration or
    subjective/manual image acceptance occurred. Provider tests inject mocked clients;
    integrated/browser runners remove paid-provider configuration and override the
    provider. Official documentation was read only.
26. **Exact owner benchmark:** follow the numbered
    [owner-only benchmark and worksheet](conversational-quality-validation.md#owner-only-manual-benchmark):
    root styling; green upholstered-bed child; black-chair sibling from root; beige-bed
    grandchild from the bed child; optional desk movement. It includes exact instructions,
    per-root/per-refinement criteria, canonical/global drift comparison, qualitative MVP
    thresholds and development-only observation records. No ratings product surface.
27. **Completion recommendation: READY FOR OWNER QUALITY ACCEPTANCE.** The deterministic
    Furniture contract, integrated workflow and regressions pass. Owner-paid visual
    quality acceptance remains separate. AI-C1 is complete;
    AI-C2's functional owner acceptance passed according to the supplied request. AI-C3
    does not grant itself visual acceptance. No further AI-C subphases were introduced.
28. **AI-D remains:** natural language → reviewed typed Furniture operations, canonical
    movement/rotation/category application and Apply Proposal to Project. Image-based
    C3 deliberately implements none of those capabilities or generative 3D.

## Official OpenAI documentation checked

Checked on 9 October 2026, before adapter-prompt changes. Official
[image prompting guidance](https://developers.openai.com/api/docs/guides/image-prompting)
supports explicitly separating requested edits from preserved identity/layout/composition.
The [Responses image-generation guide](https://developers.openai.com/api/docs/guides/tools-image-generation)
documents input references, forced edit action, output options, prompt revision and
multi-turn editing. The [edit API reference](https://developers.openai.com/api/reference/resources/images/methods/edit)
documents multi-image edits and current Sunburst edit/output settings. These are
documentation checks, not evidence that the CasaStudio visual benchmark passes.
The existing one-call Responses/artifact-replay strategy and configuration were retained.

## Validation results

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed, all six package tasks |
| `pnpm test` | Passed, all eleven tasks: web 780, API 182 + 58 DB skips, schema 460, geometry 62, AI 24, shared 1; version tests pass |
| `pnpm build` | Passed, all seven tasks; existing Vite large-chunk warning |
| `git diff --check` | Passed |
| AI/OpenAI focused tests | AI 24 passed; OpenAI 45 passed |
| Prisma validation | Valid |
| Migration deployment/status/diff | Nine existing migrations, none pending, up to date, no difference (exit 0) |
| Full database-backed API suite | 240 passed, 20 files, no skips (serial) |
| Furniture/lineage signed-JWT HTTP workflow | 12 passed |
| Milestone Playwright | 2 passed: AI-B regression and complete AI-C3 Furniture/conversation workflow, Chromium, retries 0 |
| Changed-code Prettier check | Passed |

```sh
node tools/ai-b5-validation.mjs db:validate
node tools/ai-b5-validation.mjs db:migrate:deploy
node tools/ai-b5-validation.mjs db:migrate:status
node tools/ai-b5-validation.mjs --filter @casastudio/api prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
node tools/ai-b5-validation.mjs --filter @casastudio/api test --maxWorkers=1
pnpm test:e2e --config playwright.ai-b5.config.ts
```

No Git add, commit, push, rebase or amend occurred. No owner Project was used or modified.
