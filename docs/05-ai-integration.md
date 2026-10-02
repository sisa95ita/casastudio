# 05 — AI Interior Design Foundation

## Truth boundaries

CasaStudio keeps three deliberately separate truths:

1. `ProjectSchema` is canonical for Levels, Rooms, Walls, Openings, Stairs, dimensions, topology, elevations, and canonical Furniture. AI never rewrites this geometry from an image.
2. A `DesignProposal` image is visual design truth for a concept: style, materials, colors, decoration, lighting, composition, and non-canonical furniture appearance.
3. The existing structured 3D scene is derived from canonical Project data. Later phases may approximate a proposal with typed canonical Furniture operations, but an object visible in generated pixels is not automatically Furniture.

The AI-A generation path is read-only with respect to `Project`. It does not send raw Project JSON to a model and it does not put image bytes into `ProjectSchema`.

## Architecture

```text
selected canonical Room + user instruction + Room-aware reference views
                              |
                              v
authenticated CasaStudio API endpoint
                              |
              reload and authorize canonical Project
                              |
                    derive DesignContext
                              |
                 InteriorDesignProvider
                              |
       OpenAIInteriorDesignProvider (first adapter)
                              |
          OpenAI Responses API + image_generation
                              |
                normalized DesignProposal
```

Provider-neutral contracts and context derivation live in `@casastudio/ai`. The Nest feature owns authentication, orchestration, failure-to-Problem-Details mapping, and provider construction. Only the OpenAI adapter imports provider SDK concepts. The React application knows only CasaStudio request/proposal contracts.

MCP is intentionally not used for this native path. The product backend calls the official OpenAI SDK directly. MCP may later expose CasaStudio tools to external agents, but it is not needed between CasaStudio and its first provider.

## Contracts

### DesignTarget

AI-A supports one target kind:

```ts
{
  kind: ("room", projectId, levelId, roomId);
}
```

The stable IDs reference canonical entities and do not duplicate persisted geometry. The tagged shape can gain Level, Room-group, or Project variants later without changing provider contracts.

### DesignContext

`deriveDesignContext` reloads semantic information from the authorized Project on the server. For a Room it contains:

- Project identity and revision;
- Level identity and elevation;
- Room identity, type, local/global floor elevation, ordered canonical boundary, and extents;
- only relevant Walls, thicknesses, and Doors/Windows/Wall Openings;
- Stairs connected to the Room or otherwise relevant on its Level;
- only Furniture owned by the target Room;
- `spatialContext.adjacentSpaces`: direct same-Level neighboring Room identity,
  name/type, Level/global floor elevation, and distinct canonical passages;
- canonical centimeters/degrees and the right-handed X/Z horizontal, +Y elevation convention.

It intentionally excludes unrelated Levels, viewpoints, presentation visibility, renderer state, and the rest of the Project aggregate. It is transient derived data; the Project stays authoritative.

### AI-B2.1 — direct local spatial context

A target-only snapshot describes an architectural opening but can omit the
canonical identity of the space beyond it. The provider then has to invent a
plausible background. Local topology now communicates that a Door or Wall Opening
connects the selected Room to a named, typed Room. For example, a Studio's doorway
may lead to a canonical Bedroom; the Bedroom is context for interpreting the
doorway, not an additional design target.

`Project → deriveDesignContext → DesignContext → OpenAI prompt` stays server-side
and deterministic. The reusable `deriveDirectRoomConnections(level, roomId)`
belongs to `@casastudio/schema/physical-building`, the smallest owner of the
canonical topology. It has no AI/provider/renderer dependency. It reads Level-local
maps once per context derivation, never during rendering, and never mutates or
adds ownership to Project, Rooms, Walls, Openings, Stairs or Furniture.

Supported connection kinds are **`door`** and **`wall-opening`**:

1. A Door's non-empty `connectedRoomIds` explicitly models functional navigation.
   Exactly two distinct resolvable Rooms, including the target, can resolve the
   relation even when their boundaries are drafts. Contradictory Wall ownership
   or known same-side boundary uses invalidate the relation.
