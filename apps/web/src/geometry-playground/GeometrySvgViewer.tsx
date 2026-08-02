import type { LevelGeometry } from "@casastudio/geometry";

import {
  collectLevelBounds,
  countBoundaryEdgeUses,
  formatSvgNumber,
  getPolygonPointString,
  getScreenBoundsRect
} from "./geometry-svg-helpers";
import { createFitToViewTransform } from "./viewport-transform-2d";

const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 520;
const VIEWPORT_PADDING = 40;

/**
 * Read-only diagnostic SVG layer visibility flags.
 *
 * These options are local presentation state for the playground. They are kept
 * out of `GeometryModel` because diagnostic overlays such as bounds and labels
 * are not domain geometry.
 */
export type GeometryDisplayOptions = {
  readonly polygons: boolean;
  readonly boundaryEdges: boolean;
  readonly vertices: boolean;
  readonly centroids: boolean;
  readonly bounds: boolean;
  readonly runtimeLabels: boolean;
};

/**
 * Default debug layers for the Phase 1 geometry playground.
 */
export const defaultGeometryDisplayOptions: GeometryDisplayOptions = Object.freeze({
  polygons: true,
  boundaryEdges: true,
  vertices: true,
  centroids: true,
  bounds: false,
  runtimeLabels: false
});

/**
 * Props for the read-only runtime geometry SVG viewer.
 */
export type GeometrySvgViewerProps = {
  readonly level: LevelGeometry;
  readonly options: GeometryDisplayOptions;
};

/**
 * Renders one immutable `LevelGeometry` as an SVG debug view.
 *
 * The component consumes runtime entities directly for this first playground
 * slice, but all world XZ to SVG XY projection is delegated to
 * `ViewportTransform2D`. This keeps the renderer honest without introducing a
 * complete 2D editor view-model hierarchy before editing exists.
 */
export function GeometrySvgViewer({ level, options }: GeometrySvgViewerProps) {
  const bounds = collectLevelBounds(level);

  if (!bounds) {
    return (
      <div className="geometry-empty-state" role="status">
        No runtime geometry to display for this level.
      </div>
    );
  }

  const transform = createFitToViewTransform({
    bounds,
    viewportWidth: VIEWPORT_WIDTH,
    viewportHeight: VIEWPORT_HEIGHT,
    padding: VIEWPORT_PADDING
  });
  const edgeUseCounts = countBoundaryEdgeUses(level);
  const vertexRadius = Math.max(3, Math.min(6, transform.scaleLength(5)));
  const centroidRadius = Math.max(4, Math.min(7, transform.scaleLength(6)));

  return (
    <svg
      className="geometry-svg"
      viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`}
      role="img"
      aria-labelledby="geometry-svg-title geometry-svg-description"
    >
      <title id="geometry-svg-title">Geometry playground runtime SVG viewer</title>
      <desc id="geometry-svg-description">
        Read-only SVG projection of GeometryEngine runtime level geometry.
      </desc>

      {options.polygons ? (
        <g data-layer="polygons">
          {level.polygons.map((polygon) => {
            const centroid = transform.worldToScreen(polygon.centroid);

            return (
              <g key={polygon.id}>
                <polygon
                  data-testid="geometry-polygon"
                  points={getPolygonPointString(polygon, transform)}
                  className="geometry-polygon"
                />
                {options.runtimeLabels ? (
                  <text
                    className="geometry-label geometry-label-room"
                    x={formatSvgNumber(centroid.x)}
                    y={formatSvgNumber(centroid.y - 14)}
                    textAnchor="middle"
                  >
                    {polygon.sourceRoomId}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      ) : null}

      {options.bounds ? (
        <g data-layer="polygon-bounds">
          {level.polygons.map((polygon) => {
            const rect = getScreenBoundsRect(polygon.bounds, transform);

            return (
              <rect
                key={polygon.id}
                data-testid="polygon-bounds"
                className="geometry-polygon-bounds"
                x={formatSvgNumber(rect.x)}
                y={formatSvgNumber(rect.y)}
                width={formatSvgNumber(rect.width)}
                height={formatSvgNumber(rect.height)}
              />
            );
          })}
        </g>
      ) : null}

      {options.boundaryEdges ? (
        <g data-layer="boundary-edges">
          {level.boundaryEdges.map((edge) => {
            const start = transform.worldToScreen(edge.startVertex);
            const end = transform.worldToScreen(edge.endVertex);
            const isShared = (edgeUseCounts.get(edge.id) ?? 0) === 2;
            const midpoint = {
              x: (start.x + end.x) / 2,
              y: (start.y + end.y) / 2
            };

            return (
              <g key={edge.id}>
                <line
                  data-testid="boundary-edge"
                  data-shared={isShared ? "true" : "false"}
                  className={isShared ? "geometry-edge geometry-edge-shared" : "geometry-edge"}
                  x1={formatSvgNumber(start.x)}
                  y1={formatSvgNumber(start.y)}
                  x2={formatSvgNumber(end.x)}
                  y2={formatSvgNumber(end.y)}
                />
                {options.runtimeLabels ? (
                  <text
                    className="geometry-label geometry-label-edge"
                    x={formatSvgNumber(midpoint.x + 8)}
                    y={formatSvgNumber(midpoint.y - 8)}
                  >
                    {edge.id}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      ) : null}

      {options.vertices ? (
        <g data-layer="vertices">
          {level.vertices.map((vertex) => {
            const point = transform.worldToScreen(vertex);

            return (
              <g key={vertex.id}>
                <circle
                  data-testid="geometry-vertex"
                  className="geometry-vertex"
                  cx={formatSvgNumber(point.x)}
                  cy={formatSvgNumber(point.y)}
                  r={formatSvgNumber(vertexRadius)}
                />
                {options.runtimeLabels ? (
                  <text
                    className="geometry-label geometry-label-vertex"
                    x={formatSvgNumber(point.x + 8)}
                    y={formatSvgNumber(point.y + 18)}
                  >
                    {vertex.id}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      ) : null}

      {options.centroids ? (
        <g data-layer="centroids">
          {level.polygons.map((polygon) => {
            const point = transform.worldToScreen(polygon.centroid);

            return (
              <g key={polygon.id} data-testid="polygon-centroid">
                <circle
                  className="geometry-centroid"
                  cx={formatSvgNumber(point.x)}
                  cy={formatSvgNumber(point.y)}
                  r={formatSvgNumber(centroidRadius)}
                />
                <line
                  className="geometry-centroid-cross"
                  x1={formatSvgNumber(point.x - centroidRadius)}
                  y1={formatSvgNumber(point.y)}
                  x2={formatSvgNumber(point.x + centroidRadius)}
                  y2={formatSvgNumber(point.y)}
                />
                <line
                  className="geometry-centroid-cross"
                  x1={formatSvgNumber(point.x)}
                  y1={formatSvgNumber(point.y - centroidRadius)}
                  x2={formatSvgNumber(point.x)}
                  y2={formatSvgNumber(point.y + centroidRadius)}
                />
              </g>
            );
          })}
        </g>
      ) : null}
    </svg>
  );
}
