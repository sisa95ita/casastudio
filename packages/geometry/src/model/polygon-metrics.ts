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
export const calculateSignedArea = (vertices: readonly Vertex[]): number => {
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
export const calculateBoundingBox = (vertices: readonly Vertex[]): BoundingBox => {
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
  vertices: readonly Vertex[],
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
