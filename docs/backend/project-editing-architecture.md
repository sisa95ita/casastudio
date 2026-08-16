# Project Editing Architecture

## Purpose

CasaStudio treats a Project as one authoritative aggregate and one save unit.
Interactive tools may produce many local changes, but the server accepts only a
complete proposed Project through an explicit save. This keeps editing latency
out of the HTTP request path while preserving a single validation,
authorization, concurrency, and transaction boundary.

The frontend editor and backend replacement API share the state boundary
described here. The backend portions define what any editor, automation, or
other caller can rely on; the frontend portions define how the current 2D
workspace preserves that contract throughout editing and persistence.

## Authoritative state and editing drafts

PostgreSQL contains authoritative Project state. TanStack Query owns the
frontend copy of that authoritative response and revision. The 2D workspace
clones that Project into Redux only when a user explicitly enters Edit. Redux
then owns the transient editing draft, active Level, selection, tool,
interaction, and dirty state.

Interactive operations apply only to the local draft. There is no autosave and
no HTTP command stream. A user explicitly saves the complete draft when it is
ready to become authoritative.

```text
PostgreSQL normalized Project
        ↓ GET
TanStack Query authoritative Project + revision
        ↓ clone
Redux editing draft
        ↓ pure editing operations
dirty complete draft
        ↓ explicit PUT
validated transactional replacement + next revision
```

## Project lifecycle API

All endpoints require a valid Keycloak bearer token.

### List Projects

`GET /api/v1/projects` returns:

```json
{
  "projects": [
    {
      "id": "project-domain-id",
      "name": "Apartment",
      "revision": 4,
      "updatedAt": "2026-08-13T10:30:00.000Z"
    }
  ]
}
```

This query reads only root Project metadata. Normal users receive Projects
whose persisted owner subject equals their authenticated Keycloak `sub`.
Administrators receive all Projects under the existing admin override. Results
are ordered by the database update timestamp descending and then domain ID
ascending for deterministic ties.

### Create a Project

`POST /api/v1/projects` accepts user intent only:

```json
{
  "name": "My apartment"
}
```

It returns `201 Created` with the authoritative Project response. The server
generates the Project, Building, and first Level IDs; assigns the authenticated
subject as owner, creator, and updater; and initializes revision one.

The canonical initial aggregate uses schema version `2.0.0`, centimeter and
degree units, an `OTHER` Building named after the Project, and one empty Level
named `Ground Floor` at elevation zero. Rendering workflow collections are
empty. The aggregate passes structural, reference, persisted-geometry, and
Geometry Engine validation, so drawing may start immediately.

### Delete a Project

`DELETE /api/v1/projects/:id` returns `204 No Content` after deleting the
complete persisted Project aggregate. Regular users may delete only Projects
whose persisted owner subject matches their authenticated Keycloak `sub`;
administrators retain the established cross-owner override. Missing Projects
and ownership failures use the same `404` and `403` semantics as authoritative
Project reads and writes.

The repository locks the Project root, evaluates ownership, and deletes the
root inside one Prisma transaction. Every aggregate-owned normalized table has
a direct cascading foreign key to that root: Building and geometry entities,
reference and boundary rows, staircase structures, viewpoints and base images,
design-brief rows, and render requests and results. Cross-entity restrictive
foreign keys continue to protect isolated child deletion while the root
cascade defines complete aggregate ownership. PostgreSQL therefore commits all
root and subordinate deletion together or rolls the statement back. Deleting
the root also releases the owner-scoped normalized-name constraint.

### Read a Project

`GET /api/v1/projects/:id` retains the authoritative response envelope:

```json
{
  "project": {
    "id": "project-domain-id",
    "revision": 4
  },
  "sourceRevision": 4
}
```

The canonical schema currently includes `Project.revision`; `sourceRevision`
is the response-level persisted source marker used by existing clients. They
must agree. Ownership and technical database metadata are never exposed.

### Replace a Project

`PUT /api/v1/projects/:id` is the only Project editing write boundary:

```json
{
  "baseRevision": 4,
  "project": {
    "id": "project-domain-id",
    "revision": 4,
    "...": "complete canonical Project"
  }
}
```

The request is a complete replacement, not a patch. `baseRevision` is
mandatory. The body Project ID must equal the route ID. The body revision must
equal `baseRevision`, and its Project creation/update timestamps must equal the
authoritative editing base. These checks prevent clients from assigning
aggregate identity, revision, or server-managed timestamps. Owner subjects,
technical row IDs, and database timestamps are absent from the contract.

