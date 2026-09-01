import {
  GeometryEngine,
  LevelGeometry,
  calculatePolygonInteriorAnchor,
  measureLevel,
  measureRoom,
  projectPointOntoWall
} from "@casastudio/geometry";
import {
  canCollapseWallJunction,
  createConnectedWall,
  createRoomFromShape,
  classifyLevelRoomTopology,
  deriveRoomShapeVertices,
  moveOpening,
  moveJunction,
  moveWallEndpoint,
  splitWall,
  formatArchitecturalLength,
  type WallEndpoint,
  type Opening
} from "@casastudio/schema";
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import LockOutlineRoundedIcon from "@mui/icons-material/LockOutlineRounded";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { useBlocker, useParams } from "react-router-dom";

import { useCasaStudioApi } from "../../../core/api/ApiProvider";
import type { GeometryLevel, GeometrySnapshot } from "../../../core/api/api-types";
import { useAppShellContent } from "../../../shell/AppShellContext";
import { createArchitecturalPresentationModel2D } from "../../geometry-2d/presentation/architectural-presentation-model-2d";
import { createArchitecturalDimensionPresentationModel2D } from "../../geometry-2d/presentation/architectural-dimension-presentation-model-2d";
import { createRuntimeGeometryPresentationModel2D } from "../../geometry-2d/presentation/geometry-presentation-model-2d";
import { GeometryViewerPanel } from "../../geometry-2d/viewer/GeometryViewerPanel";
import {
  createGeometrySnapshotPresentationModel2D
} from "../../geometry-2d/adapters/geometry-snapshot-presentation-adapter";
import {
  createGeometrySelectionState,
  selectDoor,
  selectPolygon,
  selectWallOpening,
  selectWindow,
  type GeometrySelectionState
} from "../../geometry-2d/selection/geometry-selection-state";
import { isEditableShortcutTarget } from "../../geometry-2d/viewport/geometry-viewer-shortcuts";
import {
  geometrySvgViewport,
  projectGeometryDisplayOptions,
  type GeometryDisplayOptions,
  type GeometryEditorOverlay,
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
  getVisibleLevelReferences3D,
  type LevelVisibility3D
} from "../../project-3d/model/architectural-scene-3d-model";
import { useProjectGeometryQuery } from "../data/geometry-queries";
import { useReplaceProjectMutation } from "../data/project-mutations";
import { useProjectQuery } from "../data/project-queries";
import { useAppDispatch, useAppSelector } from "../../../app/store/hooks";
import {
  cleanEditingSessionLeft,
  editingDraftReplaced,
  editingSessionEntered,
  editorActiveLevelChanged,
  editorActiveToolChanged,
  editorDrawWallPointerMoved,
  editorDrawWallStarted,
  editorDocumentScaleChanged,
  editorDimensionDisplayChanged,
  editorEndpointDragStarted,
  editorGridSnappingChanged,
  editorGridSpacingChanged,
  editorGridVisibilityChanged,
  editorJunctionDragStarted,
  editorMeasurementPointSet,
  editorMeasurementPointerMoved,
  editorRoomShapePlacementChanged,
  editorRoomShapePlacementPointerMoved,
  editorRoomShapePlacementStarted,
  editorOpeningDragThresholdCrossed,
  editorOpeningDragPreviewChanged,
  editorOpeningDragStarted,
  editorOpeningPlacementChanged,
  editorWallVertexPlacementChanged,
  editorRedoRequested,
  editorSelectionChanged,
  editorSelectionCleared,
  editorTransientInteractionCleared,
  editorTransientPointerMoved,
  editorUndoRequested,
  projectRouteChanged,
  projectRouteExited,
  selectEditorGeometrySelection,
  selectProjectEditor,
  selectShouldProtectProjectNavigation,
  type ProjectWorkspaceMode
} from "../../editor-2d/state/project-editor-slice";
import { getProjectEditorInteraction } from "../../editor-2d/state/project-editor-tools";
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
import { ProjectEditorStatusBar } from "../../editor-2d/components/ProjectEditorStatusBar";
import { collectActionableRoomFaces } from "../../editor-2d/tools/room/project-room-authoring";
import {
  ProjectPersistenceDialogs,
  type ProjectPersistenceDialog
} from "./components/ProjectPersistenceDialogs";
import { normalizeEditorMeasurement } from "../../editor-2d/tools/measure/editor-measurement";
import {
  ProjectRoomAuthoringMenu,
  type RoomShapeDimensionDraft
} from "../../editor-2d/tools/room/ProjectRoomAuthoringMenu";
import {
  defaultRoomShapeDimensions,
  formatRoomShapePreviewLabel,
  getDefaultRoomShapeDimensions,
  getRoomEditingErrorKey,
  parseRoomShapeDefinition
} from "../../editor-2d/tools/room/room-shape-authoring";
import { EditorToolbar } from "../../editor-2d/components/EditorToolbar";
import { useEditorKeyboardShortcuts } from "../../editor-2d/hooks/useEditorKeyboardShortcuts";
import {
  useEditorSelectionActions,
  type EditingErrorKey
} from "../../editor-2d/hooks/useEditorSelectionActions";
import { ProjectHeaderActions } from "./components/ProjectHeaderActions";
import { ProjectLevelControl } from "./components/ProjectLevelControl";
import { WorkspaceModeControl } from "./components/WorkspaceModeControl";
import {
  WorkspaceRepresentationControl,
  type ProjectWorkspaceRepresentation
} from "./components/WorkspaceRepresentationControl";
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

