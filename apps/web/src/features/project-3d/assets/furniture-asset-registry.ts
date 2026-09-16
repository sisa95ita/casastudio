/** Visual adaptation limits relative to the semantic catalog's default proportions. */
export type FurnitureDeformationPolicy = Readonly<{
  kind: "free-axes" | "bounded-proportions";
  /** Largest allowed ratio between dimension scale factors before exact-envelope fallback. */
  maxAnisotropy: number;
}>;

/** Native GLB envelope and orientation, independent of canonical catalog dimensions. */
export type FurnitureAssetDefinition = Readonly<{
  resource: string;
  nativeMin: readonly [number, number, number];
  nativeMax: readonly [number, number, number];
  /** Native-to-normalized yaw; normalized front is Three +Z (Project -Z). */
  yaw: number;
  deformation: FurnitureDeformationPolicy;
}>;

const flexible = Object.freeze({ kind: "free-axes" as const, maxAnisotropy: 6 });
const bounded = (maxAnisotropy: number): FurnitureDeformationPolicy =>
  Object.freeze({ kind: "bounded-proportions", maxAnisotropy });
const asset = (resource: string, nativeMin: [number, number, number], nativeMax: [number, number, number], deformation: FurnitureDeformationPolicy): FurnitureAssetDefinition =>
  Object.freeze({ resource, nativeMin: Object.freeze(nativeMin), nativeMax: Object.freeze(nativeMax), yaw: 0, deformation });

/** Presentation-only resources keyed by canonical definition identity; null deliberately uses fallback. */
export const furnitureAssetRegistry: Readonly<Record<string, FurnitureAssetDefinition | null>> = Object.freeze({
  "generic-single-bed": asset(new URL("./models/bedSingle.glb", import.meta.url).href, [0.38500000250536454, 0, -1.125], [0.9559999920426173, 0.375, 0], bounded(2.5)),
  "generic-double-bed": asset(new URL("./models/bedDouble.glb", import.meta.url).href, [-8.792835244630925e-10, 0, -1.125], [0.9559999920426173, 0.375, 0], bounded(2.5)),
  "generic-sofa": asset(new URL("./models/loungeDesignSofa.glb", import.meta.url).href, [0, 0, -0.4100000262260437], [1.1200000047683716, 0.4000000059604645, 0], bounded(2)),
  "generic-chair": asset(new URL("./models/chairCushion.glb", import.meta.url).href, [0, 0, -0.20000000298023224], [0.20000000298023224, 0.46000000834465027, 0], bounded(1.6)),
  "generic-dining-table": asset(new URL("./models/table.glb", import.meta.url).href, [0, 0, -0.44737333059310913], [0.8414879441261292, 0.3267339766025543, 0], bounded(3)),
  "generic-desk": asset(new URL("./models/desk.glb", import.meta.url).href, [-0.009999999776482582, 0, -0.3799999952316284], [0.7244754433631897, 0.38440755009651184, 0.012299999223480212], bounded(3)),
  "generic-cabinet": asset(new URL("./models/bookcaseClosedDoors.glb", import.meta.url).href, [0, 0, -0.25], [0.4000000059604645, 0.8499999642372131, 0], flexible),
  "generic-furniture": null
});

/** Unknown, custom and generic definitions all resolve to the same intentional neutral fallback. */
export function resolveFurnitureAsset(definitionId: string): FurnitureAssetDefinition | undefined {
  return Object.hasOwn(furnitureAssetRegistry, definitionId) ? furnitureAssetRegistry[definitionId] ?? undefined : undefined;
}
