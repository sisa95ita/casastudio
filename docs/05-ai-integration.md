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
- canonical centimeters/degrees and the right-handed X/Z horizontal, +Y elevation convention.

It intentionally excludes unrelated Levels, viewpoints, presentation visibility, renderer state, and the rest of the Project aggregate. It is transient derived data; the Project stays authoritative.

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

## AI-B2 generation-quality strategy

AI-B2 assigns a deterministic role to every automatic reference rather than submitting anonymous images:

1. `room-interior-a` is sent first and labeled **PRIMARY OUTPUT VIEW**. The result should use its photographic interior composition.
2. `room-axonometric` is labeled **STRUCTURAL/LAYOUT REFERENCE**. It constrains footprint, Walls, partitions, Openings, proportions, and movable Furniture context, but must not become the output viewpoint.
3. `room-interior-b` is labeled **SUPPORTING GEOMETRY**. It supplies evidence hidden from perspective A.

The adapter interleaves each label immediately before its image. Its stable architectural instruction states that every reference describes the same Room; `ProjectSchema` geometry is authoritative; and Walls, relevant internal/partition Walls, Doors, Windows, Wall Openings, Stairs, elevations, and proportions must not be added, removed, moved, resized, or closed. Furniture and visual design elements remain movable unless an explicit preservation instruction says otherwise. The system/provider architectural contract, concise semantic context, and user design direction are separate prompt sections, so style direction does not silently override architecture.

The semantic translator does not serialize arbitrary Project JSON. It emits only the Room name/type/description, approximate extents and area, Level and floor elevation, counts and concise dimensions for relevant Walls and Openings, relevant Stairs, existing movable Furniture, and canonical units. IDs, renderer state, unrelated Levels, and implementation details such as boundary traversal direction are excluded.

This strategy strongly constrains generation, but image generation is not guaranteed to reconstruct architecture pixel-perfectly. The generated pixels remain a transient visual proposal. `ProjectSchema` remains authoritative.

## OpenAI adapter

The first adapter uses the official `openai` JavaScript SDK and `client.responses.create`. It supplies:

- a configurable top-level reasoning/orchestration model;
- the separated architectural instruction, concise Room context, user direction, role labels, and all three reference images as Responses input;
- the configurable `image_generation` tool model with forced `action: "generate"`, explicit quality, size, and format;
- the generated `image_generation_call.result`, normalized from base64 to a data URL with the configured/reported format.

The development profile is `gpt-5.6-sol` orchestration plus `gpt-image-2.5-flare`, `medium`, `1536x1024`, and PNG. All values are server-side environment configuration; switching to `gpt-image-2.5-sunburst` or another quality requires no application-code change. The official tool documentation supports explicit model, quality, size, format, forced tool choice, and multiple image inputs: [Responses image-generation tool](https://developers.openai.com/api/docs/guides/tools-image-generation). The requested Flare quality settings and token rates are documented on the [GPT-Image-2.5 Flare model page](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare).

### Telemetry and estimated cost policy

The adapter measures elapsed duration around `responses.create` with an injectable monotonic clock and records completion time separately. It normalizes Responses usage into input, output, total, cached-input, cache-write, and reasoning token counts when present. Missing fields stay absent; no value is inferred. The panel shows this metadata below the proposal as secondary development information.

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

## AI-B2 manual generation acceptance

Automated tests use fakes/mocks and never make paid calls. After implementation, an authorized human may use a small paid-call budget:

1. Configure the server-side OpenAI variables above and start CasaStudio. Confirm the UI displays all three Room references before each call.
2. Record the exact design direction and configured orchestration model, image model, quality, size, and format.
3. **Test A — simple rectangular Room:** make one generation. Evaluate selected-Room identity, proportions, Walls, Doors/Windows, style compliance, and whether the output follows Interior Perspective A rather than the axonometric view.
4. **Test B — Room with a non-boundary/internal Wall:** make one generation. Evaluate preservation of that Wall and its hosted Opening, where applicable.
5. **Test C — concave/complex or Stair-related Room:** make one generation only if A/B justify continuing. Evaluate difficult geometry and Stair fidelity.
6. For every call, record prompt, configuration, displayed models, duration, normalized usage, OpenAI Usage/Billing cost, and architectural-fidelity observations. The UI shows no estimated cost until the API can support one defensibly.
7. A human decides quality/fidelity acceptance. Automated test success is not visual acceptance.

Stop after the smallest useful number of calls. Failures must leave canonical Project state unchanged.

## Evolution

- **AI-C:** conversational iteration, prior-response continuation, and scoped follow-up changes.
- **Later AI-B/product work:** durable artifact storage/gallery, job progress for long latency, richer style and explicit Furniture-preservation controls, and quality/cost experiments approved from manual results.
- **Gemini/other providers:** implement `InteriorDesignProvider`; reuse target, context, reference, request, proposal, and failure contracts. Provider choice can later be resolved per user/tenant without changing these contracts.
- **User-configured providers:** keep credentials in a future server-side secret facility above the provider factory. Never put keys in `ProjectSchema` or browser state.
- **AI Editing Assistant:** translate future proposals into reviewed, typed CasaStudio editing operations. Never allow an LLM to mutate raw Project JSON.
- **Structured 3D:** later suggestions may select `FurnitureDefinition`s and place canonical `FurnitureItem`s through typed operations. Arbitrary mesh/GLB generation remains post-MVP and is not implied by the image artifact contract.
