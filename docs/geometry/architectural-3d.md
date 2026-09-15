# Architectural 3D model

The viewer consumes the immutable `ArchitecturalScene3DModel` in
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
requires a second authoritative tread-depth field. Canonical endpoints remain
unchanged.

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
Their thickness uses the Stair slab profile because they belong to the same
structural assembly. Placement follows the established 2D footprint convention:
Landing i uses Flight i's plan direction, falling back to the final Flight, or
world X for a Landing-only aggregate. Depth runs along the Flight; width runs
across it. No template identity or persisted rotation participates in rendering.

This convention is deterministic even though the domain does not express an
independent Landing orientation or explicit Flight-to-Landing adjacency. The
canonical centered footprint may overlap adjacent Flight portions. No anchor is
moved to hide that fact. A material depth bias resolves coplanar final-tread and
Landing surfaces without changing physical walking elevations. Arbitrary
canonical layouts are rendered as supplied; the renderer does not repair absent
or disconnected architecture.

## Visibility, interaction, bounds and rendering

When an owning Level is visible, its entire Staircase is visible, including a
cross-Level destination. Hiding the destination Level does not truncate the
Stair. Same-Level Room connections and cross-Level connections use identical
geometry derivation.

Clicking treads, risers, structural slab or Landing resolves to the canonical
Staircase. Floor top, edge and bottom resolve to the Room. The Inspector displays
read-only dimensions, elevations and semantic references. Hover/selection tint
retains the different step, structural and Landing base materials.

Every generated vertex contributes to Stair bounds; Level and scene bounds
include Stair bounds and both floor elevations. Fit/reset and visibility use
these same bounds. Walls and Opening sections retain their existing generation.

Each Staircase uploads at most three static BufferGeometries: batched step
wedges, Flight slabs, and Landings. A Room uses two. Pure derived models are
immutable and memoizable. Uploads are memoized, disposed on replacement/unmount,
and never regenerated per frame. Non-indexed outward triangles preserve hard
normals; these volumes use front-sided materials. The viewer remains lazy-loaded.

## Canonical limits

There are no automatic railings, columns, posts, beams, supports or stringers.
Exposed elevated edges honestly remain unguarded. Explicit railing/support
semantics are separate domain requirements.

There are no canonical floor voids. A cross-Level Stair can intersect an upper
Room slab when its canonical footprint overlaps that Room. No heuristic Stair
hole is cut, and no elevated footprint is subtracted from a lower Room. Explicit
floor/slab openings require a future domain contract.

Furniture assets, furniture clearance validation and final material/lighting
refinement are outside this architecture implementation.

## Verification

Pure tests check frames, exact run/rise, invalid geometry, perpendicular slab
thickness, finite-footprint soffit queries, outward closed solids, concave floor
volumes, mixed WALL/FREE boundaries, elevated overlap, same/cross-Level connections,
Landing joins, aggregate bounds, selection and camera containment. The Chromium
vertical-architecture workflow saves generic canonical layouts, renders them,
clicks architectural surfaces, checks Level ownership, and returns to 2D with
unchanged persisted Project state. Existing 3D/editor scenarios cover Wall and
Opening regression, camera interaction and workspace transitions.
