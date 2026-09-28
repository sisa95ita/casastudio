# Architectural 3D model

The workspace consumes the immutable `ArchitecturalScene3DModel` in
`apps/web/src/features/project-3d/model`. ProjectSchema remains authoritative.
Room contours and global floor elevations come from a matching Geometry Snapshot
or the Geometry Engine. Walls, Openings and Stair aggregates derive from the
canonical Project. React components receive the resulting model, never API DTOs.
The Snapshot already transports canonical Flight/Landing data and needs no
additional renderer fields. There is no persisted 3D model.

## Coordinates and dimensions

All model geometry is in meters. The existing conversion boundary maps Project X
to scene X, building elevation to Y and Project Z to scene −Z. It supports the
Project's declared metric length unit. Flight elevations are already in building
space; the owning Level elevation must never be added to them.

`architectural3DProfile` contains floor thickness (0.18 m) and Stair structural
slab thickness (0.16 m). Callers can supply the small renderer-neutral profile to
pure derivation. Neither dimension is stored in ProjectSchema.

## Physical Wall bodies and junctions

Canonical Wall start/end segments, thickness, height, and Opening offsets remain
authoritative. `createArchitecturalWallEndpointInterfaces` groups exact canonical
endpoints and sorts incident rays around each node. It intersects each Wall face
line with the adjacent incident face line, producing final left/right physical
interfaces without moving the reference endpoint. This endpoint contract is pure
geometry used by the 3D model; the established 2D plan convention remains
independent.

Incident endpoint directions always point away from their shared node, making the
result independent of canonical Wall direction. A two-Wall corner resolves both
the inner and outer face intersections, so the two Wall bodies share one mitered
end interface. At a T node, the branch interface lands on the through-Wall face;
the two collinear through segments retain their common square caps. Three-or-more
Wall nodes retain overlapping square caps where those caps already cover the
node; only branch-to-through boundaries and an uncovered exterior angular sector
are resolved against adjacent faces. This deterministic overlap policy avoids a
central polygonal void without creating separate junction geometry.

Near-parallel intersections are replaced by a shared bevel point bounded by four
times the largest incident half-thickness and 45 percent of either incident Wall
length. Different thicknesses retain their individual face offsets. Opening
subdivision remains in canonical Wall-local distance: only sections touching a
Wall start or end use its resolved interface, while sill, header, and interior
sections retain their exact spans.

Each resulting four-point section footprint is extruded directly into a closed,
outward-wound Wall solid. Every surface remains owned by its canonical Wall and
uses the shared Wall material, shadow flags, hover, and selection behavior. Final
Wall footprint vertices contribute to Level and scene bounds; presentation
context does not.

## Room floor volumes

`Floor3D.y` is the canonical global walking elevation. `bottomY` is `y` minus the
profile's floor thickness. The renderer does not raise the walking surface.
`createFloorSolid3D` retains the exact existing ear-clipped contour triangulation,
corrects top winding to +Y, reverses the bottom to −Y, and closes every contour
edge with outward vertical faces. Concave Rectangle/L/U/T footprints retain their
area. Top and edges/underside use two restrained materials with one Room identity.

An elevated surface remains a Room. A FREE edge produces a slab edge only; it
never produces a Wall. Lower and elevated Rooms can overlap independently in
plan. Both slabs remain intact. Wall-backed edges overlap the canonical Wall
solid; no constructive subtraction is performed.

## Stair Flights, steps and soffits

`Staircase3D` retains source/destination Level and optional Room references,
Flights, Landings and bounds. `createStairFlight3D` derives a normalized plan
forward axis, perpendicular lateral axis and horizontal run from the actual
canonical endpoints. Invalid/nonfinite endpoints, zero run, nonpositive rise,
invalid width and invalid step count fail before geometry reaches WebGL.

For N steps, interval i spans run fractions i/N to (i+1)/N. Its tread is at
`startY + rise * (i+1)/N`; the last tread uses the exact canonical end Y. The
first vertical riser starts at source Y. Each step is a triangular prism between
the inclined structural top and the horizontal tread, providing a real riser,
tread and lateral faces. Subdivision never accumulates rounded riser heights or
requires a second authoritative tread-depth field. At an intermediate Landing,
the effective start/end anchors are the exact derived Landing exit/entry
interfaces. Step count and canonical elevations remain unchanged.

The Flight's structural top joins its start and end elevations. Its underside is
a parallel plane. Thickness is measured **normal to the incline**, so its vertical
depth is `stairSlabThickness * sqrt(1 + (rise/run)^2)`. The slab has vertical end
cuts at the canonical anchors and closed lateral faces. Steps sit above it; the
Stair is not filled down to the ground. This leaves visible space beneath the
straight soffit.

