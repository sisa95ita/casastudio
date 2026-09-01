import type { BoundaryEdge, BoundingBox, LevelGeometry, Polygon } from "@casastudio/geometry";

import type { ViewportTransform2D } from "./viewport-transform-2d";

/**
 * Formats SVG coordinates with stable precision for deterministic markup.
 */
export const formatSvgNumber = (value: number): string => {
  if (Object.is(value, -0)) {
    return "0";
  }

  return Number(value.toFixed(2)).toString();
};

/**
 * Collects traversal-relative polygon points for an SVG `polygon` element.
 *
 * The helper consumes `polygon.outerLoop.edgeUses` in the exact runtime order
 * produced from ordered `Room.boundary` data. It deliberately avoids
 * reconstructing a polygon from unordered physical edges or normalizing winding.
 */
export const getPolygonPointString = (
  polygon: Polygon,
  transform: ViewportTransform2D
): string =>
  polygon.outerLoop.edgeUses
    .map((edgeUse) => transform.worldToScreen(edgeUse.startVertex))
    .map((point) => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`)
    .join(" ");

/**
 * Aggregates level bounds from polygon metrics, falling back to vertices.
 *
 * Polygon bounds are preferred because this viewer is primarily visualizing
 * room-derived regions. Vertex bounds keep draft physical topology stable when
 * a level has edges but no buildable polygons.
 */
export const collectLevelBounds = (level: LevelGeometry): BoundingBox | undefined => {
  if (level.polygons.length > 0) {
    return mergeBounds(level.polygons.map((polygon) => polygon.bounds));
  }

  if (level.vertices.length === 0) {
    return undefined;
  }

  return {
    minX: Math.min(...level.vertices.map((vertex) => vertex.x)),
    minZ: Math.min(...level.vertices.map((vertex) => vertex.z)),
    maxX: Math.max(...level.vertices.map((vertex) => vertex.x)),
    maxZ: Math.max(...level.vertices.map((vertex) => vertex.z))
  };
};

/**
 * Counts how many loop-relative uses reference each shared physical edge.
 *
 * The debug viewer derives shared-wall presentation from the immutable runtime
 * relationship graph instead of adding adjacency fields to the Geometry Engine
 * or mutating `BoundaryEdge` objects for display state.
 */
export const countBoundaryEdgeUses = (
  level: LevelGeometry
): ReadonlyMap<BoundaryEdge["id"], number> => {
  const useCounts = new Map<BoundaryEdge["id"], number>();

  level.boundaryEdgeUses.forEach((edgeUse) => {
    const edgeId = edgeUse.boundaryEdge.id;
    useCounts.set(edgeId, (useCounts.get(edgeId) ?? 0) + 1);
  });

  return useCounts;
};

/**
 * Converts XZ bounds into an SVG rectangle after shared viewport projection.
 *
 * Bounds rectangles are diagnostic overlays rather than domain geometry. The
 * rectangle accounts for SVG Y inversion by projecting both world-space
 * corners and normalizing the screen-space width and height only for drawing.
 */
export const getScreenBoundsRect = (
  bounds: BoundingBox,
  transform: ViewportTransform2D
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } => {
  const minPoint = transform.worldToScreen({ x: bounds.minX, z: bounds.minZ });
  const maxPoint = transform.worldToScreen({ x: bounds.maxX, z: bounds.maxZ });

  return {
    x: Math.min(minPoint.x, maxPoint.x),
    y: Math.min(minPoint.y, maxPoint.y),
    width: Math.abs(maxPoint.x - minPoint.x),
    height: Math.abs(maxPoint.y - minPoint.y)
  };
};

const mergeBounds = (bounds: readonly BoundingBox[]): BoundingBox => ({
  minX: Math.min(...bounds.map((bound) => bound.minX)),
  minZ: Math.min(...bounds.map((bound) => bound.minZ)),
  maxX: Math.max(...bounds.map((bound) => bound.maxX)),
  maxZ: Math.max(...bounds.map((bound) => bound.maxZ))
});
