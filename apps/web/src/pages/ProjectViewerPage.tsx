import {
  GeometryEngine,
  LevelGeometry,
  measureLevel,
  measureRoom,
  projectPointOntoWall,
  type RoomMeasurement
} from "@casastudio/geometry";
import {
  createConnectedWall,
  classifyLevelRoomTopology,
  dissolveRoom,
  deleteWallAndCollapseRedundantTopology,
  deleteOpening,
  moveOpening,
  moveJunction,
  moveWallEndpoint,
  updateWallProperties,
  updateOpening,
  updateRoomProperties,
  ValidationErrorCode,
  type Project,
  type Room,
  type Wall,
  type WallEndpoint,
  type Opening,
  type UpdateOpeningProperties,
  type UpdateRoomProperties
} from "@casastudio/schema";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LinearScaleRoundedIcon from "@mui/icons-material/LinearScaleRounded";
import LockOutlineRoundedIcon from "@mui/icons-material/LockOutlineRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import DoorFrontRoundedIcon from "@mui/icons-material/DoorFrontRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
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
  editorOpeningDragThresholdCrossed,
  editorOpeningDragPreviewChanged,
  editorOpeningDragStarted,
  editorOpeningPlacementChanged,
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
} from "../state/project-editor-slice";
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
  type WallEditingErrorKey
} from "../state/project-wall-editing";
import {
  resolveDrawWallSnapCandidate,
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

const emptySelectionState = createGeometrySelectionState();
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

  useEffect(() => {
    const enabled =
      workspaceMode === "edit" && !shortcutsOpen && !saveInteractionBlocked;
    if (!enabled) {
      setViewportPanModifierActive(false);
      return;
    }

    const handleSpaceDown = (event: KeyboardEvent) => {
      if (
        (event.key !== " " && event.code !== "Space") ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableShortcutTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      setViewportPanModifierActive(true);
    };
    const handleSpaceUp = (event: KeyboardEvent) => {
      if (event.key !== " " && event.code !== "Space") return;
      event.preventDefault();
      setViewportPanModifierActive(false);
    };
    const handleWindowBlur = () => setViewportPanModifierActive(false);

    window.addEventListener("keydown", handleSpaceDown);
    window.addEventListener("keyup", handleSpaceUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleSpaceDown);
      window.removeEventListener("keyup", handleSpaceUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [saveInteractionBlocked, shortcutsOpen, workspaceMode]);
  const viewLevels = geometryResponse?.geometry.levels ?? [];
  const selectedViewLevel =
    viewLevels.find((level) => level.id === selectedViewLevelId) ??
    viewLevels[0];
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
    return selected && (selected.kind === "DOOR" || selected.kind === "WINDOW")
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

    return {
      roomFaceCandidates:
        editor.activeTool === "room"
          ? actionableRoomFaces.map((face) => ({
              faceKey: face.key,
              vertices: face.vertices,
              selected: false
            }))
          : undefined,
      drawWall:
        transient?.kind === "draw-wall"
          ? {
              start: transient.startPoint,
              end: transient.currentPointerPoint
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
    workspaceMode
  ]);

  useEffect(() => {
    dispatch(projectRouteChanged(projectId));
    dispatch(geometrySelectionReset());
    setSelectionOwnerSnapshot(undefined);
    setViewportOwnerKey("");

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

      if (editor.activeTool === "door" || editor.activeTool === "window") {
        const openingType = editor.activeTool === "door" ? "DOOR" : "WINDOW";
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
            openingType === "DOOR" ? selectDoor(openingId) : selectWindow(openingId)
          ])));
          dispatch(editorOpeningPlacementChanged({ openingType, candidate: undefined }));
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
        (editor.activeTool === "door" || editor.activeTool === "window")
      ) {
        const openingType = editor.activeTool === "door" ? "DOOR" : "WINDOW";
        dispatch(editorOpeningPlacementChanged({
          openingType,
          candidate: resolveOpeningPlacementCandidate(
            editor.draft,
            editor.activeLevelId,
            pointer.worldPoint,
            openingType,
            18 / Math.max(Number.EPSILON, activeViewport.zoom * pointer.cssPixelsPerSvgUnit)
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

  const handleUpdateSelectedWallProperties = useCallback(
    (properties: {
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

      const result = updateWallProperties(editor.draft, {
        levelId: editor.activeLevelId,
        wallId: selectedEditWall.id,
        ...properties
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
    workspaceMode
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
      workspaceMode
    ]
  );

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
        selectedRoom={selectedRoom}
        selectedRoomMeasurement={selectedRoomMeasurement}
        levelMeasurement={activeLevelMeasurement}
        endpointAvailability={selectedWallEndpointAvailability}
        units={projectResponse?.project.units}
        onDeleteWall={handleDeleteSelectedWall}
        onUpdateWallProperties={handleUpdateSelectedWallProperties}
        onDeleteOpening={handleDeleteSelectedOpening}
        onUpdateOpening={handleUpdateSelectedOpening}
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
    selectionState,
    workspaceMode,
    projectResponse?.project.units,
    handleDeleteSelectedWall,
    handleUpdateSelectedWallProperties,
    handleDeleteSelectedOpening,
    handleUpdateSelectedOpening,
    handleDeleteSelectedRoom,
    handleUpdateSelectedRoomProperties,
    handleDisplayOptionsChange
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
            name: level.name
          })) ?? []}
          activeEditLevelId={editor.activeLevelId}
          onViewLevelChange={setSelectedViewLevelId}
          onEditLevelChange={(levelId) => dispatch(editorActiveLevelChanged(levelId))}
        />
      ) : undefined,
      headerCenter: !isPhone && projectResponse && !consistencyFailure ? (
        <WorkspaceModeControl
          mode={workspaceMode}
          disabled={saveInteractionBlocked}
          onChange={handleModeChange}
        />
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
      status: selectedLevel && activeProject ? (
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
      workspaceMode
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

      {workspaceMode === "edit" ? (
        <ProjectEditorToolbar
          activeTool={editor.activeTool}
          disabled={saveInteractionBlocked}
          onToolChange={(tool) => dispatch(editorActiveToolChanged(tool))}
        />
      ) : null}

      {editBuildFailed ? (
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
  readonly onChange: (mode: ProjectWorkspaceMode | null) => void;
};

/** Renders the View/Edit control independently from future representation choices. */
function WorkspaceModeControl({
  mode,
  disabled,
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
      <ToggleButton value="edit" aria-label={t("workspace.edit")}>
        <EditRoundedIcon fontSize="small" />
        {t("workspace.edit")}
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
};

/** Renders the mutually exclusive architectural authoring tools. */
function ProjectEditorToolbar({
  activeTool,
  disabled,
  onToolChange
}: ProjectEditorToolbarProps) {
  const { t } = useCasaTranslation("project-viewer");
  const icons = {
    select: <NearMeRoundedIcon fontSize="small" />,
    "draw-wall": <LinearScaleRoundedIcon fontSize="small" />,
    door: <DoorFrontRoundedIcon fontSize="small" />,
    window: <WindowRoundedIcon fontSize="small" />,
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
        onChange={(_event, value: ProjectEditorTool | null) =>
          onToolChange(value)
        }
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
  }[];
  readonly activeEditLevelId: string | null;
  readonly onViewLevelChange: (levelId: string) => void;
  readonly onEditLevelChange: (levelId: string) => void;
};

function ProjectLevelControl({
  mode,
  viewLevels,
  selectedViewLevel,
  draftLevelIds,
  activeEditLevelId,
  onViewLevelChange,
  onEditLevelChange
}: ProjectLevelControlProps) {
  const { t } = useCasaTranslation("project-viewer");
  const levels =
    mode === "edit"
      ? draftLevelIds
      : viewLevels.map((level) => ({
          id: level.id,
          name: level.sourceLevelId
        }));
  const value =
    mode === "edit" ? (activeEditLevelId ?? "") : (selectedViewLevel?.id ?? "");

  if (levels.length <= 1) {
    return value ? (
      <Chip label={levels[0]?.name ?? value} variant="outlined" />
    ) : null;
  }

  return (
    <FormControl size="small" className="project-level-selector">
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
  readonly endpointAvailability?: ReturnType<
    typeof getWallEndpointEditingAvailability
  >;
  readonly units?: Project["units"];
  readonly onDeleteWall: () => void;
  readonly onUpdateWallProperties: (properties: {
    readonly height?: number;
    readonly thickness?: number;
  }) => boolean;
  readonly onDeleteOpening: () => void;
  readonly onUpdateOpening: (properties: UpdateOpeningProperties) => boolean;
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
  endpointAvailability,
  units,
  onDeleteWall,
  onUpdateWallProperties,
  onDeleteOpening,
  onUpdateOpening,
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
              onDeleteWall={onDeleteWall}
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
