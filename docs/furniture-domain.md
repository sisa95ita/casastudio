# Furniture domain and persistence

Furniture is canonical architectural Project data. A FurnitureItem describes one actual furnishing owned by exactly one Room. It is independent of editor tools, selection, renderers, catalog assets, and AI workflows.

## Ownership and aggregate shape

`Project.building.furniture` is a required ordered array. Each item has a mandatory `roomId` resolving to a Room in the same Project. Room IDs and Furniture IDs are unique per Project within their respective entity kinds. Structural parsing validates the item shape; the existing cross-reference and identifier-uniqueness passes enforce reference existence and unique ownership before persistence.

The Building-wide collection fits the Building's role as the physical aggregate and allows moving an item between Rooms, including Rooms on different Levels, by changing one reference. Furniture is not nested under Room, so there is no competing container ownership. A direct `levelId` is absent. `resolveFurnitureRoom` follows Room ownership to return the Room, Level, and global floor elevation, returning undefined for missing or ambiguous Room identity.

## Instance and catalog contracts

`FurnitureItem` persists:

- `id`: a stable Project entity identifier in lowercase kebab case;
- `roomId`: its sole mandatory architectural owner;
- `definitionId`: an opaque stable catalog identity, including provider namespaces such as `custom-provider:item-123`;
- `position`: `{ x, z }`, the center of its footprint in Project plan coordinates;
- `rotation`: arbitrary finite degrees about positive Y using the right-hand rule, without normalization;
- `width`, `depth`, `height`: finite strictly positive effective dimensions in centimeters;
- optional `name` and `description`, following the existing common metadata convention.

At zero rotation, width lies along local X and depth along local Z, centered on position. A local footprint point `(u, v)` maps to `(x + u cos θ + v sin θ, z - u sin θ + v cos θ)`. Height extends upwards from the owning Room's floor. No Y or elevation is persisted. The global floor is `Level.elevation + (Room.elevation ?? 0)`. Ordinary Rooms, elevated Levels, and elevated Rooms use exactly the same rule. Furniture assigned to vertically stacked Rooms can share X/Z coordinates.

`FurnitureDefinition` is a separate product catalog contract containing a stable `id`, broad `category`, product-facing `name`, and `defaultWidth`, `defaultDepth`, `defaultHeight` in centimeters. Categories are BED, SOFA, TABLE, CHAIR, CABINET, DESK, and GENERIC. Category belongs to the definition, not the instance.

The optional deterministic catalog in `packages/schema/src/furniture/builtin-catalog.ts` is separate from Project schema composition and validation. It contains generic single and double beds, sofa, dining table, chair, cabinet, desk, and generic furniture. Definitions and the catalog array are frozen. No catalog definitions are copied into Projects or database tables. No assets, brands, retailers, or network loading are involved.

`createFurnitureItemFromDefinition` copies defaults into a detached complete instance. Existing instances retain their dimensions if catalog defaults change. Parsing and semantic Project validation do not consult the catalog, so unknown, external, or retired definition IDs remain valid. Catalog resolution returns undefined for unknown identities; consumers can choose their own generic presentation fallback.

## Pure editing and Room operations

`createFurniture`, `updateFurniture`, `moveFurniture`, `rotateFurniture`, `resizeFurniture`, `reassignFurniture`, `deleteFurniture`, and `duplicateFurniture` return the established `ProjectEditingResult`. They never mutate the supplied Project, generate IDs, or change timestamps/revisions. Invalid structure, missing Rooms, duplicate IDs, and unknown Furniture targets return semantic validation errors. Canonical validation runs before success.

Updates preserve instance identity. Duplication requires a new caller-supplied ID and target position, preserves metadata, definition, dimensions and rotation, and retains the Room unless explicitly reassigned. Reassignment can retain or replace X/Z; the derived floor follows the new Room, including across Levels.

Room structural operations preserve aggregate validity:

- `deleteRoom` removes owned Furniture atomically. Existing restrictions for other Room references still apply. The same policy covers elevated standalone Rooms.
- `dissolveRoom` already requires a unique adjacent Room at the same elevation and an exact valid merged boundary. Furniture follows the existing Door/Viewpoint/Staircase policy and transfers to that unique surviving Room. Ambiguous dissolution retains the existing precise domain rejection; nothing is partially changed.
- `partitionRoom` and `reconcileRoomSubdivision` preserve the source Room ID. Furniture remains assigned to that identity; new Rooms start without assigned Furniture. There is no spatial reassignment.
- Shape creation and topology edits preserving Room identity preserve Furniture ownership and properties.

Anchor containment and rotated footprint containment are deliberately deferred. A valid Room relationship is mandatory, but neither the anchor nor full footprint must pass a polygon containment test. Draft Rooms with empty boundaries remain supported. There is no collision, snapping, clearance or Project-wide footprint overlap constraint.

## Schema, API and database

Canonical schema version is `4.0.0`. Deterministic schema-owned migration adds `building.furniture: []` to Furniture-free v3 input and changes only the version otherwise. The v1 and v2 migration entry points chain through to the canonical version. Unexpected non-empty legacy Furniture is rejected rather than discarded. The JSON Schema is generated from Zod with `pnpm generate:schema`.

The complete Project API is the persistence boundary; there is no Furniture-specific REST resource. Explicit DTO mapping transports the full ordered instance collection and detached position values. Frontend Project types are imported from the schema package. Existing full-Project JSON cloning, equality and undo/redo snapshots naturally include Furniture.

PostgreSQL stores normalized `FurnitureItem` rows with scalar coordinates, dimensions, rotation, metadata, and explicit array positions. Technical UUIDs stay inside persistence; canonical IDs are retained in `domainId`. A composite foreign key `(projectId, roomId)` references `(Room.projectId, Room.id)`, preventing cross-Project ownership. Room and Project deletion cascade to Furniture. Unique constraints protect per-Project domain IDs and array positions; check constraints protect finite coordinates/rotation and positive finite dimensions. The aggregate writer recreates subordinate state transactionally in canonical order. The database migration advances existing v3 root versions without changing revision, timestamps, or architectural rows.

No Furniture runtime geometry is introduced. The existing immutable GeometryModel derives topology and architectural spatial facts used by current consumers. Furniture has no geometry consumer here; its required vertical fact is already available through the pure Room resolver. Geometry Snapshot and Geometry API contracts therefore remain unchanged. Canonical Furniture carries no SVG, mesh, transform object, asset URL, or renderer state.
