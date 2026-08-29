import {
  GeometryEngine,
  LevelGeometry,
  calculatePolygonInteriorAnchor,
  measureLevel,
  measureRoom,
  projectPointOntoWall,
  type RoomMeasurement
} from "@casastudio/geometry";
import {
  canCollapseWallJunction,
  collapseWallJunction,
  createLevel,
  createConnectedWall,
  createRoomFromShape,
  classifyLevelRoomTopology,
  deriveRoomShapeVertices,
  dissolveRoom,
  deleteWallAndCollapseRedundantTopology,
  deleteOpening,
  moveOpening,
  moveJunction,
  moveWallEndpoint,
  setWallLength,
  splitWall,
  updateWallProperties,
  updateOpening,
  updateLevelProperties,
  updateRoomProperties,
  validateRoomShapeDefinition,
  convertPhysicalLength,
  formatDisplayValue,
  formatArchitecturalLength,
  ValidationErrorCode,
  type Project,
  type Room,
  type Wall,
  type WallEndpoint,
  type Opening,
  type UpdateOpeningProperties,
  type UpdateRoomProperties,
  type RoomShapeDefinition,
  type RoomShapeRotation
} from "@casastudio/schema";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LinearScaleRoundedIcon from "@mui/icons-material/LinearScaleRounded";
import LockOutlineRoundedIcon from "@mui/icons-material/LockOutlineRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import DoorFrontRoundedIcon from "@mui/icons-material/DoorFrontRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useBlocker, useParams } from "react-router-dom";

import {
  ApiAuthenticationUnavailableError,
  ApiRequestError,
  ProjectReplacementResponseError
} from "../api/CasaStudioApiClient";
import { useCasaStudioApi } from "../api/ApiProvider";
import type { GeometryLevel, GeometrySnapshot } from "../api/api-types";
import { useAppShellContent } from "../app-shell/AppShellContext";
import { createArchitecturalPresentationModel2D } from "../geometry-playground/architectural-presentation-model-2d";
import { createArchitecturalDimensionPresentationModel2D } from "../geometry-playground/architectural-dimension-presentation-model-2d";
import type { GeometryPresentationModel2D } from "../geometry-playground/geometry-presentation-model-2d";
import { createRuntimeGeometryPresentationModel2D } from "../geometry-playground/geometry-presentation-model-2d";
import { GeometryShortcutGuide } from "../geometry-playground/GeometryShortcutGuide";
import { GeometryViewerPanel } from "../geometry-playground/GeometryViewerPanel";
import {
  collectGeometrySnapshotLevelBounds,
  createGeometrySnapshotPresentationModel2D
} from "../geometry-playground/geometry-snapshot-presentation-adapter";
import {
  createGeometrySelectionState,
  selectDoor,
  selectPolygon,
  selectWallOpening,
  selectWindow,
  type GeometrySelectionState
} from "../geometry-playground/geometry-selection-state";
import { collectLevelBounds } from "../geometry-playground/geometry-svg-helpers";
import {
  getGeometryViewerShortcutAction,
  isEditableShortcutTarget
} from "../geometry-playground/geometry-viewer-shortcuts";
import {
  geometrySvgViewport,
  projectGeometryDisplayOptions,
  type GeometryDisplayOptions,
  type GeometryEditorOverlay,
  type SvgViewportPointer
} from "../geometry-playground/GeometrySvgViewer";
import {
  createFitViewportState,
  createViewportTransform2D,
  resetViewportState,
  type ViewportState,
  type WorldPointXZ,
  zoomViewportState
} from "../geometry-playground/viewport-transform-2d";
import { useCasaTranslation } from "../i18n";
import { Project3DInspector } from "../project-3d/Project3DInspector";
import {
  createArchitecturalScene3DModel,
  getVisibleLevelReferences3D,
  type LevelVisibility3D
} from "../project-3d/architectural-scene-3d-model";
import {
  geometryKeys,
  projectGeometryQueryOptions,
  useProjectGeometryQuery
} from "../queries/geometry-queries";
import { useReplaceProjectMutation } from "../queries/project-mutations";
import {
  projectKeys,
  projectQueryOptions,
  useProjectQuery
} from "../queries/project-queries";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import {
  cleanEditingSessionLeft,
  editingDraftReplaced,
  editingSessionEnded,
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
  editorWallVertexPlacementStarted,
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
  type OpeningAuthoringProperties,
  type PlaceOpeningInteraction,
  type ProjectWorkspaceMode
} from "../state/project-editor-slice";
import {
  createLevelIdentifier
} from "../state/project-level-editing";
import {
  getProjectEditorInteraction,
  projectEditorTools,
  type ProjectEditorTool
} from "../state/project-editor-tools";
import {
  createDraftWall,
  createRoomIdentifier,
  createWallIdentifier,
  doesWallCloseCycle,
  findProjectWall,
  getWallEndpointEditingAvailability,
  getIncidentWallIds,
  getWallEditingErrorKey,
  newWallDefaults,
  type WallEditingErrorKey
} from "../state/project-wall-editing";
import {
  resolveDrawWallSnapCandidate,
  resolveGridSnapCandidate,
  resolveProjectPointSnapCandidate
} from "../state/project-wall-snapping";
import {
  commitOpeningPlacementCandidate,
  createOpeningIdentifier,
  findProjectOpening,
  resolveOpeningPlacementCandidate
} from "../state/project-opening-editing";
import {
  geometrySelectionChanged,
  geometrySelectionCleared,
  geometrySelectionReset,
  selectGeometrySelection
} from "../state/viewer-slice";
import {
  ProjectPropertiesDetails,
  ProjectSelectionDetails
} from "./ProjectSelectionDetails";
import { ProjectEditorStatusBar } from "./ProjectEditorStatusBar";
import { ProjectLayerControls } from "./ProjectLayerControls";
import {
  collectActionableRoomFaces,
  commitRoomFaceCandidate
} from "./project-room-authoring";
import {
  ProjectPersistenceDialogs,
  type ProjectPersistenceDialog
} from "./ProjectPersistenceDialogs";
import { normalizeEditorMeasurement } from "./editor-measurement";
import {
  ProjectRoomAuthoringMenu,
  type RoomShapeDimensionDraft
} from "./ProjectRoomAuthoringMenu";

const emptySelectionState = createGeometrySelectionState();
/** Lazily loaded Three.js workspace kept out of the default 2D route chunk. */
const Project3DViewer = lazy(() =>
  import("../project-3d/Project3DViewer").then((module) => ({
    default: module.Project3DViewer
  }))
);

