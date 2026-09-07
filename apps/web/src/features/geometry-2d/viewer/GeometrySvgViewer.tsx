import { FurnitureSvgLayer, type FurnitureViewerModel } from "./FurnitureSvgLayer";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent
} from "react";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";

import { useCasaTranslation } from "../../../core/i18n";
import {
  createStaircasePresentation2D,
  type ArchitecturalPresentationModel2D
} from "../presentation/architectural-presentation-model-2d";
import type {
  ArchitecturalDimensionPresentationModel2D,
  LinearDimensionPresentation2D
} from "../presentation/architectural-dimension-presentation-model-2d";
import type { GeometryPresentationModel2D } from "../presentation/geometry-presentation-model-2d";
import type { ProjectEditorInteraction } from "../../editor-2d/state/project-editor-tools";
import {
  applyGeometrySelectionClick,
  clearGeometrySelection,
  createGeometrySelectionState,
  selectBoundaryEdge,
  selectDoor,
  selectWallOpening,
  selectPolygon,
  selectVertex,
  selectWall,
  selectWindow,
  selectStaircase,
  selectStairFlight,
  selectStairLanding,
  type GeometryHoverState,
  type GeometrySelection,
  type GeometrySelectionState,
  setGeometryHover
} from "../selection/geometry-selection-state";
import { formatSvgNumber } from "../viewport/geometry-svg-helpers";
import {
  createViewportTransform2D,
  normalizeClientPointToSvgViewport,
  panViewportState,
  zoomViewportState,
  type ScreenPoint,
  type ViewportState,
  type WorldPointXZ
} from "../viewport/viewport-transform-2d";
import type { WallEndpoint } from "@casastudio/schema";
import type { Opening, Wall } from "@casastudio/schema";
import type { RoomShapeKind, Staircase } from "@casastudio/schema";
import {
  createDoorPlanGeometry,
  createWallOpeningPlanGeometry,
  createWindowPlanGeometry
} from "@casastudio/geometry";
import type { DrawWallSnapCandidate } from "../../editor-2d/tools/wall/project-wall-snapping";

/**
 * Fixed internal SVG viewport dimensions for the technical geometry viewer.
 */
export const geometrySvgViewport = Object.freeze({
  width: 800,
  height: 520,
  padding: 40
});

/**
 * SVG layer visibility flags for architectural geometry and diagnostics.
 *
 * These options are local presentation state and are not domain or server
 * state. Room contours use the same ordered polygon points as Room fills.
 */
export type GeometryDisplayOptions = {
  readonly architecturalWalls: boolean;
  readonly openings: boolean;
  readonly polygons: boolean;
  /** Whether ordered architectural Room polygon contours are visible. */
  readonly roomContours: boolean;
  readonly boundaryEdges: boolean;
  readonly vertices: boolean;
  readonly centroids: boolean;
  readonly bounds: boolean;
  readonly entityLabels: boolean;
  readonly overallDimensions: boolean;
  readonly selectedDimensions: boolean;
  readonly roomMetrics: boolean;
  /** Whether persisted product annotations are visible when available. */
  readonly annotations: boolean;
  /** Committed Furniture visibility; authoring proposals remain visible independently. */
  readonly furniture?: boolean;
};

/**
 * Default layers for an interactive geometry viewer.
 */
export const defaultGeometryDisplayOptions: GeometryDisplayOptions =
  Object.freeze({
    furniture: true,
    architecturalWalls: true,
    openings: true,
    polygons: true,
    roomContours: true,
    boundaryEdges: true,
    vertices: true,
    centroids: true,
    bounds: false,
    entityLabels: false,
    overallDimensions: false,
    selectedDimensions: false,
    roomMetrics: false,
    annotations: false
  });

/**
 * Default layer visibility for the Project architectural workspace.
 *
 * Architectural geometry is visible while bounding boxes and runtime labels
 * remain disabled for the authoring workspace.
 */
export const projectGeometryDisplayOptions: GeometryDisplayOptions =
  Object.freeze({
    furniture: true,
    architecturalWalls: true,
    openings: true,
    polygons: true,
    roomContours: false,
    boundaryEdges: true,
    vertices: true,
    centroids: true,
    bounds: false,
    entityLabels: false,
    overallDimensions: true,
    selectedDimensions: true,
    roomMetrics: true,
    annotations: true
  });

/**
 * Props for the interactive geometry SVG viewer.
 */
