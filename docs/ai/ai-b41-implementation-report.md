# AI-B4.1 implementation report

1. **Workspace found:** `ProjectWorkspacePage` derives the canonical scene/selection;
   `ProjectWorkspaceCanvas` mounts the lazy 3D viewer; `useProjectWorkspaceShell`
   projects Inspector content into the existing desktop shell. Tablet already has
   an inline Inspector below its canvas. No parallel workspace was added.
2. **Retired presentation:** the Room Designer was a floating `Paper` inside the
   canvas, absolutely positioned at its top right, with references, prompt, saved
   list, comparison, preview and telemetry competing in a 330px card. Its canvas
   placement and overlay CSS are removed.
3. **Inspector modes:** existing MUI Tabs expose Properties and Designer with
   associated panels. Properties starts selected. Designer remains mounted while
   its tab is hidden. The shell mounts only one Inspector placement at a time.
4. **Properties preservation:** existing Project/Level summary and Room, Wall,
   Door, Window, Wall Opening, Stair and Furniture inspection remains. Furniture
   editing retains the existing controller, units and editable gate.
5. **Designer hierarchy:** Room target, Design direction, explicit Generate/Try
   another, essential progress/errors, compact current proposal and selectors,
   saved count/View history, reference readiness/Inspect references.
6. **References:** dedicated inspection dialog exposes all three views and local
   Refresh. Existing individual contained previews remain. Refresh clears session
   comparisons and never requests AI generation.
7. **Session UX:** up to three rolling comparisons, stable proposal IDs and native
   pressed-state selectors. Selecting alternatives never submits generation.
8. **Review:** `ProposalReview` composes contained artifact, date/direction/revision,
   normalized Generation details, session selectors, Close and saved-design deletion.
   Switching comparison updates artifact and metadata together. Stale/missing
   proposals have a recovery message rather than silently showing another design.
9. **Artifact seam:** `ProposalArtifactView` only renders the current image artifact
   or loading/error/retry state. Future richer viewers can extend that boundary;
   no fake 3D contracts or new capability were introduced.
10. **History:** `RoomDesignHistory` shows one newest-first metadata page, date,
    direction, current/historical revision indication, a selected thumbnail preview,
    Open design, confirmed Delete, Refresh and Older designs.
11. **Identity:** session/history refer to the same durable ID and metadata record.
    History includes the current session's saved records once each. Deletion removes
    the ID from both collections and closes an affected Review or leaves valid
    remaining session selection. Project data/revision is untouched.
12. **Telemetry:** retained normalized provider, models, mode, timestamp, duration,
    output dimensions/format/quality, usage and optional cost, exclusively within
    Review's details disclosure. Raw payloads are not rendered.
13. **Selection:** Designer consumes only canonical Room selection. Deselecting or
    selecting another entity shows the intentional empty state. Room/scene/capture
    changes retain B3/B4 invalidation and stale-completion suppression. The workspace
    page owns the generation lock so Inspector placement changes cannot unlock a
    pending request; the hook returns stable memoized state for shell registration.
14. **Layout:** desktop grid width uses `clamp(340px, 28vw, 390px)`, sharing space
    with the viewport. Tablet retains the existing inline Inspector. Dialog content
    stacks responsively, long text wraps and the textarea has 3–6 visible rows.
15. **Accessibility:** labeled tabs/panels, selected/pressed states, titled dialogs,
    native controls, MUI focus trap/restoration, Escape/Close, initial Cancel focus,
    progress live announcements, Alert errors and existing editor shortcut scopes.
16. **Resources:** unchanged artifact hook loads only selected authenticated bytes,
    shares its URL with preview/Review, aborts stale reads and revokes URLs on
    replacement/deletion/retry/scope change/unmount. History does not download all
    full-resolution images. Closing History restores the current session artifact
    or releases the historical artifact if no session proposal exists.
17. **Backend:** no backend, schema, provider, persistence, artifact store or API
    changes. Generation remains one request per explicit action with no retries,
    fallback, parallel variants or navigation-triggered generation.
