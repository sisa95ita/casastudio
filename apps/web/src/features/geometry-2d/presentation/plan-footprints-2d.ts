import { createArchitecturalWallBodyShapes } from "@casastudio/geometry";
import type {
  FurnitureItem,
  Level,
  Point2D,
  StairFlight,
  StairLanding,
  Staircase
} from "@casastudio/schema";

const SPATIAL_EPSILON = 1e-7;

/** Four corners of a centered rectangle using Furniture's positive-Y rotation convention. */
export function createOrientedRectangleFootprint(
  center: Point2D,
  width: number,
  depth: number,
  rotation: number
): readonly Point2D[] {
  const angle = (rotation * Math.PI) / 180;
  const point = (x: number, z: number): Point2D =>
    Object.freeze({
      x: center.x + x * Math.cos(angle) + z * Math.sin(angle),
      z: center.z - x * Math.sin(angle) + z * Math.cos(angle)
    });
  return Object.freeze([
    point(-width / 2, -depth / 2),
    point(width / 2, -depth / 2),
    point(width / 2, depth / 2),
    point(-width / 2, depth / 2)
  ]);
}

/** Exact oriented X/Z footprint of one canonical Furniture item. */
export function createFurnitureFootprint2D(
  item: Pick<FurnitureItem, "position" | "width" | "depth" | "rotation">
): readonly Point2D[] {
  return createOrientedRectangleFootprint(
    item.position,
    item.width,
    item.depth,
    item.rotation
  );
}

/** Physical Wall body polygons, excluding canonical Opening intervals. */
export function createWallFootprints2D(
  level: Pick<Level, "walls">
): readonly (readonly Point2D[])[] {
  const junctions = new Map<
    string,
    {
      readonly point: Point2D;
      count: number;
      thickness: number;
      blockedByOpening: boolean;
    }
  >();
  for (const wall of level.walls) {
    const length = Math.hypot(
      wall.end.x - wall.start.x,
      wall.end.z - wall.start.z
    );
    for (const [endpoint, point] of [
      ["start", wall.start],
      ["end", wall.end]
    ] as const) {
      const key = `${point.x}:${point.z}`;
      const current = junctions.get(key);
      const blockedByOpening = wall.openings.some((opening) =>
        endpoint === "start"
          ? opening.offsetFromStart === 0
          : opening.offsetFromStart + opening.width === length
      );
      junctions.set(key, {
        point,
        count: (current?.count ?? 0) + 1,
        thickness: Math.max(current?.thickness ?? 0, wall.thickness),
        blockedByOpening:
          (current?.blockedByOpening ?? false) || blockedByOpening
      });
    }
  }
  return Object.freeze(
    [
      ...level.walls.flatMap((wall) =>
        createArchitecturalWallBodyShapes(wall).map((shape) => shape.points)
      ),
      ...[...junctions.values()]
        .filter((junction) => junction.count > 1 && !junction.blockedByOpening)
        .map((junction) =>
          Array.from({ length: 12 }, (_, index) => {
            const angle = (index * Math.PI * 2) / 12;
            return {
              x: junction.point.x + Math.cos(angle) * junction.thickness / 2,
              z: junction.point.z + Math.sin(angle) * junction.thickness / 2
            };
          })
        )
    ]
  );
}

/** Canonical Stair flight and landing plan footprints used only for warnings/presentation. */
export function createStairFootprints2D(
  level: Pick<Level, "staircases">
): readonly (readonly Point2D[])[] {
  return Object.freeze(
    level.staircases.flatMap((staircase) => [
      ...staircase.flights.map(createFlightFootprint),
      ...staircase.landings.map((landing, index) =>
        createLandingFootprint(staircase, landing, index)
      )
    ])
  );
}

