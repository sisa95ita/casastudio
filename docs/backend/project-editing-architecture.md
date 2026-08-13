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
workspace preserves that contract before persistence is integrated.

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

A successful response contains the complete newly authoritative Project and
the incremented `sourceRevision`; no follow-up GET is required.

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

Each operation returns a discriminated `{ ok, project | errors }` result using
stable validation error codes. Expected failures do not throw. Success uses
targeted structural copying: input state and unaffected entity state are not
mutated.

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

The editing session stores:

- `mode`, owning Project ID, complete draft, and `baseRevision`;
- explicit `dirty` state;
- active Level and active `select`, `draw-wall`, or `pan` tool;
- editor selection and hover references;
- transient interaction state reserved for pointer previews.

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
Wall tools will commit pure schema-domain operation results through the
existing draft-replacement action and use transient state for previews.
Autosave, granular mutation
endpoints, HTTP command APIs, collaborative editing, automatic conflict merge,
and automatic conflict merge are not implied by this contract.
