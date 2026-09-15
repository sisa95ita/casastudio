import type { ScenePoint3D } from "./architectural-scene-3d-model";

/** Non-indexed outward-wound triangles in meter-scaled scene space. */
export type ArchitecturalSolid3D = Readonly<{ positions: readonly number[] }>;

/** Freezes triangle vertices; flat triangles preserve hard architectural normals. */
export function createArchitecturalSolid3D(positions: readonly number[]): ArchitecturalSolid3D {
  return Object.freeze({ positions: Object.freeze([...positions]) });
}

/** Combines derived solids without changing geometry or semantic ownership. */
export function mergeArchitecturalSolids3D(solids: readonly ArchitecturalSolid3D[]): ArchitecturalSolid3D {
  return createArchitecturalSolid3D(solids.flatMap((solid) => solid.positions));
}

/** Emits a convex planar face, oriented away from a known interior point. */
export function appendSolidFace3D(
  positions: number[],
  face: readonly ScenePoint3D[],
  interior: ScenePoint3D
): void {
  const [a, b, c] = face;
  if (!a || !b || !c) return;
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const normal = {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x
  };
  const inward = normal.x * (interior.x - a.x) + normal.y * (interior.y - a.y) +
    normal.z * (interior.z - a.z) > 0;
  for (let index = 1; index < face.length - 1; index += 1) {
    const triangle = inward ? [a, face[index + 1]!, face[index]!] : [a, face[index]!, face[index + 1]!];
    for (const point of triangle) positions.push(point.x, point.y, point.z);
  }
}

/** Extrudes a convex run/elevation section across a Flight's width. */
export function extrudeFlightSection3D(
  section: readonly Readonly<{ along: number; y: number }>[],
  width: number,
  pointAt: (along: number, lateral: number, y: number) => ScenePoint3D
): ArchitecturalSolid3D {
  const sides = [-width / 2, width / 2].map((lateral) =>
    section.map((point) => pointAt(point.along, lateral, point.y))
  );
  const points = sides.flat();
  const interior = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    z: points.reduce((sum, p) => sum + p.z, 0) / points.length
  };
  const positions: number[] = [];
  for (const side of sides) appendSolidFace3D(positions, side, interior);
  section.forEach((_, index) => {
    const next = (index + 1) % section.length;
    appendSolidFace3D(positions, [sides[0]![index]!, sides[0]![next]!, sides[1]![next]!, sides[1]![index]!], interior);
  });
  return createArchitecturalSolid3D(positions);
}
