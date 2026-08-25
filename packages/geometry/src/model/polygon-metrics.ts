import type { Point2D } from "@casastudio/schema";

import type { Vertex } from "./vertex.js";

/**
 * Runtime winding classification for a polygon's traversal order.
 *
 * Winding is derived from ordered level-local XZ vertices. The Geometry Engine
 * reports the source boundary traversal order exactly as built; it does not
 * normalize clockwise input into counter-clockwise output.
 */
export type PolygonWinding = "CLOCKWISE" | "COUNTER_CLOCKWISE" | "DEGENERATE";

/**
 * Immutable two-dimensional bounds for level-local plan geometry.
 *
 * Bounds are derived from runtime polygon vertices in the XZ plane and do not
 * include elevation or wall height.
 */
export type BoundingBox = {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
};

/**
 * Complete set of derived polygon measurements for runtime geometry.
 *
 * `signedArea` preserves traversal orientation, while `area` is the absolute
 * planar area. Degenerate polygons intentionally have no centroid because the
 * runtime should not invent a geometric center for zero-area topology.
 */
export type PolygonMetrics = {
  readonly signedArea: number;
  readonly area: number;
  readonly winding: PolygonWinding;
  readonly bounds: BoundingBox;
  readonly centroid?: Point2D;
};

/**
 * Calculates signed area using the CasaStudio level-local XZ plane.
 *
 * Positive values represent counter-clockwise traversal, negative values
 * represent clockwise traversal, and zero represents degenerate collinear or
 * otherwise zero-area input. The input order is used exactly as provided.
 */
export const calculateSignedArea = (vertices: readonly PlanarVertex[]): number => {
  let doubledSignedArea = 0;

  vertices.forEach((vertex, index) => {
    const nextVertex = vertices[(index + 1) % vertices.length];

    if (!nextVertex) {
      return;
    }

    doubledSignedArea += vertex.x * nextVertex.z - nextVertex.x * vertex.z;
  });

  return doubledSignedArea / 2;
};

/**
 * Classifies polygon winding from signed area without changing vertex order.
 */
export const getPolygonWinding = (signedArea: number): PolygonWinding => {
  if (signedArea > 0) {
    return "COUNTER_CLOCKWISE";
  }

  if (signedArea < 0) {
    return "CLOCKWISE";
  }

  return "DEGENERATE";
};

/**
 * Calculates an immutable XZ bounding box from runtime polygon vertices.
 */
export const calculateBoundingBox = (vertices: readonly PlanarVertex[]): BoundingBox => {
  const xs = vertices.map((vertex) => vertex.x);
  const zs = vertices.map((vertex) => vertex.z);

  return Object.freeze({
    minX: Math.min(...xs),
    minZ: Math.min(...zs),
    maxX: Math.max(...xs),
    maxZ: Math.max(...zs)
  });
};

/**
 * Calculates the centroid of a non-degenerate simple polygon.
 *
 * Returns `undefined` for zero-area input so the builder can reject invalid
 * runtime polygons rather than silently inventing a centroid.
 */
export const calculateCentroid = (
  vertices: readonly PlanarVertex[],
  signedArea: number
): Point2D | undefined => {
  if (signedArea === 0) {
    return undefined;
  }

  let weightedX = 0;
  let weightedZ = 0;

  vertices.forEach((vertex, index) => {
    const nextVertex = vertices[(index + 1) % vertices.length];

    if (!nextVertex) {
      return;
    }

    const cross = vertex.x * nextVertex.z - nextVertex.x * vertex.z;
    weightedX += (vertex.x + nextVertex.x) * cross;
    weightedZ += (vertex.z + nextVertex.z) * cross;
  });

  const divisor = 6 * signedArea;

  return Object.freeze({
    x: weightedX / divisor,
    z: weightedZ / divisor
  });
};

/**
 * Finds a stable interior anchor suitable for labels in a simple polygon.
 *
 * Unlike the area centroid, the returned point is guaranteed to be inside the
 * polygon. The search maximizes clearance from boundary segments and remains
 * entirely derived from the ordered polygon vertices.
 */
