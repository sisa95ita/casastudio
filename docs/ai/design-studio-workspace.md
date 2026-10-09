# AI-B4.1 — Design Studio workspace

AI-C2 extends this architecture with the [Proposal Review revision workspace](conversational-design-ux.md).
Review now owns refinement, revision paths and direct branch alternatives; the
Inspector stays high-level. The sections below record the original AI-B4.1 baseline.

The growing floating AI card obscured the house and put reference evidence, telemetry,
comparison, prompts and durable history in one crowded flow. The Designer now lives
in the existing right 3D Inspector. CasaStudio remains one Project workspace.

## Workspace and ownership

`ProjectWorkspacePage` already resolves canonical architectural selection, derives
one scene model, and supplies Inspector content through `useProjectWorkspaceShell`.
Desktop uses the shell's docked Inspector; tablet uses its existing inline Inspector
below the viewport. Phone retains the existing read-only overview restriction.
The shared shell now mounts either the docked Inspector or its compact drawer, never
both. Stateful Inspector tools must have one mounted owner.

`Project3DViewer` owns the Three.js renderer and deterministic reference capture. It
publishes the existing capture callback through `ProjectWorkspaceCanvas` to the
workspace; it renders no Designer inside the canvas. `Project3DInspector` owns the
Properties/Designer MUI tabs. The workspace page owns the single-flight generation
guard, surviving responsive Inspector remounts as well as Room deselection. Existing
Properties content, including Furniture editing and all architectural selection
details, is unchanged. Properties remains the initial mode.

The Room panel stays mounted behind a hidden tab panel across mode switches. A mode
switch neither clears comparisons nor loads history, refreshes references, or calls
generation. Preparation/history loading still happens for canonical Room selection,
independently of mode. No Room or a non-Room selection gives an explicit Designer
empty state; there is no pinned target. Deselecting a Room unmounts its panel but
keeps the workspace generation guard until any in-flight request settles. Selecting
a different Room, changing scene/capture identity, editing normalized direction or
refreshing local references retains the B3/B4 epoch invalidation rules. Late results
never re-enter obsolete session comparisons.

## Main task and focused surfaces

Designer follows: target Room → Design direction → Generate/Try another → essential
status/error → compact current proposal and session selectors → saved-design summary
→ reference readiness. It contains no permanent reference thumbnails, telemetry,
history list, deletion controls, or saved prompt/revision detail.

- **Reference inspection:** explicit dialog with the three evidence views, local
  Refresh, preparation/failure feedback, and existing contained reference previews.
  Refresh clears session comparisons, preserves durable history, and makes zero AI
  requests. It remains disabled during generation/preparation.
- **Proposal Review:** near-full-width MUI dialog with a dominant contained artifact,
  secondary direction/date/revision information, Generation details disclosure,
  current-session selectors, and saved-proposal deletion. Selecting a proposal
  updates both artifact and normalized details without generation. Escape/Close
  restores focus. A missing/stale proposal has an explicit recovery message.
- **Room Design History:** dedicated wide MUI dialog, newest-first bounded metadata
  page, date/direction/revision indication, selectable proposal, one useful thumbnail
  preview, Open design, confirmed deletion, Refresh and Older designs. All durable
  records on the page appear, including records also present in the session. They
  retain the same stable IDs; different surfaces do not create duplicate records.

`ProposalArtifactView` owns only artifact presentation; `ProposalReview` owns the
review composition; `RoomDesignHistory` owns the history presentation; the Room
panel coordinates session, selection and API actions. Today the artifact is an image.
Future layout/material/3D viewers can extend this presentation boundary without
replacing the Designer flow. No speculative artifact types, generative 3D, canonical
Apply action or new production contracts have been introduced.

## Lifecycle, requests and layout

The original `useRoomDesignHistory` and `useDesignArtifact` behavior is retained.
History keeps one metadata page (20 records); selecting a saved record fetches one
authenticated Blob, whose object URL is shared across thumbnail and Review. The
history list does not eagerly download all full-resolution artifacts. Aborting old
reads and revoking URLs on replacement, retry, deletion, scope change and unmount
remain unchanged. Closing history restores the active session artifact or releases
the historical artifact when no session proposal exists.

Generate and Try another each request exactly one generation, only on explicit
click. No automatic retries, variants, fallback, continuation or hidden generation
were added. At most three current-session comparisons remain, with the original
rolling eviction behavior. Pending generation remains indeterminate; the prior
proposal can be reviewed while Try another waits. Normalized errors stay in the
action area without replacing prior proposals or saved history. History, deletion,
reference preparation and Review do not modify ProjectSchema or Project revision.
Backend, provider, persistence, budgets and storage interfaces are unchanged.