/** Independent visual representations available for a Project workspace. */
type ProjectWorkspaceRepresentation = "2d" | "3d";
/** Initial editable Room shape values in canonical centimeter Project units. */
const defaultRoomShapeDimensions: RoomShapeDimensionDraft = Object.freeze({
  width: "400",
  depth: "300",
  notchWidth: "150",
  notchDepth: "120",
  rotation: "0"
});
/** Localized feedback categories for explicit Room authoring actions. */
type RoomEditingErrorKey =
  | "errors.room.none"
  | "errors.room.assigned"
  | "errors.room.subdivision"
  | "errors.room.doorReference"
  | "errors.room.viewpointReference"
  | "errors.room.staircaseReference"
  | "errors.room.stale"
  | "errors.room.geometry"
  | "errors.room.referenced"
  | "errors.room.dissolutionAmbiguous"
  | "errors.room.dissolutionInvalid"
  | "errors.room.metadata"
  | "errors.room.invalid";
type EditingErrorKey = WallEditingErrorKey | RoomEditingErrorKey | "errors.opening.invalid";

/** Renders the authoritative View and local-draft Edit workspace for one Project. */
export function ProjectViewerPage() {
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
    if (!projectResponse) return undefined;
    try {
      return {
        ok: true as const,
        model: createArchitecturalScene3DModel(projectResponse.project)
      };
    } catch (error) {
      return { ok: false as const, error };
    }
  }, [projectResponse]);

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

  const handleDeleteSelectedWall = useCallback(() => {
    if (
      saveInteractionBlocked ||
      workspaceMode !== "edit" ||
      !editor.draft ||
      !editor.activeLevelId ||
      !selectedEditWall
    ) {
      return;
    }

    const result = deleteWallAndCollapseRedundantTopology(editor.draft, {
      levelId: editor.activeLevelId,
      wallId: selectedEditWall.id
    });
    if (result.ok) {
      setEditingError(undefined);
      dispatch(editorTransientInteractionCleared());
      dispatch(editorSelectionCleared());
      dispatch(editingDraftReplaced(result.project));
    } else {
      setEditingError(getWallEditingErrorKey(result));
    }
  }, [
    dispatch,
    editor.activeLevelId,
    editor.draft,
    selectedEditWall,
    saveInteractionBlocked,
    workspaceMode
  ]);

  const handleAddVertexToSelectedWall = useCallback(() => {
    if (!editor.activeLevelId || !selectedEditWall || saveInteractionBlocked) return;
    setEditingError(undefined);
    dispatch(editorWallVertexPlacementStarted({
      levelId: editor.activeLevelId,
      wallId: selectedEditWall.id
    }));
  }, [dispatch, editor.activeLevelId, saveInteractionBlocked, selectedEditWall]);

  const handleRemoveSelectedVertex = useCallback(() => {
    if (
      !editor.draft ||
      !editor.activeLevelId ||
      !selectedEditVertex ||
      !selectedVertexRemovable ||
      saveInteractionBlocked
    ) return;
    const result = collapseWallJunction(editor.draft, {
      levelId: editor.activeLevelId,
      junction: selectedEditVertex.coordinates
    });
    if (!result.ok || result.project === editor.draft) {
      setEditingError("errors.wall.invalid");
      return;
    }
    setEditingError(undefined);
    dispatch(editorSelectionCleared());
    dispatch(editingDraftReplaced(result.project));
  }, [
    dispatch,
    editor.activeLevelId,
    editor.draft,
    saveInteractionBlocked,
    selectedEditVertex,
    selectedVertexRemovable
  ]);

  const handleUpdateSelectedWallProperties = useCallback(
    (properties: {
      readonly length?: number;
      readonly anchoredEndpoint?: "START" | "END";
      readonly height?: number;
      readonly thickness?: number;
    }): boolean => {
      if (
        saveInteractionBlocked ||
        workspaceMode !== "edit" ||
        !editor.draft ||
        !editor.activeLevelId ||
        !selectedEditWall
      ) {
        return false;
      }

      const result = properties.length === undefined
        ? updateWallProperties(editor.draft, {
            levelId: editor.activeLevelId,
            wallId: selectedEditWall.id,
            height: properties.height,
            thickness: properties.thickness
          })
        : setWallLength(editor.draft, {
            levelId: editor.activeLevelId,
            wallId: selectedEditWall.id,
            targetLength: properties.length,
            anchoredEndpoint: properties.anchoredEndpoint ?? "START"
          });
      if (!result.ok) {
        setEditingError(getWallEditingErrorKey(result));
        return false;
      }

      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
      return true;
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.draft,
      selectedEditWall,
      saveInteractionBlocked,
      workspaceMode
    ]
  );

  const handleDeleteSelectedOpening = useCallback(() => {
    if (!editor.draft || !editor.activeLevelId || !selectedEditOpening || saveInteractionBlocked) return;
    const result = deleteOpening(editor.draft, {
      levelId: editor.activeLevelId,
      wallId: selectedEditOpening.wall.id,
      openingId: selectedEditOpening.opening.id
    });
    if (result.ok) {
      setEditingError(undefined);
      dispatch(editorSelectionCleared());
      dispatch(editingDraftReplaced(result.project));
    } else {
      setEditingError("errors.opening.invalid");
    }
  }, [dispatch, editor.activeLevelId, editor.draft, saveInteractionBlocked, selectedEditOpening]);

  const handleUpdateOpeningAuthoring = useCallback(
    (changes: Partial<OpeningAuthoringProperties>) => {
      const interaction = editor.transient.interaction;
      if (interaction?.kind !== "place-opening") return;
      const properties = { ...interaction.properties, ...changes };
      const candidate = interaction.candidate && editor.draft && editor.activeLevelId
        ? resolveOpeningPlacementCandidate(
            editor.draft,
            editor.activeLevelId,
            interaction.candidate.projectedPoint,
            interaction.openingType,
            1e-6,
            properties
          )
        : undefined;
      dispatch(editorOpeningPlacementChanged({
        openingType: interaction.openingType,
        properties,
        candidate
      }));
    },
    [dispatch, editor.activeLevelId, editor.draft, editor.transient.interaction]
  );

  const handleUpdateSelectedOpening = useCallback(
    (properties: UpdateOpeningProperties): boolean => {
      if (!editor.draft || !editor.activeLevelId || !selectedEditOpening || saveInteractionBlocked) return false;
      const result = updateOpening(editor.draft, {
        levelId: editor.activeLevelId,
        wallId: selectedEditOpening.wall.id,
        openingId: selectedEditOpening.opening.id,
        ...properties
      });
      if (!result.ok) {
        setEditingError("errors.opening.invalid");
        return false;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
      return true;
    },
    [dispatch, editor.activeLevelId, editor.draft, saveInteractionBlocked, selectedEditOpening]
  );

  const handleDeleteSelectedRoom = useCallback(() => {
    if (!editor.draft || !editor.activeLevelId || !selectedRoom || saveInteractionBlocked) return;
    const result = dissolveRoom(editor.draft, {
      levelId: editor.activeLevelId,
      roomId: selectedRoom.id
    });
    if (result.ok) {
      setEditingError(undefined);
      dispatch(editorSelectionCleared());
      dispatch(editingDraftReplaced(result.project));
    } else {
      setEditingError(
        result.errors[0]?.code === ValidationErrorCode.ROOM_DISSOLUTION_AMBIGUOUS
          ? "errors.room.dissolutionAmbiguous"
          : result.errors[0]?.code === ValidationErrorCode.INVALID_ROOM_DISSOLUTION
            ? "errors.room.dissolutionInvalid"
            : "errors.room.invalid"
      );
    }
  }, [dispatch, editor.activeLevelId, editor.draft, saveInteractionBlocked, selectedRoom]);

  const handleUpdateSelectedRoomProperties = useCallback(
    (properties: Partial<UpdateRoomProperties>): boolean => {
      if (!editor.draft || !editor.activeLevelId || !selectedRoom || saveInteractionBlocked) return false;
      const result = updateRoomProperties(editor.draft, {
        levelId: editor.activeLevelId,
        roomId: selectedRoom.id,
        ...properties
      });
      if (!result.ok) {
        setEditingError("errors.room.metadata");
        return false;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
      return true;
    },
    [dispatch, editor.activeLevelId, editor.draft, saveInteractionBlocked, selectedRoom]
  );

  const handleCreateLevel = useCallback((properties: {
    readonly name: string;
    readonly elevation: number;
  }): boolean => {
    if (!editor.draft || workspaceMode !== "edit" || saveInteractionBlocked) return false;
    const levelId = createLevelIdentifier();
    const result = createLevel(editor.draft, { id: levelId, ...properties });
    if (!result.ok) return false;
    dispatch(editingDraftReplaced(result.project));
    dispatch(editorActiveLevelChanged(levelId));
    return true;
  }, [dispatch, editor.draft, saveInteractionBlocked, workspaceMode]);

  const handleUpdateActiveLevel = useCallback((properties: {
    readonly name: string;
    readonly elevation: number;
  }): boolean => {
    if (
      !editor.draft ||
      !editor.activeLevelId ||
      workspaceMode !== "edit" ||
      saveInteractionBlocked
    ) return false;
    const result = updateLevelProperties(editor.draft, {
      levelId: editor.activeLevelId,
      ...properties
    });
    if (!result.ok) return false;
    dispatch(editingDraftReplaced(result.project));
    return true;
  }, [dispatch, editor.activeLevelId, editor.draft, saveInteractionBlocked, workspaceMode]);

  const handleCreateRoom = useCallback((faceKey: string) => {
    if (
      saveInteractionBlocked ||
      workspaceMode !== "edit" ||
      editor.activeTool !== "room" ||
      !editor.draft ||
      !editor.activeLevelId
    ) return;
    const commit = commitRoomFaceCandidate(
      editor.draft,
      editor.activeLevelId,
      faceKey,
      createRoomIdentifier
    );
    if (!commit) {
      setEditingError("errors.room.none");
      return;
    }
    if (commit.result.ok) {
      setEditingError(undefined);
      dispatch(editorSelectionCleared());
      dispatch(editingDraftReplaced(commit.result.project));
    } else {
      setEditingError(getRoomEditingErrorKey(commit.result.errors[0]?.code));
    }
  }, [
    dispatch,
    editor.activeLevelId,
    editor.activeTool,
    editor.draft,
    saveInteractionBlocked,
    workspaceMode
  ]);

  useEffect(() => {
    if (!selectedLevel) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (workspaceRepresentation !== "2d") return;
      if (shortcutsOpen || saveInteractionBlocked) return;
      const target = event.target as HTMLElement | null;
      if (
        typeof target?.closest === "function" &&
        target.closest('[role="dialog"]')
      ) return;
      const isTextInput = isEditableShortcutTarget(target);
      const modifier = event.metaKey || event.ctrlKey;
      if (workspaceMode === "edit" && modifier && !isTextInput) {
        const key = event.key.toLowerCase();
        if (key === "z") {
          event.preventDefault();
          dispatch(event.shiftKey ? editorRedoRequested() : editorUndoRequested());
          return;
        }
        if (key === "y") {
          event.preventDefault();
          dispatch(editorRedoRequested());
          return;
        }
      }
      if (workspaceMode === "edit" && !modifier && !isTextInput) {
        const tool = event.key.toLowerCase() === "d"
          ? "door"
          : event.key.toLowerCase() === "n"
            ? "window"
            : event.key.toLowerCase() === "m"
              ? "measure"
            : event.key.toLowerCase() === "w"
              ? "draw-wall"
              : event.key.toLowerCase() === "v"
                ? "select"
                : undefined;
        if (tool) {
          event.preventDefault();
          dispatch(editorActiveToolChanged(tool));
          return;
        }
      }
      const action = getGeometryViewerShortcutAction(event);
      if (!action) return;
      if (
        action === "DELETE_SELECTION" &&
        workspaceMode === "edit" &&
        selectedEditOpening
      ) {
        event.preventDefault();
        handleDeleteSelectedOpening();
        return;
      }
      if (
        action === "DELETE_SELECTION" &&
        workspaceMode === "edit" &&
        selectedRoom
      ) {
        event.preventDefault();
        handleDeleteSelectedRoom();
        return;
      }
      if (
        action === "DELETE_SELECTION" &&
        workspaceMode === "edit" &&
        selectedEditWall
      ) {
        event.preventDefault();
        handleDeleteSelectedWall();
        return;
      }
      if (action === "DELETE_SELECTION") return;
      event.preventDefault();
      if (action === "CLEAR_SELECTION") {
        if (
          workspaceMode === "edit" &&
          (editor.transient.interaction !== null ||
            editor.transient.snapCandidate !== undefined)
        ) {
          dispatch(editorTransientInteractionCleared());
          setRoomMenuAnchor(null);
          setRoomDetectionActive(false);
        } else {
          dispatch(
            workspaceMode === "edit"
              ? editorSelectionCleared()
              : geometrySelectionCleared()
          );
        }
      } else if (action === "FIT_VIEWPORT") {
        handleFitViewport();
      } else {
        handleResetViewport();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    dispatch,
    handleFitViewport,
    handleDeleteSelectedWall,
    handleDeleteSelectedOpening,
    handleDeleteSelectedRoom,
    handleResetViewport,
    editor.transient.interaction,
    editor.transient.snapCandidate,
    selectedLevel,
    selectedEditWall,
    selectedEditOpening,
    selectedRoom,
    saveInteractionBlocked,
    shortcutsOpen,
    workspaceMode,
    workspaceRepresentation
  ]);

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
  }, [saveInteractionBlocked, workspaceMode, workspaceRepresentation]);

  const refreshAuthoritativeState = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
        exact: true,
        refetchType: "none"
      }),
      queryClient.invalidateQueries({
        queryKey: geometryKeys.detail(projectId),
        exact: true,
        refetchType: "none"
      })
    ]);

    const refreshResults = await Promise.allSettled([
      queryClient.fetchQuery(projectQueryOptions(api, projectId)),
      queryClient.fetchQuery(projectGeometryQueryOptions(api, projectId))
    ]);
    const failedRefresh = refreshResults.find(
      (result) => result.status === "rejected"
    );
    if (failedRefresh?.status === "rejected") {
      throw failedRefresh.reason;
    }
    const [projectResult, geometryResult] = refreshResults;
    if (
      projectResult?.status !== "fulfilled" ||
      geometryResult?.status !== "fulfilled"
    ) {
      throw new Error("Authoritative refresh completed without both resources.");
    }
    const nextProject = projectResult.value;
    const nextGeometry = geometryResult.value;
    if (getConsistencyFailure(nextProject, nextGeometry)) {
      throw new Error(
        "Authoritative Project and Geometry responses are not coherent."
      );
    }
  }, [api, projectId, queryClient]);

  const finishAuthoritativeTransition = useCallback(
    async (kind: "save" | "reload-latest", resumeNavigation: boolean) => {
      dispatch(editingSessionEnded(projectId));
      dispatch(geometrySelectionReset());
      setPersistenceDialog("none");
      setRefreshingAuthoritativeState(true);

      try {
        await refreshAuthoritativeState();
        setRefreshFailure(undefined);
        if (resumeNavigation && blocker.state === "blocked") {
          blocker.proceed();
        }
      } catch {
        setRefreshFailure(kind);
      } finally {
        setRefreshingAuthoritativeState(false);
      }
    },
    [blocker, dispatch, projectId, refreshAuthoritativeState]
  );

  const handleSave = useCallback(async () => {
    if (
      saveInteractionBlocked ||
      workspaceMode !== "edit" ||
      !editor.dirty ||
      !editor.draft ||
      editor.baseRevision === null
    ) {
      return;
    }

    const input = {
      projectId,
      baseRevision: editor.baseRevision,
      project: structuredClone(editor.draft)
    };
    const resumeNavigation = blocker.state === "blocked";
    setPersistenceDialog("none");
    setSaveFeedback(undefined);

    try {
      await replaceProjectMutation.mutateAsync(input);
    } catch (error) {
      if (error instanceof ProjectReplacementResponseError) {
        await finishAuthoritativeTransition("save", resumeNavigation);
        return;
      }

      if (resumeNavigation && blocker.state === "blocked") {
        blocker.reset();
      }
      if (isProjectRevisionConflict(error)) {
        setPersistenceDialog("conflict");
      } else {
        setSaveFeedback(classifySaveFeedback(error));
      }
      return;
    }

    await finishAuthoritativeTransition("save", resumeNavigation);
  }, [
    blocker,
    editor.baseRevision,
    editor.dirty,
    editor.draft,
    finishAuthoritativeTransition,
    projectId,
    replaceProjectMutation,
    saveInteractionBlocked,
    workspaceMode
  ]);

  const handleKeepEditing = useCallback(() => {
    if (blocker.state === "blocked") {
      blocker.reset();
    }
    setPersistenceDialog("none");
  }, [blocker]);

  const handleConfirmDiscard = useCallback(() => {
    const resumeNavigation = blocker.state === "blocked";
    dispatch(editingSessionEnded(projectId));
    dispatch(geometrySelectionReset());
    setPersistenceDialog("none");
    if (resumeNavigation) {
      blocker.proceed();
    }
  }, [blocker, dispatch, projectId]);

  const handleConfirmReloadLatest = useCallback(async () => {
    await finishAuthoritativeTransition("reload-latest", false);
  }, [finishAuthoritativeTransition]);

  const handleRetryAuthoritativeRefresh = useCallback(async () => {
    const failedTransition = refreshFailure;
    if (!failedTransition || refreshingAuthoritativeState) return;
    setRefreshingAuthoritativeState(true);
    try {
      await refreshAuthoritativeState();
      setRefreshFailure(undefined);
      if (failedTransition === "save" && blocker.state === "blocked") {
        blocker.proceed();
      }
    } catch {
      setRefreshFailure(failedTransition);
    } finally {
      setRefreshingAuthoritativeState(false);
    }
  }, [
    blocker,
    refreshAuthoritativeState,
    refreshFailure,
    refreshingAuthoritativeState
  ]);

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
    activeLevelId3D
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
    return <ProjectViewerError error={failure} />;
  }
  if (!projectResponse || !geometryResponse) {
    return (
      <ProjectViewerError error={new Error("Query completed without data.")} />
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
        <ProjectEditorToolbar
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
        <ProjectViewerError error={presentationResult.error} />
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

type WorkspaceModeControlProps = {
  readonly mode: ProjectWorkspaceMode;
  readonly disabled: boolean;
  readonly editDisabled: boolean;
  readonly onChange: (mode: ProjectWorkspaceMode | null) => void;
};

/** Renders the View/Edit control independently from future representation choices. */
function WorkspaceModeControl({
  mode,
  disabled,
  editDisabled,
  onChange
}: WorkspaceModeControlProps) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={mode}
      disabled={disabled}
      onChange={(_event, value: ProjectWorkspaceMode | null) => onChange(value)}
      aria-label={t("workspace.modeLabel")}
      className="project-workspace__mode-control"
    >
      <ToggleButton value="view" aria-label={t("workspace.view")}>
        <VisibilityOutlinedIcon fontSize="small" />
        {t("workspace.view")}
      </ToggleButton>
      <ToggleButton
        value="edit"
        disabled={editDisabled}
        aria-label={t("workspace.edit")}
      >
        <EditRoundedIcon fontSize="small" />
        {t("workspace.edit")}
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

/** Inputs for the independent 2D/3D representation control. */
type WorkspaceRepresentationControlProps = {
  readonly representation: ProjectWorkspaceRepresentation;
  readonly disabled: boolean;
  readonly threeDDisabled: boolean;
  readonly onChange: (
    representation: ProjectWorkspaceRepresentation | null
  ) => void;
};

/** Renders the Project representation choice independently from View/Edit state. */
function WorkspaceRepresentationControl({
  representation,
  disabled,
  threeDDisabled,
  onChange
}: WorkspaceRepresentationControlProps) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={representation}
      disabled={disabled}
      onChange={(_event, value: ProjectWorkspaceRepresentation | null) =>
        onChange(value)
      }
      aria-label={t("representation.label")}
      className="project-workspace__representation-control"
    >
      <ToggleButton value="2d" aria-label={t("representation.twoD")}>
        2D
      </ToggleButton>
      <ToggleButton
        value="3d"
        disabled={threeDDisabled}
        aria-label={t("representation.threeD")}
      >
        3D
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

/** Header actions associated with local editing history and persistence. */
type ProjectHeaderActionsProps = {
  readonly mode: ProjectWorkspaceMode;
  readonly dirty: boolean;
  readonly disabled: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly shortcutsOpen: boolean;
  readonly onOpenShortcuts: () => void;
  readonly onCloseShortcuts: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onDiscard: () => void;
  readonly onSave: () => void;
};

/** Renders history, dirty state, and transactional actions in the Project header. */
function ProjectHeaderActions({
  mode,
  dirty,
  disabled,
  canUndo,
  canRedo,
  shortcutsOpen,
  onOpenShortcuts,
  onCloseShortcuts,
  onUndo,
  onRedo,
  onDiscard,
  onSave
}: ProjectHeaderActionsProps) {
  const { t } = useCasaTranslation("project-viewer");

  if (mode === "view") {
    return (
      <Chip
        className="project-header-status"
        icon={<CheckCircleRoundedIcon />}
        color="success"
        variant="outlined"
        label={t("workspace.saved")}
      />
    );
  }

  return (
    <Stack direction="row" className="project-header-actions">
      <Box className="project-header-actions__history" role="group" aria-label={t("header.history")}>
        <Tooltip title={t("tools.undo")}>
          <span>
            <IconButton size="small" aria-label={t("tools.undo")} disabled={disabled || !canUndo} onClick={onUndo}>
              <UndoRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("tools.redo")}>
          <span>
            <IconButton size="small" aria-label={t("tools.redo")} disabled={disabled || !canRedo} onClick={onRedo}>
              <RedoRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <ShortcutsHelpControl
        open={shortcutsOpen}
        onOpen={onOpenShortcuts}
        onClose={onCloseShortcuts}
      />
      <Chip
        className="project-header-status"
        icon={<EditRoundedIcon />}
        color={dirty ? "warning" : "default"}
        variant="outlined"
        label={t(dirty ? "workspace.unsaved" : "workspace.clean")}
      />
      {dirty ? (
        <Button color="inherit" disabled={disabled} onClick={onDiscard}>
          {t("persistence.discardAction")}
        </Button>
      ) : null}
      <Button variant="contained" disabled={!dirty || disabled} onClick={onSave}>
        {t("persistence.save")}
      </Button>
    </Stack>
  );
}

type ProjectEditorToolbarProps = {
  readonly activeTool: ProjectEditorTool | null;
  readonly disabled: boolean;
  readonly onToolChange: (tool: ProjectEditorTool | null) => void;
  readonly roomMenuOpen: boolean;
  readonly onRoomToggle: (anchor: HTMLElement) => void;
};

/** Renders the mutually exclusive architectural authoring tools. */
function ProjectEditorToolbar({
  activeTool,
  disabled,
  onToolChange,
  roomMenuOpen,
  onRoomToggle
}: ProjectEditorToolbarProps) {
  const { t } = useCasaTranslation("project-viewer");
  const icons = {
    select: <NearMeRoundedIcon fontSize="small" />,
    "draw-wall": <LinearScaleRoundedIcon fontSize="small" />,
    door: <DoorFrontRoundedIcon fontSize="small" />,
    window: <WindowRoundedIcon fontSize="small" />,
    opening: <DoorFrontRoundedIcon fontSize="small" />,
    room: <MeetingRoomRoundedIcon fontSize="small" />,
    measure: <StraightenRoundedIcon fontSize="small" />
  } satisfies Record<ProjectEditorTool, ReactNode>;

  return (
    <Box
      className="project-editor-toolbar"
      role="toolbar"
      aria-label={t("tools.label")}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={activeTool}
        onChange={(event, value: ProjectEditorTool | null) => {
          const button = (event.target as HTMLElement).closest("button");
          if (button?.getAttribute("value") === "room") {
            onRoomToggle(button);
            return;
          }
          onToolChange(value);
        }}
      >
        {projectEditorTools.map((tool) => {
          const label = t(`tools.${tool.id}`);
          const tooltip = t(`tools.help.${tool.id}`);
          const button = (
            <ToggleButton
              value={tool.id}
              disabled={disabled || !tool.enabled}
              selected={activeTool === tool.id}
              aria-label={
                tool.enabled ? label : t("tools.comingSoon", { tool: label })
              }
              aria-haspopup={tool.id === "room" ? "menu" : undefined}
              aria-expanded={tool.id === "room" ? roomMenuOpen : undefined}
              aria-controls={tool.id === "room" && roomMenuOpen
                ? "room-authoring-menu"
                : undefined}
            >
              {icons[tool.id]}
              <span>{label}</span>
            </ToggleButton>
          );

          return tool.enabled ? (
            <Tooltip key={tool.id} title={tooltip} describeChild>
              {button}
            </Tooltip>
          ) : (
            <Tooltip key={tool.id} title={tooltip}>
              <span>{button}</span>
            </Tooltip>
          );
        })}
      </ToggleButtonGroup>

    </Box>
  );
}

type ShortcutsHelpControlProps = {
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
};

function ShortcutsHelpControl({
  open,
  onOpen,
  onClose
}: ShortcutsHelpControlProps) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <>
      <Tooltip title={t("shortcuts.title")}>
        <IconButton
          aria-label={t("shortcuts.title")}
          onClick={onOpen}
          size="small"
        >
          <KeyboardRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog
        open={open}
        onClose={onClose}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
          }
        }}
        aria-labelledby="project-shortcuts-dialog-title"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="project-shortcuts-dialog-title">
          {t("shortcuts.title")}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {t("shortcuts.description")}
            </Typography>
            <GeometryShortcutGuide showTitle={false} includeEditingShortcuts />
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}

