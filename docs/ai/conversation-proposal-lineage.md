# AI-C1 — Conversation & Proposal Lineage

AI-B is closed. AI-C has exactly three phases: **AI-C1 — Conversation & Proposal
Lineage**, **AI-C2 — Conversational Design UX**, **AI-C3 — Conversational Quality
& Validation**. This implementation is C1 only: durable iteration, branching and
provider-neutral refinement. It adds no chat, timeline, branch browsing, Proposal
Review redesign, paid acceptance or canonical Furniture editing.

## Reused AI-B architecture

3D Room selection enters Design Studio. Room reference generation supplies
axonometric, Interior A and Interior B views. The authenticated API reloads the
canonical Project, derives `DesignContext`, calls `InteriorDesignService` and
`InteriorDesignProvider`, validates/stores the image, then persists `DesignProposal`.
Room history and Proposal Review read stable IDs and authenticated artifact URLs.
Generate/Try another continues to use Interior A as primary edit image and produce
independent roots from the original design direction/context.

C1 reuses artifact storage, revision provenance, normalized telemetry, persistence
compensation, owner/admin authorization and Project deletion cleanup. No Proposal,
conversation or turn enters `ProjectSchema` or aggregate serialization. The AI-A
transient `iteration`/`session` seam remains compatible; refinement does not use it
as durable identity or provider state.

## Minimal durable model and branching

`DesignConversation` stores application ID, Project FK, stable Level/Room domain
IDs, unique root Proposal FK, timestamps and an internal monotonic turn counter.
There is no workflow status, generic message model or duplicate artifact.

Each child `DesignProposal` **is the durable design turn**: its existing ID is the
iteration identity and its existing `instructions` records the delta. New fields
are `conversationId`, `parentProposalId`, `turnNumber`; public children expose these
as `lineage`. Result image and turn cannot be persisted independently. A separate
turn table would duplicate instruction, parent and result without adding C1 value.

Existing rows retain null lineage/continuation and remain valid ordinary roots.
The first successful refinement creates its conversation in the same transaction
as its child. The root connects through the conversation's root FK; it does not
become a child. No backfill or provisional empty conversation is created. After
all children are deleted, the established conversation stays with its root; root
deletion safely removes that empty conversation.

Refining P1 twice produces P2.parent=P1 and P3.parent=P1. Refining P2 produces
P4.parent=P2. All share one conversation. A new initial generation is a separate
root. Concurrent first branches serialize under the canonical Project row lock,
create one conversation and receive distinct turn numbers. Numbers are never reused.

Migration `20261009130000_design_conversation_lineage` adds scoped composite FKs
for roots, parents and membership; lookup/parent/turn indexes; complete-positive-
non-self-lineage checks; and a PostgreSQL trigger preventing cross-conversation
parents and non-increasing ancestry. Parent/root deletion uses NO ACTION, while
owning Project deletion cascades all its application history. Level/Room IDs retain
AI-B's independence from replaceable geometry database rows.

## Provider-neutral refinement

`generateDesign` retains initial semantics. The distinct `refineDesign` request
contains target, freshly derived canonical context/references, server-loaded base
Proposal artifact/revision, user delta, preservation policy and optional internal
continuation data. `InteriorDesignService.refine` validates base/context scope,
revision, base bytes and required references before provider invocation.

Previous Proposal pixels are **current visual design state**, never geometric truth.
Every turn re-derives canonical architecture. The adapter supplies precise Room
boundaries, Walls, internal/non-boundary partitions, Doors, Windows, Wall Openings,
Stairs, dimensions, elevations, units and direct adjacency alongside current Room
references. Canonical evidence takes precedence over conflicting generated pixels.
Adjacent Rooms remain supporting context, not secondary design targets.

The deterministic instruction builder separates BASE DESIGN, ARCHITECTURE and
USER CHANGE. Its default is **preserve everything not requested to change**.
Sofa/chair-only changes preserve unrelated design; a broader minimal-arrangement
request permits broader design changes. Architecture remains fixed. No extra LLM
interprets intent before the same intended image-edit request.

## OpenAI decision — official documentation checked 9 October 2026