A successful response uses `200 OK` and contains the complete newly
authoritative Project and the incremented `sourceRevision`. API consumers may
use that response directly. The interactive workspace deliberately performs
fresh Project and Geometry reads before returning to View so both rendered
authorities are known to describe the committed revision.

## Workspace persistence lifecycle

View renders only the authoritative Project and Geometry Snapshot owned by
TanStack Query. Edit renders only the isolated Project draft owned by Redux.
Tool choice, selection, hover, viewport, and pointer previews are local
interaction state and do not make an otherwise clean Project saveable.

Save captures one complete draft and its `baseRevision`, sends one replacement
PUT, and blocks workspace interaction while persistence is unresolved. After
the server accepts the replacement, the editing session is removed and the
specific Project and Geometry queries are invalidated and fetched again. View
becomes available only with matching Project revision and Geometry
`sourceRevision`:

```text
dirty Redux draft
        ↓ PUT complete Project + baseRevision
authoritative replacement
        ↓ fresh Project GET + Geometry GET
coherent TanStack View
```

A failed PUT never destroys or modifies the draft, dirty flag, or base
revision. Validation, client, network, and server failures return control to
Edit with local work intact. A successful PUT followed by a failed read is
reported as an authoritative refresh failure, not as a failed save; retrying
performs only the reads and never repeats the replacement.

Discard destroys the matching Redux editing session and its transient
interactions. It does not change or refetch authoritative state in the normal
case. Dirty explicit discard requires confirmation.

Dirty application navigation is held by the router until the user chooses one
of three outcomes. Keep editing cancels the transition, Discard removes the
local session and resumes the exact transition, and Save persists and refreshes
authoritative state before resuming it. Failed navigation-initiated saves
cancel the transition. The browser's native `beforeunload` boundary remains
active only while the current editing session is dirty.

A `409 PROJECT_REVISION_CONFLICT` preserves the exact draft and stale
`baseRevision`; the client does not merge, rebase, or retry automatically.
Keeping the local draft lets the user return to it, but does not make that
stale draft saveable over the newer authoritative revision; another save may
therefore produce the same conflict. Reloading the latest version requires a
second destructive confirmation, then removes the local session and fetches
both authoritative resources before rendering View without automatically
starting another editing session.

## Revision and optimistic concurrency

The persisted Project revision is the authoritative version of the complete
state. It starts at one and increments exactly once per committed PUT.

The persistence repository opens a transaction and selects the stable
technical Project root with PostgreSQL `FOR UPDATE`. The locked row is checked
against `baseRevision` before any root or child mutation. Writers for the same
Project therefore serialize at the row:

```text
writer A locks revision 4 → replaces state → commits revision 5
writer B waits           → reads revision 5 → returns conflict
```

The second writer returns `409 PROJECT_REVISION_CONFLICT`; it does not delete or
insert rows and does not increment the revision. The preliminary revision check
in the application service improves stale-request response time, but the row
lock inside the write transaction is the concurrency guarantee.

Automatic merging is intentionally outside this contract. A client resolves a
conflict by fetching the current authoritative Project and deciding whether to
discard, reapply, or otherwise reconcile its local edits.

## Authoritative validation pipeline

The server validates every proposed aggregate independently of frontend UX:

```text
request envelope validation
        ↓
route/body identity and server-owned fields
        ↓
ProjectSchema structural parsing
        ↓
entity-kind identifier uniqueness
        ↓
cross-reference and reciprocal-reference consistency
        ↓
persisted geometry validation
        ↓
renderability validation when RenderRequests exist
        ↓
Geometry Engine build
        ↓
locked transactional persistence
```

Renderability is conditional because an empty editable Project and rendering
workflow drafts are legitimate authoritative states. Once a Project contains a
RenderRequest, its rendering prerequisites must be complete. Every accepted
Project must still build successfully through the Geometry Engine, including an
empty Project.

Pure editing operations enforce only their local preconditions. They do not run
this complete pipeline after every pointer movement. The hard invariant is:

```text
persisted authoritative Project
⇒ structural and semantic validation succeeds
⇒ Geometry Engine build succeeds
```

## Normalized transactional persistence

The HTTP representation is mapped into normalized Prisma/PostgreSQL tables. No
authoritative Project JSON blob is stored.

