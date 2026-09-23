import type {
  LevelReference3D,
  SceneBounds3D
} from "./architectural-scene-3d-model";

/** Tiny presentation separation around the canonical walking datum. */
export const architecturalGroundContactEpsilon3D = 0.001;

/** Presentation-only ground and grid placement around visible architecture. */
export type GroundReference3D = Readonly<{
  centerX: number;
  centerZ: number;
  datumY: number;
  y: number;
  gridY: number;
  size: number;
  divisions: number;
}>;

/**
 * Anchors context to the lowest visible Floor top, then to the lowest visible
 * Level datum, without making context geometry part of architectural bounds.
 */
export function createGroundReference3D(
  levels: readonly LevelReference3D[],
  bounds?: SceneBounds3D
): GroundReference3D {
  const floorElevations = levels.flatMap((level) =>
    level.floors.map((floor) => floor.y)
  );
  const levelElevations = levels.map((level) => level.y);
  const datumY = finiteMinimum(floorElevations) ?? finiteMinimum(levelElevations) ?? 0;
  const span = bounds ? Math.max(bounds.size.x, bounds.size.z) : 5;
  const size = Math.max(10, Math.ceil(span * 1.5));
  return Object.freeze({
    centerX: bounds?.center.x ?? 0,
    centerZ: bounds?.center.z ?? 0,
    datumY,
    y: datumY - architecturalGroundContactEpsilon3D,
    gridY: datumY + architecturalGroundContactEpsilon3D,
    size,
    divisions: Math.min(100, Math.max(10, Math.round(size)))
  });
}

function finiteMinimum(values: readonly number[]): number | undefined {
  const finite = values.filter(Number.isFinite);
  return finite.length > 0 ? Math.min(...finite) : undefined;
}
