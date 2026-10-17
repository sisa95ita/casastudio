import type {
  ScenePoint3D,
  ScenePlanVector3D
} from "../model/architectural-scene-3d-model";
import type { FurnitureModel3D } from "../model/furniture-3d-model";

/** Canonical convex footprint extruded vertically, including resolved Wall sections. */
export type InteriorSolid3D = Readonly<{
  id: string;
  contour: readonly ScenePlanVector3D[];
  bottom: number;
  top: number;
}>;

export function distanceToPlanSegment3D(
  p: ScenePlanVector3D,
  a: ScenePlanVector3D,
  b: ScenePlanVector3D
): number {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)
    )
  );
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}

export function insidePlanPolygon3D(
  p: ScenePlanVector3D,
  polygon: readonly ScenePlanVector3D[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!,
      b = polygon[j]!;
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  return inside;
}

export function planClearance3D(
  p: ScenePlanVector3D,
  polygon: readonly ScenePlanVector3D[]
): number {
  return Math.min(
    ...polygon.map((a, i) =>
      distanceToPlanSegment3D(p, a, polygon[(i + 1) % polygon.length]!)
    )
  );
}

export function furnitureLocalPoint3D(
  item: FurnitureModel3D,
  x: number,
  y: number,
  z: number
): ScenePoint3D {
  const c = Math.cos(item.yaw),
    s = Math.sin(item.yaw);
  return {
    x: item.position.x + x * c + z * s,
    y: item.position.y + y,
    z: item.position.z - x * s + z * c
  };
}

export function furnitureSolid3D(item: FurnitureModel3D): InteriorSolid3D {
  return {
    id: `furniture:${item.id}`,
    contour: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ].map(([x, z]) =>
      furnitureLocalPoint3D(
        item,
        (x! * item.width) / 2,
        0,
        (z! * item.depth) / 2
      )
    ),
    bottom: item.position.y,
    top: item.position.y + item.height
  };
}

/** Slab/half-plane segment clipping: actual convex prism, not its world AABB. */
export function segmentHitsInteriorSolid3D(
  start: ScenePoint3D,
  end: ScenePoint3D,
  solid: InteriorSolid3D
): boolean {
  return segmentHitsPlanes3D(start, end, interiorSolidPlanes3D(solid));
}

type SolidPlane3D = Readonly<{
  x: number;
  y: number;
  z: number;
  offset: number;
}>;

/** Compile static prism faces once, rather than rebuilding them for each sample ray. */
function interiorSolidPlanes3D(
  solid: InteriorSolid3D
): readonly SolidPlane3D[] {
  const planes: SolidPlane3D[] = [
    { x: 0, y: -1, z: 0, offset: solid.bottom },
    { x: 0, y: 1, z: 0, offset: -solid.top }
  ];
  const center = averageInteriorPoints3D(solid.contour);
  for (let i = 0; i < solid.contour.length; i++) {
    const a = solid.contour[i]!,
      b = solid.contour[(i + 1) % solid.contour.length]!;
    const nx = b.z - a.z,
      nz = a.x - b.x;
    const sign = (center.x - a.x) * nx + (center.z - a.z) * nz > 0 ? -1 : 1;
    planes.push({
      x: sign * nx,
      y: 0,
      z: sign * nz,
      offset: -sign * (a.x * nx + a.z * nz)
    });
  }
  return planes;
}

function segmentHitsPlanes3D(
  start: ScenePoint3D,
  end: ScenePoint3D,
  planes: readonly SolidPlane3D[]
): boolean {
  let low = 0,
    high = 1 - 1e-5;
  for (const plane of planes) {
    const atStart =
      start.x * plane.x + start.y * plane.y + start.z * plane.z + plane.offset;
    const atEnd =
      end.x * plane.x + end.y * plane.y + end.z * plane.z + plane.offset;
    if (atStart > 0 && atEnd > 0) return false;
    const delta = atEnd - atStart;
    if (Math.abs(delta) < 1e-12) {
      if (atStart > 0) return false;
      continue;
    }
    const t = -atStart / delta;
    if (delta > 0) high = Math.min(high, t);
    else low = Math.max(low, t);
    if (low > high) return false;
  }
  return low <= high;
}