For complete saves, CasaStudio retains the technical Project row and replaces
subordinate rows deterministically. Dependent rendering records and reference
tables are deleted before their referenced entities; the Building, Levels,
Rooms, Walls, Openings, Staircases, observations, and rendering workflow rows
are then recreated in canonical array order. Caller-supplied domain IDs are
written unchanged.

The Project root update, all subordinate deletes, all inserts, and the
authoritative read-back execute in one Prisma transaction. A constraint,
connection, mapper, or application failure rolls back the revision, root
fields, child records, references, and ordering positions together. The
technical root ID, owner, creator, and database creation timestamp remain
unchanged across saves.

This replacement strategy favors deterministic correctness over a relational
diff. It can evolve internally without changing the full-Project PUT contract.

## Stable client-generated entity IDs

Editable entities use CasaStudio lowercase kebab-case identifiers. Callers
generate IDs before Save and include them in the complete draft. The server
validates identifier format and uniqueness within each normalized entity kind,
then preserves accepted IDs through persistence and read-back.

There is no temporary-ID/server-ID exchange for Walls or other editable domain
entities. Technical UUID primary keys remain private persistence details.

## Editing-domain operations

The schema package owns pure Project transformations because it already owns
the canonical types, Wall vocabulary, validators, and `reverseWallDirection`.
The first operations are:

- `createWall(project, { levelId, wall })`: appends a locally valid Wall,
  requires an existing Level, preserves the supplied ID, and rejects malformed
  or duplicate Wall IDs and zero-length segments.
- `moveWallEndpoint(project, { levelId, wallId, endpoint, position })`: moves an
  explicit `start` or `end`, preserves Wall identity, and rejects missing
  entities, non-finite points, and a zero-length result.
- `deleteWall(project, { levelId, wallId })`: removes an unreferenced Wall and
  rejects deletion when a Room boundary or reciprocal `roomIds` would dangle.
- `updateWallProperties(project, { levelId, wallId, height?, thickness? })`:
  updates supported scalar properties while preserving Wall identity,
  endpoints, references, Openings, and server-owned Project fields. The
  canonical Wall schema validates the proposed result without clamping.

Each operation returns a discriminated `{ ok, project | errors }` result using
stable validation error codes. Expected failures do not throw. Success uses
targeted structural copying: input state and unaffected entity state are not
mutated.

## Topology-aware Wall authoring

Connected plan topology is persisted through exact Wall endpoint coordinates.
There is no canonical Vertex or Junction entity. When two or more Wall
endpoints contain exactly equal `{ x, z }` values on a Level, the Geometry
Engine derives one runtime Vertex and its incident boundary edges. Editing
operations mutate canonical Project topology; the Geometry Engine only derives
runtime topology and never decides which Project entities to create or split.

Draw Wall resolves pointer intent in this deterministic order:

```text
eligible existing Vertex
        ↓ otherwise
eligible Wall interior
        ↓ otherwise
free canonical pointer point
```

Eligibility and nearest-candidate comparison use one centralized visible
CSS-pixel tolerance. Pointer coordinates begin in browser client space. The SVG
event boundary removes the element's bounding-rectangle origin and accounts for
the SVG viewBox's uniform `xMidYMid meet` scale and centered letterboxing. That
produces one SVG viewBox point, which is compared directly with presentation
geometry expressed in the same SVG coordinate space. The rendered CSS scale
converts SVG distance back to visible pixels, so the intended tolerance remains
stable when the CSS element and viewBox have different sizes.

The editor viewport/display transform is separate from the browser-to-SVG
normalization. It maps Project/world `{ x, z }` coordinates to SVG viewBox
coordinates for rendering, zoom, and pan, and inverts the normalized SVG
pointer into a free canonical Project point when needed. Snapping does not send
that world point back through the projection merely to recover the SVG pointer.
A Vertex candidate returns its exact canonical Project coordinates. A
Wall-interior candidate projects onto the visible segment and retains the
stable source `levelId` and `wallId`. The snap marker projects the candidate's
canonical point through the ordinary world-to-SVG transform; it therefore
lands on the selected geometry while the pointer-to-target separation is the
actual visible snap distance. Equal-distance candidates use stable runtime
identity as a secondary key, so array order cannot change the result.

The candidate and preview remain transient editor state: pointer movement does
not replace the Redux Project draft, mark it dirty, validate the aggregate, or
rebuild the Geometry Engine.

