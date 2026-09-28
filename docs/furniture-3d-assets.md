# Furniture 3D assets

`FurnitureDefinition` in `packages/schema/src/furniture/builtin-catalog.ts` owns names,
categories and default dimensions. The presentation registry in
`apps/web/src/features/project-3d/assets/furniture-asset-registry.ts` owns only local
resource URLs, measured native envelopes, orientation corrections and deformation
limits. It does not duplicate catalog defaults. `generic-furniture` deliberately
resolves to fallback; unrecognized/custom IDs resolve to the same fallback.

## Resources and provenance

The seven GLBs are unchanged files from [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit),
distributed under [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
The original license is preserved alongside the models as `Kenney-LICENSE.txt`.
No attribution is required, but Kenney is credited here. These are externally
authored static meshes, not generated boxes. Beds contain bedding/pillows, seating
contains backs/cushions/supports, the desk has drawers, and the cabinet has doors
and handles. Their style is simplified architectural/game furniture, not photorealistic
product scans. Catalog-level visual acceptance should be reviewed at the intended zoom.

Acquisition archive:
`https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip`

Archive SHA-256: `e67652d0932cee41683f74711c03d3e192a2af9979ef8e6b237711f5482d46b0`.
The web page labels the release 1.0; the included license labels it 2.0. The hash
identifies the exact archive independently of that upstream inconsistency.
Copy the files below from `Models/GLTF format/` without conversion. Run
`node apps/web/scripts/inspect-furniture-assets.mjs` to audit them through Three's
actual GLTFLoader and precise vertex bounds. The asset tests verify the measured
bounds against the registry, resource validity, static scope and absence of external data.

| Definition | GLB | Bytes | Policy: maximum relative axis ratio |
| --- | --- | ---: | --- |
| generic-single-bed | bedSingle.glb | 18,636 | bounded proportions: 2.5 |
| generic-double-bed | bedDouble.glb | 23,368 | bounded proportions: 2.5 |
| generic-sofa | loungeDesignSofa.glb | 9,128 | bounded proportions: 2 |
| generic-chair | chairCushion.glb | 12,588 | bounded proportions: 1.6 |
| generic-dining-table | table.glb | 8,196 | bounded proportions: 3 |
| generic-desk | desk.glb | 15,048 | bounded proportions: 3 |
| generic-cabinet | bookcaseClosedDoors.glb | 22,644 | free axes with extreme-distortion guard: 6 |
| generic-furniture | deliberate neutral fallback | 0 | exact effective dimensions |

Total: **109,608 bytes (107.04 KiB)**. Largest file: 23,368 bytes.
There are **no textures**, animations, skins, morph targets or required compression
extensions. The GLB-contained standard PBR colors, roughness and metalness are
preserved. No textures are fetched; no remote runtime resource exists. No Draco or
Meshopt is justified for this asset budget; both optional Drei decoder paths are
explicitly disabled. Existing scene lighting is unchanged.

Vite statically resolves `new URL(..., import.meta.url)` in the registry and emits
fingerprinted local files. URLs may be present in the lightweight model chunk;
GLTF parsing, Three rendering, and requests stay behind the existing lazy 3D viewer.
No catalog preloading occurs. Only currently mounted visible furnishings with an
adaptable asset call the loader, so unused definitions are never fetched.

## Coordinate and dimension contract

The renderer-neutral `FurnitureModel3D` is derived before JSX, from the canonical
Project. It retains semantic ID, Room/derived Level, definition, display information,
effective meter dimensions, center/base position, canonical degrees, renderer yaw,
optional asset and rotated physical bounds. Existing workspace memoization owns
scene derivation. Bounds and Fit never wait for asynchronous Three traversal.

Native GLBs are offset from the origin. The registry records their full visual
min/max measured offline once with `Box3.setFromObject(scene, true)`. Normalization
first applies native yaw, then translates the rotated bounds center to X/Z zero
and the floor minimum to Y zero, then independently scales X/Y/Z to width/height/depth.
All shipped native yaw corrections are zero: their back/head is native -Z and
front is +Z, consistent with reflected canonical 2D semantics. Registry corrections
are separate from instance rotation; synthetic offset/quarter-turn tests cover this
contract. An author adding another model must audit forward orientation and native bounds.

Project X maps to Three X, elevation to Three Y, and Project Z to Three -Z.
Centimeters become meters through existing conversion helpers. Canonical positive-Y
right-hand rotation therefore becomes **negative** Three yaw in radians. Tests compare
0°, 90°, 180° and 37° (plus signed/multi-turn angles) to the actual 2D footprint and
asymmetric forward cue. Canonical degrees are never changed or quantized.

`resolveFurnitureRoom` supplies Level elevation plus Room local elevation. Furniture
rests on the floor **top**, without adding/subtracting slab thickness. Items sharing
X/Z can independently occupy lower, raised and upper Room floors. Neither Y nor
Level ID is persisted on Furniture.

Canonical `FurnitureItem.width/depth/height` always win. For adaptation, compare
item/default ratios; the maximum ratio divided by the minimum measures distortion
relative to the intended catalog proportions. A cabinet permits broad independent
scaling; chairs have the tightest bound. Tables/desks and beds are moderately flexible.
Root scaling is sufficient for these static assets; no parametric reconstruction or
business rules are introduced. If the policy limit is exceeded, use exact-size
fallback rather than clamp dimensions or render an incorrect envelope.

The rotated enclosing envelope contributes to Level and scene bounds and camera Fit,
including items extending outside architectural floor bounds. This envelope is the
canonical furniture bounding volume, not a per-triangle collision hull.

## Loading, fallback and interaction

`useGLTF(resource, false, false)` uses the installed R3F `useLoader` cache keyed by
loader and URL. Repeated instances share the same parsed geometry/materials and
clone only their static Object3D hierarchies. No custom fetch/parse cache is needed.
No per-frame asset work or bounds traversal occurs. Cached resources remain owned
by the loader for the session; `dispose={null}` prevents one instance unmount from
disposing resources still used by others. Instance transforms do not mutate the
cached source. GPU instancing is unnecessary for this small static catalog.

Each item has its own Suspense fallback and React error boundary. Loading/rejection/
malformed GLB errors retain a restrained neutral chamfered volume with recessed
plinth at the exact effective dimensions, elevation and rotation. Unknown definitions,
generic furniture and extreme proportions use the same representation. Failures are
isolated to the asset subtree: the semantic parent, other items and Canvas survive.
Failed loader cache entries are not automatically retried every render.

All child-mesh pointer events bubble to the existing semantic interaction group;
selection remains `furniture` plus canonical item ID and Room-derived Level. The
existing store and orbit-drag suppression are reused. Hover/selection draws a thin,
transient envelope outline; it never changes cached GLB materials. No permanent
bounding box is shown. The Inspector displays name, definition, category, Room, Level,
floor elevation, width, depth, height and rotation, using text only. Asset paths do
not appear in product information. No placement, drag, rotate or resize UI exists.

## Manual visual acceptance

1. [ ] Single bed recognizable, including pillow and bedding.
2. [ ] Double bed recognizable and distinct from single bed.
3. [ ] Sofa recognizable.
4. [ ] Chair recognizable.
5. [ ] Dining table recognizable.
6. [ ] Desk distinguishable from table through drawers/supports.
7. [ ] Cabinet/storage recognizable through doors and handles.
8. [ ] Generic fallback intentional.
9. [ ] Assets rest on floor tops without floating/sinking.
10. [ ] Elevated-Room Furniture appears at its own floor elevation.
11. [ ] Arbitrary rotation matches 2D front/back orientation.
12. [ ] Edited width reflected in 3D.
13. [ ] Edited depth reflected in 3D.
14. [ ] Edited height reflected in 3D.
15. [ ] Extreme valid dimensions degrade to exact-size fallback.
16. [ ] PBR materials readable at architectural viewing scale.
17. [ ] No excessive/blurry textures (shipped assets have none).
18. [ ] Repeated same-definition items load consistently.
19. [ ] Selection identifies only the intended Furniture.
20. [ ] Hover preserves materials of all instances.
21. [ ] Inspector values and Room/Level context correct and read-only.
22. [ ] Camera Fit includes rotated, elevated and outlying Furniture.
23. [ ] Level visibility hides the correct Room-owned items.
24. [ ] Missing-resource/unknown-definition fallback remains selectable.
25. [ ] Existing Stair steps, joins and soffits remain correct.
26. [ ] Existing elevated slab volumes remain correct.
27. [ ] Returning to 2D preserves canonical Furniture and authoring behavior.
