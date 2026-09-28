# Vertical architecture validation

## Checkout audit

Work started on `feature/3d-mvp-completion` with a clean working tree. No
`AGENTS.md` was found in the checkout. Inspected the 3D model, camera, interaction,
viewer and Inspector; 2D geometry adaptation and Stair footprint/authoring code;
workspace composition; Geometry Engine construction and Stair runtime classes;
canonical Flight/Landing schemas; and API Snapshot mapping/contracts.

The existing scene boundary was pure and immutable. Room contours came from the
Geometry Engine or Snapshot and used ear clipping. Floors were drawn at Y +
0.004 m with no thickness and a double-sided material. Walls used local frames
and rectangular sections around Openings. Doors/Windows already had semantic
geometry. Bounds drove fit/reset and active-Level framing. Renderer loading was
already lazy. Selection resolved canonical identities through the scene model.

Project X maps to scene X, elevation to Y, Project Z to −Z, and centimeters to
meters. Stair elevations were already global building-space values. The Snapshot
already carried every required Flight/Landing dimension and reference. Landing
orientation was not persisted; the established 2D footprint uses the corresponding
Flight's direction, with depth along the Flight and width across it.

## Implementation contracts

- **Profile:** renderer-neutral `Architectural3DProfile`, with 0.18 m floor
  thickness and 0.16 m Stair structural thickness. These are derived parameters.
- **Floors:** canonical top unchanged; bottom at top minus profile thickness.
  Existing triangulation remains authoritative. Top, bottom and every boundary
  side have outward winding. Concave Rectangle/L/U/T floors remain closed.
- **Elevated Rooms:** remain Rooms, can overlap lower Rooms independently, and
  retain both slabs. FREE edges are slab extents and never generate Walls.
- **Stair model:** immutable aggregate with canonical identities/references,
  Flight frames, steps, slabs, Landings and exact bounds. Rendering never consults
  template identity or reads API DTOs in React.
- **Frame:** actual endpoint delta supplies horizontal run and normalized forward;
  a perpendicular lateral axis supplies width. Invalid geometry throws before
  mesh construction.
- **Steps:** N intervals use normalized fractions of exact run/rise. The final
  tread explicitly uses canonical end Y. Triangular prisms above the inclined
  structural plane supply real tread, riser and side faces.
- **Structural slab:** a closed inclined prism with constant perpendicular
  thickness; vertical depth is thickness × sqrt(1 + slope²). It is not persisted
  and does not fill the under-Stair space to ground level.
- **Soffit:** straight parallel bottom plane. The pure
  `getStairUndersideElevation3D` helper returns scene-meter Y inside the Flight
  footprint and undefined outside. It supports future clearance calculations
  without renderer-mesh inspection; furniture validation is not connected.
- **Landings:** centered, horizontal, closed volumes with Stair slab profile
  thickness. Orientation follows existing 2D semantics, with last-Flight/world-X
  fallback. Canonical overlapping joins remain unchanged; depth bias removes
  coplanar tread/Landing display seams without moving walking surfaces.
- **Connections:** same-Level lower Room → elevated Room and cross-Level Stairs
  use one pipeline. Owning Level elevation is never added to Flight elevations.
- **Visibility:** the complete Stair aggregate renders when its owning Level is
  visible, including its destination at another Level.
- **Bounds/camera:** steps, slabs, Landings and both floor elevations participate
  in Level/scene bounds. Fit/reset operate on those bounds.
- **Selection/Properties:** tread, riser, slab and Landing select the Staircase.
  Floor top/edge/bottom select the Room. Properties are informational. Material
  differences remain visible under selection/hover tint.
- **Rendering/performance:** at most three static BufferGeometries per Staircase,
  two per Room; memoized uploads and explicit disposal, no per-step React tree or
  per-frame derivation. Hard outward normals and front-sided volume materials.
- **Regression scope:** existing Wall/Opening geometry and lazy loading retained.

## Validation results

- `pnpm lint`: passed.
- `pnpm test`: passed, 1,114 package tests plus the version-tool tests. Web:
  526 passed. API: 93 passed and 23 existing database-conditional skips because
  the normal task does not supply `DATABASE_URL`; no skip was added as a workaround.
- Focused 3D suite: 83 passed across seven files.
- `pnpm build`: passed; separate `Project3DViewer` chunk retained. Vite reports
  its large-chunk advisory. No chunk limit was increased.
- `git diff --check`: passed.
- Focused Chromium: all five selected scenarios passed. The existing 3D smoke
  and elevated-Room/asymmetric-Stair editor scenarios passed in the initial run.
  The final Straight/L/U vertical-architecture run passed 3/3 in 57.5 seconds.
  No historic editor matrix was rerun.
- Normal Turbo caching was used; no serialization or timeout changes were needed.
  Chromium required execution outside the sandbox after API port binding was
  rejected with EPERM.

Pure tests cover axis-aligned/diagonal/reversed frames, invalid inputs, unit
conversion, exact count/run/rise, final elevation, slab normal thickness, soffit
queries and bounds, Landing dimensions/orientation/joins, same-Level +220 cm,
cross-Level +300 cm and nonzero owning-Level offsets, closed outward solids,
concave floors in both windings, mixed WALL/FREE elevated boundaries, lower-floor
retention, semantic selection/hover/visibility and camera containment. Inspector
tests verify read-only Stair properties. Existing bounds expectations now include
floor thickness.

## Visual audit findings