Draw Wall is a continuous interaction chain, not a persisted polyline. Each
successful click after the initial point creates one independent Wall, and the
exact committed endpoint becomes the next segment's continuation point.
Escape clears the unfinished continuation and ends the chain while leaving the
Draw Wall tool active. Already committed Walls remain in the draft. After a
successful commit, the editor excludes the new Wall and checks for an existing
exact endpoint-to-endpoint path in the canonical Wall graph. Such an alternate
path means the new Wall closed a cycle, so the current chain ends naturally and
the next click starts a new chain. A snap to unrelated existing topology does
not stop the chain when no alternate path exists. Closure is evaluated only
after commit, never during pointer movement.

`splitWall(project, { levelId, wallId, splitPoint, newWallId })` divides an
existing canonical Wall. The original ID stays on the original `start` to split
segment; the caller ID belongs to the split to original `end` segment. Both
children retain physical Wall properties and reciprocal `roomIds`. Points off
the segment, at or numerically equivalent to an endpoint, and invalid child
Walls are rejected without mutating the input.

Room boundaries are ordered and oriented traversals. A forward use of a split
Wall expands in place as original-forward then new-forward. A reverse use
expands as new-reverse then original-reverse. Every referencing Room is
rewritten independently, including both sides of a shared Wall, so traversal
continuity and reciprocal references remain valid and the represented Room
area is unchanged.

Openings have an explicit Wall-relative `offsetFromStart` and `width`, so their
split ownership is deterministic. An Opening ending at or before the split
stays on the original child. An Opening starting at or after the split moves to
the new child with:

```text
new offsetFromStart = old offsetFromStart - split distance
```

An Opening whose interior crosses the split point cannot belong to either
child without changing its meaning, so the split returns a typed failure.
Opening IDs and all other Opening properties remain unchanged.

`createConnectedWall` represents one local topology edit. It applies required
start/end Wall splits to immutable intermediate values, creates the new Wall,
and validates the complete canonical result before returning it. The frontend
dispatches only that final Project. If any split or creation precondition fails,
the original Redux draft remains the only visible Project state; there is no
intermediate split-only draft.

Select-mode endpoint movement distinguishes the two endpoint identities of a
selected Wall. A canonical endpoint is standalone when it is the only Wall
endpoint on the Level with those exact coordinates. If another Wall endpoint
uses the same coordinates, runtime geometry derives a shared junction and that
endpoint's independent drag handle is unavailable. The other endpoint remains
draggable when it is standalone. Room-referenced Walls retain their existing
whole-Wall movement restriction. The pointer-down and commit boundaries both
resolve availability from the current draft, so stale interaction state cannot
detach a newly shared endpoint. Junction movement is a distinct future editing
operation; independent endpoint movement never moves or detaches incident
Walls implicitly.

`collapseWallJunction` reverses a redundant split only at an exact degree-two
canonical junction. The two incident segments must be opposite collinear
continuations with matching name, description, height, thickness, and ordered
Room references. The earlier segment in Level order survives, which restores
the original ID for segments produced by `splitWall`; unsafe or ambiguous
junctions are unchanged.

Every Room that uses the segments must contain them as adjacent continuous
boundary traversals. The pair is replaced in place by the surviving Wall with
the orientation that preserves the same traversal start and end. Forward,
reverse, wraparound, and multiple-Room uses follow the same rule. No Room is
created or deleted. Openings retain their IDs and physical spans; their offsets
are projected onto the surviving Wall's orientation, so an Opening from the
second forward segment is shifted by the first segment length. Candidate Walls,
Room boundaries, Opening placement, cross-references, reference consistency,
and geometry must all validate before the collapse is accepted.

`deleteWallAndCollapseRedundantTopology` first applies the ordinary referenced-
Wall deletion restriction, then inspects only the deleted Wall's former
endpoints. Each endpoint may perform the strict collapse above if deletion made
it redundant. Optional unsafe collapses are skipped, unrelated Level topology
is not scanned, and the frontend receives one final validated Project for one
Redux draft replacement and one Geometry Engine rebuild.

Wall graph topology and Room semantics remain separate:

```text
closed Wall cycle != automatic Room entity
```

Splitting an outer Room Wall only expands that Room's existing outer boundary.
A new Wall that starts on the boundary remains an internal standalone Wall. If
it connects two opposite boundary splits and visually partitions the polygon,
the original explicit Room and rewritten outer perimeter remain authoritative;
no second Room is inferred and the internal Wall is not inserted into the Room
boundary.