type ProjectLevelControlProps = {
  readonly mode: ProjectWorkspaceMode;
  readonly viewLevels: readonly GeometryLevel[];
  readonly selectedViewLevel?: GeometryLevel;
  readonly draftLevelIds: readonly {
    readonly id: string;
    readonly name: string;
    readonly elevation: number;
  }[];
  readonly projectLevelNames: readonly { readonly id: string; readonly name: string }[];
  readonly activeEditLevelId: string | null;
  readonly onViewLevelChange: (levelId: string) => void;
  readonly onEditLevelChange: (levelId: string) => void;
  readonly onCreateLevel: (properties: { readonly name: string; readonly elevation: number }) => boolean;
  readonly onUpdateActiveLevel: (properties: { readonly name: string; readonly elevation: number }) => boolean;
};

function ProjectLevelControl({
  mode,
  viewLevels,
  selectedViewLevel,
  draftLevelIds,
  projectLevelNames,
  activeEditLevelId,
  onViewLevelChange,
  onEditLevelChange,
  onCreateLevel,
  onUpdateActiveLevel
}: ProjectLevelControlProps) {
  const { t } = useCasaTranslation("project-viewer");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [name, setName] = useState("");
  const [elevation, setElevation] = useState("");
  const [invalid, setInvalid] = useState(false);
  const levels =
    mode === "edit"
      ? draftLevelIds
      : viewLevels.map((level) => ({
          id: level.id,
          name: projectLevelNames.find((candidate) => candidate.id === level.sourceLevelId)?.name ??
            level.sourceLevelId,
          elevation: level.elevation
        }));
  const value =
    mode === "edit" ? (activeEditLevelId ?? "") : (selectedViewLevel?.id ?? "");
  const activeDraftLevel = draftLevelIds.find((level) => level.id === activeEditLevelId);

  const openDialog = (nextMode: "create" | "edit") => {
    setDialogMode(nextMode);
    setInvalid(false);
    if (nextMode === "edit" && activeDraftLevel) {
      setName(activeDraftLevel.name);
      setElevation(String(activeDraftLevel.elevation));
      return;
    }
    setName("");
    const highestElevation = draftLevelIds.reduce(
      (highest, level) => Math.max(highest, level.elevation),
      0
    );
    setElevation(String(highestElevation + 300));
  };

  const submit = () => {
    const parsedElevation = Number(elevation);
    const properties = { name: name.trim(), elevation: parsedElevation };
    if (!properties.name || !Number.isFinite(parsedElevation)) {
      setInvalid(true);
      return;
    }
    const accepted = dialogMode === "create"
      ? onCreateLevel(properties)
      : onUpdateActiveLevel(properties);
    setInvalid(!accepted);
    if (accepted) setDialogMode(null);
  };

  if (!value) return null;

  return (
    <>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        {levels.length <= 1 ? (
          <Chip label={levels[0]?.name ?? value} variant="outlined" />
        ) : (
          <FormControl size="small" className="project-level-selector" sx={{ minWidth: 136 }}>
            <InputLabel id="project-geometry-level-selector-label">
              {t("levelSelector.label")}
            </InputLabel>
            <Select
              labelId="project-geometry-level-selector-label"
              label={t("levelSelector.label")}
              value={value}
              onChange={(event) =>
                mode === "edit"
                  ? onEditLevelChange(event.target.value)
                  : onViewLevelChange(event.target.value)
              }
            >
              {levels.map((level) => (
                <MenuItem key={level.id} value={level.id}>
                  {level.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {mode === "edit" ? (
          <>
            <Tooltip title={t("levelSelector.edit")}>
              <IconButton size="small" aria-label={t("levelSelector.edit")} onClick={() => openDialog("edit")}>
                <SettingsRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("levelSelector.create")}>
              <IconButton size="small" aria-label={t("levelSelector.create")} onClick={() => openDialog("create")}>
                <AddRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : null}
      </Stack>
      <Dialog open={dialogMode !== null} onClose={() => setDialogMode(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {t(dialogMode === "create" ? "levelSelector.createTitle" : "levelSelector.editTitle")}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              autoFocus
              label={t("levelSelector.name")}
              value={name}
              onChange={(event) => { setName(event.target.value); setInvalid(false); }}
              error={invalid && !name.trim()}
              fullWidth
            />
            <TextField
              label={t("levelSelector.elevation", { unit: "cm" })}
              type="number"
              value={elevation}
              onChange={(event) => { setElevation(event.target.value); setInvalid(false); }}
              error={invalid && !Number.isFinite(Number(elevation))}
              slotProps={{ htmlInput: { step: "any" } }}
              fullWidth
            />
            {invalid ? <Alert severity="error">{t("levelSelector.invalid")}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogMode(null)}>{t("levelSelector.cancel")}</Button>
          <Button variant="contained" onClick={submit}>
            {t(dialogMode === "create" ? "levelSelector.createAction" : "levelSelector.saveAction")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

type ProjectWorkspaceInspectorProps = {
  readonly model: GeometryPresentationModel2D;
  readonly selectionState: GeometrySelectionState;
  readonly options: GeometryDisplayOptions;
  readonly onOptionsChange: (options: GeometryDisplayOptions) => void;
  readonly mode: ProjectWorkspaceMode;
  readonly selectedWall?: Wall;
  readonly selectedOpening?: { readonly wall: Wall; readonly opening: Opening };
  readonly selectedRoom?: Room;
  readonly selectedRoomMeasurement?: RoomMeasurement;
  readonly levelMeasurement?: ReturnType<typeof measureLevel>;
  /** Transient Wall-local Opening offset used only for Inspector display. */
  readonly selectedOpeningDisplayOffset?: number;
  readonly openingAuthoring?: PlaceOpeningInteraction;
  readonly endpointAvailability?: ReturnType<
    typeof getWallEndpointEditingAvailability
  >;
  readonly selectedVertexRemovable: boolean;
  readonly units?: Project["units"];
  readonly onDeleteWall: () => void;
  readonly onAddWallVertex: () => void;
  readonly onRemoveVertex: () => void;
  readonly onUpdateWallProperties: (properties: {
    readonly length?: number;
    readonly anchoredEndpoint?: "START" | "END";
    readonly height?: number;
    readonly thickness?: number;
  }) => boolean;
  readonly onDeleteOpening: () => void;
  readonly onUpdateOpening: (properties: UpdateOpeningProperties) => boolean;
  readonly onUpdateOpeningAuthoring: (
    properties: Partial<OpeningAuthoringProperties>
  ) => void;
  readonly onDeleteRoom: () => void;
  readonly onUpdateRoomProperties: (properties: Partial<UpdateRoomProperties>) => boolean;
};

/** Provides the durable Layers, Selection, and Properties inspector foundation. */
function ProjectWorkspaceInspector({
  model,
  selectionState,
  options,
  onOptionsChange,
  mode,
  selectedWall,
  selectedOpening,
  selectedRoom,
  selectedRoomMeasurement,
  levelMeasurement,
  selectedOpeningDisplayOffset,
  openingAuthoring,
  endpointAvailability,
  selectedVertexRemovable,
  units,
  onDeleteWall,
  onAddWallVertex,
  onRemoveVertex,
  onUpdateWallProperties,
  onDeleteOpening,
  onUpdateOpening,
  onUpdateOpeningAuthoring,
  onDeleteRoom,
  onUpdateRoomProperties
}: ProjectWorkspaceInspectorProps) {
  const { t } = useCasaTranslation("project-viewer");
  const [tab, setTab] = useState<"layers" | "selection" | "properties">(
    "layers"
  );

  return (
    <Box className="project-inspector">
      <Tabs
        value={tab}
        onChange={(_event, value) => setTab(value)}
        variant="fullWidth"
        aria-label={t("inspector.tabsLabel")}
      >
        <Tab value="layers" label={t("inspector.layers")} />
        <Tab value="selection" label={t("inspector.selection")} />
        <Tab value="properties" label={t("inspector.properties")} />
      </Tabs>
      <Box className="project-inspector__content" role="tabpanel">
        {tab === "layers" ? (
          <ProjectLayerControls
            options={options}
            onOptionsChange={onOptionsChange}
            measurement={levelMeasurement}
            units={units}
          />
        ) : tab === "selection" ? (
          units ? (
            <ProjectSelectionDetails
              model={model}
              selectionState={selectionState}
              wall={selectedWall}
              opening={selectedOpening?.opening}
              openingWall={selectedOpening?.wall}
              openingDisplayOffsetFromStart={selectedOpeningDisplayOffset}
              room={selectedRoom}
              roomMeasurement={selectedRoomMeasurement}
              units={units}
              endpointAvailability={endpointAvailability}
              selectedVertexRemovable={selectedVertexRemovable}
              onDeleteWall={onDeleteWall}
              onAddWallVertex={onAddWallVertex}
              onRemoveVertex={onRemoveVertex}
              onDeleteOpening={onDeleteOpening}
              onUpdateOpening={onUpdateOpening}
              onDeleteRoom={onDeleteRoom}
              editable={mode === "edit"}
            />
          ) : null
        ) : (
          units && mode === "edit" ? (
            <ProjectPropertiesDetails
              selectionState={selectionState}
              wall={selectedWall}
              opening={selectedOpening?.opening}
              openingWall={selectedOpening?.wall}
              openingDisplayOffsetFromStart={selectedOpeningDisplayOffset}
              room={selectedRoom}
              units={units}
              onUpdateWallProperties={onUpdateWallProperties}
              onUpdateOpening={onUpdateOpening}
              openingAuthoring={openingAuthoring}
              onUpdateOpeningAuthoring={onUpdateOpeningAuthoring}
              onUpdateRoomProperties={onUpdateRoomProperties}
            />
          ) : (
            <Typography variant="caption" color="text.secondary">
              {t("properties.editModeOnly")}
            </Typography>
          )
        )}
      </Box>
    </Box>
  );
}

type ConsistencyFailure = "project-id" | "revision";
type SaveFeedback = "validation" | "forbidden" | "client" | "failure";

function isProjectRevisionConflict(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    error.status === 409 &&
    error.problem?.code === "PROJECT_REVISION_CONFLICT"
  );
}

function classifySaveFeedback(error: unknown): SaveFeedback {
  if (
    error instanceof ApiRequestError &&
    (error.status === 422 || error.problem?.code === "PROJECT_STATE_INVALID")
  ) {
    return "validation";
  }
  if (
    error instanceof ApiAuthenticationUnavailableError ||
    (error instanceof ApiRequestError &&
      (error.status === 401 || error.status === 403))
  ) {
    return "forbidden";
  }
  if (
    error instanceof ApiRequestError &&
    error.status !== undefined &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return "client";
  }
  return "failure";
}

function getConsistencyFailure(
  projectResponse: ReturnType<typeof useProjectQuery>["data"],
  geometryResponse: ReturnType<typeof useProjectGeometryQuery>["data"]
): ConsistencyFailure | undefined {
  if (!projectResponse || !geometryResponse) return undefined;
  if (projectResponse.project.id !== geometryResponse.sourceProjectId)
    return "project-id";
  return projectResponse.sourceRevision !== geometryResponse.sourceRevision
    ? "revision"
    : undefined;
}

type ProjectConsistencyErrorProps = {
  readonly kind: ConsistencyFailure;
  readonly projectId: string;
  readonly projectRevision: number;
  readonly geometryProjectId: string;
  readonly geometryRevision: number;
};

function ProjectConsistencyError({
  kind,
  projectId,
  projectRevision,
  geometryProjectId,
  geometryRevision
}: ProjectConsistencyErrorProps) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <Alert severity="error">
      <Typography component="h1" variant="h2">
        {t("consistency.title")}
      </Typography>
      <Typography variant="body2">{t(`consistency.${kind}.detail`)}</Typography>
      <Typography variant="caption" component="p">
        {t("consistency.diagnostic", {
          projectId,
          projectRevision,
          geometryProjectId,
          geometryRevision
        })}
      </Typography>
    </Alert>
  );
}

type ProjectAuthoritativeRefreshErrorProps = {
  readonly kind: "save" | "reload-latest";
  readonly retrying: boolean;
  readonly onRetry: () => void;
};

function ProjectAuthoritativeRefreshError({
  kind,
  retrying,
  onRetry
}: ProjectAuthoritativeRefreshErrorProps) {
  const { t } = useCasaTranslation("project-viewer");
  const saved = kind === "save";

  return (
    <Alert
      severity="error"
      action={
        <Button disabled={retrying} onClick={onRetry}>
          {t(
            retrying
              ? "persistence.refresh.retrying"
              : "persistence.refresh.retry"
          )}
        </Button>
      }
    >
      <Typography component="h1" variant="h2">
        {t(
          saved
            ? "persistence.refresh.savedTitle"
            : "persistence.refresh.latestTitle"
        )}
      </Typography>
      <Typography variant="body2">
        {t(
          saved
            ? "persistence.refresh.savedDetail"
            : "persistence.refresh.latestDetail"
        )}
      </Typography>
    </Alert>
  );
}

function ProjectViewerError({ error }: { readonly error: unknown }) {
  const { t } = useCasaTranslation("project-viewer");
  const presentation = describeError(error, t);

  return (
    <Alert severity="error">
      <Typography component="h1" variant="h2">
        {presentation.title}
      </Typography>
      <Typography variant="body2">{presentation.detail}</Typography>
      {presentation.requestId ? (
        <Typography variant="caption">
          {t("errors.requestId", { requestId: presentation.requestId })}
        </Typography>
      ) : null}
    </Alert>
  );
}

type ErrorTranslator = (
  key: string,
  options?: Record<string, unknown>
) => string;

/** Returns sensible editable defaults expressed in canonical Project units. */
function getDefaultRoomShapeDimensions(
  kind: "RECTANGLE" | "L_SHAPE"
): RoomShapeDimensionDraft {
  return kind === "RECTANGLE"
    ? { ...defaultRoomShapeDimensions }
    : {
        width: "500",
        depth: "400",
        notchWidth: "200",
        notchDepth: "150",
        rotation: "0"
      };
}

/** Parses locally editable fields into one validated authoring-only shape. */
function parseRoomShapeDefinition(
  kind: "RECTANGLE" | "L_SHAPE",
  draft: RoomShapeDimensionDraft
): RoomShapeDefinition | undefined {
  const shape: RoomShapeDefinition = kind === "RECTANGLE"
    ? {
        kind,
        dimensions: { width: Number(draft.width), depth: Number(draft.depth) },
        rotation: Number(draft.rotation) as RoomShapeRotation
      }
    : {
        kind,
        dimensions: {
          width: Number(draft.width),
          depth: Number(draft.depth),
          notchWidth: Number(draft.notchWidth),
          notchDepth: Number(draft.notchDepth)
        },
        rotation: Number(draft.rotation) as RoomShapeRotation
      };
  return validateRoomShapeDefinition(shape) ? shape : undefined;
}

/** Formats compact physical dimensions for the transient Room preview. */
function formatRoomShapePreviewLabel(
  shape: RoomShapeDefinition,
  unit: Project["units"]["length"]
): string {
  const format = (value: number) => formatDisplayValue(
    convertPhysicalLength(value, unit, "m"),
    2,
    true
  );
  const outer = `${format(shape.dimensions.width)} × ${format(shape.dimensions.depth)} m`;
  return shape.kind === "RECTANGLE"
    ? outer
    : `L ${outer} · ${format(shape.dimensions.notchWidth)} × ${format(shape.dimensions.notchDepth)} m`;
}

/** Maps Room-authoring validation codes to localized presentation messages. */
function getRoomEditingErrorKey(
  code: ValidationErrorCode | undefined
): RoomEditingErrorKey {
  switch (code) {
    case ValidationErrorCode.DUPLICATE_ROOM_BOUNDARY:
      return "errors.room.assigned";
    case ValidationErrorCode.ROOM_SUBDIVISION_NOT_FOUND:
    case ValidationErrorCode.INVALID_ROOM_SUBDIVISION_INPUT:
      return "errors.room.subdivision";
    case ValidationErrorCode.ROOM_PARTITION_OPENING_AMBIGUOUS:
      return "errors.room.doorReference";
    case ValidationErrorCode.ROOM_SUBDIVISION_DOOR_REFERENCE_AMBIGUOUS:
      return "errors.room.doorReference";
    case ValidationErrorCode.ROOM_SUBDIVISION_VIEWPOINT_REFERENCE_AMBIGUOUS:
      return "errors.room.viewpointReference";
    case ValidationErrorCode.ROOM_SUBDIVISION_STAIRCASE_REFERENCE_AMBIGUOUS:
      return "errors.room.staircaseReference";
    case ValidationErrorCode.STALE_ROOM_TOPOLOGY:
      return "errors.room.stale";
    case ValidationErrorCode.INVALID_ROOM_BOUNDARY:
    case ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED:
    case ValidationErrorCode.SELF_INTERSECTING_ROOM_BOUNDARY:
      return "errors.room.geometry";
    default:
      return "errors.room.invalid";
  }
}

function describeError(error: unknown, t: ErrorTranslator) {
  if (error instanceof ApiAuthenticationUnavailableError) {
    return {
      title: t("errors.authentication.title"),
      detail: t("errors.authentication.detail")
    };
  }
  if (error instanceof ApiRequestError && error.status === 403) {
    return {
      title: t("errors.forbidden.title"),
      detail: t("errors.forbidden.detail"),
      requestId: error.problem?.requestId
    };
  }
  if (error instanceof ApiRequestError && error.status === 404) {
    return {
      title: t("errors.notFound.title"),
      detail: t("errors.notFound.detail"),
      requestId: error.problem?.requestId
    };
  }
  if (
    error instanceof ApiRequestError &&
    error.kind === "problem" &&
    error.problem
  ) {
    return {
      title: error.problem.title,
      detail: error.problem.detail,
      requestId: error.problem.requestId
    };
  }
  if (error instanceof ApiRequestError && error.kind === "network") {
    return {
      title: t("errors.network.title"),
      detail: t("errors.network.detail")
    };
  }
  return {
    title: t("errors.unexpected.title"),
    detail: t("errors.unexpected.detail")
  };
}

const createInitialViewportState = (
  level: GeometryLevel | LevelGeometry | undefined
): ViewportState => {
  let bounds;
  try {
    bounds = level
      ? level instanceof LevelGeometry
        ? collectLevelBounds(level)
        : collectGeometrySnapshotLevelBounds(level)
      : undefined;
  } catch {
    return resetViewportState();
  }

  return bounds
    ? createFitViewportState({
        bounds,
        viewportWidth: geometrySvgViewport.width,
        viewportHeight: geometrySvgViewport.height,
        padding: geometrySvgViewport.padding
      })
    : resetViewportState();
};
