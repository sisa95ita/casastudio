# Architectural plan presentation

CasaStudio's 2D plan uses a restrained architectural hierarchy. Room surfaces establish spatial context first, physical Walls form the strongest geometry, inserted architectural elements remain clearly legible, and Furniture is recognizable without competing with the building. Room labels, dimensions, precision guides, and editor overlays sit above the physical plan only when their information is needed.

## Graphic hierarchy

- Room floors use a quiet neutral ivory fill. Room type does not change the default plan color.
- Walls use their canonical physical thickness, a charcoal solid, and a restrained edge. Presentation join caps close seams between separate Wall primitives without changing topology.
- Doors, Windows, Wall Openings, and Stairs use medium-weight architectural linework. A Door retains its jambs, leaf, hinge, and swing; a Window retains jambs and paired glazing lines; an open passage has jambs without glazing or Door semantics.
- Furniture uses the shared semantic symbols with lighter outer and detail strokes. Names, dimensions, and categories are not painted on the plan.
- Dimensions and precision guides use light, non-scaling strokes. Precision guides use the product accent family so they remain distinct from dimensions and permanent boundaries.
- Hover is subtle and selection uses one clear accent while preserving the underlying entity symbol. Single-object manipulation handles remain governed by editor interaction policy.

SVG document order is intentional: Room fill is below physical geometry, Openings are above Wall bodies, Furniture is below Room labels, stable dimensions follow plan content, and transient editor overlays are last. Diagnostic edge and vertex layers retain their interaction ordering but are visually suppressed in the Project workspace unless needed.

## Elevated Rooms

An elevated floor remains a Room. Its surface uses a differentiated light neutral/sage tint and a dashed extent boundary so a lower overlapping Room remains readable. The extent stroke is presentation linework, not a physical Wall. In particular, a `FREE` boundary edge never enters the architectural Wall layer.

Room labels show the Room name and measured area. A compact elevation line is included only when the Room's local floor elevation differs from its Level datum. Placement starts from the deterministic interior anchor, searches a small and then larger fixed candidate ring, and avoids Furniture, Stairs, prior Room labels, and Wall-body clutter where space permits. If no candidate fits, the preferred anchor remains visible with the text halo.

## Stair continuation

The plan cut is presentation-only and is fixed at 120 Project units above the active Level datum. A StairFlight crossing that elevation receives two derived break strokes at the exact interpolated crossing. Treads and body geometry beyond the cut use reduced opacity and dashed continuation treatment; Landings above the cut use the same subordinate hierarchy. The direction arrow remains legible across the symbol.

The decision is based on each Flight's canonical `startElevation` and `endElevation`, not only on whether Level identifiers differ. It therefore also applies to a same-Level Stair connecting a lower Room to an elevated Room. Cut ratio, break geometry, and continuation styling are recomputed for presentation and are never persisted in Project data.
