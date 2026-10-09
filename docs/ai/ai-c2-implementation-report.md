# AI-C2 implementation report — 9 October 2026

AI-C2 is implemented / pending owner acceptance. AI-C1 is complete; AI-C3 is not
started. Exactly these three AI-C phases remain. Changes are unstaged.

1. **Existing architecture:** AI-B4.1 already separates docked/inline 3D Inspector
   Properties/Designer tabs, a high-level Room Designer, transient comparison,
   Proposal Review, durable Room history, artifact presentation and authenticated
   Blob loading. The workspace owns the single-flight work guard. C1 already supplies
   typed refinement, paginated conversation metadata, parent IDs and normalized
   stale/descendant conflicts. The existing architecture is extended.
2. **Refinement UX:** Proposal Review now places a labeled Refine this design area
   below its dominant generic artifact and revision controls, with a labeled Design
   change input and explicit Generate revision action. It submits through C1 only.
3. **Explicit base:** Root proposal/Revision N and the saved instruction identify the
   selected base. One selection drives artifact, details, path, children and API
   Proposal ID. Navigation updates the base; no hidden previous selection is used.
4. **Pending/success/failure:** Nonblank trimmed input and synchronous duplicate
   guards protect submission. Pending retains the base and announces original Room/
   base with indeterminate progress and honest close behavior. Success activates
   the durable child and refreshes lineage/history. Failure retains draft/base and
   sanitized guidance, with no automatic retry or fabricated success.
5. **Revision path:** Parent IDs from paginated C1 reads define the selected ancestry.
   Native selected-state buttons navigate it. Turn order labels distinguish revisions
   within a lineage; neither dates nor Room archive order determine edges.
6. **Direct branches:** A separate Other revisions from this proposal group contains
   only direct children, with their producing change instructions. Long selector text
   truncates; accessible names, titles and selected details retain full text.
7. **Older-base branching:** Selecting any eligible ancestor/root then submitting
   creates its child. P1 has sibling P2/P3; P2 has P4. P3 never appears in P4's path.
8. **Try another:** Keeps the existing initial-generation route, direction/references,
   rolling three session comparisons and independent roots. Refinement children do
   not acquire artificial parentage or become unrelated session alternatives.
9. **Room history:** Remains a bounded metadata archive; adds Root design/Revised
   design indicators. New children insert by durable identity without reload. Opening
   saved proposals reconstructs lineage; navigation does not refetch all Room history.
10. **Stale geometry:** Historical artifact/path/provenance remain available; refinement
    blocks with clear current-Room guidance. Unsaved edits also block refinement.
    A normalized server stale conflict remembers the affected revision in this Room
    context, blocking resubmission even when navigating away and back. No override.
11. **Draft lifecycle:** Local per-base state only. Successful submission clears;
    failure preserves; switching Proposal or closing Review clears. Room/context
    changes and responsive unmount clear drafts. Unsent drafts never reach the DB.
12. **Deletion:** Known parents are disabled in Review/History; authoritative C1
    conflicts remain announced in confirmation for concurrent/unloaded descendants.
    Leaves remove history/session/branch state and close their selected Review,
    releasing the existing artifact resource. No recursive deletion.
13. **Locking:** Refinement reuses workspace-owned `useDesignGeneration`, synchronously
    shared with Generate/Try another. A local synchronous refinement guard also keeps
    duplicate events from disturbing pending status. Work survives mode/Room changes
    with the shared guard; there is no distributed/global lock.
14. **Late results:** Selection epochs plus mounted/context/current-Proposal/visible
    checks prevent navigation, close, Room switch, Properties mode or deselection
    from having their current UI replaced. Valid server results remain durable and
    are discoverable through original Room history.
15. **Accessibility:** MUI focus trap/restoration and editor shortcut scopes retained;
    section/input/action labels, polite progress, alert errors, keyboard-native branch
    buttons with `aria-pressed`, stale explanations, Cancel-first deletion focus.
16. **Layout:** Artifact precedes controls and keeps its contained available height;
    secondary details/telemetry remain in the existing side column or stacked layout.
    Dialog scroll and 2–5 textarea rows accommodate long instructions; compact lineage
    labels truncate. Desktop and 1050px workflow are exercised without image grading.
17. **Frontend/API:** Adds metadata hook and Review components, wires C1 client methods,
    updates panel selection/errors/locking/history, and propagates unsaved state and
    Inspector mode. No new API route, DTO, provider contract or client method needed.
18. **Backend:** No production backend changes. The separate AI-B5 test launcher adds
    fake `refineDesign` and invocation diagnostics (operation/base ID) so browser tests
    use real C1 API/persistence with deterministic images. Models, OpenAI strategy,
    storage, ProjectSchema and budget limits are unchanged.
