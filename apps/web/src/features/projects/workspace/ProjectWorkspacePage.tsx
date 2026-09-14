import { useFurnitureEditor } from "../../editor-2d/tools/furniture/useFurnitureEditor";
import {
  GeometryEngine,
  LevelGeometry,
  measureLevel,
  measureRoom,
  projectPointOntoWall
} from "@casastudio/geometry";
import {
  canCollapseWallJunction,
  createConnectedWall,
  createRoomFromShape,
  createFreeBoundaryRoomFromShape,
  deriveRoomShapeVertices,
  moveOpening,
  moveJunction,
  moveWallEndpoint,
  splitWall,
  updateStaircase,
  type WallEndpoint
} from "@casastudio/schema";
import {
  CircularProgress,
  Stack,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBlocker, useParams } from "react-router-dom";

import { useCasaStudioApi } from "../../../core/api/ApiProvider";
import type {
  GeometryLevel,
  GeometrySnapshot
} from "../../../core/api/api-types";
import { createArchitecturalPresentationModel2D } from "../../geometry-2d/presentation/architectural-presentation-model-2d";
import { createArchitecturalDimensionPresentationModel2D } from "../../geometry-2d/presentation/architectural-dimension-presentation-model-2d";
import { createProjectSelectionFootprints } from "../../geometry-2d/selection/project-selection-footprints";
import { createStairFootprints2D } from "../../geometry-2d/presentation/plan-footprints-2d";
import { createRuntimeGeometryPresentationModel2D } from "../../geometry-2d/presentation/geometry-presentation-model-2d";
import { createGeometrySnapshotPresentationModel2D } from "../../geometry-2d/adapters/geometry-snapshot-presentation-adapter";
import {
  createGeometrySelectionState,
  selectDoor,
  selectPolygon,
  selectWallOpening,
  selectWindow,
  type GeometrySelection,
  type GeometrySelectionState
} from "../../geometry-2d/selection/geometry-selection-state";
import {
  geometrySvgViewport,
  projectGeometryDisplayOptions,
  type GeometryDisplayOptions,
  type SvgViewportPointer
} from "../../geometry-2d/viewer/GeometrySvgViewer";
import {
  createViewportTransform2D,
  resetViewportState,
  type ViewportState,
  type WorldPointXZ,
  zoomViewportState
} from "../../geometry-2d/viewport/viewport-transform-2d";
import { useCasaTranslation } from "../../../core/i18n";
import { Project3DInspector } from "../../project-3d/Project3DInspector";
import {
  isArchitecturalSelectionVisible3D,
  resolveArchitecturalSelection3D,
  type ArchitecturalEntityIdentity3D
} from "../../project-3d/interaction/architectural-selection-3d";
import {
  createArchitecturalScene3DModel,
  type LevelVisibility3D
} from "../../project-3d/model/architectural-scene-3d-model";
import { useProjectGeometryQuery } from "../data/geometry-queries";
import { useReplaceProjectMutation } from "../data/project-mutations";
import { useProjectQuery } from "../data/project-queries";
import { useAppDispatch, useAppSelector } from "../../../app/store/hooks";
import {
  cleanEditingSessionLeft,
  createOpeningAuthoringInteraction,
  editingDraftReplaced,
  editingSessionEntered,
  editorActiveToolChanged,
  editorToolToggled,
  editorDrawWallPointerMoved,
  editorDrawWallStarted,
  editorDocumentScaleChanged,
  editorDimensionDisplayChanged,
  editorEndpointDragStarted,
  editorJunctionDragStarted,
  editorMeasurementPointSet,
  editorMeasurementPointerMoved,
  editorRoomShapePlacementPointerMoved,
  editorStairAuthoringChanged,
  editorStairPlacementPointerMoved,
  editorStairAdjustmentPointerMoved,
  editorStairTranslationPointerMoved,
  editorOpeningDragThresholdCrossed,
  editorOpeningDragPreviewChanged,
  editorOpeningDragStarted,
  editorOpeningPlacementChanged,
  editorWallVertexPlacementChanged,
  editorSelectionChanged,
  editorSelectionCleared,
  editorSelectionTranslationPointerMoved,
  editorTransientInteractionCleared,
  editorTransientPointerMoved,
  projectRouteChanged,
  projectRouteExited,
  selectEditorGeometrySelection,
  selectProjectEditor,
  selectShouldProtectProjectNavigation,
  type ProjectWorkspaceMode
} from "../../editor-2d/state/project-editor-slice";
import { getProjectEditorInteraction } from "../../editor-2d/state/project-editor-tools";
import {
  getProjectSelectionCapabilities,
  resolveProjectSelectionRoots,
  translateProjectSelection
} from "../../editor-2d/selection/project-selection-transforms";
import {
  resolveAggregatePrecisionTranslation,
  resolveFurniturePrecisionTranslation
} from "../../editor-2d/precision/project-precision-assistance";
import {
  createDraftWall,
  createRoomIdentifier,
  createWallIdentifier,
  doesWallCloseCycle,
  findProjectWall,
  getWallEndpointEditingAvailability,
  getIncidentWallIds,
  getWallEditingErrorKey,
  newWallDefaults
} from "../../editor-2d/tools/wall/project-wall-editing";
import {
  resolveDrawWallSnapCandidate,
  resolveGridSnapCandidate,
  resolveProjectPointSnapCandidate
} from "../../editor-2d/tools/wall/project-wall-snapping";
import {
  commitOpeningPlacementCandidate,
  createOpeningIdentifier,
  findProjectOpening,
  resolveOpeningPlacementCandidate
} from "../../editor-2d/tools/opening/project-opening-editing";
import {
  geometrySelectionChanged,
  geometrySelectionReset,
  selectGeometrySelection
} from "../../editor-2d/state/viewer-slice";
import type { ProjectPersistenceDialog } from "./components/ProjectPersistenceDialogs";
import { normalizeEditorMeasurement } from "../../editor-2d/tools/measure/editor-measurement";
import {
  defaultRoomShapeDimensions,
  getRoomEditingErrorKey
} from "../../editor-2d/tools/room/room-shape-authoring";
import { translateStaircase } from "../../editor-2d/tools/stair/project-stair-authoring";
import { useEditorKeyboardShortcuts } from "../../editor-2d/hooks/useEditorKeyboardShortcuts";
import {
  useEditorSelectionActions,
  type EditingErrorKey
} from "../../editor-2d/hooks/useEditorSelectionActions";
import { useEditorSelectionTransformActions } from "../../editor-2d/hooks/useEditorSelectionTransformActions";
import { useRoomAuthoring } from "../../editor-2d/hooks/useRoomAuthoring";
import { useStairAuthoring } from "../../editor-2d/hooks/useStairAuthoring";
import { useSelectedStairActions } from "../../editor-2d/hooks/useSelectedStairActions";
import type { ProjectWorkspaceRepresentation } from "./components/WorkspaceRepresentationControl";
import { ProjectWorkspaceInspector } from "./inspector/ProjectWorkspaceInspector";
import {
  ProjectAuthoritativeRefreshError,
  ProjectConsistencyError,
  getConsistencyFailure
} from "./persistence/project-consistency";
import {
  ProjectWorkspaceError,
  type SaveFeedback
} from "./persistence/project-errors";
import { useProjectPersistence } from "./persistence/useProjectPersistence";
import { createInitialViewportState } from "./project-workspace-viewport";
import { createProjectWorkspaceOverlay } from "./project-workspace-overlay";
import { ProjectWorkspaceCanvas } from "./components/ProjectWorkspaceCanvas";
import { ProjectWorkspaceFeedback } from "./components/ProjectWorkspaceFeedback";
import { useProjectWorkspaceShell } from "./useProjectWorkspaceShell";
import { useViewportPanModifier } from "./useViewportPanModifier";

const emptySelectionState = createGeometrySelectionState();