2. Without explicit Door navigation metadata, a Door or Wall Opening requires
   a host Wall with exactly two same-floor Room owners including the target,
   reciprocal `Room.boundary` references, and opposite `FORWARD`/`REVERSE` uses.
   Canonical outer Room loops are persisted counter-clockwise, so opposite uses
   establish opposite sides of the shared physical Wall. A shared solid Wall or
   Window creates no Room connection.
3. Only Rooms in the selected Level and at the same canonical Room floor
   elevation are included. Walls can have owners in multiple elevation strata;
   those owners are not automatically neighbors. Openings must fit the canonical
   Wall and extend above the connected Room floors. Stair context remains
   independent and unchanged; no vertical graph expansion is added.

This is **topology first, with no proximity/geometry fallback**. Existing
boundaries and ownership encode supported shared-Wall relationships precisely.
Overlapping Wall bounding boxes, nearby polygons, separate coincident Walls,
external/unidentified openings, incomplete/contradictory explicit Door references,
missing reciprocal boundary references, same-side uses and non-manifold ownership
do not justify guessing a neighbor. They are omitted; existing target Wall and
Opening facts remain available without an invented adjacent identity.

**FREE/open-boundary limitation:** `FreeRoomBoundaryEdgeSchema` explicitly states
that a FREE segment closes a walkable footprint but carries no Wall, opening,
guard or structural-support meaning. It can also be an exposed elevated slab
edge. There is no canonical passage identity joining two FREE edges. Even a
positive-length coincident pair therefore cannot reliably distinguish intentional
connectivity from geometric contact; FREE overlap and endpoint-only contact both
produce no adjacency. No tolerance-based matching is introduced for unsupported
semantics. Explicit open-boundary connectivity needs a later domain decision.

The neutral snapshot groups each neighboring Room once and retains all distinct
connections (identified internally by neighbor, host Wall and Opening IDs).
Each passage includes kind, width/height, canonical Wall-start offset, sill
elevation and target boundary direction when available. Only identity/type/Level
and floor elevation are copied for neighbors; their boundaries, Walls, Furniture
and neighbors are not serialized. There is no recursive traversal.

The adapter keeps **ARCHITECTURAL EDIT CONTRACT**, **TARGET ROOM CONTEXT**,
**LOCAL SPATIAL CONTEXT** and **USER DESIGN DIRECTION** distinct. Local prose
uses Room names/types and the target-context Wall number instead of internal
IDs. A visible neighbor in edited Interior A must read consistently with its
canonical identity/type. The instruction forbids merging Rooms, extending the
target into its neighbor, changing connecting architecture, revealing hidden
spaces, or treating the background as a second full design brief. Neighbor
contents remain non-canonical proposal pixels; the proposal still belongs to one
target Room.

Provider-only local prose is bounded to **12 directly connected Rooms**, **4
passages per Room**, and **120 characters per semantic label**. Rank Rooms by
their widest passage, then stable Room ID; rank passages by width, then stable
Wall/Opening IDs. This gives wider architectural connections priority, reports
omitted counts and forbids guessing omitted identities. The provider-neutral
snapshot retains every direct relation. These limits bound the added spatial
section, not the pre-existing target-context section; they are not a token or
cost estimate.

This adds only semantic text to the existing single Responses request. It adds
no AI analysis, image input, fourth camera/reference, generation, retry, fallback,
variant, quality change or parallel provider call. AI-B2.2 remains `action=edit`,
Interior A first/base, axonometric second, Interior B third, `max_tool_calls=1`
and `parallel_tool_calls=false`. No paid provider call is needed to derive or
test adjacency, including when `OPENAI_API_KEY` is absent.

### DesignReferenceView

The AI-A current-view screenshot proved the end-to-end pipeline, but an arbitrary OrbitControls position is not a reliable design input: it can be zoomed out to the full building, blocked by another Level or Wall, or aimed away from the selected Room. AI-B1 therefore derives three automatic references from the immutable renderer-neutral Room model:

