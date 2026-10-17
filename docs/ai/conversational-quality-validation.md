# AI-C3 — Conversational Quality & Validation

Canonical Furniture placement is layout intent. This applies to root proposals and
every refinement. AI-C is exactly C1 (lineage), C2 (UX) and C3 (quality/validation).
Automated checks validate deterministic contracts; only the owner can accept image
quality. This document does not authorize paid provider calls.

## Constraint hierarchy

| Priority | Meaning | User override |
| --- | --- | --- |
| 1 — Architecture | Room footprint, Walls including internal partitions, Doors, Windows, Wall Openings, Stairs, elevations, dimensions and connectivity are immutable | No architectural-edit feature exists |
| 2 — Canonical Furniture layout | Preserve category/definition role, center position, rotation, approximate footprint, arrangement and relationships to Furniture/Room boundaries | An explicit design instruction can change the requested items/relationships in Proposal pixels |
| 3 — Visual design | Style, materials, colors, upholstery, detailed shape, finishes, decoration, textiles and lighting follow the brief | Freely generative within the higher priorities |

“Make the room warmer” and “Make the room more minimal” preserve layout. “Change
only the bed” must visibly redesign the bed at its canonical placement/orientation.
“Move the table closer to the kitchen”, “Remove the chair”, “Replace the bed with a
sofa bed” and “Try a completely different furniture arrangement” permit the requested
visual layout/category changes. “Create more free space” permits the changes needed
for that goal, without global unrelated redesign. The provider interprets this in
the same request; there is no intent parser or classification call.

Root generation edits Interior A, with Axonometric and Interior B as supporting
architecture/Furniture evidence. Refinement edits the explicitly selected previous
Proposal, with Axonometric, Interior A and Interior B as fresh canonical evidence.
The base supplies visual design state; current canonical layout wins over conflicting
pixels. Requested targets must change visibly; unrelated visual content stays close
to the base. A past visual layout override is not a canonical operation: restate an
intentional exception when needed in subsequent instructions. Pixels alone cannot
distinguish an intended exception from model drift.

## Spatial representation

`deriveDesignContext` copies canonical centers, arbitrary finite degree rotations and
effective instance width/depth/height. Built-in definition names/categories come from
the schema catalog, never renderer assets or AI inference. Unknown definitions retain
their IDs and optional instance names; category remains unresolved.

Items are sorted by stable ID. A translation-only Room-local frame starts at boundary
B1's start when a nondegenerate edge exists. X/Z axes and +Y right-hand rotation remain
canonical: width local X, depth local Z; +90 degrees turns width toward -Z and depth
toward +X. All plan positions are centimeters, not image left/right. Every boundary is
labeled B1…Bn with local endpoints, including free edges. No rectangle, four-Wall,
cardinal-direction, inside-point or corner assumption is used.

Each item has one nearest nondegenerate finite boundary segment, with center distance
and width-axis parallel/perpendicular/oblique relation (one-degree tolerance).
These are center measurements, **not footprint clearance or containment claims**.
Per item, select at most two nearby center relations within the sum of the footprint
half-diagonals plus 100 cm; deduplicate and retain the 24 shortest globally, ties by
stable IDs. Pairs state center separation and width-axis relation only. There are no
guessed functional associations such as “work chair”. Pair candidates are enumerated across item pairs and sorted per item
(O(n² log n) worst-case CPU work); output is bounded to 24 pair lines. Furniture/boundary prose is linear; all items
remain represented. There is no arbitrary Project JSON dump or Three.js object.

All three reference plans include target-Room Furniture; the same visibility mask is
used for all views and restored afterward. Other Room/Level Furniture is excluded.
No omission defect was found. Within AI-C3, the recovered bounded camera planner
now selects Interior A for useful overview coverage and Interior B for complementary
evidence, using canonical geometry and deterministic visibility scores. Axonometric
and the three-reference roles remain unchanged. Occlusion, framing and small assets
still limit individual views; owner visual grading is pending. See the
[camera recovery report and zero-cost reference procedure](ai-c3-reference-camera-recovery-report.md).

## Owner-only manual benchmark

Manually prepare and save a Room containing a bed, desk/table and chair with clearly
intentional placement/orientation, then record its revision and canonical views. The
owner's simple Bedroom is a useful scenario; it is not production or test logic.
The owner separately authorizes and budgets each paid action below. Codex must not
perform these calls or subjective image acceptance.

1. **Root P1:** use “Create a warm contemporary interior with natural materials.”
   This styling-only brief exercises default layout preservation without an extra
   user preservation instruction. Evaluate Room
   silhouette/proportions, Walls/internal partitions, Openings, Stairs; represented
   canonical items; approximate positions/orientations/footprints; important spatial
   relationships; and style compliance. Stop and record a failure if the root already
   loses canonical layout. A coherent refinement of a wrong root does not pass.
