import type { BoundaryEdge, LevelGeometry, Polygon, Vertex } from "@casastudio/geometry";

import {
  collectLevelBounds,
  countBoundaryEdgeUses,
  formatSvgNumber
} from "./geometry-svg-helpers";
import {
  isGeometrySelectionMatch,
  type GeometryHoverState,
  type GeometrySelection,
  type GeometrySelectionState
} from "./geometry-selection-state";
import type {
  ScreenPoint,
  ViewportBounds2D,
  ViewportTransform2D,
  WorldPointXZ
} from "./viewport-transform-2d";

/**
 * Shared selection and hover flags for render-oriented geometry entities.
 */
export type GeometryPresentationInteractionState = {
  readonly selected: boolean;
  readonly hovered: boolean;
};

/**
 * Render-oriented point containing both level-local and SVG coordinates.
 */
export type GeometryPresentationPoint2D = {
  readonly world: WorldPointXZ;
  readonly screen: ScreenPoint;
};

/**
 * Render-oriented polygon independent of its geometry source.
 */
export type GeometryPresentationPolygon2D = GeometryPresentationInteractionState & {
  readonly kind: "POLYGON";
  readonly geometryId: Polygon["id"];
  readonly sourceRoomId: Polygon["sourceRoomId"];
  readonly points: readonly GeometryPresentationPoint2D[];
  readonly svgPoints: string;
  readonly area: Polygon["area"];
  readonly winding: Polygon["winding"];
  readonly centroid: GeometryPresentationPoint2D;
  readonly bounds: ViewportBounds2D;
  readonly screenBounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
};

/**
 * Render-oriented physical boundary edge independent of its geometry source.
 */
export type GeometryPresentationBoundaryEdge2D = GeometryPresentationInteractionState & {
  readonly kind: "BOUNDARY_EDGE";
  readonly geometryId: BoundaryEdge["id"];
  readonly sourceWallId: BoundaryEdge["sourceWallId"];
  readonly startVertexId: Vertex["id"];
  readonly endVertexId: Vertex["id"];
  readonly start: GeometryPresentationPoint2D;
  readonly end: GeometryPresentationPoint2D;
  readonly midpoint: ScreenPoint;
  readonly sharedUsageCount: number;
};

/**
 * Render-oriented vertex independent of its geometry source.
 */
export type GeometryPresentationVertex2D = GeometryPresentationInteractionState & {
  readonly kind: "VERTEX";
  readonly geometryId: Vertex["id"];
  readonly coordinates: WorldPointXZ;
  readonly point: ScreenPoint;
};

/**
 * Frontend-only model consumed by the SVG renderer and inspector.
 *
 * Instances may be adapted from runtime geometry, an authoritative snapshot,
 * or future editor state. The model owns no domain mutation, persistence,
 * editor command, or project editing behavior.
 */
export type GeometryPresentationModel2D = {
  readonly levelId: LevelGeometry["id"];
  readonly sourceLevelId: LevelGeometry["sourceLevelId"];
  readonly bounds: ViewportBounds2D | undefined;
  readonly polygons: readonly GeometryPresentationPolygon2D[];
  readonly boundaryEdges: readonly GeometryPresentationBoundaryEdge2D[];
  readonly vertices: readonly GeometryPresentationVertex2D[];
};

/**
 * Inputs for adapting runtime geometry into a presentation model.
 */
export type CreateRuntimeGeometryPresentationModel2DOptions = {
  readonly level: LevelGeometry;
  readonly transform: ViewportTransform2D;
  readonly selectionState?: GeometrySelectionState;
  readonly hover?: GeometryHoverState;
};

/**
 * Adapts immutable runtime level geometry into SVG-oriented 2D presentation
 * data.
 */
export const createRuntimeGeometryPresentationModel2D = ({
  level,
  transform,
  selectionState,
  hover
}: CreateRuntimeGeometryPresentationModel2DOptions): GeometryPresentationModel2D => {
  const sharedUsageCounts = countBoundaryEdgeUses(level);
  const selected = selectionState?.selected ?? [];
  const hovered = selectionState?.hovered ?? hover;

  return Object.freeze({
    levelId: level.id,
    sourceLevelId: level.sourceLevelId,
    bounds: collectLevelBounds(level),
    polygons: Object.freeze(
      level.polygons.map((polygon) => createPresentationPolygon(polygon, transform, selected, hovered))
    ),
    boundaryEdges: Object.freeze(
      level.boundaryEdges.map((edge) =>
        createPresentationBoundaryEdge(edge, transform, sharedUsageCounts, selected, hovered)
      )
    ),
    vertices: Object.freeze(
      level.vertices.map((vertex) => createPresentationVertex(vertex, transform, selected, hovered))
    )
  });
};

const createPresentationPolygon = (
  polygon: Polygon,
  transform: ViewportTransform2D,
  selected: readonly GeometrySelection[],
  hover: GeometryHoverState
): GeometryPresentationPolygon2D => {
  const points = polygon.outerLoop.edgeUses.map((edgeUse) =>
    createPresentationPoint(edgeUse.startVertex, transform)
  );

  return Object.freeze({
    kind: "POLYGON",
    geometryId: polygon.id,
    sourceRoomId: polygon.sourceRoomId,
    points: Object.freeze(points),
    svgPoints: points.map((point) => `${formatSvgNumber(point.screen.x)},${formatSvgNumber(point.screen.y)}`).join(" "),
    area: polygon.area,
    winding: polygon.winding,
    centroid: createPresentationPoint(polygon.centroid, transform),
    bounds: Object.freeze({ ...polygon.bounds }),
    screenBounds: Object.freeze(createScreenBounds(polygon.bounds, transform)),
    selected: isGeometrySelectionMatch(selected, "POLYGON", polygon.id),
    hovered: isGeometrySelectionMatch(hover, "POLYGON", polygon.id)
  });
};

const createPresentationBoundaryEdge = (
  edge: BoundaryEdge,
  transform: ViewportTransform2D,
  sharedUsageCounts: ReadonlyMap<BoundaryEdge["id"], number>,
  selected: readonly GeometrySelection[],
  hover: GeometryHoverState
): GeometryPresentationBoundaryEdge2D => {
  const start = createPresentationPoint(edge.startVertex, transform);
  const end = createPresentationPoint(edge.endVertex, transform);

  return Object.freeze({
    kind: "BOUNDARY_EDGE",
    geometryId: edge.id,
    sourceWallId: edge.sourceWallId,
    startVertexId: edge.startVertex.id,
    endVertexId: edge.endVertex.id,
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

const createPresentationVertex = (
  vertex: Vertex,
  transform: ViewportTransform2D,
  selected: readonly GeometrySelection[],
  hover: GeometryHoverState
): GeometryPresentationVertex2D =>
  Object.freeze({
    kind: "VERTEX",
    geometryId: vertex.id,
    coordinates: Object.freeze({ x: vertex.x, z: vertex.z }),
    point: transform.worldToScreen(vertex),
    selected: isGeometrySelectionMatch(selected, "VERTEX", vertex.id),
    hovered: isGeometrySelectionMatch(hover, "VERTEX", vertex.id)
  });

const createPresentationPoint = (
  point: WorldPointXZ,
  transform: ViewportTransform2D
): GeometryPresentationPoint2D =>
  Object.freeze({
    world: Object.freeze({ x: point.x, z: point.z }),
    screen: transform.worldToScreen(point)
  });

const createScreenBounds = (
  bounds: ViewportBounds2D,
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