## Authorization

Create, list, read, save, and geometry reuse the existing JWT principal and
Project ownership policy:

- a user-role principal creates Projects owned by its Keycloak `sub`;
- a user-role principal lists, reads, and saves only owned Projects;
- an admin-role principal may list, read, and save non-owned Projects;
- a principal without the applicable CasaStudio role is forbidden;
- unauthenticated requests return `401`.

No request field can assign ownership. The persistence transaction also checks
the required owner for normal-user saves so authorization is preserved at the
mutation boundary.

## Problem Details semantics

New failures use the shared RFC 9457 response shape and stable top-level codes:

- `400 INVALID_REQUEST` for malformed request envelopes;
- `400 PROJECT_AGGREGATE_ID_MISMATCH` for route/body identity mismatch;
- `400 PROJECT_SERVER_FIELDS_INVALID` for revision/timestamp reassignment;
- `401 UNAUTHORIZED` for missing or invalid authentication;
- `403 PROJECT_ACCESS_FORBIDDEN` (or the shared forbidden code before resource
  lookup) for authenticated callers without access;
- `404 PROJECT_NOT_FOUND` under existing resource-disclosure behavior;
- `409 PROJECT_REVISION_CONFLICT` for a stale editing base;
- `422 PROJECT_STATE_INVALID` for structurally shaped Project data that cannot
  become authoritative because schema, references, renderability, persisted
  geometry, or Geometry Engine validation fails;
- sanitized `500` responses for unexpected read/write provider failures.

Database errors, stack traces, token data, owner subjects, and internal Geometry
Engine causes are not copied into responses.

## Geometry Snapshot coherence

`GET /api/v1/projects/:id/geometry` loads the current normalized Project and
derives geometry on demand. There is no snapshot cache to invalidate. After a
successful PUT, the next geometry request necessarily reads the committed
revision and returns matching `sourceProjectId`, `sourceRevision`, and runtime
geometry derived from the saved Walls and Rooms.

## Frontend View/Edit state contract

The 2D workspace has mutually exclusive interaction modes that are independent
from any future 2D/3D representation choice:

```text
View mode                         Edit mode
TanStack authoritative Project   Redux local Project draft
authoritative Geometry Snapshot  Geometry Engine runtime build
snapshot presentation adapter    runtime presentation adapter
             \                   /
                GeometrySvgViewer
```

View never renders the Redux draft. Edit never mutates or replaces TanStack
Query data. The explicit transition to Edit requires a successfully loaded
authoritative Project, captures its `sourceRevision` as `baseRevision`, and
uses a deep independent clone as the draft. A preferred View Level is retained
when it belongs to the draft; otherwise the first draft Level is selected.
Selection, hover, active tool, and transient interaction state are reset at the
session boundary.

Changing between Select, Draw Wall, Pan, and the neutral tool state clears
editor geometry selection, hover, and incompatible transient interaction
state. Re-dispatching the already active tool is a no-op. Tool changes do not
replace the draft or rebuild runtime geometry.

The editing session stores:

- `mode`, owning Project ID, complete draft, and `baseRevision`;
- explicit `dirty` state;
- active Level and active `select`, `draw-wall`, or `pan` tool;
- editor selection and hover references;
- transient Draw Wall and Wall-endpoint pointer previews.

The draft keeps `id`, `revision`, `createdAt`, and `updatedAt` from the editing
base. `draft.revision` remains equal to `baseRevision`; local operations do not
increment revisions or fabricate timestamps. The committed-draft Redux action
rejects replacements that change these server-owned fields and marks accepted
local changes dirty without comparing serialized Project aggregates on render.

### Geometry source boundary

Authoritative View keeps the existing consistency requirement:

```text
Project sourceRevision == Geometry Snapshot sourceRevision
```

After that check, the snapshot adapter creates the source-independent 2D
presentation model. View does not invoke `GeometryEngine.build`.

Edit memoizes `GeometryEngine.build(draft)` at the stable draft boundary, then
adapts the active runtime Level into the same presentation model consumed by
`GeometrySvgViewer`. Selection, hover, viewport, tool, and inspector changes do
not rebuild runtime geometry. Future pointer previews belong in transient
overlays; a full engine build follows a committed domain edit, not every
pointer movement. An expected or unexpected local geometry failure renders a
safe workspace error while preserving the draft and authoritative query data.