18. **Files changed:**
    - `apps/web/src/features/project-3d/AiRoomDesignPanel.tsx`
    - `apps/web/src/features/project-3d/Project3DInspector.tsx`
    - `apps/web/src/features/project-3d/Project3DViewer.tsx`
    - `apps/web/src/features/project-3d/useDesignGeneration.ts`
    - `apps/web/src/features/project-3d/ProposalArtifactView.tsx` (new)
    - `apps/web/src/features/project-3d/ProposalReview.tsx` (new)
    - `apps/web/src/features/project-3d/RoomDesignHistory.tsx` (new)
    - `apps/web/src/features/projects/workspace/ProjectWorkspacePage.tsx`
    - `apps/web/src/features/projects/workspace/components/ProjectWorkspaceCanvas.tsx`
    - `apps/web/src/shell/AppShell.tsx`
    - `apps/web/src/styles.css`
    - `apps/web/src/core/i18n/locales/en/project-viewer.json`
    - `apps/web/src/features/project-3d/AiRoomDesignPanel.test.tsx`
    - `apps/web/src/features/project-3d/Project3DInspector.test.tsx`
    - `apps/web/src/features/projects/workspace/ProjectWorkspacePage.test.tsx`
    - `apps/web/src/shell/AppShell.test.tsx` (new)
    - `docs/05-ai-integration.md`
    - `docs/ai/durable-design-proposals.md`
    - `docs/ai/design-studio-workspace.md` (new)
    - this report (new).
19. **Tests:** mocked proposal tests now exercise secondary references/history,
    Review metadata and switching, lazy Blob sharing/revocation, deletion, empty
    states, scoped history, stale completions, normalized errors, request counts,
    focus/keyboard behavior, long direction, three-comparison retention and locks.
    New integration coverage uses the real Inspector/renderer boundary to assert
    no Designer within the canvas, target selection and mode persistence. Shell
    coverage asserts a single desktop/compact Inspector owner. Existing general
    Properties and workspace suites remain intact, with the old no-tabs assertion
    updated. Live fetch is prohibited in the Designer UX suite. No API key is needed.
20. **Validation:**
    - `pnpm lint`: passed, 6 tasks.
    - `pnpm test`: passed, 11 tasks. Web: 747 tests in 66 files, including all 118
      workspace tests. API: 171 passed and 27 database-dependent tests skipped.
      Shared/schema/geometry/AI and build-version suites passed; unchanged tasks
      reused the repository's normal Turbo cache.
    - `pnpm build`: passed, 7 tasks. Vite retains its large-chunk warning.
    - Focused Designer/Inspector/shell run: 60 tests passed in 3 files.
    - `git diff --check`: passed.
    - No manual browser visual acceptance or Playwright visual acceptance was run.
21. **Provider policy:** no live OpenAI/provider calls, live image generation or API
    credit consumption occurred. Generation actions were exercised only against
    mocks. No staging, commit, push, rebase or amend was performed.
22. **Manual acceptance:** owners should follow the exact ten-step
    [zero-paid-call fixture procedure](design-studio-workspace.md#owner-only-manual-acceptance--zero-paid-calls).
    It covers migration/configuration, deterministic fixture seeding, viewport and
    Properties inspection, empty/target states, references, history/Review,
    Room switching/reload, confirmed deletion/unchanged revision, keyboard/focus and
    tablet sizing. Session comparison is covered by mocks; any paid acceptance is
    a separate explicit owner decision. Manual UX acceptance is still outstanding.
23. **Remaining limits:** page-local saved count plus a more-available indication
    because the API has no total count; one selected history thumbnail instead of
    per-row full-resolution downloads; existing phone overview restriction; session
    proposals remain transient, and moving between desktop/tablet placements can
    remount/reset presentation/session state while preserving the pending-request
    lock. Revision status cannot represent unsaved geometry changes. Existing B4
    storage/crash/pagination limitations remain.
24. **Next phases:** AI-B5 scope remains for owners to establish from acceptance and
    quality/cost findings. AI-C still owns chat, continuation and scoped follow-up
    editing. Generative 3D, typed Furniture application and Apply Proposal are not
    implemented by this presentation phase.