Desktop Inspector width uses `clamp(340px, 28vw, 390px)` within the existing grid.
It consumes workspace width rather than covering the viewport. Tablet keeps the
existing inline layout. Text wraps; direction is bounded to 2,000 characters with
3–6 visible rows. Review/History details stack at smaller widths; images preserve
aspect ratio with `object-fit: contain`. No resize handles or new sidebar were added.
Tabs have selected states and associated tab panels. Proposal selectors are native
buttons with pressed states; surfaces have labels, shortcut scopes and focus
management from MUI. Progress uses polite live announcements; errors use Alert.
Confirmation starts on Cancel and disables duplicate deletion while pending.

## Owner-only manual acceptance — zero paid calls

Agents must not perform manual visual acceptance or live provider calls. The
following procedure belongs to owners; automated checks do not claim visual UX
acceptance.

1. Use your development/test database, apply existing migrations with
   `pnpm db:migrate:deploy`, configure the existing `AI_ARTIFACT_DIRECTORY`, and
   start API/web normally. Leave `AI_PROVIDER` and `OPENAI_API_KEY` unset.
2. Choose a Project with two canonical Rooms, record its revision, and retrieve its
   Project/Level/Room IDs from canonical JSON or the authenticated Project response.
   Run `pnpm db:seed:design-history <project-id> <level-id> <room-id>` for each Room.
   This existing development-only utility creates two local deterministic PNG
   fixtures, at current and previous revisions, without provider calls or Project
   mutation. These are workflow fixtures, not design-quality baselines.
3. Open 3D. Select Room A. Confirm the canvas has no floating Designer card and the
   house shares space cleanly with the existing Inspector. Properties should show
   the Room's current details. Select Wall, Stair and Furniture and confirm their
   existing Properties inspection/edit behavior.
4. Open Designer with no Room selected, then select Room A. Confirm the empty state
   and target name. Type a long direction, switch Properties ↔ Designer, and confirm
   the text remains. **Do not press Generate or Try another.**
5. Confirm the primary direction/action flow is compact. Reference thumbnails,
   detailed telemetry, saved prompts and Delete should be absent from the normal
   sidebar. Inspect references, open each of the three previews, Escape/Close, and
   Refresh locally. Confirm no generation POST is sent in browser network tools.
6. Confirm the saved count; open View history. Confirm Room A fixtures, newest-first
   order, dates and historical/current revision labels. Select one, inspect its
   thumbnail, open Proposal Review, read direction/revision/Generation details, and
   verify image containment without crop. Close with Escape and with Close; verify
   focus returns to the initiating control. Reopen another fixture without generation.
7. Switch to Room B and confirm Room A content disappears and the proper history
   loads. Switch back and reload; durable fixtures should remain. Inspect no-Room
   and no-history states. Closing/reopening Review and History must send no
   generation requests.
8. In History or Review, cancel deletion first. Then confirm deletion of a fixture.
   Confirm history/preview updates, the artifact is no longer available through its
   authorized route, and Project revision/geometry match the recorded values.
   No generation POST should appear. Delete remaining fixtures after acceptance.
9. Use Tab, arrow keys on Inspector tabs, Enter/Space on buttons, and Escape in
   dialogs. Confirm focus restoration and that editor shortcuts do not change the
   Project while working inside Designer/dialogs. Repeat at desktop and a tablet
   width below 1200px, including long direction, long saved prompt and stacked
   Review details. Phone retains the existing overview-only limitation.
10. Current-session comparison requires an existing session or the mocked test
    harness: persisted fixture history alone does not create transient comparisons.
    Automated tests cover four fake generations with three retained comparisons,
    switches in sidebar/Review, mode persistence and pending locks. An optional
    paid owner acceptance is a separate, explicit owner decision: generate once,
    confirm its saved/session identity, then optionally request alternatives within
    the chosen budget. Codex must not perform these calls. Check history/billing
    after ambiguous failures before choosing another paid action.

## Limitations and subsequent work

The summary counts the loaded page and states when more designs exist; the API has
no global count. History has one selected thumbnail rather than full-resolution
thumbnails for every row. Smaller layouts use stacked dialogs/inline Inspector;
phone design authoring and drag resizing remain outside this phase. Switching
between desktop and tablet Inspector placements can remount and reset presentation
and transient session state; the workspace-owned generation lock survives. A persisted
revision comparison cannot describe unsaved geometry edits. Sessions remain transient
and disappear on Room/scene changes or reload, as before. Storage/crash/pagination
limits remain those documented in [AI-B4](durable-design-proposals.md).

AI-B5's next scope should be set from owner acceptance and existing quality/cost
findings; this phase adds no new quality experiment or provider capability. AI-C
still owns conversational iteration, continuation and scoped follow-up edits. Typed
Furniture application and generative 3D are future work, not implemented features.

## Automated verification

The focused Designer/Inspector/shell suite passed 60 tests. The full web suite
passed 747 tests, including 118 workspace tests. `pnpm lint`, `pnpm test`,
`pnpm build` and `git diff --check` passed. The API suite reported 27
database-dependent skips. No live provider calls or manual visual acceptance
occurred. See the [24-point implementation report](ai-b41-implementation-report.md)
for changed files, coverage, validation and remaining scope.
