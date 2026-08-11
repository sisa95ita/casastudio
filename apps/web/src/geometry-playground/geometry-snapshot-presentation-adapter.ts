import type {
  GeometryBoundaryEdge,
  GeometryBoundaryEdgeUse,
  GeometryBounds,
  GeometryLevel,
  GeometryPolygon
} from "../api/api-types";
import {
  type GeometryPresentationBoundaryEdge2D,
  type GeometryPresentationModel2D,
  type GeometryPresentationPoint2D,
  type GeometryPresentationPolygon2D,
  type GeometryPresentationVertex2D
} from "./geometry-presentation-model-2d";
import {
  isGeometrySelectionMatch,
  type GeometryHoverState,
  type GeometrySelection,
  type GeometrySelectionState
} from "./geometry-selection-state";
import { formatSvgNumber } from "./geometry-svg-helpers";
import type {
  ViewportBounds2D,
  ViewportTransform2D,
  WorldPointXZ
} from "./viewport-transform-2d";

/** Inputs for adapting one authoritative snapshot level for the 2D viewer. */
export type CreateGeometrySnapshotPresentationModel2DOptions = {
  readonly level: GeometryLevel;
  readonly transform: ViewportTransform2D;
  readonly selectionState?: GeometrySelectionState;
  readonly hover?: GeometryHoverState;
};

/**
 * Adapts a serialized authoritative Geometry Snapshot level directly into the
 * render-oriented 2D model without constructing Geometry runtime classes.
 *
 * Ordered polygon points follow the snapshot's explicit outer-loop and edge-use
 * identifier arrays. The adapter only creates projection coordinates, lookup
 * maps, interaction flags, and display counts; it does not infer topology.
 */
export function createGeometrySnapshotPresentationModel2D({
  level,
  transform,
  selectionState,
  hover
}: CreateGeometrySnapshotPresentationModel2DOptions): GeometryPresentationModel2D {
  const selected = selectionState?.selected ?? [];
  const hovered = selectionState?.hovered ?? hover;
  const edgeUsesById = new Map(level.boundaryEdgeUses.map((edgeUse) => [edgeUse.id, edgeUse]));
  const loopsById = new Map(level.loops.map((loop) => [loop.id, loop]));
  const sharedUsageCounts = countSnapshotBoundaryEdgeUses(level.boundaryEdgeUses);

  return Object.freeze({
    levelId: level.id,
    sourceLevelId: level.sourceLevelId,
    bounds: collectGeometrySnapshotLevelBounds(level),
    polygons: Object.freeze(
      level.polygons.map((polygon) =>
        createSnapshotPolygon(
          polygon,
          edgeUsesById,
          loopsById,
          transform,
          selected,
          hovered
        )
      )
    ),
    boundaryEdges: Object.freeze(
      level.boundaryEdges.map((edge) =>
        createSnapshotBoundaryEdge(edge, sharedUsageCounts, transform, selected, hovered)
      )
    ),
    vertices: Object.freeze(
      level.vertices.map((vertex) => {
        const coordinates = Object.freeze({ x: vertex.x, z: vertex.z });

        return Object.freeze({
          kind: "VERTEX",
          geometryId: vertex.id,
          coordinates,
          point: transform.worldToScreen(coordinates),
          selected: isGeometrySelectionMatch(selected, "VERTEX", vertex.id),
          hovered: isGeometrySelectionMatch(hovered, "VERTEX", vertex.id)
        }) satisfies GeometryPresentationVertex2D;
      })
    )
  });
}