`getStairUndersideElevation3D(flight, scenePlanPoint)` returns the bottom-plane Y
in meters inside the Flight's plan footprint, or undefined outside it. A tiny
numerical boundary tolerance includes exact endpoints for angled/reversed runs.
Future clearance consumers can compare furniture top Y with this value without
reading Three meshes. The helper does not perform furniture validation and is
specific to a Flight; overlapping Landings or other architecture require their
own volume queries.

## Landings and joins

Landings are centered horizontal rectangular volumes at canonical elevation.
Their renderer-neutral local frame is derived from ordered adjacent Flight
vectors: the normalized incoming direction is `forward`, its perpendicular is
`lateral`, depth follows `forward`, and width follows `lateral`. A quarter-turn
Landing connects the incoming boundary to the boundary reached along the
outgoing vector. A return Landing keeps the two lane centers distinct on its
shared return edge. This vector contract works at arbitrary global rotation and
does not depend on persisted template or rotation metadata.

`StairLanding.position` is the footprint center for current authoring. The
derivation also recognizes the earlier L turn-point and U lane-midpoint anchors
from adjacent Flight topology, producing the same entry/exit contract without a
Project migration. Both 2D presentation and 3D solids consume the normalized
plan geometry.

Incoming final tread elevation, Landing top elevation, and outgoing Flight start
elevation share the canonical transition elevation. Flight slabs terminate at
the same plan interfaces as their steps; the Landing remains a real horizontal
volume using the Stair slab thickness. The inclined slab bottom stays parallel
to its rendered Flight, so renderer-neutral soffit queries use the exact same
effective span and cannot report clearance outside the visible structure.

This convention is deterministic even though the domain does not express an
independent Landing orientation or explicit Flight-to-Landing adjacency. The
ordered topology supplies that adjacency, and its interfaces partition the
walking and structural geometry without duplicate tread area or presentation
offsets. Landing-only aggregates retain their centered footprint with world X as
the fallback frame.

## Visibility, interaction, bounds and rendering

When an owning Level is visible, its entire Staircase is visible, including a
cross-Level destination. Hiding the destination Level does not truncate the
Stair. Same-Level Room connections and cross-Level connections use identical
geometry derivation.

Clicking treads, risers, structural slab or Landing resolves to the canonical
Staircase. Floor top, edge and bottom resolve to the Room. The Inspector displays
read-only dimensions, elevations and semantic references. Hover and selection
use temporary semantic edge overlays, so the surface hierarchy and shared GLB
materials are never recolored or mutated.

Every generated vertex contributes to Stair bounds; Level and scene bounds
include Stair bounds and both floor elevations. Fit/reset and visibility use
these same bounds. Wall bounds use the final endpoint-resolved section footprints.

Each Staircase uploads at most three static BufferGeometries: batched step
wedges, Flight slabs, and Landings. A Room uses two. Pure derived models are
immutable and memoizable. Uploads are memoized, disposed on replacement/unmount,
and never regenerated per frame. Non-indexed outward triangles preserve hard
normals; these volumes use front-sided materials. The viewer remains lazy-loaded.

## Scene presentation

`architecturalPresentationProfile3D` is the renderer-neutral visual contract for
the scene. It centralizes the warm Wall, Floor top, slab edge, Door, Window frame,
glazing, Stair walking, Stair structure, and neutral Furniture fallback roles.
Walls are the primary light architectural surface. Floor tops are warmer and
darker, while exposed slab edges and undersides are quieter and deeper. Stair
steps and Landings share a walking-surface material; inclined slabs and soffits
share the structural material. A Wall Opening remains an invisible hit volume
with an edge overlay only while hovered or selected, so it never reads as glass.

The Canvas explicitly uses sRGB output, ACES filmic tone mapping, and one fixed
exposure suitable for local GLB PBR assets. Window glazing uses one restrained
transparent `MeshPhysicalMaterial` with low transmission and no refraction or
environment-map infrastructure. No HDRI, environment preset, texture library,
or remote runtime asset participates in the architectural finish.

One hemisphere light supplies soft global readability. One warm directional key
light casts soft shadows; its position, orthographic frustum, and clipping range
scale from the complete visible renderer-neutral bounds. The shadow map remains
1024 square. Walls, slabs, Stairs, Furniture, and Door/Window frames cast and
receive shadows; glazing, interaction overlays, the grid, and semantic hit
volumes do not. The neutral context plane receives shadows and is deliberately
non-canonical and non-selectable as Project geometry.

The context plane datum is the lowest visible Room floor top, or the lowest
visible Level datum when there are no Room floors, with zero as the empty-scene
fallback. The plane sits 0.001 m below that walking datum and the grid sits 0.001 m
above it. Floor slabs keep their full volume below their canonical top: the ground
plane visually meets the lowest floor while elevated Room and upper-Level slab
edges remain exposed. Context and grid remain presentation-only, do not contribute
to architectural bounds, and do not change Floor, Wall, or Level elevations.

