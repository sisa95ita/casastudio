import type { Floor3D, ScenePoint3D } from "./architectural-scene-3d-model";
import { createArchitecturalSolid3D, type ArchitecturalSolid3D } from "./architectural-solid-3d";

/** Material roles for semantic Floor surfaces, kept independent of mesh batching. */
export const floorSurfaceMaterialRoles3D = Object.freeze({
  top: "floorTop" as const,
  wallEdge: "wall" as const,
  freeEdge: "floorEdge" as const,
  bottom: "floorBottom" as const
});

/** Closed floor volume split into walking surface, semantic sides, and underside. */
export type FloorSolid3D = Readonly<{
  top: ArchitecturalSolid3D;
  wallEdges: ArchitecturalSolid3D;
  freeEdges: ArchitecturalSolid3D;
  bottom: ArchitecturalSolid3D;
}>;

/** Preserves exact ear-clipped contours, including concave and FREE Room boundaries. */
export function createFloorSolid3D(floor: Floor3D): FloorSolid3D {
  if (floor.boundaryKinds.length !== floor.contour.length) {
    throw new Error("Floor boundary semantics must match its contour edges.");
  }
  const top: number[] = [];
  const wallEdges: number[] = [];
  const freeEdges: number[] = [];
  const bottom: number[] = [];
  const emit = (output: number[], points: readonly ScenePoint3D[]) => {
    for (const point of points) output.push(point.x, point.y, point.z);
  };
  const at = (index: number, y: number) => ({ ...floor.contour[index]!, y });
  for (const triangle of floor.triangles) {
    const [a, b, c] = triangle.map((index) => at(index, floor.y)) as [ScenePoint3D, ScenePoint3D, ScenePoint3D];
    const normalY = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    const points = normalY > 0 ? [a, b, c] : [a, c, b];
    emit(top, points);
    emit(bottom, [...points].reverse().map((p) => ({ ...p, y: floor.bottomY })));
  }
  const area = floor.contour.reduce((sum, p, index) => {
    const next = floor.contour[(index + 1) % floor.contour.length]!;
    return sum + p.x * next.z - next.x * p.z;
  }, 0);
  floor.contour.forEach((_, index) => {
    const next = (index + 1) % floor.contour.length;
    const quad = [at(index, floor.y), at(next, floor.y), at(next, floor.bottomY), at(index, floor.bottomY)];
    if (area < 0) quad.reverse();
    emit(
      floor.boundaryKinds[index] === "WALL" ? wallEdges : freeEdges,
      [quad[0]!, quad[1]!, quad[2]!, quad[0]!, quad[2]!, quad[3]!]
    );
  });
  return Object.freeze({
    top: createArchitecturalSolid3D(top),
    wallEdges: createArchitecturalSolid3D(wallEdges),
    freeEdges: createArchitecturalSolid3D(freeEdges),
    bottom: createArchitecturalSolid3D(bottom)
  });
}
