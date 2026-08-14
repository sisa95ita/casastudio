import {
  useRef,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent
} from "react";

import { useCasaTranslation } from "../i18n";
import type { GeometryPresentationModel2D } from "./geometry-presentation-model-2d";
import type { ProjectEditorInteraction } from "../state/project-editor-tools";
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
  createViewportTransform2D,
  panViewportState,
  zoomViewportState,
  type ScreenPoint,
  type ViewportState,
  type WorldPointXZ
} from "./viewport-transform-2d";
import type { WallEndpoint } from "@casastudio/schema";

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
export const defaultGeometryDisplayOptions: GeometryDisplayOptions =
  Object.freeze({
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
  readonly onSelectionStateChange?: (
    selectionState: GeometrySelectionState
  ) => void;
  readonly onViewportChange?: (viewport: ViewportState) => void;
  readonly interaction?: ProjectEditorInteraction;
  readonly editorOverlay?: GeometryEditorOverlay;
  readonly onEditorCanvasClick?: (point: WorldPointXZ) => void;
  readonly onEditorPointerMove?: (
    point: WorldPointXZ,
    pointerId: number
  ) => void;
  readonly onWallEndpointPointerDown?: (
    endpoint: WallEndpoint,
    pointerId: number
  ) => void;
  readonly onWallEndpointPointerUp?: (
    point: WorldPointXZ,
    pointerId: number
  ) => void;
  readonly onWallEndpointPointerCancel?: (pointerId: number) => void;
};

/** Editor-only geometry rendered above the stable presentation model. */
export type GeometryEditorOverlay = {
  readonly drawWall?: {
    readonly start: WorldPointXZ;
    readonly end: WorldPointXZ;
  };
  readonly selectedWall?: {
    readonly wallId: string;
    readonly start: WorldPointXZ;
    readonly end: WorldPointXZ;
    readonly endpointEditingAvailable: boolean;
    readonly draggingEndpoint?: WallEndpoint;
  };
};

const defaultViewerInteraction: ProjectEditorInteraction = Object.freeze({
  selectionEnabled: true,
  panEnabled: true,
  drawWallEnabled: false,
  wallEndpointEditingEnabled: false
});

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
  onViewportChange,
  interaction = defaultViewerInteraction,
  editorOverlay,
  onEditorCanvasClick,
  onEditorPointerMove,
  onWallEndpointPointerDown,
  onWallEndpointPointerUp,
  onWallEndpointPointerCancel
}: GeometrySvgViewerProps) {
  const { t } = useCasaTranslation("geometry-playground");
  const bounds = presentationModel.bounds;
  const lastPanPointRef = useRef<ScreenPoint | undefined>(undefined);
  const currentViewportRef = useRef<ViewportState | undefined>(undefined);
  const suppressNextBackgroundClickRef = useRef(false);
  const endpointPointerIdRef = useRef<number | undefined>(undefined);

  currentViewportRef.current = viewport;
  const resolvedSelectionState =
    selectionState ?? createGeometrySelectionState();
  const transform = createViewportTransform2D(viewport);
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
  }): ScreenPoint =>
    getSvgEventPoint(
      event,
      geometrySvgViewport.width,
      geometrySvgViewport.height
    );

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
    if (
      !interaction.panEnabled ||
      !onViewportChange ||
      !isBackgroundPanEvent(event)
    ) {
      return;
    }

    lastPanPointRef.current = getEventPoint(event);
    suppressNextBackgroundClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    onEditorPointerMove?.(
      transform.screenToWorld(getEventPoint(event)),
      event.pointerId
    );

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
      const nextViewport = panViewportState(
        currentViewportRef.current ?? viewport,
        delta
      );
      currentViewportRef.current = nextViewport;
      onViewportChange(nextViewport);
      lastPanPointRef.current = nextPoint;
    }
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (endpointPointerIdRef.current === event.pointerId) {
      onWallEndpointPointerUp?.(
        transform.screenToWorld(getEventPoint(event)),
        event.pointerId
      );
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      endpointPointerIdRef.current = undefined;
      return;
    }

    if (lastPanPointRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      lastPanPointRef.current = undefined;
    }
  };

  const handlePointerCancel = (event: PointerEvent<SVGSVGElement>) => {
    if (endpointPointerIdRef.current === event.pointerId) {
      onWallEndpointPointerCancel?.(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      endpointPointerIdRef.current = undefined;
    }
    lastPanPointRef.current = undefined;
  };

  const handleSvgClick = (event: MouseEvent<SVGSVGElement>) => {
    if (interaction.drawWallEnabled) {
      onEditorCanvasClick?.(transform.screenToWorld(getEventPoint(event)));
    }
  };

  const handleEndpointPointerDown = (
    event: PointerEvent<SVGCircleElement>,
    endpoint: WallEndpoint
  ) => {
    if (!interaction.wallEndpointEditingEnabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    endpointPointerIdRef.current = event.pointerId;
    svg.setPointerCapture(event.pointerId);
    onWallEndpointPointerDown?.(endpoint, event.pointerId);
  };

  const handleBackgroundClick = (event: MouseEvent<SVGRectElement>) => {
    if (!interaction.selectionEnabled) {
      return;
    }

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
    if (!interaction.selectionEnabled) {
      return;
    }

    event.stopPropagation();
    onSelectionStateChange?.(
      applyGeometrySelectionClick(
        resolvedSelectionState,
        nextSelection,
        event.shiftKey
      )
    );
  };

  const handleHoverChange = (nextHover: GeometryHoverState) => {
    if (interaction.selectionEnabled) {
      onSelectionStateChange?.(
        setGeometryHover(resolvedSelectionState, nextHover)
      );
    }
  };

  return (
    <svg
      className={`geometry-svg geometry-svg--${
        interaction.drawWallEnabled
          ? "draw-wall"
          : interaction.selectionEnabled
            ? "select"
            : interaction.panEnabled
              ? "pan"
              : "neutral"
      }`}
      viewBox={`0 0 ${geometrySvgViewport.width} ${geometrySvgViewport.height}`}
      role="img"
      aria-labelledby="geometry-svg-title geometry-svg-description"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleSvgClick}
    >
      <title id="geometry-svg-title">{t("viewer.svgTitle")}</title>
      <desc id="geometry-svg-description">{t("viewer.svgDescription")}</desc>

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
                  onClick={(event) =>
                    handleEntityClick(event, selectPolygon(polygon.geometryId))
                  }
                  onMouseEnter={() =>
                    handleHoverChange(selectPolygon(polygon.geometryId))
                  }
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
            const stableClassName = getEntityClassName(
              isShared ? "geometry-edge geometry-edge-shared" : "geometry-edge",
              edge
            );
            const isDragSource =
              editorOverlay?.selectedWall?.draggingEndpoint !== undefined &&
              editorOverlay.selectedWall.wallId === edge.sourceWallId;
            const className = `${stableClassName}${
              isDragSource ? " geometry-edge--drag-source" : ""
            }`;

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
                    handleEntityClick(
                      event,
                      selectBoundaryEdge(edge.geometryId)
                    );
                  }}
                  onMouseEnter={() =>
                    handleHoverChange(selectBoundaryEdge(edge.geometryId))
                  }
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
                  onClick={(event) =>
                    handleEntityClick(event, selectVertex(vertex.geometryId))
                  }
                  onMouseEnter={() =>
                    handleHoverChange(selectVertex(vertex.geometryId))
                  }
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

      <GeometryEditorOverlayLayer
        overlay={editorOverlay}
        transform={transform}
        endpointEditingEnabled={interaction.wallEndpointEditingEnabled}
        onEndpointPointerDown={handleEndpointPointerDown}
      />
    </svg>
  );
}