Standalone Walls are valid local draft geometry before they belong to a Room.
The Geometry Engine therefore emits a physical boundary edge and endpoints for
every Wall in a Level; Room references additionally produce edge uses, loops,
and polygons. This lets the runtime adapter and shared viewer render a newly
created Wall without inserting preview objects into runtime geometry.

### Transient interaction and commit boundary

The Redux Project draft is stable canonical state. An unfinished Draw Wall
segment or endpoint drag is editor-only transient state:

```text
pointermove
≠ Project mutation
≠ Geometry Engine build

pointer interaction commit
↓ schema domain operation
new immutable Project
↓ Redux draft replacement
dirty = true
↓ Geometry Engine build
```

Draw Wall stores only its canonical start point and current pointer point until
the second click. Endpoint dragging stores the stable Wall ID, endpoint name,
pointer ID, and proposed point until pointer release. Escape, tool changes, and
Level changes discard these previews without touching the draft. Failed domain
operations also discard the proposal, preserve the draft and prior dirty state,
and expose translated local error feedback.

Transient Wall proposals use a light, short-dashed construction-line style.
During endpoint dragging, the stable boundary edge whose `sourceWallId`
matches the active proposal is visually suppressed while every other stable
entity remains unchanged. Cancelled and failed interactions clear the overlay,
which automatically restores the stable edge without mutating the presentation
model.

### Pointer coordinate boundary

The shared SVG viewer converts pointer coordinates at one renderer-adjacent
boundary. Client coordinates are normalized through the SVG bounding rectangle
and fixed viewBox, then passed through the inverse of the current viewport
transform. The inverse preserves the established orientation in which Project
`x` maps right and increasing Project `z` maps upward while SVG `y` increases
downward:

```text
PointerEvent client XY
↓ SVG viewBox XY
↓ inverse scale and pan offsets
Project level-local {x, z}
```

Draw and drag commits therefore resolve to the same Project coordinates at any
zoom or pan state. No handler derives domain coordinates from raw CSS pixels.

### Wall overlay, identity, and operations

`GeometrySvgViewer` retains one stable presentation renderer and adds one small
editor overlay above polygons, edges, vertices, and centroids. The overlay
renders the unfinished Draw Wall segment, selected-Wall emphasis, and two
screen-relative endpoint handles. Overlay entities never enter the Project or
`GeometryPresentationModel2D`.

Runtime and snapshot boundary edges preserve `sourceWallId`. Edit-mode
selection continues to store the presented geometry reference; exactly one
selected boundary edge resolves through `sourceWallId` to `{ levelId, wallId }`
in the draft. No array index or coordinate matching participates in identity.
Multiple geometry selections remain supported but intentionally expose no
ambiguous endpoint handles.

Draw Wall uses collision-resistant `wall-<uuid>` identifiers compatible with
the lowercase kebab-case schema. New standalone Walls use the established
centimeter defaults of 300 height and 20 thickness, with no Room IDs or
Openings. These defaults are centralized in the frontend Wall-editing helper.
A successful second click calls `createWall`, clears only the preview, and
leaves Draw Wall active for another independent segment.

Endpoint release calls `moveWallEndpoint` once for a standalone Wall. The
selected Wall ID and fixed opposite endpoint are preserved; pointer movement
changes only the overlay. A Wall with non-empty `roomIds`, or one referenced by
an owning Level Room boundary, remains selectable but exposes no endpoint
handles. The commit boundary rechecks the same canonical references and does
not call `moveWallEndpoint` for such a Wall. This prevents independent endpoint
movement from making a Room boundary discontinuous while retaining inspection,
property editing, and the existing non-cascading delete restriction.
Deletion from Delete/Backspace or the Selection inspector shares one action
that calls `deleteWall`. Keyboard deletion is ignored in editable controls and
all Wall mutation paths are unavailable in View and phone layouts. Referenced
Wall rejection is presented without cascading into Room changes.

The Edit-mode Selection inspector dispatches on runtime geometry kind. A
selected Wall reads canonical length, thickness, height, and endpoints from the
active draft and Project units. Length and endpoints remain read-only. Height
and thickness use controlled numeric fields whose intermediary text remains
local; blur or Enter commits through `updateWallProperties`, while rejected
values restore the canonical value and leave the draft unchanged.