2. **Narrow child P2 from P1:** “Replace only the bed with a dark green upholstered bed
   with a tall headboard. Keep everything else unchanged.” The bed should visibly
   change, its placement/orientation should remain, and desk/chair/architecture should
   remain substantially stable.
3. **Sibling P3 from P1:** return explicitly to P1 and use “Replace only the chair with
   a black minimal chair. Keep everything else unchanged.” Compare against P1 and
   canonical truth. P2's green bed must not leak into this branch.
4. **Grandchild P4 from P2:** “Keep the same bed position but use light beige upholstery
   and a simpler headboard. Do not change anything else.” Compare with P2 and the
   canonical Room; inspect cumulative architectural/layout/content/viewpoint drift.
5. **Optional, budget permitting:** from an explicit selected base use “Move only the
   desk closer to the bed. Keep all other furniture and architecture unchanged.”
   Check that only the requested layout relationship changes visually. Verify canonical
   Furniture position/rotation and Project revision remain unchanged by the AI action.
6. To assess a **four-proposal linear path** separately, authorize one further narrow
   edit from P4 (for example “Change only the bed upholstery to muted blue. Keep its
   position and everything else unchanged.”). Compare the entire P1→P2→P4→P5 path
   against canonical truth, not just adjacent pairs. This extra call is optional and
   requires its own owner budget decision.
7. Reload, open history and reconstruct the selected paths and sibling branch. Check
   base IDs/instructions, leaf deletion, parent deletion blocking, and historical
   refinement blocking after a deliberate canonical save. These structural checks
   already have zero-cost automated coverage.

For each refinement score qualitatively: **delta adherence**, **non-target
preservation**, **canonical layout preservation**, **architectural fidelity**, and
**viewpoint stability**. Check cumulative Room proportions, Walls/Openings, Furniture
positions/orientations, disappearance/addition, viewpoint and unrequested style drift.
Use the canonical references and previous Proposal side by side; pairwise similarity
alone cannot establish global fidelity.

MVP threshold: recognizable canonical architecture and substantially preserved root
arrangement; clearly applied narrow deltas with substantially stable non-target design;
no severe cumulative architectural/layout drift; independent branches. The owner makes
the final good-enough-for-MVP decision; no numeric fidelity guarantee is implied.

## Acceptance worksheet (development documentation only)

Record Proposal ID, root/refinement, explicit parent, instruction, Project revision,
provider/orchestration/image model, duration, usage (or “not reported”), output
size/format/quality, then the observations below. Existing Proposal details/telemetry
supply these facts. There is no product rating, metrics dashboard or training-data store.

| Proposal / parent / instruction | Root architecture, presence, placement, relationships, style | Delta adherence | Non-target preservation | Architecture / Furniture-layout / viewpoint drift vs canonical | Pass/fail and observations |
| --- | --- | --- | --- | --- | --- |
| P1 / root / styling brief | Owner to record | N/A | N/A | Owner to record | Pending |
| P2 / P1 / green bed | Compare to P1 and canonical | Owner to record | Owner to record | Owner to record | Pending |
| P3 / P1 / black chair | Compare to P1 and canonical | Owner to record | Includes branch independence | Owner to record | Pending |
| P4 / P2 / beige bed | Compare to P2 and canonical | Owner to record | Owner to record | Cumulative path comparison | Pending |
| Optional override / explicit base | Canonical Project unchanged | Owner to record | Requested item only | Intentional move vs accidental drift | Pending |
| Optional fourth linear Proposal | Compare full path to canonical | Owner to record | Owner to record | Cumulative path comparison | Pending |

## Limits and post-MVP research

Image refinement is probabilistic. Exact Furniture placement, exact “change only X”
pixel preservation and mathematical architectural fidelity cannot be guaranteed.
Canonical Furniture is communicated as layout intent; `ProjectSchema` remains
canonical truth and Proposal pixels remain visual design truth. AI actions never
change Furniture.position/rotation or Project revision. Reviewed typed operations
and Apply Proposal belong to AI-D.

If owner acceptance still fails, record whether the evidence points to provider/model
behavior, weak visual evidence, insufficient structured spatial conditioning, prompt
ambiguity or API conditioning limitations. C3 removed a demonstrable prompt/translation
gap; it does not establish which remaining limitation dominates. Do not endlessly add
prompt wording. Depth, normals, semantic segmentation, object masks, explicit layout
conditioning and CasaStudio adapters/fine-tuning are post-MVP research directions,
not implemented features. No vision scorer, judge, validation model call, retries,
fallbacks or alternate-model experiments are part of C3.

See the [milestone report](ai-c3-milestone-report.md) for exact validation results.
