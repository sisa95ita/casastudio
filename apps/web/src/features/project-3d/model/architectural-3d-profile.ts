/** Renderer-neutral derived architectural dimensions, expressed in meters. */
export type Architectural3DProfile = Readonly<{
  floorThickness: number;
  /** Perpendicular distance between the inclined Flight's structural planes. */
  stairSlabThickness: number;
}>;

/** Restrained architectural defaults; neither dimension is persisted in ProjectSchema. */
export const architectural3DProfile: Architectural3DProfile = Object.freeze({
  floorThickness: 0.18,
  stairSlabThickness: 0.16
});