export type GeometrySvgViewerProps = {
  readonly furnitureModel?: FurnitureViewerModel;
  readonly onFurniturePointerDown?: (id: string, intent: "move" | "rotate", pointer: SvgViewportPointer, pointerId: number) => void;
  readonly onFurniturePointerUp?: (dragged: boolean) => void;
  readonly onFurniturePointerCancel?: () => void;
  readonly presentationModel: GeometryPresentationModel2D;
  readonly architecturalModel?: ArchitecturalPresentationModel2D;
  readonly dimensionModel?: ArchitecturalDimensionPresentationModel2D;
  readonly options: GeometryDisplayOptions;
  readonly viewport: ViewportState;
  readonly selectionState?: GeometrySelectionState;
  readonly onSelectionStateChange?: (
    selectionState: GeometrySelectionState
  ) => void;
  readonly onViewportChange?: (viewport: ViewportState) => void;
  readonly interaction?: ProjectEditorInteraction;
  readonly editorOverlay?: GeometryEditorOverlay;
  readonly onEditorCanvasClick?: (pointer: SvgViewportPointer) => void;
  readonly onEditorPointerMove?: (
    pointer: SvgViewportPointer,
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
  readonly onJunctionPointerDown?: (pointerId: number) => void;
  readonly onOpeningPointerDown?: (
    openingId: string,
    wallId: string,
    pointerId: number
  ) => void;
  readonly onOpeningDragThresholdCrossed?: (pointerId: number) => void;
  readonly onOpeningPointerUp?: (pointerId: number, dragged: boolean) => void;
  readonly onOpeningPointerCancel?: (pointerId: number) => void;
  readonly onRoomFaceCandidateClick?: (faceKey: string) => void;
  readonly onStairAdjustmentPointerDown?: (staircaseId: string, pointerId: number) => void;
  readonly onStairAdjustmentPointerUp?: (point: WorldPointXZ, pointerId: number) => void;
  readonly onStairAdjustmentPointerCancel?: (pointerId: number) => void;
  readonly onStairTranslationPointerDown?: (staircaseId: string, point: WorldPointXZ, pointerId: number) => void;
  readonly onStairTranslationPointerUp?: (pointerId: number) => void;
  readonly onStairTranslationPointerCancel?: (pointerId: number) => void;
};

/** Pointer normalized into both SVG viewBox and canonical world coordinates. */
export type SvgViewportPointer = {
  readonly svgPoint: ScreenPoint;
  readonly worldPoint: WorldPointXZ;
  readonly cssPixelsPerSvgUnit: number;
};

/** Screen-local state for distinguishing an Opening click from a drag. */
type OpeningPointerInteraction = {
  readonly pointerId: number;
  readonly openingId: string;
  readonly wallId: string;
  readonly startPoint: ScreenPoint;
  readonly cssPixelsPerSvgUnit: number;
  dragStarted: boolean;
  completed: boolean;
};

/** Captured pointer state for one viewport-only pan gesture. */
type ViewportPanInteraction = {
  readonly pointerId: number;
  readonly extent: "background" | "viewport";
  lastPoint: ScreenPoint;
};

/** Minimum pointer travel required before an Opening interaction becomes a drag. */
const openingDragThresholdCssPixels = 5;

/** Editor-only geometry rendered above the stable presentation model. */
export type GeometryEditorOverlay = {
  readonly roomFaceCandidates?: readonly {
    readonly faceKey: string;
    readonly vertices: readonly WorldPointXZ[];
    readonly selected: boolean;
  }[];
  readonly drawWall?: {
    readonly start: WorldPointXZ;
    readonly end: WorldPointXZ;
    /** Architectural label derived from the exact Project-space preview. */
    readonly lengthLabel?: string;
  };
  /** Exact transient Room footprint projected through the shared viewport. */
  readonly roomShapePreview?: {
    readonly vertices: readonly WorldPointXZ[];
    readonly labelAnchor: WorldPointXZ;
    readonly label: string;
    readonly kind: RoomShapeKind;
    readonly elevated?: boolean;
    readonly elevation?: number;
    readonly valid: boolean;
  };
  /** Complete canonical Staircase proposal rendered without entering history. */
  readonly stairPreview?: {
    readonly staircase: Staircase;
    readonly valid: boolean;
    readonly locked: boolean;
  };
  /** Direct-manipulation handle for the selected root Staircase. */
  readonly selectedStair?: {
    readonly staircaseId: string;
    readonly adjustmentPoint: WorldPointXZ;
  };
  readonly selectedWall?: {
    readonly wallId: string;
    readonly start: WorldPointXZ;
    readonly end: WorldPointXZ;
    readonly endpointEditingAvailable: {
      readonly start: boolean;
      readonly end: boolean;
    };
    readonly draggingEndpoint?: WallEndpoint;
  };
  readonly snapCandidate?: DrawWallSnapCandidate;
  readonly snapMarkerPurpose?: "authoring" | "measurement";
  readonly selectedJunction?: {
    readonly position: WorldPointXZ;
    readonly previewPosition: WorldPointXZ;
  };
  /** Point-on-Wall preview for a canonical split. */
  readonly wallVertexPreview?: WorldPointXZ;
  readonly openingPreview?: {
    readonly wall: Wall;
    readonly opening: Opening;
    readonly valid: boolean;
  };
  /** Canonical Opening identifier currently using captured drag semantics. */
  readonly activeOpeningDragId?: string;
  readonly grid?: {
    readonly visible: boolean;
    readonly spacing: number;
  };
};

const defaultViewerInteraction: ProjectEditorInteraction = Object.freeze({
  selectionEnabled: true,
  panEnabled: true,
  drawWallEnabled: false,
  wallEndpointEditingEnabled: false,
  openingEditingEnabled: false
});

/**
 * Renders a source-independent 2D presentation model as an interactive SVG
 * view.
 *
 * Event priority is defined by layer order and propagation: polygon hit areas
 * are below diagnostic Wall/Vertex geometry, architectural Openings are above
 * Wall hit targets, and handled entity clicks stop before the background layer.
 */
export function GeometrySvgViewer({
  furnitureModel,
  onFurniturePointerDown,
  onFurniturePointerUp,
  onFurniturePointerCancel,
  presentationModel,
  architecturalModel,
  dimensionModel,
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
  onWallEndpointPointerCancel,
  onJunctionPointerDown,
  onOpeningPointerDown,
  onOpeningDragThresholdCrossed,
  onOpeningPointerUp,
  onOpeningPointerCancel,
  onRoomFaceCandidateClick,
  onStairAdjustmentPointerDown,
  onStairAdjustmentPointerUp,
  onStairAdjustmentPointerCancel,
  onStairTranslationPointerDown,
  onStairTranslationPointerUp,
  onStairTranslationPointerCancel
}: GeometrySvgViewerProps) {
  const { t } = useCasaTranslation("geometry-playground");
  const bounds = presentationModel.bounds;
  const panInteractionRef = useRef<ViewportPanInteraction | undefined>(undefined);
  const [isPanning, setIsPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const currentViewportRef = useRef<ViewportState>(viewport);
  const viewportTransformRef = useRef(createViewportTransform2D(viewport));
  const onViewportChangeRef = useRef(onViewportChange);
  const suppressNextBackgroundClickRef = useRef(false);
  const endpointPointerIdRef = useRef<number | undefined>(undefined);
  const openingPointerInteractionRef = useRef<OpeningPointerInteraction | undefined>(undefined);
  const furniturePointerRef = useRef<{ pointerId: number; start: ScreenPoint; scale: number; dragged: boolean } | undefined>(undefined);
  const furnitureClickHandledRef = useRef(false);
  const stairAdjustmentPointerIdRef = useRef<number | undefined>(undefined);
  const stairTranslationPointerIdRef = useRef<number | undefined>(undefined);

  currentViewportRef.current = viewport;
  viewportTransformRef.current = createViewportTransform2D(viewport);
  onViewportChangeRef.current = onViewportChange;
  const resolvedSelectionState =
    selectionState ?? createGeometrySelectionState();
  const transform = viewportTransformRef.current;
  const vertexRadius = Math.max(3, Math.min(6, viewport.zoom * 5));
  const centroidRadius = Math.max(4, Math.min(7, viewport.zoom * 6));

  const rendersSvgViewport = Boolean(
    bounds || architecturalModel?.staircases.length || interaction.drawWallEnabled || interaction.measurementEnabled ||
      interaction.roomShapePlacementEnabled || interaction.stairPlacementEnabled || interaction.furniturePlacementEnabled || furnitureModel?.items.length
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!rendersSvgViewport || !svg) return;

    const listenerOptions = { passive: false, capture: false } as const;
    const handleWheel = (event: globalThis.WheelEvent) => {
      const viewportChange = onViewportChangeRef.current;
      if (!viewportChange) return;

      event.preventDefault();
      const normalized = normalizeClientPointToSvgViewport({
        clientX: event.clientX,
        clientY: event.clientY,
        bounds: svg.getBoundingClientRect(),
        viewBoxWidth: geometrySvgViewport.width,
        viewBoxHeight: geometrySvgViewport.height
      });
      const nextViewport = zoomViewportState({
        viewport: currentViewportRef.current,
        zoomFactor: Math.exp(-event.deltaY * 0.0015),
        center: normalized.point
      });

      currentViewportRef.current = nextViewport;
      viewportChange(nextViewport);
    };

    svg.addEventListener("wheel", handleWheel, listenerOptions);
    return () => svg.removeEventListener("wheel", handleWheel, listenerOptions);
  }, [rendersSvgViewport]);

  useEffect(() => {
    const panInteraction = panInteractionRef.current;
    if (
      interaction.panAnywhere ||
      panInteraction?.extent !== "viewport"
    ) {
      return;
    }

    const svg = svgRef.current;
    if (svg?.hasPointerCapture(panInteraction.pointerId)) {
      svg.releasePointerCapture(panInteraction.pointerId);
    }
    panInteractionRef.current = undefined;
    setIsPanning(false);
  }, [interaction.panAnywhere]);

  if (!rendersSvgViewport) {
    return (
      <div className="geometry-empty-state" role="status">
        {t("viewer.empty")}
      </div>
    );
  }

  const getEventPointer = (event: {
    readonly clientX: number;
    readonly clientY: number;
    readonly currentTarget: SVGSVGElement;
  }): SvgViewportPointer => {
    const normalized = normalizeClientPointToSvgViewport({
      clientX: event.clientX,
      clientY: event.clientY,
      bounds: event.currentTarget.getBoundingClientRect(),
      viewBoxWidth: geometrySvgViewport.width,
      viewBoxHeight: geometrySvgViewport.height
    });
    return {
      svgPoint: normalized.point,
      worldPoint: transform.screenToWorld(normalized.point),
      cssPixelsPerSvgUnit: normalized.cssPixelsPerSvgUnit
    };
  };
  const getEventPoint = (event: {
    readonly clientX: number;
    readonly clientY: number;
    readonly currentTarget: SVGSVGElement;
  }): ScreenPoint => getEventPointer(event).svgPoint;

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    // Suppression belongs to the preceding gesture's synthetic click only.
    suppressNextBackgroundClickRef.current = false;
    furnitureClickHandledRef.current = false;
    if (openingPointerInteractionRef.current?.completed) {
      openingPointerInteractionRef.current = undefined;
    }
    if (
      !interaction.panEnabled ||
      !onViewportChange ||
      (!interaction.panAnywhere && !isBackgroundPanEvent(event))
    ) {
      return;
    }

    event.preventDefault();
    panInteractionRef.current = {
      pointerId: event.pointerId,
      extent: interaction.panAnywhere ? "viewport" : "background",
      lastPoint: getEventPoint(event)
    };
    setIsPanning(true);
    suppressNextBackgroundClickRef.current = Boolean(interaction.panAnywhere);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const pointer = getEventPointer(event);
    const furnitureGesture = furniturePointerRef.current;
    if (furnitureGesture?.pointerId === event.pointerId) {
      const distanceInCssPixels = Math.hypot(
        pointer.svgPoint.x - furnitureGesture.start.x,
        pointer.svgPoint.y - furnitureGesture.start.y
      ) * furnitureGesture.scale;
      if (distanceInCssPixels < openingDragThresholdCssPixels && !furnitureGesture.dragged) return;
      furnitureGesture.dragged = true;
    }
    const openingInteraction = openingPointerInteractionRef.current;
    if (openingInteraction?.pointerId === event.pointerId) {
      const distanceInCssPixels = Math.hypot(
        pointer.svgPoint.x - openingInteraction.startPoint.x,
        pointer.svgPoint.y - openingInteraction.startPoint.y
      ) * openingInteraction.cssPixelsPerSvgUnit;
      if (
        !openingInteraction.dragStarted &&
        distanceInCssPixels >= openingDragThresholdCssPixels
      ) {
        openingInteraction.dragStarted = true;
        onOpeningDragThresholdCrossed?.(event.pointerId);
      }
      if (!openingInteraction.dragStarted) return;
    }

    const panInteraction = panInteractionRef.current;
    if (!panInteraction || panInteraction.pointerId !== event.pointerId) {
      onEditorPointerMove?.(pointer, event.pointerId);
    }

    if (
      !onViewportChange ||
      !panInteraction ||
      panInteraction.pointerId !== event.pointerId
    ) {
      return;
    }

    const nextPoint = getEventPoint(event);
    const delta = {
      x: nextPoint.x - panInteraction.lastPoint.x,
      y: nextPoint.y - panInteraction.lastPoint.y
    };

    if (Math.abs(delta.x) + Math.abs(delta.y) > 0) {
      suppressNextBackgroundClickRef.current = true;
      const nextViewport = panViewportState(
        currentViewportRef.current ?? viewport,
        delta
      );
      currentViewportRef.current = nextViewport;
      onViewportChange(nextViewport);
      panInteraction.lastPoint = nextPoint;
    }
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const furnitureGesture = furniturePointerRef.current;
    if (furnitureGesture?.pointerId === event.pointerId) {
      onFurniturePointerUp?.(furnitureGesture.dragged);
      furniturePointerRef.current = undefined;
      furnitureClickHandledRef.current = true;
      suppressNextBackgroundClickRef.current = true;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (stairAdjustmentPointerIdRef.current === event.pointerId) {
      onStairAdjustmentPointerUp?.(getEventPointer(event).worldPoint, event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      stairAdjustmentPointerIdRef.current = undefined;
      return;
    }
    if (stairTranslationPointerIdRef.current === event.pointerId) {
      onStairTranslationPointerUp?.(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      stairTranslationPointerIdRef.current = undefined;
      suppressNextBackgroundClickRef.current = true;
      return;
    }
    const openingInteraction = openingPointerInteractionRef.current;
    if (openingInteraction?.pointerId === event.pointerId) {
      openingInteraction.completed = true;
      onOpeningPointerUp?.(event.pointerId, openingInteraction.dragStarted);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (endpointPointerIdRef.current === event.pointerId) {
      onWallEndpointPointerUp?.(
        getEventPointer(event).worldPoint,
        event.pointerId
      );
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      endpointPointerIdRef.current = undefined;
      return;
    }

    if (panInteractionRef.current?.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      panInteractionRef.current = undefined;
      setIsPanning(false);
    }
  };

  const handlePointerCancel = (event: PointerEvent<SVGSVGElement>) => {
    if (furniturePointerRef.current?.pointerId === event.pointerId) {
      onFurniturePointerCancel?.();
      furniturePointerRef.current = undefined;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (stairAdjustmentPointerIdRef.current === event.pointerId) {
      onStairAdjustmentPointerCancel?.(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      stairAdjustmentPointerIdRef.current = undefined;
    }
    if (stairTranslationPointerIdRef.current === event.pointerId) {
      onStairTranslationPointerCancel?.(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      stairTranslationPointerIdRef.current = undefined;
    }
    if (openingPointerInteractionRef.current?.pointerId === event.pointerId) {
      onOpeningPointerCancel?.(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      openingPointerInteractionRef.current = undefined;
    }
    if (endpointPointerIdRef.current === event.pointerId) {
      onWallEndpointPointerCancel?.(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      endpointPointerIdRef.current = undefined;
    }
    if (panInteractionRef.current?.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      panInteractionRef.current = undefined;
      setIsPanning(false);
    }
  };

  const handleLostPointerCapture = (event: PointerEvent<SVGSVGElement>) => {
    if (panInteractionRef.current?.pointerId !== event.pointerId) return;
    panInteractionRef.current = undefined;
    setIsPanning(false);
  };

  const handleSvgClick = (event: MouseEvent<SVGSVGElement>) => {
    if (suppressNextBackgroundClickRef.current) {
      suppressNextBackgroundClickRef.current = false;
      event.stopPropagation();
      return;
    }
    if (
      interaction.drawWallEnabled ||
      interaction.openingPlacement ||
      interaction.measurementEnabled ||
      interaction.roomShapePlacementEnabled ||
      interaction.stairPlacementEnabled || interaction.furniturePlacementEnabled
    ) {
      onEditorCanvasClick?.(getEventPointer(event));
    }
  };

  const handleOpeningPointerDown = (
    event: PointerEvent<SVGGElement>,
    selection: GeometrySelection,
    wallId: string
  ) => {
    if (!interaction.openingEditingEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const pointer = getEventPointer({
      clientX: event.clientX,
      clientY: event.clientY,
      currentTarget: svg
    });
    openingPointerInteractionRef.current = {
      pointerId: event.pointerId,
      openingId: selection.geometryId,
      wallId,
      startPoint: pointer.svgPoint,
      cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit,
      dragStarted: false,
      completed: false
    };
    svg.setPointerCapture(event.pointerId);
    onSelectionStateChange?.(createGeometrySelectionState([selection], resolvedSelectionState.hovered));
    onOpeningPointerDown?.(selection.geometryId, wallId, event.pointerId);
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

  const handleJunctionPointerDown = (event: PointerEvent<SVGCircleElement>) => {
    if (!interaction.wallEndpointEditingEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    endpointPointerIdRef.current = event.pointerId;
    svg.setPointerCapture(event.pointerId);
    onJunctionPointerDown?.(event.pointerId);
  };

  const handleStairTranslationPointerDown = (
    event: PointerEvent<SVGElement>,
    staircaseId: string
  ) => {
    if (!interaction.selectionEnabled ||
        !resolvedSelectionState.selected.some((selection) => selection.kind === "STAIRCASE" && selection.geometryId === staircaseId)) return;
    event.preventDefault();
    event.stopPropagation();
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const pointer = getEventPointer({ clientX: event.clientX, clientY: event.clientY, currentTarget: svg });
    stairTranslationPointerIdRef.current = event.pointerId;
    svg.setPointerCapture(event.pointerId);
    onStairTranslationPointerDown?.(staircaseId, pointer.worldPoint, event.pointerId);
  };

  const handleBackgroundClick = (event: MouseEvent<SVGRectElement>) => {
    if (
      suppressNextBackgroundClickRef.current ||
      (openingPointerInteractionRef.current?.completed === true &&
        openingPointerInteractionRef.current.dragStarted)
    ) {
      suppressNextBackgroundClickRef.current = false;
      openingPointerInteractionRef.current = undefined;
      event.stopPropagation();
      return;
    }

    if (!interaction.selectionEnabled) {
      return;
    }

    event.stopPropagation();
    onSelectionStateChange?.(clearGeometrySelection(resolvedSelectionState));
  };

  const handleEntityClick = (
    event: MouseEvent<SVGElement>,
    nextSelection: GeometrySelection
  ) => {
    if (suppressNextBackgroundClickRef.current) {
      suppressNextBackgroundClickRef.current = false;
      event.stopPropagation();
      return;
    }
    if (editorOverlay?.wallVertexPreview && nextSelection.kind === "WALL") {
      const svg = event.currentTarget.ownerSVGElement;
      event.stopPropagation();
      if (svg) {
        onEditorCanvasClick?.(getEventPointer({
          clientX: event.clientX,
          clientY: event.clientY,
          currentTarget: svg
        }));
      }
      return;
    }
    if (!interaction.selectionEnabled) {
      return;
    }
    if (
      openingPointerInteractionRef.current?.completed === true &&
      openingPointerInteractionRef.current.dragStarted
    ) {
      openingPointerInteractionRef.current = undefined;
      event.stopPropagation();
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

  const handleOpeningClick = (
    event: MouseEvent<SVGGElement>,
    selection: GeometrySelection
  ) => {
    if (suppressNextBackgroundClickRef.current) {
      suppressNextBackgroundClickRef.current = false;
      event.stopPropagation();
      return;
    }
    if (!interaction.selectionEnabled) return;
    event.stopPropagation();
    const pointerInteraction = openingPointerInteractionRef.current;
    const completedMatchingInteraction = pointerInteraction?.completed === true &&
      pointerInteraction.openingId === selection.geometryId;
    openingPointerInteractionRef.current = undefined;
    if (completedMatchingInteraction && pointerInteraction.dragStarted) return;
    onSelectionStateChange?.(
      createGeometrySelectionState([selection], resolvedSelectionState.hovered)
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
      ref={svgRef}
      className={`geometry-svg geometry-svg--${
        interaction.drawWallEnabled || interaction.furniturePlacementEnabled
          ? "draw-wall"
          : interaction.measurementEnabled
            ? "measure"
          : interaction.selectionEnabled
            ? "select"
            : interaction.panAnywhere
              ? "pan"
              : "neutral"
      }${editorOverlay ? " geometry-svg--authoring" : " geometry-svg--presentation"}${editorOverlay?.activeOpeningDragId ? " geometry-svg--opening-drag" : ""}${isPanning ? " geometry-svg--panning" : ""}`}
      viewBox={`0 0 ${geometrySvgViewport.width} ${geometrySvgViewport.height}`}
      role="img"
      aria-labelledby="geometry-svg-title geometry-svg-description"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
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

      {editorOverlay?.grid?.visible && editorOverlay.grid.spacing > 0 ? (
        <GeometryGridLayer spacing={editorOverlay.grid.spacing} transform={transform} />
      ) : null}

      {options.bounds ? (
        <g
          data-layer="polygon-bounds"
          data-diagnostic="true"
          className="geometry-diagnostic-layer"
          aria-hidden="true"
        >
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

      {options.polygons ? (
        <g data-layer="polygons">
          {presentationModel.polygons.map((polygon) => {
            const className = `${getEntityClassName("geometry-polygon", polygon)}${
              polygon.elevated ? " geometry-polygon--elevated" : ""
            }`;

            return (
              <g key={polygon.geometryId}>
                <polygon
                  data-testid="geometry-polygon"
                  data-geometry-kind={polygon.kind}
                  data-geometry-id={polygon.geometryId}
                  data-source-room-id={polygon.sourceRoomId}
                  data-floor-elevation={polygon.floorElevation}
                  data-elevated={polygon.elevated ? "true" : "false"}
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

      {options.roomContours ? (
        <g data-layer="room-contours">
          {presentationModel.polygons.map((polygon) => (
            <polygon
              key={polygon.geometryId}
              data-testid="room-contour"
              data-source-room-id={polygon.sourceRoomId}
              className={getEntityClassName("geometry-room-contour", polygon)}
              points={polygon.svgPoints}
            />
          ))}
        </g>
      ) : null}

      {architecturalModel && options.architecturalWalls ? (
        <g data-layer="architectural-walls">
          <g aria-hidden="true" data-layer="wall-joins">
            {architecturalModel.joins.map((join, index) => (
              <circle
                key={`${join.point.x}:${join.point.y}:${index}`}
                className="architectural-wall-body"
                cx={formatSvgNumber(join.point.x)}
                cy={formatSvgNumber(join.point.y)}
                r={formatSvgNumber(join.radius)}
              />
            ))}
          </g>
          {architecturalModel.walls.map((wall) => (
            <g key={wall.geometryId}>
              {wall.bodySvgPoints.map((points, index) => (
                <polygon
                  key={index}
                  data-testid="architectural-wall-body"
                  data-source-wall-id={wall.geometryId}
                  points={points}
                  className={getEntityClassName("architectural-wall-body", wall)}
                />
              ))}
              <line
                className="architectural-wall-hit-target"
                data-geometry-kind="WALL"
                data-geometry-id={wall.geometryId}
                x1={formatSvgNumber(wall.start.x)}
                y1={formatSvgNumber(wall.start.y)}
                x2={formatSvgNumber(wall.end.x)}
                y2={formatSvgNumber(wall.end.y)}
                strokeWidth={formatSvgNumber(wall.hitWidth)}
                onClick={(event) => handleEntityClick(event, selectWall(wall.geometryId))}
                onMouseEnter={() => handleHoverChange(selectWall(wall.geometryId))}
                onMouseLeave={() => handleHoverChange(undefined)}
              />
            </g>
          ))}
        </g>
      ) : null}

      {architecturalModel ? (
        <g data-layer="architectural-stairs">
          {architecturalModel.staircases.map((staircase) => (
            <g
              key={staircase.geometryId}
              data-testid="architectural-staircase"
              data-geometry-kind="STAIRCASE"
              data-geometry-id={staircase.geometryId}
              className={getEntityClassName("architectural-staircase", staircase)}
            >
              {staircase.flights.map((flight) => (
                <g key={flight.geometryId} className={getEntityClassName("architectural-stair-flight", flight)}>
                  <polygon
                    className="architectural-stair-flight__body"
                    points={flight.bodySvgPoints}
                    onPointerDown={(event) => handleStairTranslationPointerDown(event, staircase.geometryId)}
                    onClick={(event) => handleEntityClick(event, selectStaircase(staircase.geometryId))}
                    onMouseEnter={() => handleHoverChange(selectStaircase(staircase.geometryId))}
                    onMouseLeave={() => handleHoverChange(undefined)}
                  />
                  <line
                    className="architectural-stair-flight__hit-target"
                    data-testid="architectural-stair-flight"
                    data-geometry-kind="STAIR_FLIGHT"
                    data-geometry-id={flight.geometryId}
                    {...lineAttributes(flight.start, flight.end)}
                    onPointerDown={(event) => handleStairTranslationPointerDown(event, staircase.geometryId)}
                    onClick={(event) => handleEntityClick(event, selectStairFlight(flight.geometryId))}
                    onMouseEnter={() => handleHoverChange(selectStairFlight(flight.geometryId))}
                    onMouseLeave={() => handleHoverChange(undefined)}
                  />
                  {flight.treadLines.map((line, index) => (
                    <line key={index} className="architectural-stair-tread" {...lineAttributes(line.start, line.end)} />
                  ))}
                  <path
                    className="architectural-stair-direction"
                    d={flight.directionArrow}
                  />
                  <line className="architectural-stair-direction" {...lineAttributes(flight.directionLine.start, flight.directionLine.end)} />
                </g>
              ))}
              {staircase.landings.map((landing) => (
                <polygon
                  key={landing.geometryId}
                  data-testid="architectural-stair-landing"
                  data-geometry-kind="STAIR_LANDING"
                  data-geometry-id={landing.geometryId}
                  className={getEntityClassName("architectural-stair-landing", landing)}
                  points={landing.bodySvgPoints}
                  onPointerDown={(event) => handleStairTranslationPointerDown(event, staircase.geometryId)}
                  onClick={(event) => handleEntityClick(event, selectStairLanding(landing.geometryId))}
                  onMouseEnter={() => handleHoverChange(selectStairLanding(landing.geometryId))}
                  onMouseLeave={() => handleHoverChange(undefined)}
                />
              ))}
            </g>
          ))}
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

      {architecturalModel && options.openings ? (
        <g data-layer="architectural-openings">
          {architecturalModel.doors.map((door) => (
            <g
              key={door.geometryId}
              data-testid="architectural-door"
              data-geometry-kind="DOOR"
              data-geometry-id={door.geometryId}
              className={`${getEntityClassName("architectural-opening architectural-door", door)}${interaction.openingEditingEnabled ? " architectural-opening--draggable" : ""}${editorOverlay?.activeOpeningDragId === door.geometryId ? " architectural-opening--dragging" : ""}`}
              data-dragging={editorOverlay?.activeOpeningDragId === door.geometryId ? "true" : undefined}
              onClick={(event) => handleOpeningClick(event, selectDoor(door.geometryId))}
              onMouseEnter={() => handleHoverChange(selectDoor(door.geometryId))}
              onMouseLeave={() => handleHoverChange(undefined)}
              onPointerDown={(event) => handleOpeningPointerDown(event, selectDoor(door.geometryId), door.wallId)}
            >
              <line className="architectural-opening-hit-target" {...lineAttributes(door.spanStart, door.spanEnd)} />
              <line className="architectural-opening-hit-target" {...lineAttributes(door.hinge, door.leafEnd)} />
              <path className="architectural-opening-hit-target" d={door.arcPath} />
              {door.jambs.map((line, index) => <line key={`jamb-${index}`} {...lineAttributes(line[0], line[1])} />)}
              <line className="architectural-door-leaf" {...lineAttributes(door.hinge, door.leafEnd)} />
              <path className="architectural-door-arc" d={door.arcPath} />
              <circle className="architectural-door-hinge" cx={formatSvgNumber(door.hinge.x)} cy={formatSvgNumber(door.hinge.y)} r="2.5" />
              {door.selected && resolvedSelectionState.selected.length === 1 ? (
                <g
                  className="architectural-opening-drag-handle"
                  data-testid="selected-opening-drag-handle"
                  aria-hidden="true"
                  transform={`translate(${formatSvgNumber((door.spanStart.x + door.spanEnd.x) / 2)} ${formatSvgNumber((door.spanStart.y + door.spanEnd.y) / 2)})`}
                >
                  <circle className="architectural-opening-drag-handle__surface" r="8" />
                  <DragIndicatorRoundedIcon className="architectural-opening-drag-handle__icon" x="-6" y="-6" width="12" height="12" />
                </g>
              ) : null}
            </g>
          ))}
          {architecturalModel.windows.map((window) => (
            <g
              key={window.geometryId}
              data-testid="architectural-window"
              data-geometry-kind="WINDOW"
              data-geometry-id={window.geometryId}
              className={`${getEntityClassName("architectural-opening architectural-window", window)}${interaction.openingEditingEnabled ? " architectural-opening--draggable" : ""}${editorOverlay?.activeOpeningDragId === window.geometryId ? " architectural-opening--dragging" : ""}`}
              data-dragging={editorOverlay?.activeOpeningDragId === window.geometryId ? "true" : undefined}
              onClick={(event) => handleOpeningClick(event, selectWindow(window.geometryId))}
              onMouseEnter={() => handleHoverChange(selectWindow(window.geometryId))}
              onMouseLeave={() => handleHoverChange(undefined)}
              onPointerDown={(event) => handleOpeningPointerDown(event, selectWindow(window.geometryId), window.wallId)}
            >
              <line className="architectural-opening-hit-target" {...lineAttributes(window.spanStart, window.spanEnd)} />
              {window.jambs.map((line, index) => <line key={`jamb-${index}`} {...lineAttributes(line[0], line[1])} />)}
              {window.glazingLines.map((line, index) => <line className="architectural-window-line" key={`glass-${index}`} {...lineAttributes(line[0], line[1])} />)}
              {window.selected && resolvedSelectionState.selected.length === 1 ? (
                <g
                  className="architectural-opening-drag-handle"
                  data-testid="selected-opening-drag-handle"
                  aria-hidden="true"
                  transform={`translate(${formatSvgNumber((window.spanStart.x + window.spanEnd.x) / 2)} ${formatSvgNumber((window.spanStart.y + window.spanEnd.y) / 2)})`}
                >
                  <circle className="architectural-opening-drag-handle__surface" r="8" />
                  <DragIndicatorRoundedIcon className="architectural-opening-drag-handle__icon" x="-6" y="-6" width="12" height="12" />
                </g>
              ) : null}
            </g>
          ))}
          {architecturalModel.openings.map((opening) => (
            <g
              key={opening.geometryId}
              data-testid="architectural-wall-opening"
              data-geometry-kind="OPENING"
              data-geometry-id={opening.geometryId}
              className={`${getEntityClassName("architectural-opening architectural-wall-opening", opening)}${interaction.openingEditingEnabled ? " architectural-opening--draggable" : ""}${editorOverlay?.activeOpeningDragId === opening.geometryId ? " architectural-opening--dragging" : ""}`}
              data-dragging={editorOverlay?.activeOpeningDragId === opening.geometryId ? "true" : undefined}
              onClick={(event) => handleOpeningClick(event, selectWallOpening(opening.geometryId))}
              onMouseEnter={() => handleHoverChange(selectWallOpening(opening.geometryId))}
              onMouseLeave={() => handleHoverChange(undefined)}
              onPointerDown={(event) => handleOpeningPointerDown(event, selectWallOpening(opening.geometryId), opening.wallId)}
            >
              <line className="architectural-opening-hit-target" {...lineAttributes(opening.spanStart, opening.spanEnd)} />
              {opening.jambs.map((line, index) => <line key={`jamb-${index}`} {...lineAttributes(line[0], line[1])} />)}
              {opening.selected && resolvedSelectionState.selected.length === 1 ? (
                <g
                  className="architectural-opening-drag-handle"
                  data-testid="selected-opening-drag-handle"
                  aria-hidden="true"
                  transform={`translate(${formatSvgNumber((opening.spanStart.x + opening.spanEnd.x) / 2)} ${formatSvgNumber((opening.spanStart.y + opening.spanEnd.y) / 2)})`}
                >
                  <circle className="architectural-opening-drag-handle__surface" r="8" />
                  <DragIndicatorRoundedIcon className="architectural-opening-drag-handle__icon" x="-6" y="-6" width="12" height="12" />
                </g>
              ) : null}
            </g>
          ))}
        </g>
      ) : null}

      {dimensionModel ? (
        <ArchitecturalDimensionLayer model={dimensionModel} includeTemporary={false} />
      ) : null}

      {furnitureModel ? <FurnitureSvgLayer
        model={furnitureModel}
        transform={transform}
        selection={resolvedSelectionState}
        visible={options.furniture !== false}
        selectionEnabled={interaction.selectionEnabled}
        onClick={(event, id) => {
          if (furnitureClickHandledRef.current) {
            furnitureClickHandledRef.current = false;
            suppressNextBackgroundClickRef.current = false;
            event.stopPropagation();
            return;
          }
          handleEntityClick(event, { kind: "FURNITURE", geometryId: id });
        }}
        onHover={(id) => handleHoverChange(id ? { kind: "FURNITURE", geometryId: id } : undefined)}
        onPointerDown={(event, id, intent) => {
          if (!furnitureModel.editing || !interaction.selectionEnabled || interaction.panAnywhere || event.button !== 0) return;
          const svg = event.currentTarget.ownerSVGElement;
          if (!svg) return;
          event.stopPropagation();
          event.preventDefault();
          suppressNextBackgroundClickRef.current = false;
          const pointer = getEventPointer({
            clientX: event.clientX, clientY: event.clientY, currentTarget: svg
          });
          furniturePointerRef.current = {
            pointerId: event.pointerId,
            start: pointer.svgPoint,
            scale: pointer.cssPixelsPerSvgUnit,
            dragged: false
          };
          furnitureClickHandledRef.current = false;
          svg.setPointerCapture(event.pointerId);
          onFurniturePointerDown?.(id, intent, pointer, event.pointerId);
        }} /> : null}
      {dimensionModel ? (
        <ArchitecturalRoomMetricLayer model={dimensionModel} />
      ) : null}
      <GeometryEditorOverlayLayer
        overlay={editorOverlay}
        transform={transform}
        endpointEditingEnabled={interaction.wallEndpointEditingEnabled}
        onEndpointPointerDown={handleEndpointPointerDown}
        onJunctionPointerDown={handleJunctionPointerDown}
        onWallVertexPreviewClick={() => {
          if (!editorOverlay?.wallVertexPreview) return;
          onEditorCanvasClick?.({
            worldPoint: editorOverlay.wallVertexPreview,
            svgPoint: transform.worldToScreen(editorOverlay.wallVertexPreview),
            cssPixelsPerSvgUnit: 1
          });
        }}
        onRoomFaceCandidateClick={(faceKey) => {
          if (suppressNextBackgroundClickRef.current) {
            suppressNextBackgroundClickRef.current = false;
            return;
          }
          onRoomFaceCandidateClick?.(faceKey);
        }}
        onStairAdjustmentPointerDown={(event, staircaseId) => {
          event.preventDefault();
          event.stopPropagation();
          stairAdjustmentPointerIdRef.current = event.pointerId;
          event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
          onStairAdjustmentPointerDown?.(staircaseId, event.pointerId);
        }}
      />
      {dimensionModel?.temporary ? (
        <ArchitecturalDimensionLayer model={dimensionModel} includeTemporary />
      ) : null}
    </svg>
  );
}

/** Renders non-interactive architectural dimension graphics in semantic SVG groups. */
function ArchitecturalDimensionLayer({
  model,
  includeTemporary
}: {
  readonly model: ArchitecturalDimensionPresentationModel2D;
  readonly includeTemporary: boolean;
}) {
  if (includeTemporary) {
    return model.temporary ? (
      <g data-layer="temporary-measurement" className="architectural-dimension-layer architectural-dimension-layer--temporary">
        <ArchitecturalLinearDimension dimension={model.temporary} testId="temporary-measurement" />
      </g>
    ) : null;
  }
  return (
    <>
      <g data-layer="automatic-dimensions" className="architectural-dimension-layer">
        {model.automatic.map((dimension, index) => (
          <ArchitecturalLinearDimension key={`automatic-${index}`} dimension={dimension} testId="automatic-dimension" />
        ))}
      </g>
      <g data-layer="selected-dimensions" className="architectural-dimension-layer architectural-dimension-layer--selected">
        {model.selected.map((dimension, index) => (
          <ArchitecturalLinearDimension key={`selected-${index}`} dimension={dimension} testId="selected-dimension" />
        ))}
      </g>
    </>
  );
}

/** Room labels are repositioned around occupancy, then painted above Furniture as fallback. */
function ArchitecturalRoomMetricLayer({
  model
}: {
  readonly model: ArchitecturalDimensionPresentationModel2D;
}) {
  return (
    <g data-layer="room-metrics" className="architectural-room-metric-layer">
      {model.roomMetrics.map((metric) => (
        <text
          key={metric.roomId}
          data-testid="room-metric"
          data-source-room-id={metric.roomId}
          x={formatSvgNumber(metric.anchor.x)}
          y={formatSvgNumber(metric.anchor.y - 3)}
          textAnchor="middle"
        >
          <tspan className="architectural-room-label__name" x={formatSvgNumber(metric.anchor.x)}>{metric.roomName}</tspan>
          {metric.elevationLabel ? (
            <tspan className="architectural-room-label__elevation" x={formatSvgNumber(metric.anchor.x)} dy="13">{metric.elevationLabel}</tspan>
          ) : null}
          <tspan className="architectural-room-label__area" x={formatSvgNumber(metric.anchor.x)} dy={metric.elevationLabel ? "12" : "14"}>{metric.formattedArea}</tspan>
        </text>
      ))}
    </g>
  );
}

/** Renders one projected linear dimension without participating in hit testing. */
function ArchitecturalLinearDimension({
  dimension,
  testId
}: {
  readonly dimension: LinearDimensionPresentation2D;
  readonly testId: string;
}) {
  return (
    <g
      data-testid={testId}
      data-physical-value={dimension.physicalValue}
      data-orientation={dimension.orientation}
    >
      {dimension.extensionLines.map((line, index) => (
        <line key={`extension-${index}`} className="architectural-dimension-extension" {...lineAttributes(line.start, line.end)} />
      ))}
      <line className="architectural-dimension-line" {...lineAttributes(dimension.dimensionLine.start, dimension.dimensionLine.end)} />
      {dimension.markers.map((line, index) => (
        <line key={`marker-${index}`} className="architectural-dimension-marker" {...lineAttributes(line.start, line.end)} />
      ))}
      <text
        className="architectural-dimension-label"
        x={formatSvgNumber(dimension.labelAnchor.x)}
        y={formatSvgNumber(dimension.labelAnchor.y - 5)}
        textAnchor="middle"
      >
        {dimension.formattedValue}
      </text>
    </g>
  );
}

function GeometryEditorOverlayLayer({
  overlay,
  transform,
  endpointEditingEnabled,
  onEndpointPointerDown,
  onJunctionPointerDown,
  onWallVertexPreviewClick,
  onRoomFaceCandidateClick,
  onStairAdjustmentPointerDown
}: {
  readonly overlay?: GeometryEditorOverlay;
  readonly transform: ReturnType<typeof createViewportTransform2D>;
  readonly endpointEditingEnabled: boolean;
  readonly onEndpointPointerDown: (
    event: PointerEvent<SVGCircleElement>,
    endpoint: WallEndpoint
  ) => void;
  readonly onJunctionPointerDown: (event: PointerEvent<SVGCircleElement>) => void;
  readonly onWallVertexPreviewClick: () => void;
  readonly onRoomFaceCandidateClick?: (faceKey: string) => void;
  readonly onStairAdjustmentPointerDown: (event: PointerEvent<SVGCircleElement>, staircaseId: string) => void;
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
  const snapPoint = overlay?.snapCandidate
    ? transform.worldToScreen(overlay.snapCandidate.point)
    : undefined;
  const junctionPoint = overlay?.selectedJunction
    ? transform.worldToScreen(overlay.selectedJunction.previewPosition)
    : undefined;
  const wallVertexPreview = overlay?.wallVertexPreview
    ? transform.worldToScreen(overlay.wallVertexPreview)
    : undefined;
  const openingPreview = overlay?.openingPreview
    ? overlay.openingPreview.opening.type === "DOOR"
      ? createDoorPlanGeometry(overlay.openingPreview.wall, overlay.openingPreview.opening)
      : overlay.openingPreview.opening.type === "WINDOW"
        ? createWindowPlanGeometry(overlay.openingPreview.wall, overlay.openingPreview.opening)
        : createWallOpeningPlanGeometry(overlay.openingPreview.wall, overlay.openingPreview.opening)
    : undefined;
  const roomShapePreview = overlay?.roomShapePreview
    ? {
        ...overlay.roomShapePreview,
        vertices: overlay.roomShapePreview.vertices.map((vertex) =>
          transform.worldToScreen(vertex)
        ),
        labelAnchor: transform.worldToScreen(overlay.roomShapePreview.labelAnchor)
      }
    : undefined;
  const stairPreview = overlay?.stairPreview;
  const stairPreviewPresentation = stairPreview
    ? createStaircasePresentation2D(stairPreview.staircase, transform)
    : undefined;

  return (
    <g data-layer="editor-overlay">
      {stairPreview ? (
        <g
          data-layer="stair-preview"
          data-testid="stair-preview"
          data-valid={stairPreview.valid ? "true" : "false"}
          data-locked={stairPreview.locked ? "true" : "false"}
          className={`geometry-stair-preview${stairPreview.valid ? "" : " geometry-stair-preview--invalid"}`}
          aria-hidden="true"
        >
          {stairPreviewPresentation?.flights.map((flight) => (
            <g key={flight.geometryId}>
              <polygon
                className="geometry-stair-preview__body"
                points={flight.bodySvgPoints}
              />
              {flight.treadLines.map((line, index) => (
                <line
                  key={index}
                  className="geometry-stair-preview__tread"
                  {...lineAttributes(line.start, line.end)}
                />
              ))}
              <line className="geometry-stair-preview__direction" {...lineAttributes(flight.directionLine.start, flight.directionLine.end)} />
              <path className="geometry-stair-preview__direction" d={flight.directionArrow} />
            </g>
          ))}
          {stairPreviewPresentation?.landings.map((landing) => (
            <polygon key={landing.geometryId} className="geometry-stair-preview__landing" points={landing.bodySvgPoints} />
          ))}
        </g>
      ) : null}
      {roomShapePreview ? (
        <g
          data-layer="room-shape-preview"
          data-testid="room-shape-preview"
          data-shape-kind={roomShapePreview.kind}
          data-segment-count={roomShapePreview.vertices.length}
          data-elevated={roomShapePreview.elevated ? "true" : "false"}
          data-elevation={roomShapePreview.elevation}
          data-valid={roomShapePreview.valid ? "true" : "false"}
          className={`${roomShapePreview.elevated ? "geometry-room-shape-preview--elevated" : ""}${roomShapePreview.valid ? "" : " geometry-room-shape-preview--invalid"}`.trim() || undefined}
          aria-hidden="true"
        >
          <polygon
            className="geometry-room-shape-preview__fill"
            points={roomShapePreview.vertices.map((point) =>
              `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`
            ).join(" ")}
          />
          <polygon
            className="geometry-room-shape-preview__walls"
            points={roomShapePreview.vertices.map((point) =>
              `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`
            ).join(" ")}
          />
          <text
            className="geometry-room-shape-preview__label"
            x={formatSvgNumber(roomShapePreview.labelAnchor.x)}
            y={formatSvgNumber(roomShapePreview.labelAnchor.y)}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {roomShapePreview.label}
          </text>
        </g>
      ) : null}
      {overlay?.selectedStair ? (() => {
        const point = transform.worldToScreen(overlay.selectedStair.adjustmentPoint);
        return (
          <g data-testid="selected-stair-overlay" data-staircase-id={overlay.selectedStair.staircaseId}>
            <circle
              className="geometry-stair-adjustment-handle__hit-target"
              cx={formatSvgNumber(point.x)}
              cy={formatSvgNumber(point.y)}
              r="13"
              onPointerDown={(event) => onStairAdjustmentPointerDown(event, overlay.selectedStair!.staircaseId)}
            />
            <circle className="geometry-stair-adjustment-handle" cx={formatSvgNumber(point.x)} cy={formatSvgNumber(point.y)} r="6" />
          </g>
        );
      })() : null}
      {overlay?.roomFaceCandidates?.length ? (
        <g data-layer="room-face-candidates">
          {overlay.roomFaceCandidates.map((face) => (
            <polygon
              key={face.faceKey}
              data-testid="room-face-candidate"
              data-face-key={face.faceKey}
              className={`geometry-room-face-candidate geometry-room-face-candidate--focusable${
                face.selected ? " geometry-room-face-candidate--selected" : ""
              }`}
              points={face.vertices.map((vertex) => {
                const point = transform.worldToScreen(vertex);
                return `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`;
              }).join(" ")}
              role="button"
              aria-label={t("selection.selectRoomRegion")}
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onRoomFaceCandidateClick?.(face.faceKey);
              }}
              onKeyDown={(event: KeyboardEvent<SVGPolygonElement>) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                onRoomFaceCandidateClick?.(face.faceKey);
              }}
            />
          ))}
        </g>
      ) : null}
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
          {overlay?.drawWall?.lengthLabel ? (
            <g
              className="geometry-wall-preview-length"
              data-testid="draw-wall-preview-length"
              transform={`translate(${formatSvgNumber((drawStart.x + drawEnd.x) / 2)} ${formatSvgNumber((drawStart.y + drawEnd.y) / 2 - 14)})`}
            >
              <rect x="-31" y="-10" width="62" height="20" rx="4" />
              <text textAnchor="middle" dominantBaseline="middle">
                {overlay.drawWall.lengthLabel}
              </text>
            </g>
          ) : null}
        </g>
      ) : null}
      {snapPoint && overlay?.snapCandidate && overlay.snapCandidate.kind !== "free" ? (
        <g
          aria-hidden="true"
          data-testid={overlay.snapMarkerPurpose === "measurement" ? "measurement-snap-marker" : "draw-wall-snap-marker"}
        >
          <circle
            className={`geometry-wall-snap-marker geometry-wall-snap-marker--${overlay.snapCandidate.kind}`}
            cx={formatSvgNumber(snapPoint.x)}
            cy={formatSvgNumber(snapPoint.y)}
            r={overlay.snapCandidate.kind === "vertex" ? "8" : "6"}
          />
          {overlay.snapCandidate.kind === "vertex" ? (
            <circle
              className="geometry-wall-snap-marker__inner"
              cx={formatSvgNumber(snapPoint.x)}
              cy={formatSvgNumber(snapPoint.y)}
              r="3"
            />
          ) : null}
        </g>
      ) : null}
      {wallVertexPreview ? (
        <g
          data-testid="add-wall-vertex-preview"
          role="button"
          aria-label={t("wall.addVertex")}
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onWallVertexPreviewClick();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onWallVertexPreviewClick();
          }}
        >
          <circle
            className="geometry-wall-vertex-preview-hit-target"
            cx={formatSvgNumber(wallVertexPreview.x)}
            cy={formatSvgNumber(wallVertexPreview.y)}
            r="12"
          />
          <circle
            className="geometry-wall-snap-marker geometry-wall-snap-marker--wall-interior"
            cx={formatSvgNumber(wallVertexPreview.x)}
            cy={formatSvgNumber(wallVertexPreview.y)}
            r="7"
          />
          <circle
            className="geometry-wall-snap-marker__inner"
            cx={formatSvgNumber(wallVertexPreview.x)}
            cy={formatSvgNumber(wallVertexPreview.y)}
            r="2.5"
          />
        </g>
      ) : null}
      {openingPreview && overlay?.openingPreview ? (
        <g
          data-testid="opening-placement-preview"
          data-valid={overlay.openingPreview.valid ? "true" : "false"}
          data-offset-from-start={formatSvgNumber(overlay.openingPreview.opening.offsetFromStart)}
          className={`architectural-opening-preview${overlay.openingPreview.valid ? "" : " architectural-opening-preview--invalid"}`}
          aria-hidden="true"
        >
          {openingPreview.jambs.map((line, index) => (
            <line key={`jamb-${index}`} {...lineAttributes(transform.worldToScreen(line[0]), transform.worldToScreen(line[1]))} />
          ))}
          {openingPreview.kind === "DOOR" ? (
            <>
              <line {...lineAttributes(transform.worldToScreen(openingPreview.hinge), transform.worldToScreen(openingPreview.openLeafEnd))} />
              <path d={`M ${formatSvgNumber(transform.worldToScreen(openingPreview.arcStart).x)},${formatSvgNumber(transform.worldToScreen(openingPreview.arcStart).y)} A ${formatSvgNumber(transform.scaleLength(openingPreview.arcRadius))} ${formatSvgNumber(transform.scaleLength(openingPreview.arcRadius))} 0 0 ${openingPreview.arcSweep === 1 ? 0 : 1} ${formatSvgNumber(transform.worldToScreen(openingPreview.arcEnd).x)},${formatSvgNumber(transform.worldToScreen(openingPreview.arcEnd).y)}`} />
            </>
          ) : openingPreview.kind === "WINDOW" ? openingPreview.glazingLines.map((line, index) => (
            <line key={`glass-${index}`} {...lineAttributes(transform.worldToScreen(line[0]), transform.worldToScreen(line[1]))} />
          )) : null}
        </g>
      ) : null}
      {junctionPoint && overlay?.selectedJunction && endpointEditingEnabled ? (
        <g data-testid="selected-junction-overlay">
          <circle
            className="geometry-wall-endpoint-hit-target"
            role="button"
            aria-label={t("selection.moveJunction")}
            tabIndex={0}
            cx={formatSvgNumber(junctionPoint.x)}
            cy={formatSvgNumber(junctionPoint.y)}
            r="12"
            onPointerDown={onJunctionPointerDown}
          />
          <circle
            className="geometry-wall-endpoint"
            aria-hidden="true"
            cx={formatSvgNumber(junctionPoint.x)}
            cy={formatSvgNumber(junctionPoint.y)}
            r="6"
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
          {endpointEditingEnabled ? (
            <>
              {overlay.selectedWall.endpointEditingAvailable.start ? (
                <>
                  <circle
                    className="geometry-wall-endpoint-hit-target"
                    role="button"
                    aria-label={t("wall.startEndpoint")}
                    tabIndex={0}
                    cx={formatSvgNumber(selectedStart.x)}
                    cy={formatSvgNumber(selectedStart.y)}
                    r="10"
                    onPointerDown={(event) =>
                      onEndpointPointerDown(event, "start")
                    }
                  />
                  <circle
                    className="geometry-wall-endpoint"
                    aria-hidden="true"
                    cx={formatSvgNumber(selectedStart.x)}
                    cy={formatSvgNumber(selectedStart.y)}
                    r="5"
                  />
                </>
              ) : null}
              {overlay.selectedWall.endpointEditingAvailable.end ? (
                <>
                  <circle
                    className="geometry-wall-endpoint-hit-target"
                    role="button"
                    aria-label={t("wall.endEndpoint")}
                    tabIndex={0}
                    cx={formatSvgNumber(selectedEnd.x)}
                    cy={formatSvgNumber(selectedEnd.y)}
                    r="10"
                    onPointerDown={(event) =>
                      onEndpointPointerDown(event, "end")
                    }
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
            </>
          ) : null}
        </g>
      ) : null}
    </g>
  );
}

function GeometryGridLayer({
  spacing,
  transform
}: {
  readonly spacing: number;
  readonly transform: ReturnType<typeof createViewportTransform2D>;
}) {
  const screenSpacing = Math.abs(transform.scaleLength(spacing));
  if (!Number.isFinite(screenSpacing) || screenSpacing < 2) return null;
  return (
    <g data-layer="editor-grid" aria-hidden="true">
      <defs>
        <pattern
          id="project-editor-grid-pattern"
          width={formatSvgNumber(screenSpacing)}
          height={formatSvgNumber(screenSpacing)}
          patternUnits="userSpaceOnUse"
          x={formatSvgNumber(transform.offsetX % screenSpacing)}
          y={formatSvgNumber(transform.offsetY % screenSpacing)}
        >
          <path
            className="geometry-editor-grid-line"
            d={`M ${formatSvgNumber(screenSpacing)} 0 L 0 0 0 ${formatSvgNumber(screenSpacing)}`}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#project-editor-grid-pattern)" />
    </g>
  );
}

const lineAttributes = (start: ScreenPoint, end: ScreenPoint) => ({
  x1: formatSvgNumber(start.x),
  y1: formatSvgNumber(start.y),
  x2: formatSvgNumber(end.x),
  y2: formatSvgNumber(end.y)
});

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