/** Matches selectable plan content to the currently visible product Layers. */
function isSelectionLayerVisible(
  selection: GeometrySelection,
  options: GeometryDisplayOptions
): boolean {
  switch (selection.kind) {
    case "FURNITURE":
      return options.furniture !== false;
    case "POLYGON":
      return options.polygons;
    case "WALL":
    case "BOUNDARY_EDGE":
    case "VERTEX":
      return options.architecturalWalls;
    case "DOOR":
    case "WINDOW":
    case "OPENING":
      return options.openings;
    default:
      return true;
  }
}
/** Renders the authoritative View and local-draft Edit workspace for one Project. */
export function ProjectWorkspacePage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { t } = useCasaTranslation("project-viewer");
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "lg"));
  const dispatch = useAppDispatch();
  const api = useCasaStudioApi();
  const queryClient = useQueryClient();
  const editor = useAppSelector(selectProjectEditor);
  const viewSelection = useAppSelector(selectGeometrySelection);
  const editSelection = useAppSelector(selectEditorGeometrySelection);
  const shouldProtectNavigation = useAppSelector((state) =>
    selectShouldProtectProjectNavigation(state, projectId)
  );
  const blocker = useBlocker(shouldProtectNavigation);
  const projectQuery = useProjectQuery(projectId);
  const geometryQuery = useProjectGeometryQuery(projectId);
  const replaceProjectMutation = useReplaceProjectMutation();
  const [displayOptions, setDisplayOptions] = useState(
    projectGeometryDisplayOptions
  );
  const [workspaceRepresentation, setWorkspaceRepresentation] =
    useState<ProjectWorkspaceRepresentation>("2d");
  const [levelVisibility3D, setLevelVisibility3D] =
    useState<LevelVisibility3D>("all");
  const [selection3D, setSelection3D] =
    useState<ArchitecturalEntityIdentity3D>();
  const [selectedViewLevelId, setSelectedViewLevelId] = useState("");
  const [viewport, setViewport] = useState<ViewportState>(resetViewportState);
  const [selectionOwnerSnapshot, setSelectionOwnerSnapshot] =
    useState<GeometrySnapshot>();
  const [viewportOwnerKey, setViewportOwnerKey] = useState("");
  const [persistenceDialog, setPersistenceDialog] =
    useState<ProjectPersistenceDialog>("none");
  const [refreshingAuthoritativeState, setRefreshingAuthoritativeState] =
    useState(false);
  const [refreshFailure, setRefreshFailure] = useState<
    "save" | "reload-latest"
  >();
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [editingError, setEditingError] = useState<EditingErrorKey>();

  const projectResponse = projectQuery.data;
  const geometryResponse = geometryQuery.data;
  const consistencyFailure = getConsistencyFailure(
    projectResponse,
    geometryResponse
  );
  const geometryIdentity =
    projectResponse && geometryResponse && !consistencyFailure
      ? `${projectResponse.project.id}:${geometryResponse.sourceRevision}:${geometryResponse.geometry.id}`
      : undefined;
  const ownsEditingSession =
    editor.mode === "edit" && editor.projectId === projectId;
  const workspaceMode: ProjectWorkspaceMode =
    ownsEditingSession && !isPhone ? "edit" : "view";
  const saveInteractionBlocked =
    replaceProjectMutation.isPending || refreshingAuthoritativeState;
  const [viewportPanModifierActive, setViewportPanModifierActive] =
    useViewportPanModifier(
      workspaceMode,
      shortcutsOpen,
      saveInteractionBlocked
    );
  const scene3DResult = useMemo(() => {
    if (!projectResponse || !geometryResponse || consistencyFailure)
      return undefined;
    try {
      return {
        ok: true as const,
        model: createArchitecturalScene3DModel(
          projectResponse.project,
          geometryResponse.geometry
        )
      };
    } catch (error) {
      return { ok: false as const, error };
    }
  }, [consistencyFailure, geometryResponse, projectResponse]);

  const viewLevels = geometryResponse?.geometry.levels ?? [];
  const selectedViewLevel =
    viewLevels.find((level) => level.sourceLevelId === selectedViewLevelId) ??
    viewLevels[0];
  const activeLevelId3D = selectedViewLevel?.sourceLevelId;
  const resolvedSelection3D = useMemo(
    () =>
      scene3DResult?.ok && selection3D
        ? resolveArchitecturalSelection3D(scene3DResult.model, selection3D)
        : undefined,
    [scene3DResult, selection3D]
  );

  useEffect(() => {
    if (
      selection3D &&
      !isArchitecturalSelectionVisible3D(
        resolvedSelection3D,
        levelVisibility3D,
        activeLevelId3D
      )
    )
      setSelection3D(undefined);
  }, [activeLevelId3D, levelVisibility3D, resolvedSelection3D, selection3D]);

  useEffect(() => {
    setSelection3D(undefined);
  }, [projectId]);
  const safeViewSelection =
    geometryResponse && selectionOwnerSnapshot === geometryResponse.geometry
      ? viewSelection
      : emptySelectionState;

  const editBuildResult = useMemo(() => {
    if (!ownsEditingSession || !editor.draft) {
      return undefined;
    }

    try {
      return GeometryEngine.build(editor.draft);
    } catch (error) {
      return { ok: false as const, unexpectedError: error };
    }
  }, [editor.draft, ownsEditingSession]);
  const selectedEditLevel = editBuildResult?.ok
    ? (editBuildResult.model.levels.find(
        (level) => level.sourceLevelId === editor.activeLevelId
      ) ?? editBuildResult.model.levels[0])
    : undefined;
  const selectedLevel =
    workspaceMode === "edit" ? selectedEditLevel : selectedViewLevel;
  const selectionState =
    workspaceMode === "edit" ? editSelection : safeViewSelection;
  const viewportKey = `${workspaceMode}:${selectedLevel?.id ?? "none"}:${
    workspaceMode === "edit"
      ? editor.baseRevision
      : (geometryIdentity ?? "none")
  }`;
  const activeViewport =
    viewportOwnerKey === viewportKey
      ? viewport
      : createInitialViewportState(selectedLevel);
  const activeProject =
    workspaceMode === "edit" ? editor.draft : projectResponse?.project;
  const activeProjectLevel = activeProject?.building.levels.find(
    (level) => level.id === selectedLevel?.sourceLevelId
  );
  const furniture = useFurnitureEditor({
    project: activeProject,
    levelId: activeProjectLevel?.id,
    editor,
    dispatch,
    selection: selectionState,
    editable:
      workspaceMode === "edit" &&
      !saveInteractionBlocked &&
      workspaceRepresentation === "2d",
    visible: displayOptions.furniture !== false,
    zoom: activeViewport.zoom,
    snapToGrid: editor.precision.snapToGrid,
    gridSpacing: editor.precision.gridSpacing
  });
  useEffect(() => {
    const selected = selectionState.selected.filter((entry) =>
      isSelectionLayerVisible(entry, displayOptions)
    );
    const hovered =
      selectionState.hovered &&
      isSelectionLayerVisible(selectionState.hovered, displayOptions)
        ? selectionState.hovered
        : undefined;
    if (
      selected.length !== selectionState.selected.length ||
      hovered !== selectionState.hovered
    ) {
      dispatch(
        workspaceMode === "edit"
          ? editorSelectionChanged({ selected, hovered })
          : geometrySelectionChanged({ selected, hovered })
      );
    }
  }, [displayOptions, selectionState, dispatch, workspaceMode]);
  const resolvedDisplayOptions: GeometryDisplayOptions =
    workspaceMode === "edit"
      ? {
          ...displayOptions,
          ...editor.presentation.dimensions,
          boundaryEdges:
            displayOptions.boundaryEdges && displayOptions.architecturalWalls,
          vertices:
            displayOptions.vertices && displayOptions.architecturalWalls,
          centroids: displayOptions.centroids && displayOptions.polygons
        }
      : {
          ...displayOptions,
          boundaryEdges: false,
          vertices: false,
          centroids: false,
          roomContours: false,
          entityLabels: false
        };

  const presentationResult = useMemo(() => {
    if (!selectedLevel || (workspaceMode === "view" && consistencyFailure)) {
      return undefined;
    }

    try {
      const transform = createViewportTransform2D(activeViewport);
      const model =
        workspaceMode === "edit"
          ? createRuntimeGeometryPresentationModel2D({
              level: selectedLevel as LevelGeometry,
              transform,
              selectionState
            })
          : createGeometrySnapshotPresentationModel2D({
              level: selectedLevel as GeometryLevel,
              transform,
              selectionState
            });

      const architecturalModel = activeProjectLevel
        ? createArchitecturalPresentationModel2D(
            activeProjectLevel,
            transform,
            selectionState
          )
        : undefined;
      return { ok: true as const, model, architecturalModel };
    } catch (error) {
      return { ok: false as const, error };
    }
  }, [
    activeViewport,
    consistencyFailure,
    selectedLevel,
    selectionState,
    workspaceMode,
    activeProjectLevel
  ]);

  const selectionFootprints = useMemo(() => {
    if (!presentationResult?.ok || !activeProjectLevel || !activeProject)
      return [];
    const visibleFurnitureIds = new Set(furniture.model.map((item) => item.id));
    return createProjectSelectionFootprints(
      activeProjectLevel,
      presentationResult.model,
      activeProject.building.furniture.filter((item) =>
        visibleFurnitureIds.has(item.id)
      )
    ).filter((footprint) =>
      isSelectionLayerVisible(footprint.selection, displayOptions)
    );
  }, [
    activeProject,
    activeProjectLevel,
    furniture.model,
    presentationResult,
    displayOptions
  ]);
  const selectionRoots = useMemo(
    () =>
      activeProject && activeProjectLevel && presentationResult?.ok
        ? resolveProjectSelectionRoots(
            activeProject,
            activeProjectLevel,
            presentationResult.model,
            selectionState.selected
          )
        : [],
    [
      activeProject,
      activeProjectLevel,
      presentationResult,
      selectionState.selected
    ]
  );
  const selectionCapabilities = useMemo(
    () =>
      activeProjectLevel
        ? getProjectSelectionCapabilities(activeProjectLevel, selectionRoots)
        : getProjectSelectionCapabilities(
            { walls: [], rooms: [], staircases: [] } as never,
            []
          ),
    [activeProjectLevel, selectionRoots]
  );

  const selectedEditWall = useMemo(() => {
    if (
      !presentationResult?.ok ||
      selectionState.selected.length !== 1 ||
      (selectionState.selected[0]?.kind !== "BOUNDARY_EDGE" &&
        selectionState.selected[0]?.kind !== "WALL")
    ) {
      return undefined;
    }

    const selected = selectionState.selected[0];
    const selectedEdge =
      selected?.kind === "BOUNDARY_EDGE"
        ? presentationResult.model.boundaryEdges.find(
            (edge) => edge.geometryId === selected.geometryId
          )
        : undefined;
    return findProjectWall(
      activeProject ?? null,
      activeProjectLevel?.id ?? null,
      selected?.kind === "WALL"
        ? selected.geometryId
        : selectedEdge?.sourceWallId
    );
  }, [
    activeProject,
    activeProjectLevel?.id,
    presentationResult,
    selectionState.selected
  ]);
  const selectedWallEndpointAvailability = getWallEndpointEditingAvailability(
    editor.draft,
    editor.activeLevelId,
    selectedEditWall?.id
  );
  const selectedEditOpening = useMemo(() => {
    const selected =
      selectionState.selected.length === 1
        ? selectionState.selected[0]
        : undefined;
    return selected &&
      (selected.kind === "DOOR" ||
        selected.kind === "WINDOW" ||
        selected.kind === "OPENING")
      ? findProjectOpening(
          activeProject ?? null,
          activeProjectLevel?.id ?? null,
          selected.geometryId
        )
      : undefined;
  }, [activeProject, activeProjectLevel?.id, selectionState.selected]);
  const selectedRoom = useMemo(() => {
    const selected =
      selectionState.selected.length === 1
        ? selectionState.selected[0]
        : undefined;
    if (
      selected?.kind !== "POLYGON" ||
      !presentationResult?.ok ||
      !activeProjectLevel
    ) {
      return undefined;
    }
    const polygon = presentationResult.model.polygons.find(
      (candidate) => candidate.geometryId === selected.geometryId
    );
    return activeProjectLevel.rooms.find(
      (room) => room.id === polygon?.sourceRoomId
    );
  }, [activeProjectLevel, presentationResult, selectionState.selected]);
  const {
    selectedStair,
    stairAdjustmentProposal,
    translatedStaircase,
    handleStairAdjustmentPointerDown,
    handleStairTranslationPointerDown,
    handleStairTranslationPointerUp,
    handleStairTranslationPointerCancel,
    handleStairAdjustmentPointerUp,
    handleStairAdjustmentPointerCancel,
    handleDeleteSelectedStair,
    handleUpdateSelectedStair
  } = useSelectedStairActions({
    activeProject,
    activeProjectLevel,
    selectionState,
    editor,
    dispatch,
    saveInteractionBlocked,
    setEditingError
  });
  const selectedRoomMeasurement = useMemo(
    () =>
      activeProjectLevel && selectedRoom
        ? measureRoom(activeProjectLevel, selectedRoom)
        : undefined,
    [activeProjectLevel, selectedRoom]
  );
  const activeLevelMeasurement = useMemo(
    () => (activeProjectLevel ? measureLevel(activeProjectLevel) : undefined),
    [activeProjectLevel]
  );
  const dimensionModel = useMemo(() => {
    if (!activeProjectLevel || !activeProject || !presentationResult?.ok)
      return undefined;
    const measurement =
      editor.transient.interaction?.kind === "measure"
        ? {
            start: editor.transient.interaction.startPoint,
            end: editor.transient.interaction.currentPointerPoint
          }
        : undefined;
    return createArchitecturalDimensionPresentationModel2D({
      level: activeProjectLevel,
      units: activeProject.units,
      transform: createViewportTransform2D(activeViewport),
      geometryModel: presentationResult.model,
      scaleDenominator:
        workspaceMode === "edit" ? editor.presentation.scaleDenominator : 75,
      display: {
        overallDimensions: resolvedDisplayOptions.overallDimensions,
        selectedDimensions: resolvedDisplayOptions.selectedDimensions,
        roomMetrics: resolvedDisplayOptions.roomMetrics
      },
      selectedWall: selectedEditWall,
      selectedRoom,
      furnitureFootprints: furniture.model.map((item) => item.footprint),
      temporaryMeasurement: measurement
    });
  }, [
    activeProject,
    activeProjectLevel,
    activeViewport,
    editor.presentation.scaleDenominator,
    editor.transient.interaction,
    furniture.model,
    presentationResult,
    resolvedDisplayOptions.overallDimensions,
    resolvedDisplayOptions.roomMetrics,
    resolvedDisplayOptions.selectedDimensions,
    selectedEditWall,
    selectedRoom,
    workspaceMode
  ]);
  const selectedEditVertex = useMemo(() => {
    if (
      workspaceMode !== "edit" ||
      !presentationResult?.ok ||
      selectionState.selected.length !== 1 ||
      selectionState.selected[0]?.kind !== "VERTEX"
    )
      return undefined;
    return presentationResult.model.vertices.find(
      (vertex) => vertex.geometryId === selectionState.selected[0]?.geometryId
    );
  }, [presentationResult, selectionState.selected, workspaceMode]);
  const selectedJunctionWallIds = useMemo(
    () =>
      editor.draft && editor.activeLevelId && selectedEditVertex
        ? getIncidentWallIds(
            editor.draft,
            editor.activeLevelId,
            selectedEditVertex.coordinates
          )
        : [],
    [editor.activeLevelId, editor.draft, selectedEditVertex]
  );
  const selectedVertexRemovable = useMemo(
    () =>
      Boolean(
        editor.draft &&
        editor.activeLevelId &&
        selectedEditVertex &&
        canCollapseWallJunction(editor.draft, {
          levelId: editor.activeLevelId,
          junction: selectedEditVertex.coordinates
        })
      ),
    [editor.activeLevelId, editor.draft, selectedEditVertex]
  );

  const {
    roomDetectionActive,
    setRoomDetectionActive,
    roomPreset,
    setRoomPreset,
    roomShapeDimensions,
    setRoomShapeDimensions,
    roomElevationDraft,
    setRoomElevationDraft,
    roomShapePlacement,
    activeRoomShapeKind,
    activeRoomBoundaryKind,
    validRoomElevation,
    validatedRoomShape,
    roomPlacementValidation,
    actionableRoomFaces,
    handleSelectRoomShape,
    handleRoomMethodChange,
    handleRoomPresetChange,
    handleRoomElevationChange,
    handleRoomShapeDimensionChange,
    handleCancelRoomAuthoring
  } = useRoomAuthoring({ dispatch, editor, workspaceMode });

  useEffect(() => {
    if (
      workspaceMode === "edit" &&
      editor.activeTool === "openings" &&
      !editor.transient.interaction
    ) {
      dispatch(
        editorOpeningPlacementChanged(createOpeningAuthoringInteraction("DOOR"))
      );
    }
  }, [
    dispatch,
    workspaceMode,
    editor.activeTool,
    editor.transient.interaction
  ]);

  const {
    stairPlacement,
    stairProposal,
    handleStairDestinationChange,
    handleStairTemplateChange,
    handleStairParametersChange,
    handleCancelStairAuthoring,
    handleConfirmStairAuthoring
  } = useStairAuthoring({
    activeProject,
    activeProjectLevel,
    editor,
    dispatch,
    setEditingError
  });

  const editorOverlay = useMemo(
    () =>
      createProjectWorkspaceOverlay({
        workspaceMode,
        editor,
        selectedEditWall,
        selectedEditOpening,
        selectedEditVertex,
        selectedJunctionWallIds,
        selectedWallEndpointAvailability,
        actionableRoomFaces,
        activeProject,
        roomDetectionActive,
        stairProposal,
        stairAdjustmentProposal,
        translatedStaircase,
        selectedStair,
        selectionState,
        selectionFootprints,
        validatedRoomShape,
        roomPlacementValid: roomPlacementValidation?.ok ?? false,
        validRoomElevation
      }),
    [
      workspaceMode,
      editor,
      selectedEditWall,
      selectedEditOpening,
      selectedEditVertex,
      selectedJunctionWallIds,
      selectedWallEndpointAvailability,
      actionableRoomFaces,
      activeProject,
      roomDetectionActive,
      stairProposal,
      stairAdjustmentProposal,
      translatedStaircase,
      selectedStair,
      selectionState,
      selectionFootprints,
      validatedRoomShape,
      roomPlacementValidation,
      validRoomElevation
    ]
  );

  useEffect(() => {
    dispatch(projectRouteChanged(projectId));
    dispatch(geometrySelectionReset());
    setSelectionOwnerSnapshot(undefined);
    setViewportOwnerKey("");
    setWorkspaceRepresentation("2d");
    setLevelVisibility3D("all");
    setSelectedViewLevelId("");
    setDisplayOptions(projectGeometryDisplayOptions);
    setRoomPreset("CUSTOM");
    setRoomShapeDimensions(defaultRoomShapeDimensions);
    setRoomElevationDraft("0");
    setRoomDetectionActive(false);
    setEditingError(undefined);
    setSaveFeedback(undefined);
    setShortcutsOpen(false);

    return () => {
      dispatch(projectRouteExited(projectId));
    };
  }, [dispatch, projectId]);

  useEffect(() => {
    if (!shouldProtectNavigation) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldProtectNavigation]);

  useEffect(() => {
    if (!geometryIdentity) {
      return;
    }

    dispatch(geometrySelectionReset());
    setSelectionOwnerSnapshot(geometryResponse?.geometry);
  }, [dispatch, geometryIdentity, geometryResponse, viewLevels]);

  useEffect(() => {
    if (ownsEditingSession && editor.activeLevelId) {
      setSelectedViewLevelId(editor.activeLevelId);
    }
  }, [ownsEditingSession, editor.activeLevelId]);

  useEffect(() => {
    if (!selectedLevel || viewportOwnerKey === viewportKey) {
      return;
    }

    setViewport(createInitialViewportState(selectedLevel));
    setViewportOwnerKey(viewportKey);
    if (workspaceMode === "edit") {
      dispatch(editorSelectionCleared());
    } else {
      dispatch(geometrySelectionReset());
      setSelectionOwnerSnapshot(geometryResponse?.geometry);
    }
  }, [
    dispatch,
    geometryResponse,
    selectedLevel,
    viewportKey,
    viewportOwnerKey,
    workspaceMode
  ]);

  const handleSelectionStateChange = useCallback(
    (nextSelectionState: GeometrySelectionState) => {
      dispatch(
        workspaceMode === "edit"
          ? editorSelectionChanged(nextSelectionState)
          : geometrySelectionChanged(nextSelectionState)
      );
    },
    [dispatch, workspaceMode]
  );
  const handleFitViewport = useCallback(() => {
    setViewport(createInitialViewportState(selectedLevel));
  }, [selectedLevel]);
  const handleResetViewport = useCallback(
    () => setViewport(resetViewportState()),
    []
  );
  const handleZoomViewport = useCallback((zoomFactor: number) => {
    setViewport((currentViewport) =>
      zoomViewportState({
        viewport: currentViewport,
        zoomFactor,
        center: {
          x: geometrySvgViewport.width / 2,
          y: geometrySvgViewport.height / 2
        }
      })
    );
  }, []);

  const handleEditorCanvasClick = useCallback(
    (pointer: SvgViewportPointer) => {
      if (
        saveInteractionBlocked ||
        workspaceMode !== "edit" ||
        !editor.draft ||
        !editor.activeLevelId
      ) {
        return;
      }

      const vertexPlacement = editor.transient.interaction;
      if (vertexPlacement?.kind === "add-wall-vertex") {
        if (!vertexPlacement.splitPoint) return;
        const result = splitWall(editor.draft, {
          levelId: vertexPlacement.levelId,
          wallId: vertexPlacement.wallId,
          splitPoint: vertexPlacement.splitPoint,
          newWallId: createWallIdentifier()
        });
        dispatch(editorTransientInteractionCleared());
        if (result.ok) {
          setEditingError(undefined);
          dispatch(editorSelectionCleared());
          dispatch(editingDraftReplaced(result.project));
        } else {
          setEditingError(getWallEditingErrorKey(result));
        }
        return;
      }

      if (editor.activeTool === "stair") {
        const placement = editor.transient.interaction;
        if (
          placement?.kind !== "place-stair" ||
          !placement.toLevelId ||
          !placement.template
        )
          return;
        if (stairProposal?.valid) handleConfirmStairAuthoring();
        else setEditingError("errors.stair.invalid");
        return;
      }

      if (editor.activeTool === "room") {
        const placement = editor.transient.interaction;
        if (placement?.kind !== "place-room-shape") return;
        if (
          !validatedRoomShape ||
          (placement.boundaryKind === "FREE" &&
            validRoomElevation === undefined)
        ) {
          setEditingError("errors.room.geometry");
          return;
        }
        if (
          placement.origin &&
          roomPlacementValidation &&
          !roomPlacementValidation.ok
        ) {
          setEditingError(
            getRoomEditingErrorKey(roomPlacementValidation.errors[0]?.code)
          );
          return;
        }
        // Commit the exact origin that was previewed. Pointer movement owns
        // snapping, so validation and the semantic write cannot diverge.
        const origin = placement.origin ?? pointer.worldPoint;
        const roomId = createRoomIdentifier();
        const wallCount =
          deriveRoomShapeVertices(origin, validatedRoomShape)?.length ?? 0;
        const level = editor.draft.building.levels.find(
          (candidate) => candidate.id === editor.activeLevelId
        );
        const room = {
          id: roomId,
          name: `Room ${(level?.rooms.length ?? 0) + 1}`,
          type: placement.roomType,
          ...(placement.boundaryKind === "FREE"
            ? { elevation: placement.elevation }
            : {})
        };
        const result =
          placement.boundaryKind === "FREE"
            ? createFreeBoundaryRoomFromShape(editor.draft, {
                levelId: editor.activeLevelId,
                origin,
                shape: validatedRoomShape,
                room
              })
            : createRoomFromShape(editor.draft, {
                levelId: editor.activeLevelId,
                origin,
                shape: validatedRoomShape,
                room,
                wallIds: Array.from({ length: wallCount }, () =>
                  createWallIdentifier()
                ),
                wallHeight: newWallDefaults.height,
                wallThickness: newWallDefaults.thickness
              });
        if (!result.ok) {
          setEditingError(getRoomEditingErrorKey(result.errors[0]?.code));
          return;
        }
        setEditingError(undefined);
        setRoomDetectionActive(false);
        dispatch(editingDraftReplaced(result.project));
        dispatch(editorActiveToolChanged("select"));
        dispatch(
          editorSelectionChanged(
            createGeometrySelectionState([selectPolygon(`polygon:${roomId}`)])
          )
        );
        return;
      }

      if (editor.activeTool === "measure") {
        const snapCandidate = presentationResult?.ok
          ? resolveProjectPointSnapCandidate(
              pointer.svgPoint,
              presentationResult.model,
              {
                cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit,
                bypass: pointer.altKey,
                worldPoint: pointer.worldPoint,
                grid: {
                  enabled: editor.precision.snapToGrid,
                  spacing: editor.precision.gridSpacing,
                  worldToSvgScale: activeViewport.zoom
                }
              }
            )
          : undefined;
        dispatch(
          editorMeasurementPointSet({
            point: snapCandidate?.point ?? pointer.worldPoint,
            snapCandidate
          })
        );
        return;
      }

      if (editor.activeTool === "openings") {
        const placement = editor.transient.interaction;
        if (placement?.kind !== "place-opening") return;
        const openingType = placement.openingType;
        const candidate = placement.candidate;
        if (!candidate?.valid) {
          setEditingError("errors.opening.invalid");
          return;
        }
        const openingId = createOpeningIdentifier();
        const result = commitOpeningPlacementCandidate(
          editor.draft,
          editor.activeLevelId,
          candidate,
          openingId
        );
        if (result?.ok) {
          setEditingError(undefined);
          dispatch(editingDraftReplaced(result.project));
          dispatch(
            editorSelectionChanged(
              createGeometrySelectionState([
                openingType === "DOOR"
                  ? selectDoor(openingId)
                  : openingType === "WINDOW"
                    ? selectWindow(openingId)
                    : selectWallOpening(openingId)
              ])
            )
          );
          dispatch(
            editorOpeningPlacementChanged({
              openingType,
              properties:
                placement?.kind === "place-opening"
                  ? placement.properties
                  : undefined,
              candidate: undefined
            })
          );
        } else {
          setEditingError("errors.opening.invalid");
        }
        return;
      }
      if (editor.activeTool !== "draw-wall") return;

      const snapCandidate = presentationResult?.ok
        ? resolveDrawWallSnapCandidate(
            pointer.svgPoint,
            presentationResult.model,
            {
              cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit,
              bypass: pointer.altKey,
              worldPoint: pointer.worldPoint,
              drawStart:
                editor.transient.interaction?.kind === "draw-wall"
                  ? {
                      worldPoint: editor.transient.interaction.startPoint,
                      svgPoint: createViewportTransform2D(
                        activeViewport
                      ).worldToScreen(editor.transient.interaction.startPoint)
                    }
                  : undefined,
              grid: {
                enabled: editor.precision.snapToGrid,
                spacing: editor.precision.gridSpacing,
                worldToSvgScale: activeViewport.zoom
              }
            }
          )
        : undefined;
      const resolvedPoint = snapCandidate?.point ?? pointer.worldPoint;
      const interaction = editor.transient.interaction;
      if (interaction?.kind !== "draw-wall") {
        setEditingError(undefined);
        dispatch(
          editorDrawWallStarted({ point: resolvedPoint, snapCandidate })
        );
        return;
      }

      const wall = createDraftWall(interaction.startPoint, resolvedPoint);
      const result = createConnectedWall(editor.draft, {
        levelId: editor.activeLevelId,
        wall,
        startConnections: interaction.startConnectionWallIds.map((wallId) => ({
          wallId,
          newWallId: createWallIdentifier()
        })),
        endConnections:
          snapCandidate?.kind === "wall-interior" ||
          snapCandidate?.kind === "wall-midpoint"
            ? [
                {
                  wallId: snapCandidate.wallId,
                  newWallId: createWallIdentifier()
                }
              ]
            : snapCandidate?.kind === "wall-intersection"
              ? snapCandidate.wallIds.map((wallId) => ({
                  wallId,
                  newWallId: createWallIdentifier()
                }))
              : []
      });
      dispatch(editorTransientInteractionCleared());

      if (result.ok) {
        setEditingError(undefined);
        dispatch(editingDraftReplaced(result.project));
        if (
          !doesWallCloseCycle(result.project, editor.activeLevelId, wall.id)
        ) {
          dispatch(editorDrawWallStarted({ point: resolvedPoint }));
        }
      } else {
        setEditingError(getWallEditingErrorKey(result));
      }
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.activeTool,
      editor.draft,
      editor.precision,
      editor.transient.interaction,
      validatedRoomShape,
      validRoomElevation,
      activeViewport,
      presentationResult,
      roomPlacementValidation,
      saveInteractionBlocked,
      workspaceMode
    ]
  );

  const handleEditorPointerMove = useCallback(
    (pointer: SvgViewportPointer, pointerId: number) => {
      if (saveInteractionBlocked) {
        return;
      }
      if (
        workspaceMode === "edit" &&
        editor.transient.interaction?.kind === "translate-selection" &&
        editor.transient.interaction.pointerId === pointerId
      ) {
        const interaction = editor.transient.interaction;
        const selectedKeys = new Set(
          selectionState.selected.map(
            (selection) => `${selection.kind}:${selection.geometryId}`
          )
        );
        const selectedPoints = selectionFootprints
          .filter((footprint) =>
            selectedKeys.has(
              `${footprint.selection.kind}:${footprint.selection.geometryId}`
            )
          )
          .flatMap((footprint) =>
            footprint.polygons.flatMap((polygon) => polygon)
          );
        const rawDelta = {
          x: pointer.worldPoint.x - interaction.startPointer.x,
          z: pointer.worldPoint.z - interaction.startPointer.z
        };
        const pixelsPerWorldUnit = Math.max(
          Number.EPSILON,
          activeViewport.zoom * pointer.cssPixelsPerSvgUnit
        );
        const selectedFurniture =
          activeProject &&
          selectionRoots.length > 0 &&
          selectionRoots.every((root) => root.kind === "FURNITURE")
            ? selectionRoots.flatMap((root) => {
                const item = activeProject.building.furniture.find(
                  (candidate) => candidate.id === root.id
                );
                return item ? [item] : [];
              })
            : [];
        const isValid = (delta: WorldPointXZ) =>
          Boolean(
            editor.draft &&
            activeProjectLevel &&
            translateProjectSelection(
              editor.draft,
              activeProjectLevel,
              selectionRoots,
              delta
            ).ok
          );
        const precision =
          activeProject && activeProjectLevel && selectedFurniture.length > 0
            ? resolveFurniturePrecisionTranslation({
                project: activeProject,
                levelId: activeProjectLevel.id,
                moving: selectedFurniture,
                rawDelta,
                pixelsPerWorldUnit,
                grid: {
                  enabled: editor.precision.snapToGrid,
                  spacing: editor.precision.gridSpacing
                },
                bypass: pointer.altKey,
                previous: interaction.precision,
                isValid
              })
            : resolveAggregatePrecisionTranslation({
                points: selectedPoints,
                targetPoints: presentationResult?.ok
                  ? presentationResult.model.vertices
                      .filter(
                        (vertex) =>
                          !selectedPoints.some(
                            (point) =>
                              point.x === vertex.coordinates.x &&
                              point.z === vertex.coordinates.z
                          )
                      )
                      .map((vertex) => ({
                        id: vertex.geometryId,
                        point: vertex.coordinates
                      }))
                  : [],
                rawDelta,
                pixelsPerWorldUnit,
                grid: {
                  enabled: editor.precision.snapToGrid,
                  spacing: editor.precision.gridSpacing
                },
                bypass: pointer.altKey,
                previous: interaction.precision,
                isValid
              });
        dispatch(
          editorSelectionTranslationPointerMoved({
            pointerId,
            point: {
              x: interaction.startPointer.x + precision.delta.x,
              z: interaction.startPointer.z + precision.delta.z
            },
            precision
          })
        );
      } else if (
        workspaceMode === "edit" &&
        editor.transient.interaction?.kind === "move-stair-translation" &&
        editor.transient.interaction.pointerId === pointerId
      ) {
        const interaction = editor.transient.interaction;
        const rawDelta = {
          x: pointer.worldPoint.x - interaction.startPointer.x,
          z: pointer.worldPoint.z - interaction.startPointer.z
        };
        const stair = selectedStair?.staircase;
        const points = stair
          ? createStairFootprints2D({ staircases: [stair] }).flat()
          : [];
        const precision = resolveAggregatePrecisionTranslation({
          points,
          targetPoints: presentationResult?.ok
            ? presentationResult.model.vertices.map((vertex) => ({
                id: vertex.geometryId,
                point: vertex.coordinates
              }))
            : [],
          rawDelta,
          pixelsPerWorldUnit: Math.max(
            Number.EPSILON,
            activeViewport.zoom * pointer.cssPixelsPerSvgUnit
          ),
          grid: {
            enabled: editor.precision.snapToGrid,
            spacing: editor.precision.gridSpacing
          },
          bypass: pointer.altKey,
          previous: interaction.precision,
          isValid: (delta) =>
            Boolean(
              editor.draft &&
              stair &&
              updateStaircase(editor.draft, {
                owningLevelId: interaction.owningLevelId,
                staircaseId: interaction.staircaseId,
                staircase: translateStaircase(stair, delta)
              }).ok
            )
        });
        dispatch(
          editorStairTranslationPointerMoved({
            pointerId,
            point: {
              x: interaction.startPointer.x + precision.delta.x,
              z: interaction.startPointer.z + precision.delta.z
            },
            precision
          })
        );
      } else if (
        workspaceMode === "edit" &&
        editor.transient.interaction?.kind === "move-stair-adjustment" &&
        editor.transient.interaction.pointerId === pointerId &&
        presentationResult?.ok
      ) {
        const snapCandidate = resolveProjectPointSnapCandidate(
          pointer.svgPoint,
          presentationResult.model,
          {
            cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit,
            bypass: pointer.altKey,
            worldPoint: pointer.worldPoint,
            grid: {
              enabled: editor.precision.snapToGrid,
              spacing: editor.precision.gridSpacing,
              worldToSvgScale: activeViewport.zoom
            }
          }
        );
        dispatch(
          editorStairAdjustmentPointerMoved({
            pointerId,
            control: snapCandidate.point
          })
        );
      } else if (
        workspaceMode === "edit" &&
        editor.activeTool === "stair" &&
        editor.transient.interaction?.kind === "place-stair" &&
        presentationResult?.ok
      ) {
        const snapCandidate = resolveProjectPointSnapCandidate(
          pointer.svgPoint,
          presentationResult.model,
          {
            cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit,
            bypass: pointer.altKey,
            worldPoint: pointer.worldPoint,
            grid: {
              enabled: editor.precision.snapToGrid,
              spacing: editor.precision.gridSpacing,
              worldToSvgScale: activeViewport.zoom
            }
          }
        );
        dispatch(editorStairPlacementPointerMoved(snapCandidate.point));
      } else if (
        workspaceMode === "edit" &&
        editor.activeTool === "room" &&
        editor.transient.interaction?.kind === "place-room-shape" &&
        validatedRoomShape
      ) {
        const snapCandidate = presentationResult?.ok
          ? resolveProjectPointSnapCandidate(
              pointer.svgPoint,
              presentationResult.model,
              {
                cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit,
                bypass: pointer.altKey,
                worldPoint: pointer.worldPoint,
                grid: {
                  enabled: editor.precision.snapToGrid,
                  spacing: editor.precision.gridSpacing,
                  worldToSvgScale: activeViewport.zoom
                }
              }
            )
          : pointer.altKey
            ? undefined
            : resolveGridSnapCandidate(pointer.worldPoint, {
                enabled: editor.precision.snapToGrid,
                spacing: editor.precision.gridSpacing,
                worldToSvgScale: activeViewport.zoom,
                cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit
              });
        dispatch(
          editorRoomShapePlacementPointerMoved(
            snapCandidate?.point ?? pointer.worldPoint
          )
        );
      } else if (
        workspaceMode === "edit" &&
        editor.draft &&
        editor.transient.interaction?.kind === "add-wall-vertex"
      ) {
        const interaction = editor.transient.interaction;
        const wall = findProjectWall(
          editor.draft,
          interaction.levelId,
          interaction.wallId
        );
        if (!wall) {
          dispatch(editorWallVertexPlacementChanged(undefined));
        } else {
          const projection = projectPointOntoWall(pointer.worldPoint, wall);
          const wallLength = Math.hypot(
            wall.end.x - wall.start.x,
            wall.end.z - wall.start.z
          );
          const maximumDistance =
            18 /
            Math.max(
              Number.EPSILON,
              activeViewport.zoom * pointer.cssPixelsPerSvgUnit
            );
          dispatch(
            editorWallVertexPlacementChanged(
              Math.abs(projection.perpendicularDistance) <= maximumDistance &&
                projection.distanceAlongWall > 1e-7 &&
                projection.distanceAlongWall < wallLength - 1e-7
                ? projection.projected
                : undefined
            )
          );
        }
      } else if (
        workspaceMode === "edit" &&
        editor.draft &&
        editor.transient.interaction?.kind === "move-opening" &&
        editor.transient.interaction.pointerId === pointerId &&
        selectedEditOpening
      ) {
        const projection = projectPointOntoWall(
          pointer.worldPoint,
          selectedEditOpening.wall
        );
        const wallLength = Math.hypot(
          selectedEditOpening.wall.end.x - selectedEditOpening.wall.start.x,
          selectedEditOpening.wall.end.z - selectedEditOpening.wall.start.z
        );
        const offsetFromStart = normalizeEditorMeasurement(
          Math.max(
            0,
            Math.min(
              wallLength - selectedEditOpening.opening.width,
              projection.distanceAlongWall -
                selectedEditOpening.opening.width / 2
            )
          )
        );
        const validation = moveOpening(editor.draft, {
          levelId: editor.transient.interaction.levelId,
          wallId: editor.transient.interaction.wallId,
          openingId: editor.transient.interaction.openingId,
          offsetFromStart
        });
        dispatch(
          editorOpeningDragPreviewChanged({
            pointerId,
            offsetFromStart,
            valid: validation.ok
          })
        );
      } else if (
        workspaceMode === "edit" &&
        editor.draft &&
        editor.activeLevelId &&
        editor.activeTool === "openings"
      ) {
        const placement = editor.transient.interaction;
        if (placement?.kind !== "place-opening") return;
        const openingType = placement.openingType;
        const properties = placement.properties;
        dispatch(
          editorOpeningPlacementChanged({
            openingType,
            properties,
            candidate: resolveOpeningPlacementCandidate(
              editor.draft,
              editor.activeLevelId,
              pointer.worldPoint,
              openingType,
              18 /
                Math.max(
                  Number.EPSILON,
                  activeViewport.zoom * pointer.cssPixelsPerSvgUnit
                ),
              properties
            )
          })
        );
      } else if (
        workspaceMode === "edit" &&
        editor.activeTool === "draw-wall" &&
        presentationResult?.ok
      ) {
        const snapCandidate = resolveDrawWallSnapCandidate(
          pointer.svgPoint,
          presentationResult.model,
          {
            cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit,
            bypass: pointer.altKey,
            worldPoint: pointer.worldPoint,
            drawStart:
              editor.transient.interaction?.kind === "draw-wall"
                ? {
                    worldPoint: editor.transient.interaction.startPoint,
                    svgPoint: createViewportTransform2D(
                      activeViewport
                    ).worldToScreen(editor.transient.interaction.startPoint)
                  }
                : undefined,
            grid: {
              enabled: editor.precision.snapToGrid,
              spacing: editor.precision.gridSpacing,
              worldToSvgScale: activeViewport.zoom
            }
          }
        );
        dispatch(
          editorDrawWallPointerMoved({
            point: snapCandidate?.point ?? pointer.worldPoint,
            snapCandidate
          })
        );
      } else if (
        workspaceMode === "edit" &&
        editor.activeTool === "measure" &&
        presentationResult?.ok
      ) {
        const snapCandidate = resolveProjectPointSnapCandidate(
          pointer.svgPoint,
          presentationResult.model,
          {
            cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit,
            bypass: pointer.altKey,
            worldPoint: pointer.worldPoint,
            grid: {
              enabled: editor.precision.snapToGrid,
              spacing: editor.precision.gridSpacing,
              worldToSvgScale: activeViewport.zoom
            }
          }
        );
        dispatch(
          editorMeasurementPointerMoved({
            point: snapCandidate.point,
            snapCandidate
          })
        );
      } else if (workspaceMode === "edit" && editor.transient.interaction) {
        dispatch(
          editorTransientPointerMoved({
            point: pointer.worldPoint,
            pointerId
          })
        );
      }
    },
    [
      dispatch,
      editor.activeTool,
      editor.precision,
      editor.transient.interaction,
      editor.activeLevelId,
      editor.draft,
      activeViewport,
      activeProject,
      activeProjectLevel,
      presentationResult,
      selectionFootprints,
      selectionRoots,
      selectionState.selected,
      selectedEditOpening,
      validatedRoomShape,
      saveInteractionBlocked,
      workspaceMode
    ]
  );

  const handleWallEndpointPointerDown = useCallback(
    (endpoint: WallEndpoint, pointerId: number) => {
      if (
        saveInteractionBlocked ||
        workspaceMode !== "edit" ||
        editor.activeTool !== "select" ||
        !editor.activeLevelId ||
        !selectedEditWall ||
        !selectedWallEndpointAvailability?.[endpoint].draggable
      ) {
        return;
      }

      setEditingError(undefined);
      const point = selectedEditWall[endpoint];
      const endpointState = selectedWallEndpointAvailability[endpoint];
      if (endpointState.topology === "shared-junction" && editor.draft) {
        dispatch(
          editorJunctionDragStarted({
            levelId: editor.activeLevelId,
            position: point,
            incidentWallIds: getIncidentWallIds(
              editor.draft,
              editor.activeLevelId,
              point
            ),
            pointerId
          })
        );
      } else {
        dispatch(
          editorEndpointDragStarted({
            levelId: editor.activeLevelId,
            wallId: selectedEditWall.id,
            endpoint,
            pointerId,
            point
          })
        );
      }
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.activeTool,
      editor.draft,
      selectedEditWall,
      selectedWallEndpointAvailability,
      saveInteractionBlocked,
      workspaceMode
    ]
  );

  const handleJunctionPointerDown = useCallback(
    (pointerId: number) => {
      if (
        saveInteractionBlocked ||
        workspaceMode !== "edit" ||
        editor.activeTool !== "select" ||
        !editor.activeLevelId ||
        !selectedEditVertex ||
        selectedJunctionWallIds.length < 2
      )
        return;
      setEditingError(undefined);
      dispatch(
        editorJunctionDragStarted({
          levelId: editor.activeLevelId,
          position: selectedEditVertex.coordinates,
          incidentWallIds: selectedJunctionWallIds,
          pointerId
        })
      );
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.activeTool,
      saveInteractionBlocked,
      selectedEditVertex,
      selectedJunctionWallIds,
      workspaceMode
    ]
  );

  const handleWallEndpointPointerUp = useCallback(
    (point: WorldPointXZ, pointerId: number) => {
      const interaction = editor.transient.interaction;
      if (
        saveInteractionBlocked ||
        workspaceMode !== "edit" ||
        !editor.draft ||
        (interaction?.kind !== "move-wall-endpoint" &&
          interaction?.kind !== "move-junction") ||
        interaction.pointerId !== pointerId
      ) {
        return;
      }

      const result =
        interaction.kind === "move-junction"
          ? moveJunction(editor.draft, {
              levelId: interaction.levelId,
              position: interaction.position,
              destination: point,
              incidentWallIds: interaction.incidentWallIds
            })
          : (() => {
              const availability = getWallEndpointEditingAvailability(
                editor.draft,
                interaction.levelId,
                interaction.wallId
              );
              if (
                !availability?.[interaction.endpoint].draggable ||
                availability[interaction.endpoint].topology !== "standalone"
              )
                return undefined;
              return moveWallEndpoint(editor.draft, {
                levelId: interaction.levelId,
                wallId: interaction.wallId,
                endpoint: interaction.endpoint,
                position: point
              });
            })();
      dispatch(editorTransientInteractionCleared());

      if (!result) return;
      if (result.ok) {
        setEditingError(undefined);
        dispatch(editingDraftReplaced(result.project));
      } else {
        setEditingError(getWallEditingErrorKey(result));
      }
    },
    [
      dispatch,
      editor.draft,
      editor.transient.interaction,
      saveInteractionBlocked,
      workspaceMode
    ]
  );

  const handleWallEndpointPointerCancel = useCallback(
    (pointerId: number) => {
      const interaction = editor.transient.interaction;
      if (
        (interaction?.kind === "move-wall-endpoint" ||
          interaction?.kind === "move-junction") &&
        interaction.pointerId === pointerId
      ) {
        dispatch(editorTransientInteractionCleared());
      }
    },
    [dispatch, editor.transient.interaction]
  );

  const handleOpeningPointerDown = useCallback(
    (openingId: string, wallId: string, pointerId: number) => {
      if (
        saveInteractionBlocked ||
        workspaceMode !== "edit" ||
        editor.activeTool !== "select" ||
        !editor.activeLevelId ||
        !editor.draft
      )
        return;
      const target = findProjectOpening(
        editor.draft,
        editor.activeLevelId,
        openingId
      );
      if (!target || target.wall.id !== wallId) return;
      dispatch(
        editorOpeningDragStarted({
          levelId: editor.activeLevelId,
          wallId,
          openingId,
          pointerId,
          offsetFromStart: target.opening.offsetFromStart
        })
      );
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.activeTool,
      editor.draft,
      saveInteractionBlocked,
      workspaceMode
    ]
  );

  const handleOpeningDragThresholdCrossed = useCallback(
    (pointerId: number) =>
      dispatch(editorOpeningDragThresholdCrossed({ pointerId })),
    [dispatch]
  );

  const handleOpeningPointerUp = useCallback(
    (pointerId: number, dragged: boolean) => {
      const interaction = editor.transient.interaction;
      if (
        interaction?.kind !== "move-opening" ||
        interaction.pointerId !== pointerId ||
        !editor.draft
      )
        return;
      if (!dragged) {
        dispatch(editorTransientInteractionCleared());
        return;
      }
      const result = interaction.valid
        ? moveOpening(editor.draft, {
            levelId: interaction.levelId,
            wallId: interaction.wallId,
            openingId: interaction.openingId,
            offsetFromStart: normalizeEditorMeasurement(
              interaction.currentOffsetFromStart
            )
          })
        : undefined;
      dispatch(editorTransientInteractionCleared());
      if (result?.ok) {
        setEditingError(undefined);
        dispatch(editingDraftReplaced(result.project));
      } else {
        setEditingError("errors.opening.invalid");
      }
    },
    [dispatch, editor.draft, editor.transient.interaction]
  );

  const handleOpeningPointerCancel = useCallback(
    (pointerId: number) => {
      const interaction = editor.transient.interaction;
      if (
        interaction?.kind === "move-opening" &&
        interaction.pointerId === pointerId
      ) {
        dispatch(editorTransientInteractionCleared());
      }
    },
    [dispatch, editor.transient.interaction]
  );

  const {
    handleSelectionTranslationPointerDown,
    handleSelectionTranslationPointerUp,
    handleSelectionTranslationPointerCancel,
    handleNudgeSelection,
    handleAlignSelection,
    handleDistributeSelection,
    handleDeleteSelection
  } = useEditorSelectionTransformActions({
    dispatch,
    editor,
    activeProjectLevel,
    selectionRoots,
    selectionCapabilities,
    saveInteractionBlocked,
    workspaceMode,
    setEditingError
  });

  const {
    handleDeleteSelectedWall,
    handleAddVertexToSelectedWall,
    handleRemoveSelectedVertex,
    handleUpdateSelectedWallProperties,
    handleDeleteSelectedOpening,
    handleUpdateOpeningAuthoring,
    handleUpdateSelectedOpening,
    handleDeleteSelectedRoom,
    handleUpdateSelectedRoomProperties,
    handleCreateLevel,
    handleUpdateActiveLevel,
    handleCreateRoom
  } = useEditorSelectionActions({
    dispatch,
    editor,
    selectedEditWall,
    selectedEditVertex,
    selectedVertexRemovable,
    selectedEditOpening,
    selectedRoom,
    saveInteractionBlocked,
    workspaceMode,
    setEditingError
  });

  const handleOpeningAuthoringTypeChange = useCallback(
    (openingType: "DOOR" | "WINDOW" | "OPENING") => {
      const interaction = editor.transient.interaction;
      const properties =
        createOpeningAuthoringInteraction(openingType).properties;
      const candidate =
        interaction?.kind === "place-opening" &&
        interaction.candidate &&
        editor.draft &&
        editor.activeLevelId
          ? resolveOpeningPlacementCandidate(
              editor.draft,
              editor.activeLevelId,
              interaction.candidate.projectedPoint,
              openingType,
              1e-6,
              properties
            )
          : undefined;
      dispatch(
        editorOpeningPlacementChanged({ openingType, properties, candidate })
      );
    },
    [dispatch, editor.activeLevelId, editor.draft, editor.transient.interaction]
  );

  useEditorKeyboardShortcuts({
    selectedFurniture: furniture.selected,
    handleDeleteSelectedFurniture: furniture.remove,
    dispatch,
    selectedLevel,
    workspaceRepresentation,
    shortcutsOpen,
    saveInteractionBlocked,
    workspaceMode,
    selectedEditOpening,
    selectedRoom,
    selectedStair,
    selectedEditWall,
    transient: editor.transient,
    handleDeleteSelectedOpening,
    handleDeleteSelectedRoom,
    handleDeleteSelectedStair,
    handleDeleteSelectedWall,
    handleFitViewport,
    handleResetViewport,
    handleCancelStairAuthoring,
    handleOpeningAuthoringTypeChange,
    selectionCount: selectionState.selected.length,
    handleDeleteSelection,
    handleNudgeSelection
  });

  const handleModeChange = useCallback(
    (nextMode: ProjectWorkspaceMode | null) => {
      if (
        saveInteractionBlocked ||
        !nextMode ||
        nextMode === workspaceMode ||
        !projectResponse ||
        consistencyFailure
      ) {
        return;
      }

      if (nextMode === "edit") {
        setWorkspaceRepresentation("2d");
        setSelection3D(undefined);
        dispatch(
          editingSessionEntered({
            project: projectResponse.project,
            baseRevision: projectResponse.sourceRevision,
            preferredLevelId: selectedViewLevel?.sourceLevelId
          })
        );
        dispatch(geometrySelectionReset());
        setPersistenceDialog("none");
        return;
      }

      if (editor.dirty) {
        setPersistenceDialog("leave");
        return;
      }

      dispatch(cleanEditingSessionLeft());
      dispatch(geometrySelectionReset());
      setPersistenceDialog("none");
    },
    [
      consistencyFailure,
      dispatch,
      editor.dirty,
      projectResponse,
      saveInteractionBlocked,
      selectedViewLevel,
      workspaceMode,
      workspaceRepresentation
    ]
  );

  const handleRepresentationChange = useCallback(
    (representation: ProjectWorkspaceRepresentation | null) => {
      if (
        !representation ||
        representation === workspaceRepresentation ||
        saveInteractionBlocked ||
        (representation === "3d" && workspaceMode === "edit")
      )
        return;
      setWorkspaceRepresentation(representation);
      if (representation === "2d") setSelection3D(undefined);
    },
    [saveInteractionBlocked, workspaceMode, workspaceRepresentation]
  );

  const {
    handleSave,
    handleKeepEditing,
    handleConfirmDiscard,
    handleConfirmReloadLatest,
    handleRetryAuthoritativeRefresh
  } = useProjectPersistence({
    api,
    projectId,
    queryClient,
    dispatch,
    blocker,
    editor,
    replaceProjectMutation,
    saveInteractionBlocked,
    workspaceMode,
    refreshFailure,
    refreshingAuthoritativeState,
    setPersistenceDialog,
    setRefreshingAuthoritativeState,
    setRefreshFailure,
    setSaveFeedback
  });

  const handleDisplayOptionsChange = useCallback(
    (options: GeometryDisplayOptions) => {
      setDisplayOptions(options);
      if (workspaceMode === "edit") {
        dispatch(
          editorDimensionDisplayChanged({
            overallDimensions: options.overallDimensions,
            selectedDimensions: options.selectedDimensions,
            roomMetrics: options.roomMetrics
          })
        );
      }
    },
    [dispatch, workspaceMode]
  );

  const inspector = useMemo(() => {
    if (
      workspaceRepresentation === "3d" &&
      projectResponse &&
      scene3DResult?.ok
    ) {
      return (
        <Project3DInspector
          projectName={projectResponse.project.name}
          model={scene3DResult.model}
          visibility={levelVisibility3D}
          activeLevelId={activeLevelId3D}
          selection={resolvedSelection3D}
        />
      );
    }
    if (!presentationResult?.ok || !selectedLevel) {
      return undefined;
    }
    const transientOpeningOffset =
      editor.transient.interaction?.kind === "move-opening" &&
      editor.transient.interaction.dragging &&
      editor.transient.interaction.openingId === selectedEditOpening?.opening.id
        ? editor.transient.interaction.currentOffsetFromStart
        : undefined;

    return (
      <ProjectWorkspaceInspector
        furniture={furniture}
        model={presentationResult.model}
        selectionState={selectionState}
        options={resolvedDisplayOptions}
        onOptionsChange={handleDisplayOptionsChange}
        mode={workspaceMode}
        activeTool={editor.activeTool}
        selectedWall={selectedEditWall}
        selectedOpening={selectedEditOpening}
        selectedOpeningDisplayOffset={transientOpeningOffset}
        openingAuthoring={
          editor.transient.interaction?.kind === "place-opening"
            ? editor.transient.interaction
            : undefined
        }
        roomAuthoring={
          editor.activeTool === "room"
            ? {
                ...(activeRoomShapeKind
                  ? { activeShape: activeRoomShapeKind }
                  : {}),
                ...(activeRoomBoundaryKind
                  ? { boundaryKind: activeRoomBoundaryKind }
                  : {}),
                detectionActive: roomDetectionActive,
                preset: roomPreset,
                roomType: roomShapePlacement?.roomType ?? "OTHER",
                elevation: roomElevationDraft,
                levelElevation: activeProjectLevel?.elevation ?? 0,
                dimensions: roomShapeDimensions,
                valid: Boolean(
                  validatedRoomShape &&
                  (activeRoomBoundaryKind !== "FREE" ||
                    validRoomElevation !== undefined) &&
                  (!roomShapePlacement?.origin || roomPlacementValidation?.ok)
                ),
                validationIssue:
                  !validatedRoomShape ||
                  (activeRoomBoundaryKind === "FREE" &&
                    validRoomElevation === undefined)
                    ? "PARAMETERS"
                    : roomShapePlacement?.origin &&
                        roomPlacementValidation &&
                        !roomPlacementValidation.ok
                      ? "TOPOLOGY"
                      : undefined
              }
            : undefined
        }
        selectedRoom={selectedRoom}
        selectedRoomLevelElevation={activeProjectLevel?.elevation}
        selectedStair={selectedStair}
        stairAuthoring={
          stairPlacement?.toLevelId && stairPlacement.template
            ? {
                levels: activeProject?.building.levels ?? [],
                owningLevelId: stairPlacement.owningLevelId,
                targetLevelId: stairPlacement.toLevelId,
                ...(stairPlacement.toRoomId
                  ? { targetRoomId: stairPlacement.toRoomId }
                  : {}),
                template: stairPlacement.template,
                parameters: stairPlacement.parameters,
                proposal: stairProposal,
                turnDirection: stairPlacement.turnDirection
              }
            : undefined
        }
        selectedRoomMeasurement={selectedRoomMeasurement}
        levelMeasurement={activeLevelMeasurement}
        endpointAvailability={selectedWallEndpointAvailability}
        selectedVertexRemovable={selectedVertexRemovable}
        units={projectResponse?.project.units}
        onDeleteWall={handleDeleteSelectedWall}
        onAddWallVertex={handleAddVertexToSelectedWall}
        onRemoveVertex={handleRemoveSelectedVertex}
        onUpdateWallProperties={handleUpdateSelectedWallProperties}
        onDeleteOpening={handleDeleteSelectedOpening}
        onUpdateOpening={handleUpdateSelectedOpening}
        onUpdateOpeningAuthoring={handleUpdateOpeningAuthoring}
        onUpdateOpeningAuthoringType={handleOpeningAuthoringTypeChange}
        onUpdateRoomAuthoringDimension={handleRoomShapeDimensionChange}
        onRoomAuthoringMethodChange={handleRoomMethodChange}
        onRoomAuthoringShapeChange={(shape) => {
          setRoomPreset("CUSTOM");
          handleSelectRoomShape(shape);
        }}
        onRoomAuthoringPresetChange={handleRoomPresetChange}
        onUpdateRoomAuthoringElevation={handleRoomElevationChange}
        onRoomAuthoringSpacePanChange={setViewportPanModifierActive}
        onCancelRoomAuthoring={handleCancelRoomAuthoring}
        onDeleteRoom={handleDeleteSelectedRoom}
        onUpdateRoomProperties={handleUpdateSelectedRoomProperties}
        onDeleteStair={handleDeleteSelectedStair}
        onUpdateStair={handleUpdateSelectedStair}
        onStairAuthoringTemplateChange={handleStairTemplateChange}
        onStairAuthoringDestinationChange={handleStairDestinationChange}
        onStairAuthoringTurnChange={(turnDirection) =>
          dispatch(editorStairAuthoringChanged({ turnDirection }))
        }
        onStairAuthoringParametersChange={handleStairParametersChange}
        onConfirmStairAuthoring={handleConfirmStairAuthoring}
        onCancelStairAuthoring={handleCancelStairAuthoring}
        selectionCapabilities={selectionCapabilities}
        onDeleteSelection={handleDeleteSelection}
        onDuplicateSelection={furniture.duplicate}
        onAlignSelection={handleAlignSelection}
        onDistributeSelection={handleDistributeSelection}
        multiSelectionFurniture={
          selectionState.selected.length > 1 &&
          selectionState.selected.every(
            (selection) => selection.kind === "FURNITURE"
          )
            ? selectionState.selected.flatMap((selection) => {
                const item = activeProject?.building.furniture.find(
                  (candidate) => candidate.id === selection.geometryId
                );
                return item ? [item] : [];
              })
            : undefined
        }
      />
    );
  }, [
    furniture,
    resolvedDisplayOptions,
    editor.baseRevision,
    geometryResponse,
    presentationResult,
    selectedLevel,
    selectedEditWall,
    selectedEditOpening,
    selectedRoom,
    activeProject,
    activeProjectLevel?.elevation,
    stairPlacement,
    stairProposal,
    selectedStair,
    selectedRoomMeasurement,
    activeLevelMeasurement,
    editor.transient.interaction,
    editor.activeTool,
    roomDetectionActive,
    roomElevationDraft,
    roomShapeDimensions,
    validatedRoomShape,
    activeRoomShapeKind,
    activeRoomBoundaryKind,
    validRoomElevation,
    selectedWallEndpointAvailability,
    selectedVertexRemovable,
    selectionState,
    workspaceMode,
    projectResponse?.project.units,
    handleDeleteSelectedWall,
    handleAddVertexToSelectedWall,
    handleRemoveSelectedVertex,
    handleUpdateSelectedWallProperties,
    handleDeleteSelectedOpening,
    handleUpdateSelectedOpening,
    handleUpdateOpeningAuthoring,
    handleOpeningAuthoringTypeChange,
    handleRoomShapeDimensionChange,
    handleRoomElevationChange,
    handleCancelRoomAuthoring,
    handleDeleteSelectedRoom,
    handleUpdateSelectedRoomProperties,
    handleDeleteSelectedStair,
    handleUpdateSelectedStair,
    handleStairTemplateChange,
    handleStairDestinationChange,
    handleStairParametersChange,
    handleConfirmStairAuthoring,
    handleCancelStairAuthoring,
    selectionCapabilities,
    handleDeleteSelection,
    handleAlignSelection,
    handleDistributeSelection,
    handleDisplayOptionsChange,
    workspaceRepresentation,
    scene3DResult,
    levelVisibility3D,
    activeLevelId3D,
    resolvedSelection3D
  ]);

  const handleViewLevelChange = useCallback(
    (levelId: string) =>
      setSelectedViewLevelId(
        viewLevels.find((level) => level.id === levelId)?.sourceLevelId ?? ""
      ),
    [viewLevels]
  );
  useProjectWorkspaceShell({
    project: projectResponse?.project,
    consistencyFailure: Boolean(consistencyFailure),
    mode: workspaceMode,
    viewLevels,
    selectedViewLevel,
    selectedLevel,
    editor,
    activeProject,
    activeProjectLevel,
    viewport: activeViewport,
    representation: workspaceRepresentation,
    scene3D: scene3DResult?.ok ? scene3DResult.model : undefined,
    levelVisibility3D,
    activeLevelId3D,
    saveInteractionBlocked,
    isPhone,
    isTablet,
    inspector,
    dispatch,
    onViewLevelChange: handleViewLevelChange,
    onCreateLevel: handleCreateLevel,
    onUpdateActiveLevel: handleUpdateActiveLevel,
    onModeChange: handleModeChange,
    onRepresentationChange: handleRepresentationChange,
    onSave: handleSave,
    onFitViewport: handleFitViewport,
    onZoomViewport: handleZoomViewport,
    onPersistenceDialogChange: setPersistenceDialog,
    t
  });

  const activePersistenceDialog =
    persistenceDialog !== "none"
      ? persistenceDialog
      : blocker.state === "blocked"
        ? "leave"
        : "none";

  if (projectQuery.isPending || geometryQuery.isPending) {
    return (
      <Stack role="status" spacing={1.5} sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress size={28} />
        <Typography>{t("loading")}</Typography>
      </Stack>
    );
  }

  const failure = projectQuery.error ?? geometryQuery.error;
  if (refreshFailure) {
    return (
      <ProjectAuthoritativeRefreshError
        kind={refreshFailure}
        retrying={refreshingAuthoritativeState}
        onRetry={handleRetryAuthoritativeRefresh}
      />
    );
  }
  if (failure && !saveInteractionBlocked) {
    return <ProjectWorkspaceError error={failure} />;
  }
  if (!projectResponse || !geometryResponse) {
    return (
      <ProjectWorkspaceError
        error={new Error("Query completed without data.")}
      />
    );
  }
  if (consistencyFailure && !saveInteractionBlocked) {
    return (
      <ProjectConsistencyError
        kind={consistencyFailure}
        projectId={projectResponse.project.id}
        projectRevision={projectResponse.sourceRevision}
        geometryProjectId={geometryResponse.sourceProjectId}
        geometryRevision={geometryResponse.sourceRevision}
      />
    );
  }

  const editBuildFailed =
    workspaceMode === "edit" && editBuildResult && !editBuildResult.ok;
  const presentationFailed = presentationResult && !presentationResult.ok;

  return (
    <Stack className="geometry-page project-workspace" spacing={0}>
      <Typography component="h1" className="project-workspace__title">
        {projectResponse.project.name}
      </Typography>
      <ProjectWorkspaceFeedback
        dialog={activePersistenceDialog}
        saving={saveInteractionBlocked}
        editingError={editingError}
        saveFeedback={saveFeedback}
        onDismissEditingError={() => setEditingError(undefined)}
        onDismissSaveFeedback={() => setSaveFeedback(undefined)}
        onKeepEditing={handleKeepEditing}
        onConfirmDiscard={handleConfirmDiscard}
        onSave={handleSave}
        onReloadLatest={() => setPersistenceDialog("reload-conflict")}
        onCancelReload={() => setPersistenceDialog("conflict")}
        onConfirmReload={handleConfirmReloadLatest}
        t={t}
      />
      <ProjectWorkspaceCanvas
        representation={workspaceRepresentation}
        editorToolbarProps={
          workspaceRepresentation === "2d" && workspaceMode === "edit"
            ? {
                activeTool: editor.activeTool,
                disabled: saveInteractionBlocked,
                onToolToggle: (tool) => dispatch(editorToolToggled(tool)),
                shortcutsOpen,
                onOpenShortcuts: () => setShortcutsOpen(true),
                onCloseShortcuts: () => setShortcutsOpen(false)
              }
            : undefined
        }
        scene3D={scene3DResult?.ok ? scene3DResult.model : undefined}
        activeLevelId3D={activeLevelId3D}
        levelVisibility3D={levelVisibility3D}
        onLevelVisibility3DChange={setLevelVisibility3D}
        selection3D={selection3D}
        onSelection3DChange={setSelection3D}
        editBuildFailed={Boolean(editBuildFailed)}
        presentationFailed={Boolean(presentationFailed)}
        presentationError={
          presentationFailed ? presentationResult.error : undefined
        }
        viewerProps={
          selectedLevel && presentationResult?.ok
            ? {
                workspaceCanvas: true,
                title: t("viewer.title"),
                headingId: "project-geometry-viewer-heading",
                presentationModel: presentationResult.model,
                architecturalModel: presentationResult.architecturalModel,
                dimensionModel,
                options: resolvedDisplayOptions,
                viewport: activeViewport,
                selectionState,
                selectionFootprints,
                onSelectionStateChange: handleSelectionStateChange,
                onSelectionTranslationPointerDown:
                  handleSelectionTranslationPointerDown,
                onSelectionTranslationPointerUp:
                  handleSelectionTranslationPointerUp,
                onSelectionTranslationPointerCancel:
                  handleSelectionTranslationPointerCancel,
                onViewportChange: setViewport,
                onFitViewport: handleFitViewport,
                onResetViewport: handleResetViewport,
                onZoomViewport: handleZoomViewport,
                documentScaleDenominator:
                  workspaceMode === "edit"
                    ? editor.presentation.scaleDenominator
                    : 75,
                onDocumentScaleChange:
                  workspaceMode === "edit"
                    ? (denominator) =>
                        dispatch(editorDocumentScaleChanged(denominator))
                    : undefined,
                levelMeasurement: activeLevelMeasurement,
                units: activeProject?.units,
                statusLabel: t(
                  workspaceMode === "edit"
                    ? "workspace.editing"
                    : "workspace.readOnly"
                ),
                interaction:
                  workspaceMode === "edit"
                    ? getProjectEditorInteraction(
                        editor.activeTool,
                        viewportPanModifierActive
                      )
                    : undefined,
                editorOverlay,
                furnitureModel: {
                  items: furniture.model,
                  preview: furniture.preview,
                  previewValid: furniture.previewValid,
                  editing: workspaceMode === "edit" && !saveInteractionBlocked
                },
                onFurniturePointerDown: furniture.beginGesture,
                onFurniturePointerUp: furniture.endGesture,
                onFurniturePointerCancel: furniture.cancel,
                onEditorCanvasClick: (pointer) => {
                  if (editor.activeTool === "furniture")
                    furniture.canvasClick(pointer);
                  else handleEditorCanvasClick(pointer);
                },
                onEditorPointerMove: (pointer, pointerId) => {
                  if (viewportPanModifierActive) return;
                  furniture.pointerMove(pointer, pointerId);
                  if (!furniture.transient)
                    handleEditorPointerMove(pointer, pointerId);
                },
                onWallEndpointPointerDown: handleWallEndpointPointerDown,
                onWallEndpointPointerUp: handleWallEndpointPointerUp,
                onWallEndpointPointerCancel: handleWallEndpointPointerCancel,
                onJunctionPointerDown: handleJunctionPointerDown,
                onOpeningPointerDown: handleOpeningPointerDown,
                onOpeningDragThresholdCrossed:
                  handleOpeningDragThresholdCrossed,
                onOpeningPointerUp: handleOpeningPointerUp,
                onOpeningPointerCancel: handleOpeningPointerCancel,
                onStairAdjustmentPointerDown: handleStairAdjustmentPointerDown,
                onStairAdjustmentPointerUp: handleStairAdjustmentPointerUp,
                onStairAdjustmentPointerCancel:
                  handleStairAdjustmentPointerCancel,
                onStairTranslationPointerDown:
                  handleStairTranslationPointerDown,
                onStairTranslationPointerUp: handleStairTranslationPointerUp,
                onStairTranslationPointerCancel:
                  handleStairTranslationPointerCancel,
                onRoomFaceCandidateClick: viewportPanModifierActive
                  ? undefined
                  : (faceKey) => {
                      dispatch(editorSelectionCleared());
                      handleCreateRoom(faceKey);
                    }
              }
            : undefined
        }
        tabletInspector={isTablet ? inspector : undefined}
        showMobileOverview={isPhone}
        t={t}
      />
    </Stack>
  );
}