19. **Changed files:** See the inventory below; no dependency or migration changes.
20. **Tests:** Extends existing panel suite from 54 to 72 cases (18 new), covering
    root/pre-C eligibility, trim/duplicate/pending/success/failure, pagination,
    parent/sibling/grandchild paths, selection/drafts, stale/unsaved state, deletion,
    late completion across four contexts, shared initial/refinement locking,
    descendant conflict recovery, long instructions, secondary telemetry and read
    retry. Existing artifact/focus/session tests stay active. Adds a complete durable
    AI-C2 Playwright workflow and adapts existing AI-B assertions to the new controls.
21. **Validation:** Final command results are recorded below. Database/browser runs
    required approved sandbox escalation for local database/server access; their
    successful reruns use the disposable `casastudio_ai_b5` database. Initial failures
    were sandbox access and test adjustments (duplicate text lookup, a test locator
    type, and the existing responsive Inspector remount). No paid provider retry or
    fallback occurred.
22. **No live provider calls:** No OpenAI or paid provider invocation, live image
    generation, credits consumption, subjective image-quality acceptance or owner
    manual acceptance occurred. Tests use mocks/fake provider/fixtures only.
23. **Owner procedure:** Follow the numbered procedure in
    [Conversational Design UX](conversational-design-ux.md#owner-manual-acceptance-procedure):
    save a simple Room, explicitly budget P1 plus three changes, create P2 from P1,
    P3 from P1, P4 from P2, verify reload/path/siblings/focus/deletion/staleness. A
    Bedroom with Bed/Table/Chair is guidance only. Owner authorization of paid
    acceptance is separate; Codex must not perform it.
24. **Known limits:** Desktop/tablet Inspector remount can close Review and clear local
    state/drafts; reopen durable history afterward. History shows a bounded page,
    not total counts. Lineage loads all metadata pages on open/refresh, so very large
    conversations incur multiple reads. External mutations refresh on reopen/read
    retry rather than subscriptions. Ambiguous HTTP outcomes still require checking
    saved history. Phone authoring and branch graphs/merges/deletion are absent.
25. **C3 handoff:** The workflow now supports expressing, navigating, persisting and
    branching changes. C3 remains responsible for explicitly authorized multi-turn
    fidelity/drift/quality validation and final conversational validation. No claim
    that only the requested object changed or that multi-turn visual preservation
    passed. No AI-D canonical operations or Apply Proposal were introduced.

## File inventory

- `apps/web/src/features/project-3d/AiRoomDesignPanel.tsx`
- `apps/web/src/features/project-3d/ProposalReview.tsx`
- `apps/web/src/features/project-3d/ProposalRevisions.tsx` (new)
- `apps/web/src/features/project-3d/useProposalLineage.ts` (new)
- `apps/web/src/features/project-3d/RoomDesignHistory.tsx`
- `apps/web/src/features/project-3d/Project3DInspector.tsx`
- `apps/web/src/features/projects/workspace/ProjectWorkspacePage.tsx`
- `apps/web/src/core/i18n/locales/en/project-viewer.json`
- `apps/web/src/features/project-3d/AiRoomDesignPanel.test.tsx`
- `e2e/ai-b5-workflow.spec.ts`
- `tools/ai-b5-server.mjs`
- `docs/06-roadmap.md`
- `docs/05-ai-integration.md`
- `docs/ai/design-studio-workspace.md`
- `docs/ai/durable-design-proposals.md`
- `docs/ai/conversational-design-ux.md` (new)
- `docs/ai/ai-c2-implementation-report.md` (new)

## Validation results

| Check | Result |
| --- | --- |
| `pnpm lint` | Passed; all 6 package tasks |
| `pnpm test` | Passed; all 11 tasks; web 778, API 179, schema 460, geometry 62, AI 21, shared 1 tests passed; API's ordinary run skips 58 DB-dependent cases |
| Focused Designer/Review suite | 72 passed, including 18 added C2 cases; final stale-navigation case also rechecked after correcting its test locator type |
| `pnpm build` | Passed; all 7 tasks; existing large-chunk warning remains |
| `git diff --check` | Passed |
| `node tools/ai-b5-validation.mjs db:migrate:deploy` | Existing C1 migration applied to disposable database |
| Fake HTTP workflow + database lineage suites | 31 passed, no skips, with real PostgreSQL and temporary artifact storage |
| `pnpm test:e2e --config playwright.ai-b5.config.ts` | 2 passed: AI-B regression and AI-C2 durable branching workflow, Chromium, retries 0 |

Database suite command:

```sh
node tools/ai-b5-validation.mjs --filter @casastudio/api test src/ai/api/design-workflow.integration.test.ts src/ai/persistence/design-lineage.integration.test.ts
```

The timed-out development browser run left one synthetic fixture in the disposable
validation DB; it was removed by its exact ID/name with a database-name guard.
Successful workflows clean their own synthetic Projects and artifacts. No owner
Project was used or modified. All repository changes remain unstaged; no Git add,
commit, push, rebase or amend occurred. Owner acceptance is pending; C3 not started.