/** Collects display bounds from authoritative polygon metrics or vertices. */
export function collectGeometrySnapshotLevelBounds(
  level: GeometryLevel
): ViewportBounds2D | undefined {
  if (level.polygons.length > 0) {
    return mergeBounds(level.polygons.map((polygon) => polygon.metrics.bounds));
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
}

const createSnapshotPolygon = (
  polygon: GeometryPolygon,
  edgeUsesById: ReadonlyMap<string, GeometryBoundaryEdgeUse>,
  loopsById: ReadonlyMap<string, GeometryLevel["loops"][number]>,
  transform: ViewportTransform2D,
  selected: readonly GeometrySelection[],
  hover: GeometryHoverState
): GeometryPresentationPolygon2D => {
  const outerLoop = loopsById.get(polygon.outerLoopId);

  if (!outerLoop || outerLoop.kind !== "OUTER" || outerLoop.polygonId !== polygon.id) {
    throw new Error(`Geometry polygon "${polygon.id}" has an invalid outer-loop reference.`);
  }

  const points = outerLoop.boundaryEdgeUseIds.map((edgeUseId) => {
    const edgeUse = edgeUsesById.get(edgeUseId);

    if (!edgeUse || edgeUse.loopId !== outerLoop.id) {
      throw new Error(
        `Geometry loop "${outerLoop.id}" has an invalid boundary-edge-use reference.`
      );
    }

    return createPresentationPoint(edgeUse.start, transform);
  });
  const bounds = Object.freeze({ ...polygon.metrics.bounds });

  return Object.freeze({
    kind: "POLYGON",
    geometryId: polygon.id,
    sourceRoomId: polygon.sourceRoomId,
    points: Object.freeze(points),
    svgPoints: points
      .map((point) => `${formatSvgNumber(point.screen.x)},${formatSvgNumber(point.screen.y)}`)
      .join(" "),
    area: polygon.metrics.area,
    winding: polygon.metrics.winding,
    centroid: createPresentationPoint(polygon.metrics.centroid, transform),
    bounds,
    screenBounds: Object.freeze(createScreenBounds(bounds, transform)),
    selected: isGeometrySelectionMatch(selected, "POLYGON", polygon.id),
    hovered: isGeometrySelectionMatch(hover, "POLYGON", polygon.id)
  });
};

const createSnapshotBoundaryEdge = (
  edge: GeometryBoundaryEdge,
  sharedUsageCounts: ReadonlyMap<string, number>,
  transform: ViewportTransform2D,
  selected: readonly GeometrySelection[],
  hover: GeometryHoverState
): GeometryPresentationBoundaryEdge2D => {
  const start = createPresentationPoint(edge.start, transform);
  const end = createPresentationPoint(edge.end, transform);

  return Object.freeze({
    kind: "BOUNDARY_EDGE",
    geometryId: edge.id,
    sourceWallId: edge.sourceWallId,
    startVertexId: edge.startVertexId,
    endVertexId: edge.endVertexId,
    start,
    end,
    midpoint: Object.freeze({
      x: (start.screen.x + end.screen.x) / 2,
      y: (start.screen.y + end.screen.y) / 2
    }),
    sharedUsageCount: sharedUsageCounts.get(edge.id) ?? 0,
    selected: isGeometrySelectionMatch(selected, "BOUNDARY_EDGE", edge.id),
    hovered: isGeometrySelectionMatch(hover, "BOUNDARY_EDGE", edge.id)
  });
};

const createPresentationPoint = (
  point: WorldPointXZ,
  transform: ViewportTransform2D
): GeometryPresentationPoint2D =>
  Object.freeze({
    world: Object.freeze({ x: point.x, z: point.z }),
    screen: transform.worldToScreen(point)
  });

const countSnapshotBoundaryEdgeUses = (
  edgeUses: readonly GeometryBoundaryEdgeUse[]
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();

  edgeUses.forEach((edgeUse) => {
    counts.set(edgeUse.boundaryEdgeId, (counts.get(edgeUse.boundaryEdgeId) ?? 0) + 1);
  });

  return counts;
};

const createScreenBounds = (
  bounds: GeometryBounds,
  transform: ViewportTransform2D
): GeometryPresentationPolygon2D["screenBounds"] => {
  const minPoint = transform.worldToScreen({ x: bounds.minX, z: bounds.minZ });
  const maxPoint = transform.worldToScreen({ x: bounds.maxX, z: bounds.maxZ });

  return {
    x: Math.min(minPoint.x, maxPoint.x),
    y: Math.min(minPoint.y, maxPoint.y),
    width: Math.abs(maxPoint.x - minPoint.x),
    height: Math.abs(maxPoint.y - minPoint.y)
  };
};

const mergeBounds = (bounds: readonly GeometryBounds[]): ViewportBounds2D => ({
  minX: Math.min(...bounds.map((bound) => bound.minX)),
  minZ: Math.min(...bounds.map((bound) => bound.minZ)),
  maxX: Math.max(...bounds.map((bound) => bound.maxX)),
  maxZ: Math.max(...bounds.map((bound) => bound.maxZ))
});