Inspected actual Chromium overview, low-angle soffit and overhead tread/Landing
screenshots for the generic Straight, L and U Projects. The Straight fixture
connects a lower Room at 0 to an elevated Room at +220 cm on one Level. L/U
fixtures connect Ground to Upper at +300 cm. Every fixture retains a lower slab
under the elevated footprint with exposed FREE edges.

The low-angle views show the real riser/tread silhouette, inclined structural
slab, straight soffit, usable space below the Stair, Landing volume, and closed
upper-floor underside. The overhead views show the canonical Landing footprint
and Flight continuity. The existing multi-Level smoke screenshot preserves Walls,
Doors, Windows and unadorned Openings. No missing/inverted volume faces were seen.

The initial L fixture placed its floor-edge test target precisely at the Stair
side boundary. The actual raycast correctly selected the foreground Stair there.
The generic destination Room was widened by 20 cm so the floor-edge test targets
an exposed Room face. No selection logic or production geometry was changed to
make that assertion pass. Additional low-angle/overhead views made soffit and
Landing inspection clearer. Canonical elevations and anchor positions were not
adjusted during visual review.

Final visual artifacts (disposable, ignored by Git):

- `test-results/vertical-architecture-vert-ab58e-or-and-semantic-interaction-chromium/straight-overview.png`
- `test-results/vertical-architecture-vert-ab58e-or-and-semantic-interaction-chromium/straight-soffit.png`
- `test-results/vertical-architecture-vert-ab58e-or-and-semantic-interaction-chromium/straight-landing-treads.png`
- `test-results/vertical-architecture-vert-5fdc2-or-and-semantic-interaction-chromium/L-overview.png`
- `test-results/vertical-architecture-vert-5fdc2-or-and-semantic-interaction-chromium/L-soffit.png`
- `test-results/vertical-architecture-vert-5fdc2-or-and-semantic-interaction-chromium/L-landing-treads.png`
- `test-results/vertical-architecture-vert-29183-or-and-semantic-interaction-chromium/U-overview.png`
- `test-results/vertical-architecture-vert-29183-or-and-semantic-interaction-chromium/U-soffit.png`
- `test-results/vertical-architecture-vert-29183-or-and-semantic-interaction-chromium/U-landing-treads.png`

## Canonical limits and scope confirmations

No ProjectSchema change, schemaVersion bump, Geometry Snapshot change, Prisma
migration or API contract change occurred. Elevated Rooms remain canonical Rooms.
No railing, post, column, beam, inferred support, heuristic upper-floor Stair void
or Furniture 3D implementation was introduced. Explicit floor openings,
railings/supports and independent Landing orientation/adjacency are domain
requirements if those capabilities are needed later. Canonical disconnected or
overlapping layouts render honestly; the viewer does not repair their architecture.

No timeout was increased. No test was skipped/disabled as a workaround. Jenkins
was not run. No Git stage, commit, push, rebase or amend operation was performed.

## Manual acceptance checklist

Recreate the generic layouts with `createVerticalArchitectureFixture` and orbit/fit
the viewer to check the following. Browser tests save disposable Projects and
delete them after verification. The screenshots above remain available for review.

1. Ordinary Floor has visible thickness.
2. Elevated Room has visible thickness.
3. Elevated FREE edge reads as a slab edge rather than a Wall.
4. Lower Room remains beneath the elevated Room.
5. Straight Stair has real individual steps.
6. L Stair is continuous through its Landing.
7. U Stair is continuous through its Landing.
8. Stair risers/treads have coherent count, run and rise.
9. Inclined structural slab is visible beneath the steps.
10. Stair soffit is straight and credible.
11. Visual space remains underneath the Stair.
12. Landing is a horizontal volume with visible thickness.
13. Same-Level lower → elevated Stair connects at +220 cm.
14. Cross-Level Stair connects at +300 cm.
15. No duplicate Level elevation offset occurs.
16. First riser meets the source Floor elevation.
17. Final tread meets the destination Floor elevation.
18. Camera Fit includes the complete Stair.
19. Clicking a tread selects the Staircase.
20. Clicking the structural slab selects the Staircase.
21. Clicking a Landing selects the Staircase.
22. Clicking a Floor side selects the Room.
23. Existing Walls and Openings remain intact.
24. No fake Wall appears at an elevated FREE edge.
25. No automatic railing appears.
26. No invented structural posts/beams appear.
27. No Furniture 3D appears.

## Exact files changed and final working-tree status

All changes remain unstaged. `git status --short`:

```text
 M apps/web/src/core/i18n/locales/en/project-viewer.json
 M apps/web/src/features/project-3d/Project3DInspector.test.tsx
 M apps/web/src/features/project-3d/Project3DInspector.tsx
 M apps/web/src/features/project-3d/Project3DViewer.tsx
 M apps/web/src/features/project-3d/interaction/architectural-selection-3d.ts
 M apps/web/src/features/project-3d/model/architectural-scene-3d-model.test.ts
 M apps/web/src/features/project-3d/model/architectural-scene-3d-model.ts
 M docs/02-architecture.md
 M docs/14-browser-e2e.md
 M e2e/project-3d.smoke.spec.ts
?? apps/web/src/features/project-3d/model/architectural-3d-profile.ts
?? apps/web/src/features/project-3d/model/architectural-solid-3d.ts
?? apps/web/src/features/project-3d/model/floor-solid-3d.ts
?? apps/web/src/features/project-3d/model/staircase-3d-model.ts
?? apps/web/src/features/project-3d/model/vertical-architecture-3d.test.ts
?? apps/web/src/test/vertical-architecture-fixture.ts
?? docs/geometry/architectural-3d.md
?? docs/reviews/vertical-architecture-validation.md
?? e2e/vertical-architecture.spec.ts
```