function GeometryEditorOverlayLayer({
  overlay,
  transform,
  endpointEditingEnabled,
  onEndpointPointerDown
}: {
  readonly overlay?: GeometryEditorOverlay;
  readonly transform: ReturnType<typeof createViewportTransform2D>;
  readonly endpointEditingEnabled: boolean;
  readonly onEndpointPointerDown: (
    event: PointerEvent<SVGCircleElement>,
    endpoint: WallEndpoint
  ) => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const drawStart = overlay?.drawWall
    ? transform.worldToScreen(overlay.drawWall.start)
    : undefined;
  const drawEnd = overlay?.drawWall
    ? transform.worldToScreen(overlay.drawWall.end)
    : undefined;
  const selectedStart = overlay?.selectedWall
    ? transform.worldToScreen(overlay.selectedWall.start)
    : undefined;
  const selectedEnd = overlay?.selectedWall
    ? transform.worldToScreen(overlay.selectedWall.end)
    : undefined;

  return (
    <g data-layer="editor-overlay">
      {drawStart && drawEnd ? (
        <g aria-hidden="true" data-testid="draw-wall-preview">
          <line
            className="geometry-wall-preview"
            x1={formatSvgNumber(drawStart.x)}
            y1={formatSvgNumber(drawStart.y)}
            x2={formatSvgNumber(drawEnd.x)}
            y2={formatSvgNumber(drawEnd.y)}
          />
          <circle
            className="geometry-wall-preview-point"
            cx={formatSvgNumber(drawStart.x)}
            cy={formatSvgNumber(drawStart.y)}
            r="4"
          />
          <circle
            className="geometry-wall-preview-point"
            cx={formatSvgNumber(drawEnd.x)}
            cy={formatSvgNumber(drawEnd.y)}
            r="4"
          />
        </g>
      ) : null}
      {selectedStart && selectedEnd && overlay?.selectedWall ? (
        <g data-testid="selected-wall-overlay">
          <line
            aria-hidden="true"
            className={`geometry-selected-wall${
              overlay.selectedWall.draggingEndpoint
                ? " geometry-selected-wall--dragging"
                : ""
            }`}
            x1={formatSvgNumber(selectedStart.x)}
            y1={formatSvgNumber(selectedStart.y)}
            x2={formatSvgNumber(selectedEnd.x)}
            y2={formatSvgNumber(selectedEnd.y)}
          />
          {endpointEditingEnabled &&
          overlay.selectedWall.endpointEditingAvailable ? (
            <>
              <circle
                className="geometry-wall-endpoint-hit-target"
                role="button"
                aria-label={t("wall.startEndpoint")}
                tabIndex={0}
                cx={formatSvgNumber(selectedStart.x)}
                cy={formatSvgNumber(selectedStart.y)}
                r="10"
                onPointerDown={(event) => onEndpointPointerDown(event, "start")}
              />
              <circle
                className="geometry-wall-endpoint"
                aria-hidden="true"
                cx={formatSvgNumber(selectedStart.x)}
                cy={formatSvgNumber(selectedStart.y)}
                r="5"
              />
              <circle
                className="geometry-wall-endpoint-hit-target"
                role="button"
                aria-label={t("wall.endEndpoint")}
                tabIndex={0}
                cx={formatSvgNumber(selectedEnd.x)}
                cy={formatSvgNumber(selectedEnd.y)}
                r="10"
                onPointerDown={(event) => onEndpointPointerDown(event, "end")}
              />
              <circle
                className="geometry-wall-endpoint"
                aria-hidden="true"
                cx={formatSvgNumber(selectedEnd.x)}
                cy={formatSvgNumber(selectedEnd.y)}
                r="5"
              />
            </>
          ) : null}
        </g>
      ) : null}
    </g>
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
  event.target instanceof SVGElement &&
  event.target.dataset.panTarget === "true";

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
