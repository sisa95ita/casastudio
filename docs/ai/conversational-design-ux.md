# AI-C2 — Conversational Design UX

Implemented, pending owner acceptance. AI-C has exactly C1 (Conversation & Proposal
Lineage), C2 (Conversational Design UX), and C3 (Conversational Quality & Validation).
C1 is complete; C3 has not started.

## Proposal Review is the revision workspace

The existing Design Studio remains in the 3D Inspector. It owns the target Room,
initial Design direction, Generate design, Try another, current proposal summary,
Open design, and saved history access. Proposal Review owns the selected artifact,
revision path, direct derived revisions, refinement input, provenance and details.
This keeps the Inspector compact and preserves AI-B4.1 composition and generic
`ProposalArtifactView`. Operations target a durable Proposal ID, never an image DOM
node. Room → Proposal → Design change → Revised Proposal is the product model;
there are no chat bubbles, assistant/user messages, or internal conversation IDs.

**Try another** generates an independent alternative using the original direction
and captured Room context through the existing initial-generation API. It does not
create parentage between session alternatives. **Refine this design** submits a new
change instruction against the explicitly selected saved Proposal through C1's
`refineRoomDesign`. A historical AI-B root behaves like any other eligible root;
C1 creates its lineage lazily when the first child is persisted.

The Review action area shows “Refining: Root proposal” or “Refining: Revision N”,
together with that base's saved instruction. Revision numbers are durable C1 turn
numbers within the lineage, not depth or a claim that siblings are sequential.
They can have gaps after deletion. The root remains labeled Root proposal. The
artifact, details, ancestry, direct children and submission ID follow one selection.

## Paths and branching

“Current revision path” contains only ancestors of the selected Proposal, following
explicit parent IDs from the typed lineage API. “Other revisions from this proposal”
contains only direct children of that selected base. Selecting a path step or direct
child updates the artifact, metadata and refinement base, without generation. Return
to an older root or intermediate revision to create a sibling branch from it.
P1→P2→P4 never presents sibling P3 as P4's ancestor. A child shows its full design
change in details and a Derived from label. Compact selectors truncate long text;
full instructions remain accessible in button names, titles and selected details.

The metadata hook pages the existing C1 conversation API until all available turns
are loaded; it does not derive edges from time, flatten descendants or read raw DB
records. Navigation within a loaded lineage uses cached metadata. Reopening Review,
successful refinement and deletion refresh lineage metadata; none generate images.
Reloading and history opening reconstruct lineage from durable APIs. History remains
a bounded Room archive with compact Root design/Revised design indicators.

## Submission, drafts and recovery

A nonblank trimmed Design change is required. Generate revision is explicit, with a
synchronous guard and the existing workspace-owned single-flight generation guard.
Initial generation, Try another and refinement share that guard across Room changes,
deselection and responsive Inspector remounts. There is no retry, variant, hidden
planning request or provider fallback. Pending keeps the base visible, announces the
original Room/base with indeterminate progress, disables generation and deletion,
and explains that closing Review does not cancel generation. Loaded revisions remain
available for read-only navigation.

Drafts are local component state keyed by selected Proposal ID. Success clears the
submitted draft; failure preserves it for correction or an explicit retry. Selecting
a different Proposal, closing Review, or leaving its Room clears an unsent draft.
Drafts are never persisted. On success, the durable child becomes the active Review
and Inspector proposal, history inserts the same identity without reload, and the
lineage read refreshes. Refinements do not become independent session alternatives.

A selection epoch invalidates auto-selection after navigation, close, Room/scene
change, or Designer→Properties. A mounted original Room can still add the durable
result to its history, but cannot replace another selection. After unmount, the
server result stays durable and is discoverable by reopening history. Mode switches
close Review/History while retaining the mounted Designer's ordinary session state.

Historical geometry stays viewable with its historical revision indicator and
lineage. Refinement is blocked with: “The Project geometry has changed since this
design was generated. Start a new design from the current Room to continue.” There
is no Refine anyway. Unsaved Project edits also block refinement until saved, so
local draft references cannot masquerade as current persisted architecture. Server
revision/authorization validation remains authoritative. A normalized stale response
blocks the current base; provider and authorization failures show sanitized messages.
Rate-limit guidance and the existing warning that persistence failure may follow
completed paid work are retained. Failures do not erase parents or fabricate children.
Check history after an ambiguous response before choosing another paid request.

