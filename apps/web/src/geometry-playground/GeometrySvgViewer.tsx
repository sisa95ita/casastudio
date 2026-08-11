import { useRef, type MouseEvent, type PointerEvent, type WheelEvent } from "react";

import { useCasaTranslation } from "../i18n";
import type { GeometryPresentationModel2D } from "./geometry-presentation-model-2d";
import {
  applyGeometrySelectionClick,
  clearGeometrySelection,
  createGeometrySelectionState,
  selectBoundaryEdge,
  selectPolygon,
  selectVertex,
  type GeometryHoverState,
  type GeometrySelection,
  type GeometrySelectionState,
  setGeometryHover
} from "./geometry-selection-state";
import { formatSvgNumber } from "./geometry-svg-helpers";
import {
  panViewportState,
  zoomViewportState,
  type ScreenPoint,
  type ViewportState
} from "./viewport-transform-2d";

/**
 * Fixed internal SVG viewport dimensions for the technical geometry viewer.
 */
export const geometrySvgViewport = Object.freeze({
  width: 800,
  height: 520,
  padding: 40
});

/**
 * Read-only diagnostic SVG layer visibility flags.
 *
 * These options are local presentation state. Diagnostic overlays such as
 * bounds and labels are not domain or server state.
 */
export type GeometryDisplayOptions = {
  readonly polygons: boolean;
  readonly boundaryEdges: boolean;
  readonly vertices: boolean;
  readonly centroids: boolean;
  readonly bounds: boolean;
  readonly entityLabels: boolean;
};

/**
 * Default layers for an interactive geometry viewer.
 */
export const defaultGeometryDisplayOptions: GeometryDisplayOptions = Object.freeze({
  polygons: true,
  boundaryEdges: true,
  vertices: true,
  centroids: true,
  bounds: false,
  entityLabels: false
});

/**
 * Props for the interactive geometry SVG viewer.
 */
export type GeometrySvgViewerProps = {
  readonly presentationModel: GeometryPresentationModel2D;
  readonly options: GeometryDisplayOptions;
  readonly viewport: ViewportState;
  readonly selectionState?: GeometrySelectionState;
  readonly onSelectionStateChange?: (selectionState: GeometrySelectionState) => void;
  readonly onViewportChange?: (viewport: ViewportState) => void;
};

/**
 * Renders a source-independent 2D presentation model as an interactive SVG
 * view.
 *
 * Event priority is defined by layer order and propagation: polygon hit areas
 * are below boundary edges, boundary edges are below vertices, and handled
 * entity clicks stop before reaching the background pan/clear layer.
 */
