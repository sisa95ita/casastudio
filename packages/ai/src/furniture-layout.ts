import {
  resolveBuiltinFurnitureDefinition,
  type FurnitureItem
} from "@casastudio/schema";
import type {
  DesignBoundarySegment,
  DesignContext,
  DesignPoint2D
} from "./contracts.js";

/** Concise geometry facts, never guessed functional associations. Pair prose is bounded to 24. */
export function deriveFurnitureLayout(
  items: readonly FurnitureItem[],
  boundary: readonly DesignBoundarySegment[]
): Pick<DesignContext, "furniture" | "furnitureLayout"> {
  const edges = boundary
    .map((edge, index) => ({ edge, index }))
    .filter(
      ({ edge }) =>
        Math.hypot(edge.end.x - edge.start.x, edge.end.z - edge.start.z) > 1e-9
    );
  const origin = edges.length ? boundary[0]!.start : undefined;
  const ordered = [...items].sort((a, b) => compare(a.id, b.id));
  const furniture = ordered.map((item) => {
    const definition = resolveBuiltinFurnitureDefinition(item.definitionId);
    const nearest = edges
      .map(({ edge, index }) => ({
        boundaryIndex: index,
        centerDistance: distanceToSegment(item.position, edge.start, edge.end),
        // Positive canonical yaw rotates local X toward -Z (right-hand rule about +Y).
        widthAxisRelation: axisRelation(
          item.rotation,
          (-Math.atan2(edge.end.z - edge.start.z, edge.end.x - edge.start.x) *
            180) /
            Math.PI
        )
      }))
      .sort(
        (a, b) =>
          a.centerDistance - b.centerDistance ||
          a.boundaryIndex - b.boundaryIndex
      )[0];
    return Object.freeze({
      id: item.id,
      ...(item.name ? { name: item.name } : {}),
      definitionId: item.definitionId,
      ...(definition
        ? { definitionName: definition.name, category: definition.category }
        : {}),
      position: Object.freeze({ ...item.position }),
      rotationDegrees: item.rotation,
      width: item.width,
      depth: item.depth,
      height: item.height,
      ...(origin
        ? {
            roomLocalPosition: Object.freeze({
              x: item.position.x - origin.x,
              z: item.position.z - origin.z
            })
          }
        : {}),
      ...(nearest ? { nearestBoundary: Object.freeze(nearest) } : {})
    });
  });

  // At most two nearby center relations per item, then 24 strongest globally.
  // Center distance is stated explicitly: it is not footprint clearance/containment.
  const pairs = new Map<
    string,
    NonNullable<DesignContext["furnitureLayout"]>["nearbyPairs"][number]
  >();
  for (const item of ordered) {
    const nearby = ordered
      .filter((other) => other.id !== item.id)
      .map((other) => ({
        other,
        distance: Math.hypot(
          item.position.x - other.position.x,
          item.position.z - other.position.z
        )
      }))
      .filter(
        ({ other, distance }) =>
          distance <=
          (Math.hypot(item.width, item.depth) +
            Math.hypot(other.width, other.depth)) /
            2 +
            100
      )
      .sort(
        (a, b) => a.distance - b.distance || compare(a.other.id, b.other.id)
      )
      .slice(0, 2);
    for (const { other, distance } of nearby) {
      const [first, second] =
        compare(item.id, other.id) < 0 ? [item, other] : [other, item];
      pairs.set(JSON.stringify([first!.id, second!.id]), {
        firstId: first!.id,
        secondId: second!.id,
        centerDistance: distance,
        widthAxisRelation: axisRelation(first!.rotation, second!.rotation)
      });
    }
  }
  return {
    furniture: Object.freeze(furniture),
    furnitureLayout: Object.freeze({
      intent: "preserve-by-default",
      ...(origin ? { origin: Object.freeze({ ...origin }) } : {}),
      nearbyPairs: Object.freeze(
        [...pairs.values()]
          .sort(
            (a, b) =>
              a.centerDistance - b.centerDistance ||
              compare(a.firstId, b.firstId) ||
              compare(a.secondId, b.secondId)
          )
          .slice(0, 24)
          .map((pair) => Object.freeze(pair))
      )
    })
  };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function axisRelation(
  first: number,
  second: number
): "parallel" | "perpendicular" | "oblique" {
  const angle = (((first - second) % 180) + 180) % 180;
  if (Math.min(angle, 180 - angle) <= 1) return "parallel";
  return Math.abs(angle - 90) <= 1 ? "perpendicular" : "oblique";
}

function distanceToSegment(
  point: DesignPoint2D,
  start: DesignPoint2D,
  end: DesignPoint2D
): number {
  const dx = end.x - start.x,
    dz = end.z - start.z;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.z - start.z) * dz) /
        (dx * dx + dz * dz)
    )
  );
  return Math.hypot(point.x - start.x - t * dx, point.z - start.z - t * dz);
}
