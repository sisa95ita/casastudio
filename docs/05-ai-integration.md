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

Capture reuses the mounted React Three Fiber scene but renders each temporary perspective camera to a 960×720 offscreen render target. It temporarily masks unrelated Levels, non-target Room floors and furniture, unrelated Walls, unrelated Stairs, the grid/ground, and interaction outlines. It retains target boundary Walls with their Doors, Windows, and Wall Openings; Room-owned Furniture; and Stairs canonically connected to the Room. Every visibility flag and renderer target is restored in `finally`; the controlled user camera and OrbitControls are never moved. The user's current view remains a modeled `current-user-view` reference kind for a future optional workflow, but is not an automatic/default AI-B1 reference.

Each provider-neutral `DesignReferenceView` carries a stable kind, canonical target, image artifact, dimensions/MIME type, and plain camera position/direction/up/FOV metadata. No `THREE.Camera`, `Vector3`, renderer state, or provider concept crosses the boundary.

The request body is bounded to 7 MiB globally and the image field to 6.5 million characters. The API verifies that the declared MIME type matches the data URL. The browser uploads the reference to CasaStudio; it never calls OpenAI.

### DesignRequest, proposal, and session seam

The provider request combines target, instruction, derived context, a bounded array of reference views, optional preferences/constraints/preservation rules, and an optional iteration seam. The API does not accept client-supplied context. It validates every image/MIME pair and rejects a reference whose target differs from the requested Room. The OpenAI adapter already translates every reference to an image input so AI-B2 does not require another contract migration; AI-B1 itself makes no provider call.

References are transient. The panel creates them when the selected Room or derived scene changes, retains them in component state, and offers an explicit refresh. It does not recapture per animation frame. Selecting another Room invalidates the set. No image is added to `ProjectSchema`, persistence, or proposal history.

AI-A returns one successful, transient `DesignProposal` containing a stable proposal ID, target, creation time, normalized image artifact, and isolated provider metadata. A small optional session/previous-proposal seam and opaque provider continuation map are present for AI-C, but no chat system is implemented. `structuredSuggestions` is reserved for future typed results; AI-A does not create them.

Generated image bytes are normalized into a standard image data URL before they reach React. This is pragmatic for one transient spike result. Durable galleries should replace it with object storage plus an application-owned artifact URL and metadata record.

## OpenAI adapter

The first adapter uses the official `openai` JavaScript SDK and `client.responses.create`. It supplies:

- a configurable top-level reasoning/orchestration model;
- the semantic prompt and reference image as Responses input;
- the configurable `image_generation` tool model with `action: "generate"`;
- the generated `image_generation_call.result`, normalized from base64 to a PNG data URL.

The deterministic adapter-owned instruction builder says that CasaStudio geometry is authoritative, the job is interior design rather than architecture redesign, and walls/openings/stairs/proportions/perspective must be preserved. Provider response IDs are retained only as optional provider metadata/continuation, never as canonical Project concepts.

OpenAI's current official documentation describes image input as a data URL and image-generation tool output as base64, and confirms that `gpt-5.6-sol` supports the Responses image-generation tool. See [Image generation](https://developers.openai.com/api/docs/guides/image-generation) and [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol).

## Server configuration and security

AI is optional. Uncomment these server-side values in `.env` or `.env.local`:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=replace-with-a-real-server-secret
OPENAI_REASONING_MODEL=gpt-5.6-sol
OPENAI_IMAGE_MODEL=gpt-image-2.5-sunburst
```

The model defaults are centralized configuration, not spread through controllers or React. `OPENAI_API_KEY` is read only by the API configuration/provider factory. It has no `VITE_` prefix, is absent from frontend types and payloads, is never persisted in Project data, and must not be logged.

When `AI_PROVIDER` is absent—or OpenAI is selected without a key—the API and all 2D/3D features still start normally. A generation attempt returns a sanitized `AI_PROVIDER_NOT_CONFIGURED` Problem Details response. Invalid provider names fail central environment validation. Provider authentication, availability, rate limit, timeout, invalid-response, refusal/failure, missing-reference, and unsupported-target cases map to a small stable AI error vocabulary; raw SDK exceptions do not reach the UI.

## Persistence decision

AI-A adds no database table or migration. Requests, sessions, proposals, uploaded references, and generated data URLs are process/request-transient. Existing legacy design-rendering fields in `ProjectSchema` are not used by this new path and were not expanded. This avoids making experimental images part of canonical architecture.

AI-B should introduce an application-owned artifact repository and object storage if a durable proposal gallery is required. Reference images and generated images should then have retention, ownership, authorization, deletion, content-type, size, and lifecycle policies outside `ProjectSchema`.

## AI-B1 manual reference acceptance

Normal tests use fakes/mocks and never make paid calls. Before AI-B2, manually inspect references without choosing **Generate design**:

1. Start the normal local application; no `OPENAI_API_KEY` is required.
2. Select a representative rectangular Room in 3D and open all three thumbnails under **Reference views**.
3. Move/zoom/orbit the user camera, press **Refresh**, and confirm reference framing is unchanged.
4. Repeat with rotated and L/U/T/free-boundary Rooms, elevated Rooms, and a multi-Level Project.
5. Inspect that target boundary Walls, Openings, connected Stairs, floor elevation, and existing Room Furniture remain represented, while unrelated Levels/Rooms do not dominate.
6. Close each dialog with its button and Escape and confirm focus returns to its thumbnail.
7. Do not choose **Generate design** during AI-B1 acceptance.

Visual reference quality is deliberately a human acceptance decision and is not claimed by automated tests.

## Evolution

- **AI-B2:** manually tune/approve reference composition, then exercise the multi-reference provider input and improve provider prompting as a separate change. Live generation remains opt-in manual work.
- **Later AI phases:** durable artifact storage/gallery, job progress for long latency, richer style and preservation controls, and product UX.
- **Gemini/other providers:** implement `InteriorDesignProvider`; reuse target, context, reference, request, proposal, and failure contracts. Provider choice can later be resolved per user/tenant without changing these contracts.
- **User-configured providers:** keep credentials in a future server-side secret facility above the provider factory. Never put keys in `ProjectSchema` or browser state.
- **AI Editing Assistant:** translate future proposals into reviewed, typed CasaStudio editing operations. Never allow an LLM to mutate raw Project JSON.
- **Structured 3D:** later suggestions may select `FurnitureDefinition`s and place canonical `FurnitureItem`s through typed operations. Arbitrary mesh/GLB generation remains post-MVP and is not implied by the image artifact contract.