export function GeometrySvgViewer({
  presentationModel,
  options,
  viewport,
  selectionState,
  onSelectionStateChange,
  onViewportChange
}: GeometrySvgViewerProps) {
  const { t } = useCasaTranslation("geometry-playground");
  const bounds = presentationModel.bounds;
  const lastPanPointRef = useRef<ScreenPoint | undefined>(undefined);
  const currentViewportRef = useRef<ViewportState | undefined>(undefined);
  const suppressNextBackgroundClickRef = useRef(false);

  currentViewportRef.current = viewport;
  const resolvedSelectionState = selectionState ?? createGeometrySelectionState();
  const vertexRadius = Math.max(3, Math.min(6, viewport.zoom * 5));
  const centroidRadius = Math.max(4, Math.min(7, viewport.zoom * 6));

  if (!bounds) {
    return (
      <div className="geometry-empty-state" role="status">
        {t("viewer.empty")}
      </div>
    );
  }

  const getEventPoint = (event: {
    readonly clientX: number;
    readonly clientY: number;
    readonly currentTarget: SVGSVGElement;
  }): ScreenPoint => getSvgEventPoint(event, geometrySvgViewport.width, geometrySvgViewport.height);

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    if (!onViewportChange) {
      return;
    }

    event.preventDefault();
    const nextViewport = zoomViewportState({
      viewport: currentViewportRef.current ?? viewport,
      zoomFactor: Math.exp(-event.deltaY * 0.0015),
      center: getEventPoint(event)
    });

    currentViewportRef.current = nextViewport;
    onViewportChange(nextViewport);
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!onViewportChange || !isBackgroundPanEvent(event)) {
      return;
    }

    lastPanPointRef.current = getEventPoint(event);
    suppressNextBackgroundClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!onViewportChange || !lastPanPointRef.current) {
      return;
    }

    const nextPoint = getEventPoint(event);
    const delta = {
      x: nextPoint.x - lastPanPointRef.current.x,
      y: nextPoint.y - lastPanPointRef.current.y
    };

    if (Math.abs(delta.x) + Math.abs(delta.y) > 0) {
      suppressNextBackgroundClickRef.current = true;
      const nextViewport = panViewportState(currentViewportRef.current ?? viewport, delta);
      currentViewportRef.current = nextViewport;
      onViewportChange(nextViewport);
      lastPanPointRef.current = nextPoint;
    }
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (lastPanPointRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      lastPanPointRef.current = undefined;
    }
  };

  const handleBackgroundClick = (event: MouseEvent<SVGRectElement>) => {
    if (suppressNextBackgroundClickRef.current) {
      suppressNextBackgroundClickRef.current = false;
      return;
    }

    event.stopPropagation();
    onSelectionStateChange?.(clearGeometrySelection(resolvedSelectionState));
  };

  const handleEntityClick = (
    event: MouseEvent<SVGElement>,
    nextSelection: GeometrySelection
  ) => {
    event.stopPropagation();
    onSelectionStateChange?.(
      applyGeometrySelectionClick(resolvedSelectionState, nextSelection, event.shiftKey)
    );
  };

  const handleHoverChange = (nextHover: GeometryHoverState) => {
    onSelectionStateChange?.(setGeometryHover(resolvedSelectionState, nextHover));
  };

  return (
    <svg
      className="geometry-svg"
      viewBox={`0 0 ${geometrySvgViewport.width} ${geometrySvgViewport.height}`}
      role="img"
      aria-labelledby="geometry-svg-title geometry-svg-description"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <title id="geometry-svg-title">{t("viewer.svgTitle")}</title>
      <desc id="geometry-svg-description">
        {t("viewer.svgDescription")}
      </desc>

      <rect
        className="geometry-pan-background"
        data-pan-target="true"
        x="0"
        y="0"
        width={geometrySvgViewport.width}
        height={geometrySvgViewport.height}
        onClick={handleBackgroundClick}
      />

      {options.polygons ? (
        <g data-layer="polygons">
          {presentationModel.polygons.map((polygon) => {
            const className = getEntityClassName("geometry-polygon", polygon);

            return (
              <g key={polygon.geometryId}>
                <polygon
                  data-testid="geometry-polygon"
                  data-geometry-kind={polygon.kind}
                  data-geometry-id={polygon.geometryId}
                  points={polygon.svgPoints}
                  className={className}
                  onClick={(event) => handleEntityClick(event, selectPolygon(polygon.geometryId))}
                  onMouseEnter={() => handleHoverChange(selectPolygon(polygon.geometryId))}
                  onMouseLeave={() => handleHoverChange(undefined)}
                />
                {options.entityLabels ? (
                  <text
                    className="geometry-label geometry-label-room"
                    x={formatSvgNumber(polygon.centroid.screen.x)}
                    y={formatSvgNumber(polygon.centroid.screen.y - 14)}
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
          {presentationModel.polygons.map((polygon) => {
            const rect = polygon.screenBounds;

            return (
              <rect
                key={polygon.geometryId}
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
          {presentationModel.boundaryEdges.map((edge) => {
            const isShared = edge.sharedUsageCount === 2;
            const className = getEntityClassName(
              isShared ? "geometry-edge geometry-edge-shared" : "geometry-edge",
              edge
            );

            return (
              <g key={edge.geometryId}>
                <line
                  className="geometry-edge-hit-target"
                  data-geometry-kind={edge.kind}
                  data-geometry-id={edge.geometryId}
                  x1={formatSvgNumber(edge.start.screen.x)}
                  y1={formatSvgNumber(edge.start.screen.y)}
                  x2={formatSvgNumber(edge.end.screen.x)}
                  y2={formatSvgNumber(edge.end.screen.y)}
                  onClick={(event) => {
                    handleEntityClick(event, selectBoundaryEdge(edge.geometryId));
                  }}
                  onMouseEnter={() => handleHoverChange(selectBoundaryEdge(edge.geometryId))}
                  onMouseLeave={() => handleHoverChange(undefined)}
                />
                <line
                  data-testid="boundary-edge"
                  data-shared={isShared ? "true" : "false"}
                  className={className}
                  x1={formatSvgNumber(edge.start.screen.x)}
                  y1={formatSvgNumber(edge.start.screen.y)}
                  x2={formatSvgNumber(edge.end.screen.x)}
                  y2={formatSvgNumber(edge.end.screen.y)}
                />
                {options.entityLabels ? (
                  <text
                    className="geometry-label geometry-label-edge"
                    x={formatSvgNumber(edge.midpoint.x + 8)}
                    y={formatSvgNumber(edge.midpoint.y - 8)}
                  >
                    {edge.geometryId}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      ) : null}

      {options.vertices ? (
        <g data-layer="vertices">
          {presentationModel.vertices.map((vertex) => {
            const className = getEntityClassName("geometry-vertex", vertex);

            return (
              <g key={vertex.geometryId}>
                <circle
                  data-testid="geometry-vertex"
                  data-geometry-kind={vertex.kind}
                  data-geometry-id={vertex.geometryId}
                  className={className}
                  cx={formatSvgNumber(vertex.point.x)}
                  cy={formatSvgNumber(vertex.point.y)}
                  r={formatSvgNumber(vertexRadius)}
                  onClick={(event) => handleEntityClick(event, selectVertex(vertex.geometryId))}
                  onMouseEnter={() => handleHoverChange(selectVertex(vertex.geometryId))}
                  onMouseLeave={() => handleHoverChange(undefined)}
                />
                {options.entityLabels ? (
                  <text
                    className="geometry-label geometry-label-vertex"
                    x={formatSvgNumber(vertex.point.x + 8)}
                    y={formatSvgNumber(vertex.point.y + 18)}
                  >
                    {vertex.geometryId}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      ) : null}

      {options.centroids ? (
        <g data-layer="centroids">
          {presentationModel.polygons.map((polygon) => (
            <g key={polygon.geometryId} data-testid="polygon-centroid">
              <circle
                className="geometry-centroid"
                cx={formatSvgNumber(polygon.centroid.screen.x)}
                cy={formatSvgNumber(polygon.centroid.screen.y)}
                r={formatSvgNumber(centroidRadius)}
              />
              <line
                className="geometry-centroid-cross"
                x1={formatSvgNumber(polygon.centroid.screen.x - centroidRadius)}
                y1={formatSvgNumber(polygon.centroid.screen.y)}
                x2={formatSvgNumber(polygon.centroid.screen.x + centroidRadius)}
                y2={formatSvgNumber(polygon.centroid.screen.y)}
              />
              <line
                className="geometry-centroid-cross"
                x1={formatSvgNumber(polygon.centroid.screen.x)}
                y1={formatSvgNumber(polygon.centroid.screen.y - centroidRadius)}
                x2={formatSvgNumber(polygon.centroid.screen.x)}
                y2={formatSvgNumber(polygon.centroid.screen.y + centroidRadius)}
              />
            </g>
          ))}
        </g>
      ) : null}
    </svg>
  );
}

const getSvgEventPoint = (
  event: {
    readonly clientX: number;
    readonly clientY: number;
    readonly currentTarget: SVGSVGElement;
  },
  viewportWidth: number,
  viewportHeight: number
): ScreenPoint => {
  const bounds = event.currentTarget.getBoundingClientRect();

  return {
    x: ((event.clientX - bounds.left) / bounds.width) * viewportWidth,
    y: ((event.clientY - bounds.top) / bounds.height) * viewportHeight
  };
};

const isBackgroundPanEvent = (event: PointerEvent<SVGSVGElement>): boolean =>
  event.target instanceof SVGElement && event.target.dataset.panTarget === "true";

const getEntityClassName = (
  baseClassName: string,
  state: { readonly selected: boolean; readonly hovered: boolean }
): string =>
  [
    baseClassName,
    state.hovered ? "geometry-entity-hovered" : undefined,
    state.selected ? "geometry-entity-selected" : undefined
  ]
    .filter(Boolean)
    .join(" ");
