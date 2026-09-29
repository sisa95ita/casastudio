import type {
  Floor3D,
  ScenePlanVector3D,
  Wall3D
} from "../model/architectural-scene-3d-model";

/** Matches the domain topology tolerance after conversion to renderer meters. */
const architecturalOverlapTolerance = 1e-9;

/**
 * Derives reference-visible Walls from Room ownership plus resolved physical
 * overlap. The caller supplies only the target Level, so cross-Level geometry
 * cannot enter the result.
 */
export function deriveRoomReferenceWallIds3D(
  floor: Floor3D,
  levelWalls: readonly Wall3D[]
): readonly string[] {
  const wallIds = new Set(
    floor.boundaryWallIds.filter((id): id is string => Boolean(id))
  );
  const floorTriangles = floor.triangles.map((triangle) =>
    triangle.map((index) => floor.contour[index]!)
  );

  for (const wall of levelWalls) {
    if (
      wallIds.has(wall.id) ||
      wall.bodySections.some((section) =>
        floorTriangles.some((triangle) =>
          convexPolygonsHaveMaterialOverlap(section.contour, triangle)
        )
      )
    ) {
      wallIds.add(wall.id);
    }
  }

  return Object.freeze([...wallIds]);
}

/**
 * Separating-axis test for positive-area overlap. Boundary-only contact is not
 * material; a Wall footprint must occupy some Room floor area beyond the
 * scale-relative architectural tolerance.
 */
function convexPolygonsHaveMaterialOverlap(
  first: readonly ScenePlanVector3D[],
  second: readonly ScenePlanVector3D[]
): boolean {
  for (const polygon of [first, second]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]!;
      const end = polygon[(index + 1) % polygon.length]!;
      const edgeX = end.x - start.x;
      const edgeZ = end.z - start.z;
      const length = Math.hypot(edgeX, edgeZ);
      if (length <= Number.EPSILON) continue;
      const axis = { x: -edgeZ / length, z: edgeX / length };
      const firstProjection = projectPolygon(first, axis);
      const secondProjection = projectPolygon(second, axis);
      const overlap =
        Math.min(firstProjection.max, secondProjection.max) -
        Math.max(firstProjection.min, secondProjection.min);
      const scale = Math.max(
        1,
        Math.abs(firstProjection.min),
        Math.abs(firstProjection.max),
        Math.abs(secondProjection.min),
        Math.abs(secondProjection.max)
      );
      if (overlap <= architecturalOverlapTolerance * scale) return false;
    }
  }
  return true;
}

function projectPolygon(
  polygon: readonly ScenePlanVector3D[],
  axis: ScenePlanVector3D
): Readonly<{ min: number; max: number }> {
  const projections = polygon.map((point) => point.x * axis.x + point.z * axis.z);
  return {
    min: Math.min(...projections),
    max: Math.max(...projections)
  };
}