export function averageInteriorPoints3D(
  points: readonly ScenePlanVector3D[]
): ScenePlanVector3D {
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    z: points.reduce((sum, p) => sum + p.z, 0) / points.length
  };
}

/** Stable spatial spread; never uses random sampling or input mutation. */
export function spreadInteriorPoints3D<T extends ScenePlanVector3D>(
  points: readonly T[],
  limit: number
): T[] {
  const remaining = [
    ...new Map(
      points.map((p) => [`${p.x.toFixed(8)}:${p.z.toFixed(8)}`, p] as const)
    ).values()
  ].sort((a, b) => a.x - b.x || a.z - b.z);
  if (!remaining.length || limit <= 0) return [];
  const selected = [remaining.shift()!];
  const distances = remaining.map((p) =>
    Math.hypot(p.x - selected[0]!.x, p.z - selected[0]!.z)
  );
  while (remaining.length && selected.length < limit) {
    let best = 0,
      maximum = -1;
    distances.forEach((distance, index) => {
      if (distance > maximum) {
        best = index;
        maximum = distance;
      }
    });
    const next = remaining.splice(best, 1)[0]!;
    distances.splice(best, 1);
    selected.push(next);
    // Maintain the nearest selected distance: O(points × limit), not × limit².
    remaining.forEach((p, index) => {
      distances[index] = Math.min(
        distances[index]!,
        Math.hypot(p.x - next.x, p.z - next.z)
      );
    });
  }
  return selected;
}

/** Small static broad phase over canonical solids; built only when references change. */
export function createInteriorOcclusionQuery3D(
  solids: readonly InteriorSolid3D[],
  maximumTests: number
) {
  type Node = {
    planes: readonly SolidPlane3D[];
    children?: readonly [Node, Node];
    solids?: readonly Readonly<{
      id: string;
      planes: readonly SolidPlane3D[];
    }>[];
  };
  const envelope = (items: readonly InteriorSolid3D[]): InteriorSolid3D => {
    const points = items.flatMap((s) => s.contour);
    const minX = Math.min(...points.map((p) => p.x)),
      maxX = Math.max(...points.map((p) => p.x));
    const minZ = Math.min(...points.map((p) => p.z)),
      maxZ = Math.max(...points.map((p) => p.z));
    return {
      id: "envelope",
      contour: [
        { x: minX, z: minZ },
        { x: maxX, z: minZ },
        { x: maxX, z: maxZ },
        { x: minX, z: maxZ }
      ],
      bottom: Math.min(...items.map((s) => s.bottom)),
      top: Math.max(...items.map((s) => s.top))
    };
  };
  const build = (items: readonly InteriorSolid3D[]): Node => {
    const bounds = envelope(items);
    const planes = interiorSolidPlanes3D(bounds);
    if (items.length <= 4)
      return {
        planes,
        solids: items.map((solid) => ({
          id: solid.id,
          planes: interiorSolidPlanes3D(solid)
        }))
      };
    const axis =
      bounds.contour[1]!.x - bounds.contour[0]!.x >
      bounds.contour[2]!.z - bounds.contour[0]!.z
        ? "x"
        : "z";
    const sorted = [...items].sort(
      (a, b) =>
        averageInteriorPoints3D(a.contour)[axis] -
          averageInteriorPoints3D(b.contour)[axis] || a.id.localeCompare(b.id)
    );
    const middle = Math.floor(sorted.length / 2);
    return {
      planes,
      children: [build(sorted.slice(0, middle)), build(sorted.slice(middle))]
    };
  };
  const root = solids.length ? build(solids) : undefined;
  return (
    start: ScenePoint3D,
    end: ScenePoint3D,
    ignoredId?: string
  ): boolean => {
    let tests = 0;
    const blocked = (node: Node): boolean => {
      // Overflow is conservatively occluded, never a false visibility reward.
      if (++tests > maximumTests) return true;
      if (!segmentHitsPlanes3D(start, end, node.planes)) return false;
      if (node.children) return node.children.some(blocked);
      return node.solids!.some((solid) => {
        if (solid.id === ignoredId) return false;
        return (
          ++tests > maximumTests ||
          segmentHitsPlanes3D(start, end, solid.planes)
        );
      });
    };
    return root ? blocked(root) : false;
  };
}