OpenAI documents multi-turn editing through response/image IDs or supplied image
context. Base64 image input is supported. `action: "edit"` forces editing and requires
an image in context. C1 chooses **explicit persisted-image replay on every turn**,
with forced edit semantics. This is both our continuation strategy and the safe
fallback when state is absent/expired. [Official image guide](https://developers.openai.com/api/docs/guides/image-generation).

Refinement image order is **previous Proposal**, **axonometric**, **Interior A**,
**Interior B**, followed by the existing optional current-user view. Only the first
is primary design state; the others have explicit canonical supporting roles.
Initial image order is unchanged. No verified API/SDK constraint requires another
order. Configured models, quality and size are retained; no model migration occurred.

`previous_response_id` chains responses; Conversations persist long-running state.
Responses default to 30-day retention, while Conversation items have no such TTL.
Prior chained input remains billable. C1 avoids accumulated provider chain state,
uses `store: false` for refinements, and sends all required input explicitly. This
does not promise zero retention under other provider data policies.
[Official conversation-state guide](https://developers.openai.com/api/docs/guides/conversation-state).

Installed official Node SDK 7.23.0 declarations support Responses continuation,
Conversations and image-tool `action`. Explicit replay avoids retention dependency
and an expired-ID retry that would violate our budget. Re-supplied images/context
may increase input cost compared with an effective provider cache; no savings or
unsupported billing estimate is claimed.

OpenAI C1 emits/uses no response, image or conversation continuation IDs. Other
providers may return optional continuation in server-only `providerContinuation`
JSON, scoped by provider identity and passed only to that same provider. The
transient `GeneratedDesignProposal` carries it to persistence; public Proposal
contracts and DTOs exclude it. Optional/expired state cannot erase CasaStudio lineage.

## Authorization, revision and persistence

Every operation authorizes the owning Project through the established owner/admin
policy before Proposal lookup. Opaque IDs are additionally scoped to that Project.
Unauthorized users receive the existing Project denial; foreign IDs return generic
404 in an authorized Project without exposing foreign record existence.

The base's saved revision must equal current persisted Project revision. Mismatch
returns **409 `AI_STALE_CONTEXT`** before provider work. Historical image/lineage
access remains available; generate a new root from current architecture. No
geometric reconciliation or silent stale refinement is performed.

Flow: authorize/validate lineage and revision → read verified saved base bytes →
derive context/validate references → one provider refinement → existing artifact
validation/storage → transaction with Project lock/base existence/revision recheck
→ conversation/order allocation and child persistence → durable response.
No DB lock is held during provider work. A concurrent architectural edit or base
deletion cannot commit a broken child.

Provider/storage failure creates no turn. A DB/lineage failure rolls back
conversation/counter/child together and compensates the new file. Persistence
never triggers another provider call. Late revision changes return the typed stale
conflict after compensation; one paid request may already have completed. The
filesystem/DB crash-orphan and ambiguous-HTTP-success limits documented in AI-B remain.

Parents with children return **409 `AI_PROPOSAL_HAS_DESCENDANTS`** on deletion,
before artifact cleanup. Leaf deletion removes Proposal/turn in a locked
transaction, updates conversation time, revokes image access, then performs
best-effort byte cleanup. Existing Delete never cascades a branch. Project deletion
keeps its established lock, collects all artifact keys, cascades lineage and cleans
files after commit. Conversation/refinement/deletion never advance Project revision.

Each explicit refinement causes at most one intended paid request: one Responses
call, forced image tool, `max_tool_calls: 1`, `parallel_tool_calls: false`, SDK
`maxRetries: 0`. No intent call, automatic retry, candidate variants,
provider/model/quality fallback or edit-to-generate fallback exists.

## API and C2 handoff

| Operation | Route below `/api/v1/projects/:id/design-proposals` | Result |
| --- | --- | --- |
| Refine | `POST /:proposalId/refinements` | Durable child with lineage |
| Read lineage | `GET /:proposalId/conversation?afterTurn=0` | `{ page: DesignConversationPage \| null }` |
| History/artifact/delete | Existing AI-B routes | Child lineage and typed deletion conflict added |

Refine body contains `levelId`, `roomId`, nonblank `instructions`, current
`referenceViews`. Context, revision, base image and provider IDs are server-owned;
new DTOs reject injected fields. Queries from root/child return identity, root and
20 chronological turns with delta/parent/turn number. `nextAfterTurn` pages further
turns; filter parent IDs across pages to reconstruct children/branches. Reads never
create conversations; never-refined roots return `{ page: null }`. Bounded queries
use repeatable-read snapshots and remain available after geometry removal.

Frontend client seams are `refineRoomDesign` and `getDesignConversation`, with scope
and lineage validation and stable Problem Details conflicts. No refinement UI or
live-generation development hook was added. C2 must supply references from current
saved geometry, implement explicit single-flight refinement, handle stale/deletion
conflicts, recover ambiguous completions through history, and build conversation/
branch presentation. Try another must remain distinct; unsaved geometry must not
masquerade as saved revision context.

## Zero-cost acceptance and known limits

Fake providers return deterministic valid image fixtures and expose invocation
counts. SDK mocks test primary-base/four-image ordering, canonical spatial context,
preserve-by-default rules, absent/expired-state replay and one-call failures. DB
tests cover root adoption, descendants/branching/reload, scoped authorization,
staleness, failures/rollback/compensation, concurrent roots, metadata isolation,
pagination, deletion, constraints and Project immutability. Signed-JWT HTTP tests
exercise P1 → "Change only the sofa" → P2 → reload → P1 → "Try darker wood" → P3.

Structural C1 owner acceptance can be repeated with normal local PostgreSQL tooling
and a disposable database named `casastudio_ai_c1_validation`. The launcher loads
the existing local connection, targets only that database, and strips provider
selection/API key from its child environment:

```sh
node tools/ai-c1-validation.mjs db:migrate:deploy
node tools/ai-c1-validation.mjs --filter @casastudio/api test src/ai/persistence/design-lineage.integration.test.ts src/ai/api/design-workflow.integration.test.ts src/ai/openai/openai-interior-design.provider.test.ts
```

Tests use isolated Projects and temporary storage and clean their own fixtures.
No live SDK call, paid image or subjective/manual visual acceptance occurs. Do not
press a normal application's Generate action for C1 validation.

Refinement is probabilistic: "change only X" can alter unrelated pixels. Canonical
and preservation instructions are a contract, not proof of visual quality/drift
control. Proposals never replace geometry. Revision checks cover persisted state,
not unsaved browser edits. Branching is structural before polished UI. Provider
state can expire; artifact replay remains required. C2 owns user-facing iteration;
C3 owns authorized multi-turn quality/drift validation. Neither completion is claimed.
