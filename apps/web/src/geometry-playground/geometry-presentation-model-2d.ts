import type { BoundaryEdge, LevelGeometry, Polygon, Vertex } from "@casastudio/geometry";

import {
  collectLevelBounds,
  countBoundaryEdgeUses,
  formatSvgNumber
} from "./geometry-svg-helpers";
import {
  isGeometrySelectionMatch,
  type GeometryHoverState,
  type GeometrySelection
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
 * Render-oriented polygon derived from one runtime `Polygon`.
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
};

/**
 * Render-oriented physical boundary edge derived from one runtime
 * `BoundaryEdge`.
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
 * Render-oriented vertex derived from one runtime `Vertex`.
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
 * This object adapts immutable runtime geometry into deterministic rendering
 * data. It owns no domain mutation, persistence, editor command, or project
 * editing behavior.
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
 * Inputs for deriving a `GeometryPresentationModel2D`.
 */
export type CreateGeometryPresentationModel2DOptions = {
  readonly level: LevelGeometry;
  readonly transform: ViewportTransform2D;
  readonly selection?: GeometrySelection;
  readonly hover?: GeometryHoverState;
};

/**
 * Adapts immutable runtime level geometry into SVG-oriented 2D presentation
 * data.
 */
export const createGeometryPresentationModel2D = ({
  level,
  transform,
  selection,
  hover
}: CreateGeometryPresentationModel2DOptions): GeometryPresentationModel2D => {
  const sharedUsageCounts = countBoundaryEdgeUses(level);

  return Object.freeze({
    levelId: level.id,
    sourceLevelId: level.sourceLevelId,
    bounds: collectLevelBounds(level),
    polygons: Object.freeze(
      level.polygons.map((polygon) => createPresentationPolygon(polygon, transform, selection, hover))
    ),
    boundaryEdges: Object.freeze(
      level.boundaryEdges.map((edge) =>
        createPresentationBoundaryEdge(edge, transform, sharedUsageCounts, selection, hover)
      )
    ),
    vertices: Object.freeze(
      level.vertices.map((vertex) => createPresentationVertex(vertex, transform, selection, hover))
    )
  });
};

const createPresentationPolygon = (
  polygon: Polygon,
  transform: ViewportTransform2D,
  selection: GeometrySelection | undefined,
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
    selected: isGeometrySelectionMatch(selection, "POLYGON", polygon.id),
    hovered: isGeometrySelectionMatch(hover, "POLYGON", polygon.id)
  });
};

const createPresentationBoundaryEdge = (
  edge: BoundaryEdge,
  transform: ViewportTransform2D,
  sharedUsageCounts: ReadonlyMap<BoundaryEdge["id"], number>,
  selection: GeometrySelection | undefined,
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
    selected: isGeometrySelectionMatch(selection, "BOUNDARY_EDGE", edge.id),
    hovered: isGeometrySelectionMatch(hover, "BOUNDARY_EDGE", edge.id)
  });
};

const createPresentationVertex = (
  vertex: Vertex,
  transform: ViewportTransform2D,
  selection: GeometrySelection | undefined,
  hover: GeometryHoverState
): GeometryPresentationVertex2D =>
  Object.freeze({
    kind: "VERTEX",
    geometryId: vertex.id,
    coordinates: Object.freeze({ x: vertex.x, z: vertex.z }),
    point: transform.worldToScreen(vertex),
    selected: isGeometrySelectionMatch(selection, "VERTEX", vertex.id),
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