- `room-axonometric` frames the Room bounds from a stable direction based on its longest contour edge;
- `room-interior-a` and `room-interior-b` place human-height eyes at two materially separated, triangulation-backed points inside the Room.

The derivation uses the generic Room contour and floor triangles, not width/depth fields or a four-Wall assumption. It respects the Room/Level floor Y, physical Wall height and thickness, and arbitrary plan rotation. Concave L/U/T/free-boundary Rooms use points known to lie inside triangulated floor regions. The inside-Room strategy is the reference-only occlusion policy: it avoids an exterior camera-side Wall without deleting a Wall, inventing an Opening, or persisting cutaway state.

Capture reuses the mounted React Three Fiber scene but renders each temporary perspective camera to a 960×720 offscreen render target. It temporarily masks unrelated Levels, non-target Room floors and furniture, unrelated Walls, unrelated Stairs, the grid/ground, and interaction outlines. It retains the target Room's canonical boundary Walls and any additional same-Level Wall whose resolved physical body materially overlaps the Room floor polygon, together with the included Walls' Doors, Windows, and Wall Openings. Room boundary ownership and physical/visual relevance are intentionally different concepts: reference isolation derives the latter without adding ownership or mutating canonical Room/Wall data. The overlap test uses rendered Wall footprints, including physical thickness and resolved endpoint interfaces, rather than Wall centerlines. It also retains Room-owned Furniture and Stairs canonically connected to the Room. Every visibility flag and renderer target is restored in `finally`; the controlled user camera and OrbitControls are never moved. The user's current view remains a modeled `current-user-view` reference kind for a future optional workflow, but is not an automatic/default AI-B1 reference.

Each provider-neutral `DesignReferenceView` carries a stable kind, canonical target, image artifact, dimensions/MIME type, and plain camera position/direction/up/FOV metadata. No `THREE.Camera`, `Vector3`, renderer state, or provider concept crosses the boundary.

The request body is bounded to 7 MiB globally and the image field to 6.5 million characters. The API verifies that the declared MIME type matches the data URL. The browser uploads the reference to CasaStudio; it never calls OpenAI.

### DesignRequest, proposal, and session seam

The provider request combines target, instruction, derived context, a bounded array of reference views, optional preferences/constraints/preservation rules, and an optional iteration seam. The API does not accept client-supplied context. It validates every image/MIME pair and rejects a reference whose target differs from the requested Room. Generation requires exactly one `room-axonometric`, one `room-interior-a`, and one `room-interior-b`; `current-user-view` remains an optional future/additional evidence kind.

References are transient. The panel creates them when the selected Room or derived scene changes, retains them in component state, and offers an explicit refresh. It does not recapture per animation frame. Selecting another Room invalidates the set. No image is added to `ProjectSchema`, persistence, or proposal history.

AI-A returns one successful, transient `DesignProposal` containing a stable proposal ID, target, creation time, normalized image artifact, and isolated provider metadata. AI-B2 adds normalized, safe telemetry: provider, orchestration/image model, measured duration, generation timestamp, output dimensions/format/quality, and token usage when the provider reports it. Raw provider responses, base64 payloads, secrets, and OpenAI request IDs are not displayed. A small optional session/previous-proposal seam remains in the generic contract for AI-C, but no chat system is implemented. `structuredSuggestions` is reserved for future typed results.

Generated image bytes are normalized into a standard image data URL before they reach React. This is pragmatic for one transient spike result. Durable galleries should replace it with object storage plus an application-owned artifact URL and metadata record.

## AI-B2.2 primary-reference editing

Manual AI-B2 generations produced better photorealism but still reconstructed/reinterpreted the Room. That path used `action: "generate"` with Interior A as composition guidance, so the references could be treated as inspiration for a new scene. AI-B2.2 instead makes deterministic Interior A the base image of an explicit generative edit. Architectural improvement remains unverified until the owners perform paid manual acceptance.