const emptySelectionState = createGeometrySelectionState();
/** Lazily loaded Three.js workspace kept out of the default 2D route chunk. */
const Project3DViewer = lazy(() =>
  import("../../project-3d/Project3DViewer").then((module) => ({
    default: module.Project3DViewer
  }))
);

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
  const [viewportPanModifierActive, setViewportPanModifierActive] =
    useState(false);
  const [editingError, setEditingError] = useState<EditingErrorKey>();
  const [roomMenuAnchor, setRoomMenuAnchor] = useState<HTMLElement | null>(null);
  const [roomDetectionActive, setRoomDetectionActive] = useState(false);
  const [roomShapeDimensions, setRoomShapeDimensions] =
    useState<RoomShapeDimensionDraft>(defaultRoomShapeDimensions);

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
  const scene3DResult = useMemo(() => {
    if (!projectResponse || !geometryResponse || consistencyFailure) return undefined;
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

  useEffect(() => {
    const enabled =
      workspaceMode === "edit" && !shortcutsOpen && !saveInteractionBlocked;
    if (!enabled) {
      setViewportPanModifierActive(false);
      return;
    }

    const handleSpaceDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const roomDimensionInput =
        typeof target?.matches === "function" &&
        target.matches('input[type="number"]') &&
        target.closest(".project-room-authoring-menu__dimensions") !== null;
      if (
        (event.key !== " " && event.code !== "Space") ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (isEditableShortcutTarget(event.target) && !roomDimensionInput)
      ) {
        return;
      }

      event.preventDefault();
      if (roomDimensionInput) target?.blur();
      setViewportPanModifierActive(true);
    };
    const handleSpaceUp = (event: KeyboardEvent) => {
      if (event.key !== " " && event.code !== "Space") return;
      event.preventDefault();
      setViewportPanModifierActive(false);
    };
    const handleWindowBlur = () => setViewportPanModifierActive(false);

    window.addEventListener("keydown", handleSpaceDown, true);
    window.addEventListener("keyup", handleSpaceUp, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleSpaceDown, true);
      window.removeEventListener("keyup", handleSpaceUp, true);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [saveInteractionBlocked, shortcutsOpen, workspaceMode]);
  const viewLevels = geometryResponse?.geometry.levels ?? [];
  const selectedViewLevel =
    viewLevels.find((level) => level.id === selectedViewLevelId) ??
    viewLevels[0];
  const activeLevelId3D = selectedViewLevel?.sourceLevelId;
  const resolvedSelection3D = useMemo(
    () => scene3DResult?.ok && selection3D
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
    ) setSelection3D(undefined);
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
  const activeProject = workspaceMode === "edit" ? editor.draft : projectResponse?.project;
  const activeProjectLevel = activeProject?.building.levels.find(
    (level) => level.id === selectedLevel?.sourceLevelId
  );
  const roomShapePlacement = editor.transient.interaction?.kind === "place-room-shape"
    ? editor.transient.interaction
    : undefined;
  const activeRoomShapeKind = roomShapePlacement?.shape.kind;
  const validatedRoomShape = useMemo(
    () => activeRoomShapeKind
      ? parseRoomShapeDefinition(activeRoomShapeKind, roomShapeDimensions)
      : undefined,
    [activeRoomShapeKind, roomShapeDimensions]
  );
  const roomShapeTemplateAvailable = activeProjectLevel?.walls.length === 0;
  const resolvedDisplayOptions: GeometryDisplayOptions = workspaceMode === "edit"
    ? { ...displayOptions, ...editor.presentation.dimensions }
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
        ? createArchitecturalPresentationModel2D(activeProjectLevel, transform, selectionState)
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
    const selectedEdge = selected?.kind === "BOUNDARY_EDGE"
      ? presentationResult.model.boundaryEdges.find((edge) => edge.geometryId === selected.geometryId)
      : undefined;
    return findProjectWall(
      activeProject ?? null,
      activeProjectLevel?.id ?? null,
      selected?.kind === "WALL" ? selected.geometryId : selectedEdge?.sourceWallId
    );
  }, [
    activeProject,
    activeProjectLevel?.id,
    presentationResult,
    selectionState.selected
  ]);
  const selectedWallEndpointAvailability =
    getWallEndpointEditingAvailability(
      editor.draft,
      editor.activeLevelId,
      selectedEditWall?.id
    );
  const selectedEditOpening = useMemo(() => {
    const selected = selectionState.selected.length === 1
      ? selectionState.selected[0]
      : undefined;
    return selected && (selected.kind === "DOOR" || selected.kind === "WINDOW" || selected.kind === "OPENING")
      ? findProjectOpening(activeProject ?? null, activeProjectLevel?.id ?? null, selected.geometryId)
      : undefined;
  }, [activeProject, activeProjectLevel?.id, selectionState.selected]);
  const selectedRoom = useMemo(() => {
    const selected = selectionState.selected.length === 1
      ? selectionState.selected[0]
      : undefined;
    if (selected?.kind !== "POLYGON" || !presentationResult?.ok || !activeProjectLevel) {
      return undefined;
    }
    const polygon = presentationResult.model.polygons.find(
      (candidate) => candidate.geometryId === selected.geometryId
    );
    return activeProjectLevel.rooms.find((room) => room.id === polygon?.sourceRoomId);
  }, [activeProjectLevel, presentationResult, selectionState.selected]);
  const selectedRoomMeasurement = useMemo(
    () => activeProjectLevel && selectedRoom
      ? measureRoom(activeProjectLevel, selectedRoom)
      : undefined,
    [activeProjectLevel, selectedRoom]
  );
  const activeLevelMeasurement = useMemo(
    () => activeProjectLevel ? measureLevel(activeProjectLevel) : undefined,
    [activeProjectLevel]
  );
  const dimensionModel = useMemo(() => {
    if (!activeProjectLevel || !activeProject || !presentationResult?.ok) return undefined;
    const measurement = editor.transient.interaction?.kind === "measure"
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
      scaleDenominator: workspaceMode === "edit"
        ? editor.presentation.scaleDenominator
        : 75,
      display: {
        overallDimensions: resolvedDisplayOptions.overallDimensions,
        selectedDimensions: resolvedDisplayOptions.selectedDimensions,
        roomMetrics: resolvedDisplayOptions.roomMetrics
      },
      selectedWall: selectedEditWall,
      selectedRoom,
      temporaryMeasurement: measurement
    });
  }, [
    activeProject,
    activeProjectLevel,
    activeViewport,
    editor.presentation.scaleDenominator,
    editor.transient.interaction,
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
    ) return undefined;
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
    () => Boolean(
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
  const roomTopology = useMemo(
    () =>
      editor.draft && editor.activeLevelId
        ? classifyLevelRoomTopology(editor.draft, editor.activeLevelId)
        : undefined,
    [editor.activeLevelId, editor.draft]
  );
  const actionableRoomFaces = useMemo(() => {
    if (!roomTopology) return [];
    return collectActionableRoomFaces(roomTopology);
  }, [roomTopology]);

  useEffect(() => {
    if (workspaceMode === "edit" && editor.activeTool === "room") return;
    setRoomMenuAnchor(null);
    setRoomDetectionActive(false);
  }, [editor.activeTool, workspaceMode]);

  const handleRoomToggle = useCallback((anchor: HTMLElement) => {
    if (saveInteractionBlocked || workspaceMode !== "edit") return;
    if (editor.activeTool === "room") {
      dispatch(editorTransientInteractionCleared());
      setRoomDetectionActive(false);
      setRoomMenuAnchor(null);
      dispatch(editorActiveToolChanged(null));
      return;
    }
    dispatch(editorActiveToolChanged("room"));
    setRoomMenuAnchor(anchor);
  }, [dispatch, editor.activeTool, saveInteractionBlocked, workspaceMode]);

  const handleDetectRoom = useCallback(() => {
    dispatch(editorTransientInteractionCleared());
    setRoomDetectionActive(true);
    setRoomMenuAnchor(null);
  }, [dispatch]);

  const handleSelectRoomShape = useCallback((kind: "RECTANGLE" | "L_SHAPE") => {
    if (!editor.activeLevelId || !roomShapeTemplateAvailable) return;
    const dimensions = getDefaultRoomShapeDimensions(kind);
    const shape = parseRoomShapeDefinition(kind, dimensions);
    if (!shape) return;
    setRoomShapeDimensions(dimensions);
    setRoomDetectionActive(false);
    dispatch(editorActiveToolChanged("room"));
    dispatch(editorRoomShapePlacementStarted({
      levelId: editor.activeLevelId,
      shape
    }));
  }, [dispatch, editor.activeLevelId, roomShapeTemplateAvailable]);

  const handleRoomShapeDimensionChange = useCallback((
    field: keyof RoomShapeDimensionDraft,
    value: string
  ) => {
    if (!activeRoomShapeKind) return;
    const nextDimensions = { ...roomShapeDimensions, [field]: value };
    setRoomShapeDimensions(nextDimensions);
    const shape = parseRoomShapeDefinition(activeRoomShapeKind, nextDimensions);
    if (shape) dispatch(editorRoomShapePlacementChanged(shape));
  }, [activeRoomShapeKind, dispatch, roomShapeDimensions]);

  const handleCancelRoomAuthoring = useCallback(() => {
    dispatch(editorTransientInteractionCleared());
    setRoomDetectionActive(false);
    setRoomMenuAnchor(null);
  }, [dispatch]);

  const editorOverlay = useMemo<GeometryEditorOverlay | undefined>(() => {
    if (workspaceMode !== "edit") return undefined;
    const transient = editor.transient.interaction;
    const selectedWall = selectedEditWall
      ? {
          wallId: selectedEditWall.id,
          endpointEditingAvailable: {
            start: selectedWallEndpointAvailability?.start.draggable ?? false,
            end: selectedWallEndpointAvailability?.end.draggable ?? false
          },
          start:
            transient?.kind === "move-wall-endpoint" &&
            transient.wallId === selectedEditWall.id &&
            transient.endpoint === "start"
              ? transient.currentPointerPoint
              : transient?.kind === "move-junction" &&
                  selectedEditWall.start.x === transient.position.x &&
                  selectedEditWall.start.z === transient.position.z
                ? transient.currentPointerPoint
              : selectedEditWall.start,
          end:
            transient?.kind === "move-wall-endpoint" &&
            transient.wallId === selectedEditWall.id &&
            transient.endpoint === "end"
              ? transient.currentPointerPoint
              : transient?.kind === "move-junction" &&
                  selectedEditWall.end.x === transient.position.x &&
                  selectedEditWall.end.z === transient.position.z
                ? transient.currentPointerPoint
              : selectedEditWall.end,
          draggingEndpoint:
            transient?.kind === "move-wall-endpoint" &&
            transient.wallId === selectedEditWall.id
              ? transient.endpoint
              : undefined
        }
      : undefined;
    const placementCandidate = transient?.kind === "place-opening"
      ? transient.candidate
      : undefined;
    const placementWall = placementCandidate
      ? findProjectWall(editor.draft, editor.activeLevelId, placementCandidate.wallId)
      : undefined;
    const draggedOpening = transient?.kind === "move-opening" && transient.dragging && selectedEditOpening
      ? { ...selectedEditOpening.opening, offsetFromStart: transient.currentOffsetFromStart } as Opening
      : undefined;
    const previewShape = transient?.kind === "place-room-shape"
      ? transient.shape
      : undefined;
    const shapeVertices =
      previewShape &&
      transient?.kind === "place-room-shape" &&
      transient.origin &&
      validatedRoomShape
        ? deriveRoomShapeVertices(transient.origin, previewShape)
        : undefined;
    const shapeLabelAnchor = shapeVertices
      ? calculatePolygonInteriorAnchor(shapeVertices)
      : undefined;

    return {
      roomFaceCandidates:
        editor.activeTool === "room" && roomDetectionActive
          ? actionableRoomFaces.map((face) => ({
              faceKey: face.key,
              vertices: face.vertices,
              selected: false
            }))
          : undefined,
      roomShapePreview:
        shapeVertices && shapeLabelAnchor && activeProject && previewShape
          ? {
              vertices: shapeVertices,
              labelAnchor: shapeLabelAnchor,
              label: formatRoomShapePreviewLabel(previewShape, activeProject.units.length),
              kind: previewShape.kind
            }
          : undefined,
      drawWall:
        transient?.kind === "draw-wall"
          ? {
              start: transient.startPoint,
              end: transient.currentPointerPoint,
              lengthLabel: activeProject &&
                (transient.currentPointerPoint.x !== transient.startPoint.x ||
                  transient.currentPointerPoint.z !== transient.startPoint.z)
                ? formatArchitecturalLength(
                    Math.hypot(
                      transient.currentPointerPoint.x - transient.startPoint.x,
                      transient.currentPointerPoint.z - transient.startPoint.z
                    ),
                    activeProject.units.length
                  )
                : undefined
            }
          : undefined,
      snapCandidate: editor.transient.snapCandidate,
      snapMarkerPurpose: editor.activeTool === "measure" ? "measurement" : "authoring",
      selectedWall,
      selectedJunction:
        selectedEditVertex && selectedJunctionWallIds.length > 1
          ? {
              position: selectedEditVertex.coordinates,
              previewPosition:
                transient?.kind === "move-junction"
                  ? transient.currentPointerPoint
                  : selectedEditVertex.coordinates
            }
          : undefined,
      wallVertexPreview:
        transient?.kind === "add-wall-vertex" ? transient.splitPoint : undefined,
      openingPreview: placementCandidate && placementWall
        ? { wall: placementWall, opening: placementCandidate.opening, valid: placementCandidate.valid }
        : draggedOpening && selectedEditOpening
          ? { wall: selectedEditOpening.wall, opening: draggedOpening, valid: transient?.kind === "move-opening" ? transient.valid : false }
          : undefined,
      activeOpeningDragId:
        transient?.kind === "move-opening" && transient.dragging
          ? transient.openingId
          : undefined,
      grid: {
        visible: editor.precision.gridVisible,
        spacing: editor.precision.gridSpacing
      }
    };
  }, [
    editor.transient.interaction,
    editor.transient.snapCandidate,
    selectedEditWall,
    selectedEditVertex,
    selectedEditOpening,
    selectedJunctionWallIds,
    selectedWallEndpointAvailability,
    editor.precision,
    editor.activeTool,
    actionableRoomFaces,
    activeProject,
    roomDetectionActive,
    validatedRoomShape,
    workspaceMode
  ]);

  useEffect(() => {
    dispatch(projectRouteChanged(projectId));
    dispatch(geometrySelectionReset());
    setSelectionOwnerSnapshot(undefined);
    setViewportOwnerKey("");
    setWorkspaceRepresentation("2d");
    setLevelVisibility3D("all");

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

    const firstLevel = viewLevels[0];
    setSelectedViewLevelId(firstLevel?.id ?? "");
    dispatch(geometrySelectionReset());
    setSelectionOwnerSnapshot(geometryResponse?.geometry);
  }, [dispatch, geometryIdentity, geometryResponse, viewLevels]);

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

      if (editor.activeTool === "room") {
        const placement = editor.transient.interaction;
        if (placement?.kind !== "place-room-shape") return;
        if (!validatedRoomShape) {
          setEditingError("errors.room.geometry");
          return;
        }
        const gridCandidate = resolveGridSnapCandidate(pointer.worldPoint, {
          enabled: editor.precision.snapToGrid,
          spacing: editor.precision.gridSpacing,
          worldToSvgScale: activeViewport.zoom,
          cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit
        });
        const origin = gridCandidate?.point ?? pointer.worldPoint;
        const roomId = createRoomIdentifier();
        const wallCount = validatedRoomShape.kind === "RECTANGLE" ? 4 : 6;
        const level = editor.draft.building.levels.find(
          (candidate) => candidate.id === editor.activeLevelId
        );
        const result = createRoomFromShape(editor.draft, {
          levelId: editor.activeLevelId,
          origin,
          shape: validatedRoomShape,
          room: {
            id: roomId,
            name: `Room ${(level?.rooms.length ?? 0) + 1}`,
            type: "OTHER"
          },
          wallIds: Array.from({ length: wallCount }, () => createWallIdentifier()),
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
        dispatch(editorSelectionChanged(createGeometrySelectionState([
          selectPolygon(`polygon:${roomId}`)
        ])));
        return;
      }

      if (editor.activeTool === "measure") {
        const snapCandidate = presentationResult?.ok
          ? resolveProjectPointSnapCandidate(pointer.svgPoint, presentationResult.model, {
              cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit,
              worldPoint: pointer.worldPoint,
              grid: {
                enabled: editor.precision.snapToGrid,
                spacing: editor.precision.gridSpacing,
                worldToSvgScale: activeViewport.zoom
              }
            })
          : undefined;
        dispatch(editorMeasurementPointSet({
          point: snapCandidate?.point ?? pointer.worldPoint,
          snapCandidate
        }));
        return;
      }

      if (editor.activeTool === "door" || editor.activeTool === "window" || editor.activeTool === "opening") {
        const openingType = editor.activeTool === "door"
          ? "DOOR"
          : editor.activeTool === "window" ? "WINDOW" : "OPENING";
        const placement = editor.transient.interaction;
        const candidate = placement?.kind === "place-opening" &&
            placement.openingType === openingType
          ? placement.candidate
          : undefined;
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
          dispatch(editorSelectionChanged(createGeometrySelectionState([
            openingType === "DOOR"
              ? selectDoor(openingId)
              : openingType === "WINDOW" ? selectWindow(openingId) : selectWallOpening(openingId)
          ])));
          dispatch(editorOpeningPlacementChanged({
            openingType,
            properties: placement?.kind === "place-opening" ? placement.properties : undefined,
            candidate: undefined
          }));
        } else {
          setEditingError("errors.opening.invalid");
        }
        return;
      }
      if (editor.activeTool !== "draw-wall") return;

      const snapCandidate =
        presentationResult?.ok
          ? resolveDrawWallSnapCandidate(
              pointer.svgPoint,
              presentationResult.model,
              {
                cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit,
                worldPoint: pointer.worldPoint,
                drawStart:
                  editor.transient.interaction?.kind === "draw-wall"
                    ? {
                        worldPoint: editor.transient.interaction.startPoint,
                        svgPoint: createViewportTransform2D(activeViewport).worldToScreen(
                          editor.transient.interaction.startPoint
                        )
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
        dispatch(editorDrawWallStarted({ point: resolvedPoint, snapCandidate }));
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
          snapCandidate?.kind === "wall-interior" || snapCandidate?.kind === "wall-midpoint"
            ? [{ wallId: snapCandidate.wallId, newWallId: createWallIdentifier() }]
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
        if (!doesWallCloseCycle(result.project, editor.activeLevelId, wall.id)) {
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
      activeViewport,
      presentationResult,
      saveInteractionBlocked,
      workspaceMode
    ]
  );

  const handleEditorPointerMove = useCallback(
    (pointer: SvgViewportPointer, pointerId: number) => {
      if (
        saveInteractionBlocked
      ) {
        return;
      }
      if (
        workspaceMode === "edit" &&
        editor.activeTool === "room" &&
        editor.transient.interaction?.kind === "place-room-shape" &&
        validatedRoomShape
      ) {
        const gridCandidate = resolveGridSnapCandidate(pointer.worldPoint, {
          enabled: editor.precision.snapToGrid,
          spacing: editor.precision.gridSpacing,
          worldToSvgScale: activeViewport.zoom,
          cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit
        });
        dispatch(editorRoomShapePlacementPointerMoved(
          gridCandidate?.point ?? pointer.worldPoint
        ));
      } else if (
        workspaceMode === "edit" &&
        editor.draft &&
        editor.transient.interaction?.kind === "add-wall-vertex"
      ) {
        const interaction = editor.transient.interaction;
        const wall = findProjectWall(editor.draft, interaction.levelId, interaction.wallId);
        if (!wall) {
          dispatch(editorWallVertexPlacementChanged(undefined));
        } else {
          const projection = projectPointOntoWall(pointer.worldPoint, wall);
          const wallLength = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
          const maximumDistance = 18 / Math.max(
            Number.EPSILON,
            activeViewport.zoom * pointer.cssPixelsPerSvgUnit
          );
          dispatch(editorWallVertexPlacementChanged(
            Math.abs(projection.perpendicularDistance) <= maximumDistance &&
            projection.distanceAlongWall > 1e-7 &&
            projection.distanceAlongWall < wallLength - 1e-7
              ? projection.projected
              : undefined
          ));
        }
      } else
      if (
        workspaceMode === "edit" &&
        editor.draft &&
        editor.transient.interaction?.kind === "move-opening" &&
        editor.transient.interaction.pointerId === pointerId &&
        selectedEditOpening
      ) {
        const projection = projectPointOntoWall(pointer.worldPoint, selectedEditOpening.wall);
        const wallLength = Math.hypot(
          selectedEditOpening.wall.end.x - selectedEditOpening.wall.start.x,
          selectedEditOpening.wall.end.z - selectedEditOpening.wall.start.z
        );
        const offsetFromStart = normalizeEditorMeasurement(
          Math.max(
            0,
            Math.min(
              wallLength - selectedEditOpening.opening.width,
              projection.distanceAlongWall - selectedEditOpening.opening.width / 2
            )
          )
        );
        const validation = moveOpening(editor.draft, {
          levelId: editor.transient.interaction.levelId,
          wallId: editor.transient.interaction.wallId,
          openingId: editor.transient.interaction.openingId,
          offsetFromStart
        });
        dispatch(editorOpeningDragPreviewChanged({ pointerId, offsetFromStart, valid: validation.ok }));
      } else if (
        workspaceMode === "edit" &&
        editor.draft &&
        editor.activeLevelId &&
        (editor.activeTool === "door" || editor.activeTool === "window" || editor.activeTool === "opening")
      ) {
        const openingType = editor.activeTool === "door"
          ? "DOOR"
          : editor.activeTool === "window" ? "WINDOW" : "OPENING";
        const placement = editor.transient.interaction;
        const properties = placement?.kind === "place-opening" && placement.openingType === openingType
          ? placement.properties
          : undefined;
        dispatch(editorOpeningPlacementChanged({
          openingType,
          properties,
          candidate: resolveOpeningPlacementCandidate(
            editor.draft,
            editor.activeLevelId,
            pointer.worldPoint,
            openingType,
            18 / Math.max(Number.EPSILON, activeViewport.zoom * pointer.cssPixelsPerSvgUnit),
            properties
          )
        }));
      } else
      if (
        workspaceMode === "edit" &&
        editor.activeTool === "draw-wall" &&
        presentationResult?.ok
      ) {
        const snapCandidate = resolveDrawWallSnapCandidate(
          pointer.svgPoint,
          presentationResult.model,
          {
            cssPixelsPerSvgUnit: pointer.cssPixelsPerSvgUnit,
            worldPoint: pointer.worldPoint,
            drawStart:
              editor.transient.interaction?.kind === "draw-wall"
                ? {
                    worldPoint: editor.transient.interaction.startPoint,
                    svgPoint: createViewportTransform2D(activeViewport).worldToScreen(
                      editor.transient.interaction.startPoint
                    )
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
            worldPoint: pointer.worldPoint,
            grid: {
              enabled: editor.precision.snapToGrid,
              spacing: editor.precision.gridSpacing,
              worldToSvgScale: activeViewport.zoom
            }
          }
        );
        dispatch(editorMeasurementPointerMoved({
          point: snapCandidate.point,
          snapCandidate
        }));
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
      presentationResult,
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
            incidentWallIds: getIncidentWallIds(editor.draft, editor.activeLevelId, point),
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
      ) return;
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
        (interaction?.kind !== "move-wall-endpoint" && interaction?.kind !== "move-junction") ||
        interaction.pointerId !== pointerId
      ) {
        return;
      }

      const result = interaction.kind === "move-junction"
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
            if (!availability?.[interaction.endpoint].draggable ||
                availability[interaction.endpoint].topology !== "standalone") return undefined;
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
        (interaction?.kind === "move-wall-endpoint" || interaction?.kind === "move-junction") &&
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
      ) return;
      const target = findProjectOpening(editor.draft, editor.activeLevelId, openingId);
      if (!target || target.wall.id !== wallId) return;
      dispatch(editorOpeningDragStarted({
        levelId: editor.activeLevelId,
        wallId,
        openingId,
        pointerId,
        offsetFromStart: target.opening.offsetFromStart
      }));
    },
    [dispatch, editor.activeLevelId, editor.activeTool, editor.draft, saveInteractionBlocked, workspaceMode]
  );

  const handleOpeningDragThresholdCrossed = useCallback(
    (pointerId: number) => dispatch(editorOpeningDragThresholdCrossed({ pointerId })),
    [dispatch]
  );

  const handleOpeningPointerUp = useCallback(
    (pointerId: number, dragged: boolean) => {
      const interaction = editor.transient.interaction;
      if (
        interaction?.kind !== "move-opening" ||
        interaction.pointerId !== pointerId ||
        !editor.draft
      ) return;
      if (!dragged) {
        dispatch(editorTransientInteractionCleared());
        return;
      }
      const result = interaction.valid
        ? moveOpening(editor.draft, {
            levelId: interaction.levelId,
            wallId: interaction.wallId,
            openingId: interaction.openingId,
            offsetFromStart: normalizeEditorMeasurement(interaction.currentOffsetFromStart)
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
      if (interaction?.kind === "move-opening" && interaction.pointerId === pointerId) {
        dispatch(editorTransientInteractionCleared());
      }
    },
    [dispatch, editor.transient.interaction]
  );

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

  useEditorKeyboardShortcuts({
    dispatch,
    selectedLevel,
    workspaceRepresentation,
    shortcutsOpen,
    saveInteractionBlocked,
    workspaceMode,
    selectedEditOpening,
    selectedRoom,
    selectedEditWall,
    transient: editor.transient,
    setRoomMenuAnchor,
    setRoomDetectionActive,
    handleDeleteSelectedOpening,
    handleDeleteSelectedRoom,
    handleDeleteSelectedWall,
    handleFitViewport,
    handleResetViewport
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

      if (nextMode === "edit" && workspaceRepresentation === "3d") return;

      if (nextMode === "edit") {
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

  const handleRepresentationChange = useCallback((
    representation: ProjectWorkspaceRepresentation | null
  ) => {
    if (
      !representation ||
      representation === workspaceRepresentation ||
      saveInteractionBlocked ||
      (representation === "3d" && workspaceMode === "edit")
    ) return;
    setWorkspaceRepresentation(representation);
    if (representation === "2d") setSelection3D(undefined);
  }, [saveInteractionBlocked, workspaceMode, workspaceRepresentation]);

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

  const handleDisplayOptionsChange = useCallback((options: GeometryDisplayOptions) => {
    setDisplayOptions(options);
    if (workspaceMode === "edit") {
      dispatch(editorDimensionDisplayChanged({
        overallDimensions: options.overallDimensions,
        selectedDimensions: options.selectedDimensions,
        roomMetrics: options.roomMetrics
      }));
    }
  }, [dispatch, workspaceMode]);

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
        model={presentationResult.model}
        selectionState={selectionState}
        options={resolvedDisplayOptions}
        onOptionsChange={handleDisplayOptionsChange}
        mode={workspaceMode}
        selectedWall={selectedEditWall}
        selectedOpening={selectedEditOpening}
        selectedOpeningDisplayOffset={transientOpeningOffset}
        openingAuthoring={
          selectionState.selected.length === 0 &&
          editor.transient.interaction?.kind === "place-opening"
            ? editor.transient.interaction
            : undefined
        }
        selectedRoom={selectedRoom}
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
        onDeleteRoom={handleDeleteSelectedRoom}
        onUpdateRoomProperties={handleUpdateSelectedRoomProperties}
      />
    );
  }, [
    resolvedDisplayOptions,
    editor.baseRevision,
    geometryResponse,
    presentationResult,
    selectedLevel,
    selectedEditWall,
    selectedEditOpening,
    selectedRoom,
    selectedRoomMeasurement,
    activeLevelMeasurement,
    editor.transient.interaction,
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
    handleDeleteSelectedRoom,
    handleUpdateSelectedRoomProperties,
    handleDisplayOptionsChange,
    workspaceRepresentation,
    scene3DResult,
    levelVisibility3D,
    activeLevelId3D,
    resolvedSelection3D
  ]);

  const shellContent = useMemo(
    () => ({
      title: projectResponse?.project.name ?? t("shell.title"),
      breadcrumb: t("shell.breadcrumb"),
      headerContextAccessory: !isPhone && projectResponse && !consistencyFailure ? (
        <ProjectLevelControl
          mode={workspaceMode}
          viewLevels={viewLevels}
          selectedViewLevel={selectedViewLevel}
          draftLevelIds={editor.draft?.building.levels.map((level) => ({
            id: level.id,
            name: level.name,
            elevation: level.elevation
          })) ?? []}
          projectLevelNames={projectResponse.project.building.levels.map((level) => ({
            id: level.id,
            name: level.name
          }))}
          activeEditLevelId={editor.activeLevelId}
          onViewLevelChange={setSelectedViewLevelId}
          onEditLevelChange={(levelId) => dispatch(editorActiveLevelChanged(levelId))}
          onCreateLevel={handleCreateLevel}
          onUpdateActiveLevel={handleUpdateActiveLevel}
        />
      ) : undefined,
      headerCenter: !isPhone && projectResponse && !consistencyFailure ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <WorkspaceRepresentationControl
            representation={workspaceRepresentation}
            disabled={saveInteractionBlocked}
            threeDDisabled={workspaceMode === "edit"}
            onChange={handleRepresentationChange}
          />
          <WorkspaceModeControl
            mode={workspaceMode}
            disabled={saveInteractionBlocked}
            editDisabled={workspaceRepresentation === "3d"}
            onChange={handleModeChange}
          />
        </Stack>
      ) : undefined,
      headerAccessory: !isPhone && projectResponse && !consistencyFailure ? (
        <ProjectHeaderActions
          mode={workspaceMode}
          dirty={editor.dirty}
          disabled={saveInteractionBlocked}
          canUndo={editor.history.past.length > 0}
          canRedo={editor.history.future.length > 0}
          shortcutsOpen={shortcutsOpen}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onCloseShortcuts={() => setShortcutsOpen(false)}
          onUndo={() => dispatch(editorUndoRequested())}
          onRedo={() => dispatch(editorRedoRequested())}
          onDiscard={() => setPersistenceDialog("discard")}
          onSave={handleSave}
        />
      ) : undefined,
      inspector: isTablet || isPhone ? undefined : inspector,
      status: workspaceRepresentation === "3d" && scene3DResult?.ok ? (
        t("threeD.status", {
          count: getVisibleLevelReferences3D(
            scene3DResult.model,
            levelVisibility3D,
            activeLevelId3D
          ).length
        })
      ) : selectedLevel && activeProject ? (
        <ProjectEditorStatusBar
          scale={workspaceMode === "edit" ? editor.presentation.scaleDenominator : 75}
          units={activeProject.units}
          gridVisible={workspaceMode === "edit" && editor.precision.gridVisible}
          snapToGrid={workspaceMode === "edit" && editor.precision.snapToGrid}
          gridSpacing={editor.precision.gridSpacing}
          zoom={activeViewport.zoom}
          editing={workspaceMode === "edit"}
          onScaleChange={(scale) => dispatch(editorDocumentScaleChanged(scale))}
          onGridVisibleChange={(visible) => dispatch(editorGridVisibilityChanged(visible))}
          onSnapToGridChange={(enabled) => dispatch(editorGridSnappingChanged(enabled))}
          onGridSpacingChange={(spacing) => dispatch(editorGridSpacingChanged(spacing))}
          onZoom={handleZoomViewport}
          onFit={handleFitViewport}
        />
      ) : t("status.unavailable"),
      immersiveWorkspace: true
    }),
    [
      activeProject,
      activeViewport.zoom,
      consistencyFailure,
      dispatch,
      editor.activeLevelId,
      editor.dirty,
      editor.draft,
      editor.history.future.length,
      editor.history.past.length,
      editor.precision.gridSpacing,
      editor.precision.gridVisible,
      editor.precision.snapToGrid,
      editor.presentation.scaleDenominator,
      handleFitViewport,
      handleModeChange,
      handleRepresentationChange,
      handleSave,
      handleZoomViewport,
      inspector,
      isPhone,
      isTablet,
      projectResponse,
      saveInteractionBlocked,
      selectedLevel,
      selectedViewLevel,
      shortcutsOpen,
      t,
      viewLevels,
      handleCreateLevel,
      handleUpdateActiveLevel,
      workspaceMode,
      workspaceRepresentation,
      scene3DResult,
      levelVisibility3D,
      activeLevelId3D
    ]
  );
  useAppShellContent(shellContent);

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
      <ProjectWorkspaceError error={new Error("Query completed without data.")} />
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
      <ProjectPersistenceDialogs
        dialog={activePersistenceDialog}
        saving={saveInteractionBlocked}
        onKeepEditing={handleKeepEditing}
        onConfirmDiscard={handleConfirmDiscard}
        onSave={handleSave}
        onReloadLatest={() => setPersistenceDialog("reload-conflict")}
        onCancelReload={() => setPersistenceDialog("conflict")}
        onConfirmReload={handleConfirmReloadLatest}
      />
      <Snackbar
        open={Boolean(editingError)}
        autoHideDuration={5000}
        onClose={() => setEditingError(undefined)}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setEditingError(undefined)}
        >
          {editingError ? t(editingError) : ""}
        </Alert>
      </Snackbar>
      <Snackbar
        open={Boolean(saveFeedback)}
        autoHideDuration={7000}
        onClose={() => setSaveFeedback(undefined)}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setSaveFeedback(undefined)}
        >
          {saveFeedback
            ? t(`persistence.feedback.${saveFeedback}`)
            : ""}
        </Alert>
      </Snackbar>

      {workspaceRepresentation === "2d" && workspaceMode === "edit" ? (
        <EditorToolbar
          activeTool={editor.activeTool}
          disabled={saveInteractionBlocked}
          onToolChange={(tool) => dispatch(editorActiveToolChanged(tool))}
          roomMenuOpen={Boolean(roomMenuAnchor)}
          onRoomToggle={handleRoomToggle}
        />
      ) : null}
      <ProjectRoomAuthoringMenu
        anchorEl={
          workspaceRepresentation === "2d" && workspaceMode === "edit"
            ? roomMenuAnchor
            : null
        }
        templateAvailable={roomShapeTemplateAvailable}
        activeShape={activeRoomShapeKind}
        dimensions={roomShapeDimensions}
        unit={activeProject?.units.length ?? "cm"}
        onDetectRoom={handleDetectRoom}
        onSelectShape={handleSelectRoomShape}
        onDimensionChange={handleRoomShapeDimensionChange}
        onSpacePanChange={setViewportPanModifierActive}
        onCancel={handleCancelRoomAuthoring}
      />

      {workspaceRepresentation === "3d" ? (
        scene3DResult?.ok ? (
          <Suspense
            fallback={
              <Stack role="status" spacing={1.5} sx={{ alignItems: "center", py: 8 }}>
                <CircularProgress size={28} />
                <Typography>{t("threeD.loading")}</Typography>
              </Stack>
            }
          >
            <Project3DViewer
              model={scene3DResult.model}
              activeLevelId={activeLevelId3D}
              visibility={levelVisibility3D}
              onVisibilityChange={setLevelVisibility3D}
              selection={selection3D}
              onSelectionChange={setSelection3D}
            />
          </Suspense>
        ) : (
          <Alert className="project-workspace__geometry-error" severity="error">
            <Typography component="h2" variant="h3">
              {t("threeD.errors.derivationTitle")}
            </Typography>
            <Typography variant="body2">
              {t("threeD.errors.derivationDetail")}
            </Typography>
          </Alert>
        )
      ) : editBuildFailed ? (
        <Alert className="project-workspace__geometry-error" severity="error">
          <Typography component="h2" variant="h3">
            {t("errors.editGeometry.title")}
          </Typography>
          <Typography variant="body2">
            {t("errors.editGeometry.detail")}
          </Typography>
        </Alert>
      ) : presentationFailed ? (
        <ProjectWorkspaceError error={presentationResult.error} />
      ) : selectedLevel && presentationResult?.ok ? (
        <GeometryViewerPanel
          workspaceCanvas
          title={t("viewer.title")}
          headingId="project-geometry-viewer-heading"
          presentationModel={presentationResult.model}
          architecturalModel={presentationResult.architecturalModel}
          dimensionModel={dimensionModel}
          options={resolvedDisplayOptions}
          viewport={activeViewport}
          selectionState={selectionState}
          onSelectionStateChange={handleSelectionStateChange}
          onViewportChange={setViewport}
          onFitViewport={handleFitViewport}
          onResetViewport={handleResetViewport}
          onZoomViewport={handleZoomViewport}
          documentScaleDenominator={workspaceMode === "edit" ? editor.presentation.scaleDenominator : 75}
          onDocumentScaleChange={workspaceMode === "edit"
            ? (denominator) => dispatch(editorDocumentScaleChanged(denominator))
            : undefined}
          levelMeasurement={activeLevelMeasurement}
          units={activeProject?.units}
          statusLabel={t(
            workspaceMode === "edit"
              ? "workspace.editing"
              : "workspace.readOnly"
          )}
          interaction={
            workspaceMode === "edit"
              ? getProjectEditorInteraction(
                  editor.activeTool,
                  viewportPanModifierActive
                )
              : undefined
          }
          editorOverlay={editorOverlay}
          onEditorCanvasClick={handleEditorCanvasClick}
          onEditorPointerMove={handleEditorPointerMove}
          onWallEndpointPointerDown={handleWallEndpointPointerDown}
          onWallEndpointPointerUp={handleWallEndpointPointerUp}
          onWallEndpointPointerCancel={handleWallEndpointPointerCancel}
          onJunctionPointerDown={handleJunctionPointerDown}
          onOpeningPointerDown={handleOpeningPointerDown}
          onOpeningDragThresholdCrossed={handleOpeningDragThresholdCrossed}
          onOpeningPointerUp={handleOpeningPointerUp}
          onOpeningPointerCancel={handleOpeningPointerCancel}
          onRoomFaceCandidateClick={viewportPanModifierActive
            ? undefined
            : (faceKey) => {
                dispatch(editorSelectionCleared());
                handleCreateRoom(faceKey);
              }}
        />
      ) : (
        <Paper className="geometry-empty-state" role="status" sx={{ p: 2 }}>
          {t("viewer.noLevels")}
        </Paper>
      )}

      {isTablet && inspector ? (
        <Paper
          className="project-workspace__tablet-inspector"
          variant="outlined"
        >
          {inspector}
        </Paper>
      ) : null}

      {isPhone ? (
        <Paper className="mobile-project-overview" variant="outlined">
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <LockOutlineRoundedIcon color="primary" />
            <Box>
              <Typography variant="subtitle2">{t("mobile.title")}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t("mobile.description")}
              </Typography>
            </Box>
          </Stack>
          <Typography variant="body2">{t("mobile.editRestriction")}</Typography>
        </Paper>
      ) : null}
    </Stack>
  );
}