/** Strict convex-polygon overlap: shared edges and tangency are intentionally not collisions. */
export function convexPolygonsOverlap(
  first: readonly Point2D[],
  second: readonly Point2D[]
): boolean {
  if (first.length < 3 || second.length < 3) return false;
  for (const polygon of [first, second]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]!;
      const end = polygon[(index + 1) % polygon.length]!;
      const axis = { x: -(end.z - start.z), z: end.x - start.x };
      const firstProjection = projectPolygon(first, axis);
      const secondProjection = projectPolygon(second, axis);
      const overlap =
        Math.min(firstProjection.max, secondProjection.max) -
        Math.max(firstProjection.min, secondProjection.min);
      if (overlap <= SPATIAL_EPSILON) return false;
    }
  }
  return true;
}

/** Inclusive point containment for Room-label candidate validation. */
export function polygonContainsPoint(
  polygon: readonly Point2D[],
  point: Point2D
): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const a = polygon[previous]!;
    const b = polygon[index]!;
    if (pointOnSegment(point, a, b)) return true;
    if (
      a.z > point.z !== b.z > point.z &&
      point.x <
        ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  return inside;
}

/** Conservative containment for a convex label box inside an arbitrary Room polygon. */
export function polygonContainsPolygon(
  outer: readonly Point2D[],
  inner: readonly Point2D[]
): boolean {
  if (!inner.every((point) => polygonContainsPoint(outer, point))) return false;
  for (let innerIndex = 0; innerIndex < inner.length; innerIndex += 1) {
    const innerStart = inner[innerIndex]!;
    const innerEnd = inner[(innerIndex + 1) % inner.length]!;
    for (let outerIndex = 0; outerIndex < outer.length; outerIndex += 1) {
      const outerStart = outer[outerIndex]!;
      const outerEnd = outer[(outerIndex + 1) % outer.length]!;
      if (segmentsProperlyIntersect(innerStart, innerEnd, outerStart, outerEnd))
        return false;
    }
  }
  return true;
}

function createFlightFootprint(flight: StairFlight): readonly Point2D[] {
  const length = Math.hypot(
    flight.end.x - flight.start.x,
    flight.end.z - flight.start.z
  );
  const center = {
    x: (flight.start.x + flight.end.x) / 2,
    z: (flight.start.z + flight.end.z) / 2
  };
  const rotation =
    (-Math.atan2(flight.end.z - flight.start.z, flight.end.x - flight.start.x) *
      180) /
    Math.PI;
  return createOrientedRectangleFootprint(center, length, flight.width, rotation);
}

function createLandingFootprint(
  staircase: Staircase,
  landing: StairLanding,
  index: number
): readonly Point2D[] {
  const flight =
    staircase.flights[Math.min(index, staircase.flights.length - 1)];
  const rotation = flight
    ? (-Math.atan2(
        flight.end.z - flight.start.z,
        flight.end.x - flight.start.x
      ) *
        180) /
      Math.PI
    : 0;
  return createOrientedRectangleFootprint(
    landing.position,
    landing.depth,
    landing.width,
    rotation
  );
}

function projectPolygon(
  polygon: readonly Point2D[],
  axis: Point2D
): { readonly min: number; readonly max: number } {
  const projections = polygon.map((point) => point.x * axis.x + point.z * axis.z);
  return { min: Math.min(...projections), max: Math.max(...projections) };
}

function pointOnSegment(point: Point2D, start: Point2D, end: Point2D): boolean {
  const cross =
    (point.x - start.x) * (end.z - start.z) -
    (point.z - start.z) * (end.x - start.x);
  return (
    Math.abs(cross) <=
      SPATIAL_EPSILON *
        Math.max(1, Math.hypot(end.x - start.x, end.z - start.z)) &&
    point.x >= Math.min(start.x, end.x) - SPATIAL_EPSILON &&
    point.x <= Math.max(start.x, end.x) + SPATIAL_EPSILON &&
    point.z >= Math.min(start.z, end.z) - SPATIAL_EPSILON &&
    point.z <= Math.max(start.z, end.z) + SPATIAL_EPSILON
  );
}

function segmentsProperlyIntersect(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D
): boolean {
  const orientation = (first: Point2D, second: Point2D, third: Point2D) =>
    (second.x - first.x) * (third.z - first.z) -
    (second.z - first.z) * (third.x - first.x);
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return abC * abD < -SPATIAL_EPSILON && cdA * cdB < -SPATIAL_EPSILON;
}