Parents with known direct children cannot be deleted in Review or History. Unknown
or concurrent descendants are protected by C1's authoritative conflict, announced in
the confirmation alert. No recursive deletion exists. Deleting a leaf removes its
history/session identity, invalidates cached branches, closes its selected Review,
and clears selection. The existing abort/revoke Blob lifecycle releases its artifact
resource; the authorized artifact route no longer serves it.

## Accessibility and layout

Review remains a MUI focus-trapped dialog with shortcut scope, labeled refinement
section and textarea, explicit Generate revision name, progress status, alert errors,
and native branch buttons with `aria-pressed`. Closing restores focus to its opening
control; delete confirmation starts on Cancel. Telemetry remains an initially
collapsed Generation details accordion. The contained artifact precedes controls
and retains its available height. Details sit in the existing 280px secondary column
on desktop and stack below the artifact/workflow on narrow widths. Dialog content
scrolls; multiline input is bounded to 2,000 characters and 2–5 visible rows.

The existing shell remounts Inspector across the desktop/tablet breakpoint. This can
close Review and clear presentation state/drafts, but retains the shared work guard
and durable results. Reopen the Proposal from history at the new width. Phone design
authoring remains outside existing supported behavior. Very large lineages require
multiple metadata pages; no graph editor or incremental branch expansion is added.
External mutations appear on reopen/refresh rather than live subscriptions.

## Zero-cost automated acceptance

`pnpm test:e2e --config playwright.ai-b5.config.ts` runs the existing AI-B regression
and new AI-C2 workflow against `casastudio_ai_b5`, real JWT authorization, PostgreSQL,
filesystem artifacts and the development-only fake provider. The launcher strips
`OPENAI_API_KEY` and `AI_PROVIDER`; no normal provider development hook was added.
Apply existing migrations first with `node tools/ai-b5-validation.mjs db:migrate:deploy`.
The workflow creates its own synthetic Project; it never uses the owner's Bedroom.

The browser generates fake P1, opens saved history, refines P1 into P2, closes/reopens,
returns to P1 and creates sibling P3, then refines P2 into P4. It verifies one request
per action despite duplicate events, ancestry versus siblings, persisted reload,
keyboard branch selection, focus restoration, narrow layout/long input, parent delete
blocking, leaf deletion and branch removal, and unchanged canonical Project. Fixtures
are structural evidence, not visual-quality acceptance.

## Owner manual acceptance procedure

This procedure is guidance only. Owner acceptance is pending. No live generation is
authorized for Codex. Owners choose provider configuration and an explicit budget
separately before pressing paid generation actions.

1. Prepare a disposable/simple Room and save the Project. For example, a Bedroom
   containing a Bed, Table and Chair; these objects and names are not requirements.
   Record the Project revision and choose a bounded budget of one root and three
   explicit revisions. Use the fake browser workflow above for zero-cost structure.
2. In 3D select the Room, open Designer, enter an initial direction, generate P1
   once, and Open design. Confirm the root, current revision provenance, collapsed
   telemetry and labeled refinement base. Do not use Try another for refinement.
3. From P1 request “Change only the bed” once, creating P2. Verify pending keeps P1
   visible, then P2 is active, the draft clears, Derived from points to the root,
   and the path has P1→P2. Close/reopen from history; verify the same saved IDs/path.
4. Select P1 in the path and request “Keep everything but replace the chair” once,
   creating P3. Return to P1 and verify P2 and P3 are direct siblings.
5. Select P2 and request “Make the bed more minimal and use beige textiles” once,
   creating P4. Verify P1→P2→P4, without P3 on that path. Reload and open P4 from
   history to confirm durable branching. Navigation alone must send no generation.
6. Verify a parent cannot be deleted. Cancel a leaf deletion, then delete a leaf
   and confirm history/branch removal and no generation. Check keyboard Tab/Enter/
   Escape, focus return, editor shortcut isolation and a long draft at desktop and
   supported tablet width; reopen history after crossing the Inspector breakpoint.
7. On a disposable copy, save a canonical geometry change. Open the older Proposal;
   its artifact/path remain available, with historical provenance and the disabled
   refinement explanation. Do not refine old architecture. Start a fresh root only
   if separately budgeted. For errors/late completion use automated fake tests or
   the fake harness; do not manufacture extra paid failures.

Acceptance checks expression, selection, navigation, persistence and branching only.
C3 owns authorized multi-turn visual preservation, drift/quality assessment and final
conversational validation. C2 makes no claim that only a requested object changes or
that multi-turn visual fidelity has passed. AI-D canonical Furniture operations and
Apply Proposal remain unimplemented.