A selected runtime Vertex remains a presentation entity rather than a
persisted Project entity. Its inspector shows runtime X/Z coordinates and
derives incident boundary edges by exact runtime vertex IDs. Connected stable
Wall IDs come from those edges' `sourceWallId` values; no coordinate matching
or Vertex mutation API is involved. Other geometry kinds continue through the
generic geometry inspector.

### Session exit and navigation safety

A clean editing session may return directly to View and is then removed from
Redux. A dirty session cannot return to View through the mode control and
cannot leave through ordinary React Router navigation. The current guard keeps
the draft intact and exposes no fake Save result. A dirty matching session also
registers the standard browser `beforeunload` protection; View and clean Edit
do not register it.

The editing session is keyed by Project ID. Project route changes reset clean
stale sessions and selection/transient state. Dirty sessions are retained for
the navigation guard, and a route whose ID does not own the session never
renders that draft. Query keys and request cancellation continue to prevent
late authoritative data from the previous route from becoming current data.

### Responsive editing boundary

Desktop provides the canvas with a persistent side inspector. Tablet layouts
keep Edit available and place the tabbed Layers, Selection, and Properties
inspector below the canvas. Phone layouts always render the authoritative
read-only Project preview and explain that advanced editing requires a larger
screen. A local editing session is never rendered on a phone, but resizing does
not silently discard it.

### Persistence integration handoff

Explicit Save will extend the existing sequence:

```text
GET project summaries or POST a new Project
        ↓
GET authoritative Project + sourceRevision
        ↓
clone Project into the existing Redux editing session
        ↓
apply pure editing-domain operations locally
        ↓
track dirty state without network writes
        ↓
run frontend validation for immediate UX feedback
        ↓
PUT complete Project + baseRevision
        ↓
replace TanStack Query data with the authoritative mutation response
        ↓
invalidate/refetch geometry when geometry is visible
        ↓
clear the saved Redux draft and dirty state
```

The frontend must keep `baseRevision` from the authoritative response that was
cloned, must not rewrite Project IDs or timestamps, and must preserve generated
entity IDs through local operations. A `409` leaves the local draft intact for
an explicit user conflict decision. A `422` leaves the server and revision
unchanged and may be presented using the returned validation paths.

Save and intentional abandonment remain explicit user actions. The current
frontend does not call PUT and does not claim that either operation succeeded.
Wall tools commit pure schema-domain operation results through the
existing draft-replacement action and use transient state for previews.
Autosave, granular mutation
endpoints, HTTP command APIs, collaborative editing, automatic conflict merge,
and persistence of local edits are not implied by this contract.

# Project discovery, creation, and deletion

The authenticated `GET /api/v1/projects` endpoint is the authoritative discovery boundary. Regular Project users receive only summaries owned by their authenticated subject; administrators retain the established cross-owner visibility. Results are ordered by the persistence update time descending and then by domain ID, which makes ordering deterministic. The web application keeps this server state in TanStack Query under the Project list key and does not copy it into the editor Redux store.

`POST /api/v1/projects` accepts only user-editable creation information, currently `{ name }`. The service trims the name, generates all domain identifiers and the creation time, and delegates the aggregate defaults to `createInitialProject(...)`. Successful creation therefore produces revision one with one empty Ground Floor without trusting the browser to provide IDs, ownership, revision data, or empty geometry structures.

Project-name uniqueness is scoped to the authenticated owner. Comparison trims surrounding whitespace and lowercases with the `en-US` locale while preserving the trimmed display name. A frontend comparison against the loaded list provides immediate feedback, an application-service availability check expresses the semantic rule, and the database compound unique constraint on owner subject plus normalized name provides the final concurrent-write guarantee. Database constraint violations are translated to the `PROJECT_NAME_CONFLICT` Problem Details code with HTTP 409.

After creation, the web application invalidates the Project list and navigates to `/app/projects/:projectId`. The new route begins in View mode and follows the normal authoritative `GET Project` plus `GET Geometry Snapshot` lifecycle; no editor draft is created until the user explicitly enters Edit.

Project deletion originates only from the authenticated Project list. The
secondary actions menu opens an explicit irreversible-action confirmation and
submits through a TanStack Query mutation. The list is not optimistically
filtered: it remains unchanged while the request is pending and after any
failure. After a successful `204`, the mutation removes only the deleted
Project detail and Geometry query entries, invalidates the Project list key,
and waits for the authoritative list refetch. Redux remains limited to the
local editing session and has no deletion state.