export const calculatePolygonInteriorAnchor = (
  vertices: readonly PlanarVertex[]
): Point2D | undefined => {
  if (vertices.length < 3) return undefined;
  const bounds = calculateBoundingBox(vertices);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxZ - bounds.minZ;
  const cellSize = Math.min(width, height);
  if (!(cellSize > 0)) return undefined;

  const createCell = (x: number, z: number, halfSize: number): InteriorCell => {
    const distance = signedDistanceToPolygon({ x, z }, vertices);
    return { x, z, halfSize, distance, maximum: distance + halfSize * Math.SQRT2 };
  };
  const queue: InteriorCell[] = [];
  const halfSize = cellSize / 2;
  for (let x = bounds.minX; x < bounds.maxX; x += cellSize) {
    for (let z = bounds.minZ; z < bounds.maxZ; z += cellSize) {
      queue.push(createCell(x + halfSize, z + halfSize, halfSize));
    }
  }

  const signedArea = calculateSignedArea(vertices);
  const centroid = calculateCentroid(vertices, signedArea);
  let best = centroid
    ? createCell(centroid.x, centroid.z, 0)
    : createCell(bounds.minX + width / 2, bounds.minZ + height / 2, 0);
  const boundsCenter = createCell(bounds.minX + width / 2, bounds.minZ + height / 2, 0);
  if (boundsCenter.distance > best.distance) best = boundsCenter;
  const precision = Math.max(cellSize / 1_000, 1e-6);

  while (queue.length > 0) {
    queue.sort((first, second) => second.maximum - first.maximum);
    const cell = queue.shift()!;
    if (cell.distance > best.distance) best = cell;
    if (cell.maximum - best.distance <= precision) continue;
    const nextHalfSize = cell.halfSize / 2;
    queue.push(
      createCell(cell.x - nextHalfSize, cell.z - nextHalfSize, nextHalfSize),
      createCell(cell.x + nextHalfSize, cell.z - nextHalfSize, nextHalfSize),
      createCell(cell.x - nextHalfSize, cell.z + nextHalfSize, nextHalfSize),
      createCell(cell.x + nextHalfSize, cell.z + nextHalfSize, nextHalfSize)
    );
  }

  return best.distance >= 0 ? Object.freeze({ x: best.x, z: best.z }) : undefined;
};

type InteriorCell = {
  readonly x: number;
  readonly z: number;
  readonly halfSize: number;
  readonly distance: number;
  readonly maximum: number;
};

type PlanarVertex = Pick<Vertex, "x" | "z">;

const signedDistanceToPolygon = (point: Point2D, vertices: readonly PlanarVertex[]): number => {
  let inside = false;
  let minimumSquaredDistance = Number.POSITIVE_INFINITY;
  for (let index = 0, previousIndex = vertices.length - 1; index < vertices.length; previousIndex = index++) {
    const current = vertices[index]!;
    const previous = vertices[previousIndex]!;
    if (
      (current.z > point.z) !== (previous.z > point.z) &&
      point.x < (previous.x - current.x) * (point.z - current.z) /
        (previous.z - current.z) + current.x
    ) inside = !inside;
    minimumSquaredDistance = Math.min(
      minimumSquaredDistance,
      squaredDistanceToSegment(point, current, previous)
    );
  }
  const distance = Math.sqrt(minimumSquaredDistance);
  return inside ? distance : -distance;
};

const squaredDistanceToSegment = (
  point: Point2D,
  start: PlanarVertex,
  end: PlanarVertex
): number => {
  let x = start.x;
  let z = start.z;
  const deltaX = end.x - x;
  const deltaZ = end.z - z;
  if (deltaX !== 0 || deltaZ !== 0) {
    const projection = ((point.x - x) * deltaX + (point.z - z) * deltaZ) /
      (deltaX * deltaX + deltaZ * deltaZ);
    if (projection > 1) {
      x = end.x;
      z = end.z;
    } else if (projection > 0) {
      x += deltaX * projection;
      z += deltaZ * projection;
    }
  }
  const pointDeltaX = point.x - x;
  const pointDeltaZ = point.z - z;
  return pointDeltaX * pointDeltaX + pointDeltaZ * pointDeltaZ;
};

/**
 * Calculates all polygon metrics from traversal-relative vertices.
 */
export const calculatePolygonMetrics = (vertices: readonly Vertex[]): PolygonMetrics => {
  const signedArea = calculateSignedArea(vertices);
  const winding = getPolygonWinding(signedArea);

  return {
    signedArea,
    area: Math.abs(signedArea),
    winding,
    bounds: calculateBoundingBox(vertices),
    centroid: calculateCentroid(vertices, signedArea)
  };
};