Architectural materials are created once per Canvas and reused by role. Static
geometry remains memoized independently of lighting and interaction state.
Furniture instances retain cached GLB geometry, source PBR materials, and
textures; only their cloned Object3D nodes receive per-instance shadow flags.
Fallback Furniture uses the same presentation profile. Demand rendering remains
enabled, with OrbitControls invalidating frames while damping or interaction is
active.

## Furniture interaction boundary

The 3D representation remains read-only in View. While the existing Project edit
session is active, a single selected Furniture item can be moved or rotated. No
second Project draft or 3D history exists: 3D renders the editor draft, submits a
completed gesture through the shared Furniture authoring policy, and replaces the
draft once through the normal history action. Undo, Redo, dirty comparison, Save,
and Discard therefore have identical meaning in 2D and 3D. Walls, Rooms, Stairs,
and Openings remain inspectable but not directly manipulable.

Keyboard movement uses the same Project-space axes and centimeter steps as 2D:
Arrow keys nudge by 1 cm and Shift+Arrow nudges by 10 cm. Camera orientation does
not reinterpret those directions. Each accepted nudge passes through the shared
selection translation and Furniture validation operation and creates one history
action; rejected nudges change neither draft nor history. The shared editor
Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl/Cmd+Y shortcuts work in 3D Edit outside
editable controls. Product copy consistently describes this surface as the 3D
workspace, with View mode and Edit mode defining mutation availability.

A Furniture gesture owns only a transient proposal. Pointer motion changes the
semantic Furniture group's transform without updating canonical history or
reloading its cached GLB. The stable drag plane is the current owning Room's
global floor elevation; ray hits on Furniture, Walls, Stairs, or other objects do
not replace it. Three X/Z intersections convert back to Project X/−Z in the
Project length unit, and translation retains the initial pointer-to-anchor
offset. Rotation is around the Furniture center on that same plane and remains
canonical, unnormalized degrees.

Every preview uses the shared 2D Furniture Room resolution and oriented-footprint
validator. Wall and same-floor Furniture intersections block commit, leaving all
canonical state and history unchanged. Stair overlap remains warning-only.
Existing Room ownership is preferred while its polygon contains the anchor; one
unambiguous candidate may be reassigned, while no Room or ambiguous stacked Rooms
cannot commit. Room ownership remains the only source of vertical placement and
no Furniture Y coordinate is persisted.

During a gesture OrbitControls are disabled and pointer capture keeps the
mathematical plane authoritative. Pointer cancellation, Escape, selection or
visibility changes, and representation changes discard the transient proposal
and restore camera controls. The rotation ring and valid/invalid edge feedback
are renderer-only overlays: they cast no shadows, contribute no bounds, and do
not mutate architectural or Furniture materials.

## Camera framing and controls

Initial and Reset framing use the same elevated three-quarter direction and the
center of complete visible scene bounds. Fit uses those renderer-neutral bounds
but preserves the user's current viewing direction. Both apply deterministic
padding. Visibility changes and responsive resizes update clipping without
silently resetting an established view; explicit Fit always reframes the newly
visible content.

Near/far planes and Orbit distance limits scale with physical scene radius. The
near plane stays small enough for close architectural inspection, while the far
plane includes wide footprints, tall Levels, Stairs, elevated slabs, and
Furniture beyond the central footprint without using an unbounded ratio.
Rotation, zoom, pan, damping, and polar limits prevent inversion while retaining
normal architectural exploration.

## Canonical limits

There are no automatic railings, columns, posts, beams, supports or stringers.
Exposed elevated edges honestly remain unguarded. Explicit railing/support
semantics are separate domain requirements.

There are no canonical floor voids. A cross-Level Stair can intersect an upper
Room slab when its canonical footprint overlaps that Room. No heuristic Stair
hole is cut, and no elevated footprint is subtracted from a lower Room. Explicit
floor/slab openings require a future domain contract.

General 3D collision or clearance geometry remains outside this renderer
contract; Furniture manipulation reuses the established 2D plan-placement policy.

## Verification

Pure tests check frames, exact run/rise, invalid geometry, perpendicular slab
thickness, finite-footprint soffit queries, outward closed solids, concave floor
volumes, mixed WALL/FREE boundaries, elevated overlap, same/cross-Level connections,
Landing joins, aggregate bounds, selection and camera containment. The Chromium
vertical-architecture workflow saves generic canonical layouts, renders them,
clicks architectural surfaces, checks Level ownership, and returns to 2D with
unchanged persisted Project state. Existing 3D/editor scenarios cover Wall and
Opening regression, camera interaction and workspace transitions. Furniture
interaction tests cover floor-plane elevation, coordinate reflection, grab
offset, rotation math, shared draft/history commits, and read-only View gating.