The OpenAI adapter owns this ordering; core contracts remain provider-neutral:

1. **REFERENCE 1 — Interior A — BASE IMAGE TO EDIT:** first image input; authoritative camera, framing, perspective and final composition.
2. **REFERENCE 2 — Axonometric — STRUCTURAL / LAYOUT EVIDENCE ONLY:** verify footprint, partitions, Walls and Openings; resolve ambiguity without copying its camera/viewpoint.
3. **REFERENCE 3 — Interior B — COMPLEMENTARY ARCHITECTURAL EVIDENCE ONLY:** clarify architecture hidden from A without switching viewpoint or replacing A's composition.

Labels are interleaved immediately before the corresponding image. All three describe the same canonical Room and participate in one request. Missing, duplicate, empty or mismatched required references fail through `missing_reference` before the adapter submits any paid request. There is no substitution of a supporting reference as the base.

The deterministic provider instruction starts with **EDIT THE FIRST IMAGE** and explicitly forbids recreating the Room from scratch. It preserves camera position as closely as possible, camera direction, framing, perspective, Room silhouette/footprint, Wall positions/intersections, relevant internal/non-boundary Walls, Doors, Windows, Wall Openings, Stairs, visible floor boundaries, architectural proportions and ceiling/floor relationship/elevations. Only Furniture/appearance, movable objects, materials, finishes, colors, textiles, lighting fixtures, decorative objects and styling may change. Architecture is immutable.

CasaStudio owns this contract automatically. Users can write normal design directions such as “Create a warm contemporary guest bedroom with a desk.” User direction and non-architectural constraints remain separate from the architectural instruction and concise supporting DesignContext. The translator emits Room facts, relevant Wall/Opening/Stair dimensions, movable Furniture and units; it does not dump arbitrary Project JSON, IDs or unrelated Rooms/Levels.

The current [OpenAI image prompting guide](https://developers.openai.com/api/docs/guides/image-prompting) recommends naming the edited image, specifying what changes and what stays fixed, using image 1 as the scene for multi-reference edits, and preserving layout/proportions/perspective when turning a drawing into a realistic image. This is a prompt-and-edit strategy, not a CAD constraint system. No mask is introduced; the documented first-image mask rule does not imply that an unmasked edit mechanically locks every pixel. AI-B1 cameras, reference resolution, Room isolation, Wall relevance and Level isolation are unchanged.

Generative editing cannot guarantee pixel-identical geometry, CAD-level dimensional accuracy, mathematically exact projection preservation, or perfect retention of every architectural detail. The goal is to reduce drift; automated tests cannot establish that it does. `ProjectSchema` remains the source of truth. Generated pixels are transient proposals only: no Room-boundary changes, canonical Furniture creation from pixels, architectural edits, or persistence of generated interpretation.

## OpenAI adapter

The first adapter uses the official `openai` JavaScript SDK and `client.responses.create`. It supplies:

- a configurable top-level reasoning/orchestration model;
- the separated architectural instruction, concise Room context, user direction, role labels, and all three reference images as Responses input;
- the configurable `image_generation` tool model with forced `action: "edit"`, explicit quality, size, format, and `partial_images: 0`;
- `tool_choice: { type: "image_generation" }`, `max_tool_calls: 1`, and `parallel_tool_calls: false` to request one final image edit;
- the generated `image_generation_call.result`, normalized from base64 to a data URL with the configured/reported format.

The unchanged development default is `gpt-5.6-sol` orchestration plus `gpt-image-2.5-flare`, `medium`, `1536x1024`, and PNG. All values are server-side environment configuration; switching to `gpt-image-2.5-sunburst` or another quality requires no application-code change. The official tool documentation supports explicit model, quality, size, format, forced tool choice, and multiple image inputs: [Responses image-generation tool](https://developers.openai.com/api/docs/guides/tools-image-generation). [Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst) is the preferred precision-editing profile for architecture-sensitive acceptance; set `OPENAI_IMAGE_MODEL=gpt-image-2.5-sunburst` deliberately on the server. [Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare) remains available for faster/cheaper development iterations and future drafts. Quality is never raised automatically to `xhigh`/`max`.

Official capabilities were checked on **2026-10-02**. The [tool guide](https://developers.openai.com/api/docs/guides/tools-image-generation) documents Sunburst/Flare and earlier GPT Image 2, 1.5, 1 and 1-mini tool models, data-URL/file-ID image inputs, forced tool choice and `action=edit`. Edit mode without an image in context fails; CasaStudio therefore validates the base/reference set locally and never falls back to generate. The image model belongs in the tool, while the orchestration model stays at the top level. The tool guide's supported-mainline list omits some newer models, but the [GPT-5.6 Sol model page](https://developers.openai.com/api/docs/models/gpt-5.6-sol) explicitly lists image generation as supported. Server account access/organization verification can still restrict models; those failures are returned as normalized errors, not worked around automatically.

The [Responses reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create) defines `max_tool_calls` as the cap across built-in tools. Only image generation is enabled here. No `n`, variants, partial-image streaming, analysis generation, per-reference call, previous-response iteration, speculative/background generation or automatic regeneration is requested. Unexpected zero/multiple image calls or an incomplete result fail without resubmission.

### Budget, concurrency, rate limits and retries

**One explicit Generate design action = at most one intended paid image-generation request.** All three references are included in a single `responses.create`. The frontend retains its disabled pending button and now locks synchronously with a ref before the first await, blocking duplicate events even before React renders. The lock is released on success/failure. Reference capture/refresh only produces local evidence; it never triggers generation. The browser API client performs one POST without automatic retry. The backend performs one provider invocation per valid submission; this narrow UI guard is not a distributed deduplication/job system and does not coordinate independent tabs or separately submitted API requests.

The installed official `openai` SDK **7.23.0** defaults to two retries and retries eligible transport failures/timeouts and HTTP 408/409/429/5xx (subject to provider retry headers). Previously this AI client explicitly allowed one retry. It now sets **`maxRetries: 0`**, retaining the existing 180-second timeout. A lost response/timeout can hide a completed paid generation; submitting a fresh request could incur another charge. No endpoint-specific guarantee was found that justifies relying on retry deduplication, so CasaStudio makes no automatic retry. A human decides whether to submit another explicit request after inspecting the outcome/budget.

[OpenAI rate limits](https://developers.openai.com/api/docs/guides/rate-limits) and [error semantics](https://developers.openai.com/api/docs/guides/error-codes) depend on account/model/tier and can change. CasaStudio hard-codes no RPM/IPM/TPM quotas. HTTP 429 remains `rate_limited` / `AI_RATE_LIMITED` and reaches the UI as HTTP 429 Problem Details. The adapter reads SDK error `headers` for `retry-after-ms` or `Retry-After` seconds/HTTP-date and exposes only a validated rounded delay in the sanitized message. Invalid/absent delays use “Try again later”; Documented credit/spend/usage-limit codes and `insufficient_quota` identify exhausted allowance instead of suggesting that a timed retry restores access. Raw headers/messages/payloads are never sent to React or logged. No countdown, queue, automatic wait/resubmit or aggressive retry is added. Model access, authentication, timeout and availability errors retain normalized handling.

There is no Sunburst→Flare, medium→high, edit→generate or other automatic provider/model/quality/action fallback. Configuration problems and ambiguous results stop at a normalized error so the user can choose the next action.

### Telemetry and estimated cost policy

Telemetry additionally includes optional provider-neutral `generationMode: "edit"`; the existing service carries it into the proposal. The adapter measures elapsed duration around `responses.create` with an injectable monotonic clock and records completion time separately. It normalizes Responses usage into input, output, total, cached-input, cache-write, and reasoning token counts when present. Missing fields stay absent; no value is inferred. The panel shows this metadata below the proposal as secondary development information.

The Responses image call exposes `revised_prompt` cleanly according to the tool guide. AI-B2.2 deliberately does not retain or log it: free-form user-derived text adds diagnostic sanitization/retention concerns, while it is unnecessary for this implementation. It is never canonical DesignContext or normal UI content.

AI-B2 intentionally does **not** calculate an estimated API cost. The current Responses usage is aggregate and does not provide a defensible split between orchestration-model tokens and the image tool's text-input, image-input, and image-output tokens. Official documentation also notes that cached image-generation token counts are not included in Responses output. Applying the distinct rates to one aggregate would fabricate precision. Use normalized usage for comparison and OpenAI Usage/Billing for authoritative cost. Revisit an adapter-local estimator only when the response exposes the necessary modality/model breakdown; pricing constants must then remain centralized and dated. See [image-generation cost and latency](https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency) and [API pricing](https://platform.openai.com/pricing).

## Server configuration and security

AI is optional. Uncomment these server-side values in `.env` or `.env.local`:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=replace-with-a-real-server-secret
OPENAI_REASONING_MODEL=gpt-5.6-sol
OPENAI_IMAGE_MODEL=gpt-image-2.5-flare
OPENAI_IMAGE_QUALITY=medium
OPENAI_IMAGE_SIZE=1536x1024
OPENAI_IMAGE_FORMAT=png
```

The model defaults are centralized configuration, not spread through controllers or React. `OPENAI_API_KEY` is read only by the API configuration/provider factory. It has no `VITE_` prefix, is absent from frontend types and payloads, is never persisted in Project data, and must not be logged.

When `AI_PROVIDER` is absent—or OpenAI is selected without a key—the API and all 2D/3D features still start normally. A generation attempt returns a sanitized `AI_PROVIDER_NOT_CONFIGURED` Problem Details response. Invalid provider names fail central environment validation. Provider authentication, model-access, availability, rate limit, timeout, invalid-response, refusal/failure, missing-reference, and unsupported-target cases map to a small stable AI error vocabulary; raw SDK exceptions do not reach the UI.

## Persistence decision

AI-A adds no database table or migration. Requests, sessions, proposals, uploaded references, and generated data URLs are process/request-transient. Existing legacy design-rendering fields in `ProjectSchema` are not used by this new path and were not expanded. This avoids making experimental images part of canonical architecture.

AI-B should introduce an application-owned artifact repository and object storage if a durable proposal gallery is required. Reference images and generated images should then have retention, ownership, authorization, deletion, content-type, size, and lifecycle policies outside `ProjectSchema`.

## AI-B2.2 manual acceptance — owners only

**Permanent execution rule:** automated/development agents must not call OpenAI or any paid provider, consume credits, press Generate design for verification, or perform manual visual acceptance without explicit separate authorization. This phase authorizes only documentation inspection and deterministic/mocked lint/test/build checks.

Automated success proves request construction and safety behavior, not improved architectural fidelity. Owners perform any paid acceptance themselves:

1. Choose a small budget and configure the server explicitly: `AI_PROVIDER=openai`, a server-only key, `OPENAI_REASONING_MODEL=gpt-5.6-sol`, `OPENAI_IMAGE_MODEL=gpt-image-2.5-sunburst` for precision acceptance, `OPENAI_IMAGE_QUALITY=medium`, `OPENAI_IMAGE_SIZE=1536x1024`, `OPENAI_IMAGE_FORMAT=png`. Restart the API after configuration changes. Flare remains an explicit alternative; never escalate quality implicitly.
2. Start CasaStudio, select a target Room in 3D and wait for all three automatic references. Open/inspect Interior A, axonometric and Interior B. Record/screenshot Interior A as the base composition and canonical architecture before generating. Do not alter the accepted reference cameras/resolution.
3. Record the exact ordinary design direction and model/quality/size/format. For example: “Create a warm contemporary guest bedroom with a desk.” Click **Generate design once**. Confirm it stays disabled while pending and no extra request appears from repeated clicks/reference changes.
4. **Test A — rectangular Room:** use one call and compare the final image directly with Interior A: camera/direction, framing, perspective, silhouette, visible floor, wall intersections, Doors/Windows/Openings, proportions, ceiling/floor relationship and requested styling. Supporting views should clarify architecture without becoming the final viewpoint.
5. **Test B — internal/non-boundary Wall:** proceed only if A and budget justify it; use one call and check that Wall plus any hosted Opening, along with A's camera and boundary geometry.
6. **Test C — concave/complex or Stair-related Room:** proceed only if earlier results justify it; use one call and check difficult geometry/Stairs without changing viewpoint.
7. For each call record configured/reported models, generation mode from normalized response telemetry, output settings, timestamp, duration, usage, actual OpenAI Usage/Billing cost and drift observations against Interior A/ProjectSchema. Confirm canonical Project data is unchanged. Compare with retained AI-B2 outputs if available without generating a new baseline automatically.
8. On HTTP 429, honor the sanitized delay and inspect account limits/allowance. On timeout/ambiguous failure, inspect provider outcome/billing before choosing any new explicit call. There is no automatic retry or fallback. Stop after the smallest useful number of calls; the owners alone decide visual acceptance and whether architectural drift improved.

## AI-B2.1 manual acceptance — owners only

Automated checks establish canonical derivation and request construction only.
They do not establish improved visual fidelity. This implementation performs no
live provider calls or manual visual acceptance. Owners can evaluate it as follows:

1. Start the updated API/web using the existing accepted provider/model/quality
   settings and a budget you choose. Select a target Room with a canonically
   connected same-Level neighbor whose name/type differ from the target. Confirm
   either explicit Door connectivity or reciprocal opposite shared-Wall uses
   with a Door/Wall Opening. Save/export the canonical Project before testing.
2. Wait for Interior A, axonometric and Interior B. Record Interior A's camera,
   composition and connecting architecture. Choose a connection visible in
   Interior A for the first paid case; keep the accepted three references.
3. Enter an ordinary design direction for the target only, without explaining
   the neighbor's identity. Click **Generate design once**. Confirm one browser
   submission, a disabled pending button and `generationMode=edit` telemetry.
4. Compare the output against Interior A: target camera/framing, silhouette,
   Walls, Door/Opening dimensions and elevations must remain anchored. If the
   neighbor is visible, judge whether it reads as its canonical type, remains a
   separate Room and receives only background treatment. Hidden neighbors must
   not be newly revealed. Record drift; do not assume the instruction succeeded.
5. Record models/settings, duration, usage and actual provider billing. Compare
   with any retained prior output without generating a new baseline automatically.
   Confirm the canonical Project/revision remains unchanged by generation.
6. Only if the first result and budget justify it, make another single explicit
   call for the other supported passage kind or a different neighbor type.
   Window-only/solid-Wall/FREE-only and other-Level cases are covered by
   deterministic tests; do not pay for them merely to verify derivation.
   On timeout or ambiguous failure, inspect billing/outcome before deciding on
   another action. Owners alone decide acceptance and whether fidelity improved.

## Evolution

- **AI-C:** conversational iteration, prior-response continuation, and scoped follow-up changes.
- **Later AI-B/product work:** durable artifact storage/gallery, job progress for long latency, richer style and explicit Furniture-preservation controls, and quality/cost experiments approved from manual results.
- **Gemini/other providers:** implement `InteriorDesignProvider`; reuse target, context, reference, request, proposal, and failure contracts. Provider choice can later be resolved per user/tenant without changing these contracts.
- **User-configured providers:** keep credentials in a future server-side secret facility above the provider factory. Never put keys in `ProjectSchema` or browser state.
- **AI Editing Assistant:** translate future proposals into reviewed, typed CasaStudio editing operations. Never allow an LLM to mutate raw Project JSON.
- **Structured 3D:** later suggestions may select `FurnitureDefinition`s and place canonical `FurnitureItem`s through typed operations. Arbitrary mesh/GLB generation remains post-MVP and is not implied by the image artifact contract.
