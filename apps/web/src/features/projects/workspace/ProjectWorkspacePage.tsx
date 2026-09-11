import { useFurnitureEditor } from "../../editor-2d/tools/furniture/useFurnitureEditor";
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
  createStaircase,
  createRoomFromShape,
  createFreeBoundaryRoomFromShape,
  classifyLevelRoomTopology,
  deriveRoomShapeVertices,
  moveOpening,
  moveJunction,
  moveWallEndpoint,
  splitWall,
  formatArchitecturalLength,
  deleteStaircase,
  updateStaircase,
  type WallEndpoint,
  type Opening,
  type RoomShapeKind
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
import type {
  GeometryLevel,
  GeometrySnapshot
} from "../../../core/api/api-types";
import { useAppShellContent } from "../../../shell/AppShellContext";
import { createArchitecturalPresentationModel2D } from "../../geometry-2d/presentation/architectural-presentation-model-2d";
import { createArchitecturalDimensionPresentationModel2D } from "../../geometry-2d/presentation/architectural-dimension-presentation-model-2d";
import { createProjectSelectionFootprints } from "../../geometry-2d/selection/project-selection-footprints";
import { createStairFootprints2D } from "../../geometry-2d/presentation/plan-footprints-2d";
import { createRuntimeGeometryPresentationModel2D } from "../../geometry-2d/presentation/geometry-presentation-model-2d";
import { GeometryViewerPanel } from "../../geometry-2d/viewer/GeometryViewerPanel";
import { createGeometrySnapshotPresentationModel2D } from "../../geometry-2d/adapters/geometry-snapshot-presentation-adapter";
import {
  createGeometrySelectionState,
  selectDoor,
  selectPolygon,
  selectWallOpening,
  selectWindow,
  selectStaircase,
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
  editorToolToggled,
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
  editorRoomShapeElevationChanged,
  editorRoomShapePlacementPointerMoved,
  editorRoomShapePlacementStarted,
  editorStairAuthoringChanged,
  editorStairPlacementPointerMoved,
  editorStairAdjustmentStarted,
  editorStairAdjustmentPointerMoved,
  editorStairTranslationStarted,
  editorStairTranslationPointerMoved,
  editorOpeningDragThresholdCrossed,
  editorOpeningDragPreviewChanged,
  editorOpeningDragStarted,
  editorOpeningPlacementChanged,
  editorOpeningAuthoringTypeChanged,
  editorWallVertexPlacementChanged,
  editorRedoRequested,
  editorSelectionChanged,
  editorSelectionCleared,
  editorSelectionTranslationPointerMoved,
  editorSelectionTranslationStarted,
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
  alignFurnitureSelection,
  deleteProjectSelection,
  distributeFurnitureSelection,
  getProjectSelectionCapabilities,
  resolveProjectSelectionRoots,
  translateProjectSelection,
  type FurnitureAlignment,
  type FurnitureDistribution
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
import { ProjectEditorStatusBar } from "../../editor-2d/components/ProjectEditorStatusBar";
import { collectActionableRoomFaces } from "../../editor-2d/tools/room/project-room-authoring";
import {
  ProjectPersistenceDialogs,
  type ProjectPersistenceDialog
} from "./components/ProjectPersistenceDialogs";
import { normalizeEditorMeasurement } from "../../editor-2d/tools/measure/editor-measurement";
import {
  defaultRoomShapeDimensions,
  formatRoomShapePreviewLabel,
  getDefaultRoomShapeDimensions,
  getRoomEditingErrorKey,
  parseRoomShapeDefinition,
  getRoomAuthoringPresetValues,
  type RoomAuthoringPreset,
  type RoomShapeDimensionDraft
} from "../../editor-2d/tools/room/room-shape-authoring";
import { EditorToolbar } from "../../editor-2d/components/EditorToolbar";
import {
  createStairIdentifiers,
  createStairProposal,
  findProjectStaircase,
  getStairAuthoringParameters,
  getSuggestedStairParameters,
  inferStairTemplate,
  translateStaircase,
  updateStaircaseParameters,
  type StairAuthoringParameters,
  type StairParameterChanges,
  type StairTemplate
} from "../../editor-2d/tools/stair/project-stair-authoring";
import { useEditorKeyboardShortcuts } from "../../editor-2d/hooks/useEditorKeyboardShortcuts";
import {
  useEditorSelectionActions,
  type EditingErrorKey
} from "../../editor-2d/hooks/useEditorSelectionActions";
import {
  ProjectEditHeaderActions,
  ProjectViewEditAction
} from "./components/ProjectHeaderActions";
import { ProjectLevelControl } from "./components/ProjectLevelControl";
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
  const [roomDetectionActive, setRoomDetectionActive] = useState(false);
  const [roomPreset, setRoomPreset] = useState<RoomAuthoringPreset>("CUSTOM");
  const [roomShapeDimensions, setRoomShapeDimensions] =
    useState<RoomShapeDimensionDraft>(defaultRoomShapeDimensions);
  const [roomElevationDraft, setRoomElevationDraft] = useState("0");

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
        target.closest('[data-room-authoring-parameters="true"]') !== null;
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
    if (
      displayOptions.furniture === false &&
      selectionState.selected.some((entry) => entry.kind === "FURNITURE")
    ) {
      dispatch(
        workspaceMode === "edit"
          ? editorSelectionCleared()
          : geometrySelectionReset()
      );
    }
  }, [
    displayOptions.furniture,
    selectionState.selected,
    dispatch,
    workspaceMode
  ]);
  const roomShapePlacement =
    editor.transient.interaction?.kind === "place-room-shape"
      ? editor.transient.interaction
      : undefined;
  const stairPlacement =
    editor.transient.interaction?.kind === "place-stair"
      ? editor.transient.interaction
      : undefined;
  const stairProposal = useMemo(() => {
    if (
      !activeProject ||
      !stairPlacement?.toLevelId ||
      !stairPlacement.template ||
      !stairPlacement.identifiers ||
      !stairPlacement.start
    )
      return undefined;
    const firstStepCount =
      stairPlacement.parameters.kind === "STRAIGHT"
        ? stairPlacement.parameters.flightStepCount
        : stairPlacement.parameters.firstFlightStepCount;
    const control = {
      x:
        stairPlacement.start.x +
        firstStepCount * stairPlacement.parameters.treadDepth,
      z: stairPlacement.start.z
    };
    return createStairProposal({
      project: activeProject,
      owningLevelId: stairPlacement.owningLevelId,
      destination: {
        toLevelId: stairPlacement.toLevelId,
        ...(stairPlacement.toRoomId
          ? { toRoomId: stairPlacement.toRoomId }
          : {})
      },
      template: stairPlacement.template,
      parameters: stairPlacement.parameters,
      start: stairPlacement.start,
      control,
      turnDirection: stairPlacement.turnDirection,
      identifiers: stairPlacement.identifiers,
      name: `Staircase ${(activeProjectLevel?.staircases.length ?? 0) + 1}`
    });
  }, [activeProject, activeProjectLevel?.staircases.length, stairPlacement]);
  const activeRoomShapeKind = roomShapePlacement?.shape.kind;
  const activeRoomBoundaryKind = roomShapePlacement?.boundaryKind;
  const parsedRoomElevation = Number(roomElevationDraft);
  const validRoomElevation =
    Number.isFinite(parsedRoomElevation) && parsedRoomElevation >= 0
      ? parsedRoomElevation
      : undefined;
  const validatedRoomShape = useMemo(
    () =>
      activeRoomShapeKind
        ? parseRoomShapeDefinition(activeRoomShapeKind, roomShapeDimensions)
        : undefined,
    [activeRoomShapeKind, roomShapeDimensions]
  );
  const roomPlacementValidation = useMemo(() => {
    if (
      !editor.draft ||
      !editor.activeLevelId ||
      !roomShapePlacement?.origin ||
      !validatedRoomShape
    )
      return undefined;
    const room = {
      id: "room-authoring-preview",
      name: "Room preview",
      type: roomShapePlacement.roomType,
      ...(roomShapePlacement.boundaryKind === "FREE"
        ? { elevation: roomShapePlacement.elevation }
        : {})
    };
    return roomShapePlacement.boundaryKind === "FREE"
      ? createFreeBoundaryRoomFromShape(editor.draft, {
          levelId: editor.activeLevelId,
          origin: roomShapePlacement.origin,
          shape: validatedRoomShape,
          room
        })
      : createRoomFromShape(editor.draft, {
          levelId: editor.activeLevelId,
          origin: roomShapePlacement.origin,
          shape: validatedRoomShape,
          room,
          wallIds: Array.from(
            {
              length:
                deriveRoomShapeVertices(
                  roomShapePlacement.origin,
                  validatedRoomShape
                )?.length ?? 0
            },
            (_, index) => `room-authoring-preview-wall-${index + 1}`
          ),
          wallHeight: newWallDefaults.height,
          wallThickness: newWallDefaults.thickness
        });
  }, [
    editor.activeLevelId,
    editor.draft,
    roomShapePlacement,
    validatedRoomShape
  ]);
  const resolvedDisplayOptions: GeometryDisplayOptions =
    workspaceMode === "edit"
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
    );
  }, [activeProject, activeProjectLevel, furniture.model, presentationResult]);
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
  const selectedStair = useMemo(() => {
    const selected =
      selectionState.selected.length === 1
        ? selectionState.selected[0]
        : undefined;
    if (
      !selected ||
      (selected.kind !== "STAIRCASE" &&
        selected.kind !== "STAIR_FLIGHT" &&
        selected.kind !== "STAIR_LANDING")
    )
      return undefined;
    return findProjectStaircase(activeProjectLevel, selected.geometryId);
  }, [activeProjectLevel, selectionState.selected]);
  const stairAdjustmentProposal = useMemo(() => {
    const adjustment =
      editor.transient.interaction?.kind === "move-stair-adjustment"
        ? editor.transient.interaction
        : undefined;
    if (
      !activeProject ||
      !selectedStair ||
      !adjustment ||
      adjustment.staircaseId !== selectedStair.staircase.id
    )
      return undefined;
    const staircase = selectedStair.staircase;
    const proposal = createStairProposal({
      project: activeProject,
      owningLevelId: adjustment.owningLevelId,
      destination: {
        toLevelId: staircase.toLevelId,
        ...(staircase.toRoomId ? { toRoomId: staircase.toRoomId } : {})
      },
      template: inferStairTemplate(staircase),
      parameters: getStairAuthoringParameters(staircase),
      start: staircase.flights[0]?.start ?? adjustment.control,
      control: adjustment.control,
      identifiers: {
        staircaseId: staircase.id,
        flightIds: staircase.flights.map((flight) => flight.id),
        landingIds: staircase.landings.map((landing) => landing.id)
      },
      name: staircase.name
    });
    return proposal && staircase.fromRoomId
      ? {
          ...proposal,
          staircase: { ...proposal.staircase, fromRoomId: staircase.fromRoomId }
        }
      : proposal;
  }, [activeProject, editor.transient.interaction, selectedStair]);
  const translatedStaircase = useMemo(() => {
    const move =
      editor.transient.interaction?.kind === "move-stair-translation"
        ? editor.transient.interaction
        : undefined;
    if (
      !move ||
      !selectedStair ||
      move.staircaseId !== selectedStair.staircase.id
    )
      return undefined;
    return translateStaircase(selectedStair.staircase, {
      x: move.currentPointer.x - move.startPointer.x,
      z: move.currentPointer.z - move.startPointer.z
    });
  }, [editor.transient.interaction, selectedStair]);
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
    setRoomDetectionActive(false);
  }, [editor.activeTool, workspaceMode]);

  const handleDetectRoom = useCallback(() => {
    dispatch(editorTransientInteractionCleared());
    setRoomDetectionActive(true);
  }, [dispatch]);

  const handleSelectRoomShape = useCallback(
    (
      kind: RoomShapeKind,
      boundaryKind: "WALLS" | "FREE" = Number(roomElevationDraft) === 0
        ? "WALLS"
        : "FREE",
      roomType = "OTHER" as const
    ) => {
      if (!editor.activeLevelId) return;
      const dimensions = getDefaultRoomShapeDimensions(kind);
      const shape = parseRoomShapeDefinition(kind, dimensions);
      if (!shape) return;
      setRoomShapeDimensions(dimensions);
      setRoomDetectionActive(false);
      dispatch(editorActiveToolChanged("room"));
      dispatch(
        editorRoomShapePlacementStarted({
          levelId: editor.activeLevelId,
          shape,
          boundaryKind,
          elevation: boundaryKind === "FREE" ? (validRoomElevation ?? 0) : 0,
          roomType
        })
      );
    },
    [dispatch, editor.activeLevelId, roomElevationDraft, validRoomElevation]
  );

  const handleRoomMethodChange = useCallback(
    (method: "DETECT" | "SHAPE") => {
      if (method === "DETECT") handleDetectRoom();
      else handleSelectRoomShape(activeRoomShapeKind ?? "RECTANGLE");
    },
    [activeRoomShapeKind, handleDetectRoom, handleSelectRoomShape]
  );

  const handleRoomPresetChange = useCallback(
    (preset: RoomAuthoringPreset) => {
      const values = getRoomAuthoringPresetValues(preset);
      setRoomPreset(preset);
      setRoomShapeDimensions(values.dimensions);
      setRoomDetectionActive(false);
      const shape = parseRoomShapeDefinition(values.shape, values.dimensions);
      if (!shape || !editor.activeLevelId) return;
      dispatch(
        editorRoomShapePlacementStarted({
          levelId: editor.activeLevelId,
          shape,
          boundaryKind: Number(roomElevationDraft) === 0 ? "WALLS" : "FREE",
          elevation: Number(roomElevationDraft) || 0,
          roomType: values.roomType
        })
      );
    },
    [dispatch, editor.activeLevelId, roomElevationDraft]
  );

  const handleRoomElevationChange = useCallback(
    (value: string) => {
      setRoomElevationDraft(value);
      const elevation = Number(value);
      if (Number.isFinite(elevation) && elevation >= 0) {
        dispatch(editorRoomShapeElevationChanged(elevation));
      }
    },
    [dispatch]
  );

  const handleRoomShapeDimensionChange = useCallback(
    (field: keyof RoomShapeDimensionDraft, value: string) => {
      if (!activeRoomShapeKind) return;
      const nextDimensions = { ...roomShapeDimensions, [field]: value };
      setRoomShapeDimensions(nextDimensions);
      const shape = parseRoomShapeDefinition(
        activeRoomShapeKind,
        nextDimensions
      );
      if (shape) dispatch(editorRoomShapePlacementChanged(shape));
    },
    [activeRoomShapeKind, dispatch, roomShapeDimensions]
  );

  const handleCancelRoomAuthoring = useCallback(() => {
    dispatch(editorTransientInteractionCleared());
    dispatch(editorActiveToolChanged("select"));
    setRoomDetectionActive(false);
  }, [dispatch]);

  const handleStairDestinationChange = useCallback(
    (toLevelId: string, toRoomId?: string) => {
      if (!editor.draft || !editor.activeLevelId) return;
      const parameters = getSuggestedStairParameters(
        editor.draft,
        editor.activeLevelId,
        {
          toLevelId,
          ...(toRoomId ? { toRoomId } : {})
        },
        stairPlacement?.template ?? "STRAIGHT"
      );
      dispatch(
        editorStairAuthoringChanged({ toLevelId, toRoomId, parameters })
      );
    },
    [dispatch, editor.activeLevelId, editor.draft, stairPlacement?.template]
  );

  const handleStairTemplateChange = useCallback(
    (template: StairTemplate) => {
      if (!editor.draft || !editor.activeLevelId || !stairPlacement?.toLevelId)
        return;
      const parameters = getSuggestedStairParameters(
        editor.draft,
        editor.activeLevelId,
        {
          toLevelId: stairPlacement.toLevelId,
          ...(stairPlacement.toRoomId
            ? { toRoomId: stairPlacement.toRoomId }
            : {})
        },
        template
      );
      dispatch(
        editorStairAuthoringChanged({
          template,
          parameters,
          identifiers: createStairIdentifiers(template)
        })
      );
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.draft,
      stairPlacement?.toLevelId,
      stairPlacement?.toRoomId
    ]
  );

  const handleStairParametersChange = useCallback(
    (parameters: StairAuthoringParameters) => {
      dispatch(editorStairAuthoringChanged({ parameters }));
    },
    [dispatch]
  );

  const handleCancelStairAuthoring = useCallback(() => {
    dispatch(editorActiveToolChanged("select"));
  }, [dispatch]);

  useEffect(() => {
    if (
      editor.activeTool === "room" &&
      !roomShapePlacement &&
      !roomDetectionActive
    ) {
      handleSelectRoomShape("RECTANGLE");
    }
  }, [
    editor.activeTool,
    handleSelectRoomShape,
    roomDetectionActive,
    roomShapePlacement
  ]);

  useEffect(() => {
    if (
      editor.activeTool !== "stair" ||
      !stairPlacement ||
      stairPlacement.template ||
      !editor.draft ||
      !editor.activeLevelId
    )
      return;
    const owningLevel = editor.draft.building.levels.find(
      (level) => level.id === editor.activeLevelId
    );
    const higherLevel = editor.draft.building.levels
      .filter((level) => level.elevation > (owningLevel?.elevation ?? 0))
      .sort((first, second) => first.elevation - second.elevation)[0];
    const elevatedRoom = owningLevel?.rooms.find(
      (room) => (room.elevation ?? 0) > 0
    );
    const toLevelId = higherLevel?.id ?? owningLevel?.id;
    const toRoomId = higherLevel ? undefined : elevatedRoom?.id;
    if (!toLevelId) return;
    const destination = { toLevelId, ...(toRoomId ? { toRoomId } : {}) };
    dispatch(
      editorStairAuthoringChanged({
        ...destination,
        template: "STRAIGHT",
        parameters: getSuggestedStairParameters(
          editor.draft,
          editor.activeLevelId,
          destination
        ),
        identifiers: createStairIdentifiers("STRAIGHT")
      })
    );
  }, [
    dispatch,
    editor.activeLevelId,
    editor.activeTool,
    editor.draft,
    stairPlacement
  ]);

  const handleConfirmStairAuthoring = useCallback(() => {
    if (!editor.draft || !stairPlacement || !stairProposal?.valid) return;
    const result = createStaircase(editor.draft, {
      owningLevelId: stairPlacement.owningLevelId,
      staircase: stairProposal.staircase
    });
    if (!result.ok) {
      setEditingError("errors.stair.invalid");
      return;
    }
    setEditingError(undefined);
    dispatch(editingDraftReplaced(result.project));
    dispatch(editorActiveToolChanged("select"));
    dispatch(
      editorSelectionChanged(
        createGeometrySelectionState([
          selectStaircase(stairProposal.staircase.id)
        ])
      )
    );
  }, [dispatch, editor.draft, stairPlacement, stairProposal]);

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
    const placementCandidate =
      transient?.kind === "place-opening" ? transient.candidate : undefined;
    const placementWall = placementCandidate
      ? findProjectWall(
          editor.draft,
          editor.activeLevelId,
          placementCandidate.wallId
        )
      : undefined;
    const draggedOpening =
      transient?.kind === "move-opening" &&
      transient.dragging &&
      selectedEditOpening
        ? ({
            ...selectedEditOpening.opening,
            offsetFromStart: transient.currentOffsetFromStart
          } as Opening)
        : undefined;
    const selectionTranslation =
      transient?.kind === "translate-selection"
        ? (() => {
            const selectedKeys = new Set(
              selectionState.selected.map(
                (selection) => `${selection.kind}:${selection.geometryId}`
              )
            );
            const points = selectionFootprints
              .filter((footprint) =>
                selectedKeys.has(
                  `${footprint.selection.kind}:${footprint.selection.geometryId}`
                )
              )
              .flatMap((footprint) =>
                footprint.polygons.flatMap((polygon) => polygon)
              );
            if (points.length === 0) return undefined;
            return {
              min: {
                x: Math.min(...points.map((point) => point.x)),
                z: Math.min(...points.map((point) => point.z))
              },
              max: {
                x: Math.max(...points.map((point) => point.x)),
                z: Math.max(...points.map((point) => point.z))
              },
              delta: {
                x: transient.currentPointer.x - transient.startPointer.x,
                z: transient.currentPointer.z - transient.startPointer.z
              }
            };
          })()
        : undefined;
    const previewShape =
      transient?.kind === "place-room-shape" &&
      (transient.boundaryKind === "WALLS" || validRoomElevation !== undefined)
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
      precisionGuides:
        transient?.kind === "translate-selection"
          ? transient.precision?.guides
          : transient?.kind === "move-stair-translation"
            ? transient.precision?.guides
            : transient?.kind === "furniture"
              ? transient.precision?.guides
              : undefined,
      stairPreview:
        (translatedStaircase ?? stairAdjustmentProposal ?? stairProposal)
          ? {
              staircase:
                translatedStaircase ??
                (stairAdjustmentProposal ?? stairProposal)!.staircase,
              valid: translatedStaircase
                ? true
                : (stairAdjustmentProposal ?? stairProposal)!.valid,
              locked: Boolean(translatedStaircase || stairAdjustmentProposal)
            }
          : undefined,
      selectedStair:
        selectedStair && selectionState.selected[0]?.kind === "STAIRCASE"
          ? {
              staircaseId: selectedStair.staircase.id,
              adjustmentPoint:
                editor.transient.interaction?.kind === "move-stair-adjustment"
                  ? editor.transient.interaction.control
                  : inferStairTemplate(selectedStair.staircase) === "STRAIGHT"
                    ? (selectedStair.staircase.flights.at(-1)?.end ?? {
                        x: 0,
                        z: 0
                      })
                    : (selectedStair.staircase.flights[0]?.end ?? {
                        x: 0,
                        z: 0
                      })
            }
          : undefined,
      roomFaceCandidates:
        editor.activeTool === "room" && roomDetectionActive
          ? actionableRoomFaces.map((face) => ({
              faceKey: face.key,
              vertices: face.vertices,
              selected: false
            }))
          : undefined,
      roomShapePreview:
        shapeVertices &&
        shapeLabelAnchor &&
        activeProject &&
        previewShape &&
        roomShapePlacement
          ? {
              vertices: shapeVertices,
              labelAnchor: shapeLabelAnchor,
              label: formatRoomShapePreviewLabel(
                previewShape,
                activeProject.units.length,
                roomShapePlacement.boundaryKind === "FREE"
                  ? roomShapePlacement.elevation
                  : undefined
              ),
              kind: previewShape.kind,
              elevated: roomShapePlacement.boundaryKind === "FREE",
              elevation: roomShapePlacement.elevation,
              valid: roomPlacementValidation?.ok ?? false
            }
          : undefined,
      drawWall:
        transient?.kind === "draw-wall"
          ? {
              start: transient.startPoint,
              end: transient.currentPointerPoint,
              lengthLabel:
                activeProject &&
                (transient.currentPointerPoint.x !== transient.startPoint.x ||
                  transient.currentPointerPoint.z !== transient.startPoint.z)
                  ? formatArchitecturalLength(
                      Math.hypot(
                        transient.currentPointerPoint.x -
                          transient.startPoint.x,
                        transient.currentPointerPoint.z - transient.startPoint.z
                      ),
                      activeProject.units.length
                    )
                  : undefined
            }
          : undefined,
      snapCandidate: editor.transient.snapCandidate,
      snapMarkerPurpose:
        editor.activeTool === "measure" ? "measurement" : "authoring",
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
        transient?.kind === "add-wall-vertex"
          ? transient.splitPoint
          : undefined,
      openingPreview:
        placementCandidate && placementWall
          ? {
              wall: placementWall,
              opening: placementCandidate.opening,
              valid: placementCandidate.valid
            }
          : draggedOpening && selectedEditOpening
            ? {
                wall: selectedEditOpening.wall,
                opening: draggedOpening,
                valid:
                  transient?.kind === "move-opening" ? transient.valid : false
              }
            : undefined,
      activeOpeningDragId:
        transient?.kind === "move-opening" && transient.dragging
          ? transient.openingId
          : undefined,
      grid: {
        visible: editor.precision.gridVisible,
        spacing: editor.precision.gridSpacing
      },
      selectionTranslation
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
    roomPreset,
    stairPlacement,
    stairProposal,
    stairAdjustmentProposal,
    translatedStaircase,
    selectedStair,
    selectionState.selected,
    selectionFootprints,
    t,
    validatedRoomShape,
    roomPlacementValidation,
    validRoomElevation,
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

  const handleSelectionTranslationPointerDown = useCallback(
    (_selection: unknown, point: WorldPointXZ, pointerId: number) => {
      if (
        saveInteractionBlocked ||
        workspaceMode !== "edit" ||
        editor.activeTool !== "select"
      )
        return;
      if (!selectionCapabilities.translate.supported) {
        setEditingError("errors.selection.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(
        editorSelectionTranslationStarted({ pointerId, startPointer: point })
      );
    },
    [
      dispatch,
      editor.activeTool,
      saveInteractionBlocked,
      selectionCapabilities.translate,
      workspaceMode
    ]
  );

  const handleSelectionTranslationPointerUp = useCallback(
    (pointerId: number, dragged: boolean) => {
      const interaction = editor.transient.interaction;
      if (
        interaction?.kind !== "translate-selection" ||
        interaction.pointerId !== pointerId
      )
        return;
      dispatch(editorTransientInteractionCleared());
      if (!dragged || !editor.draft || !activeProjectLevel) return;
      const result = translateProjectSelection(
        editor.draft,
        activeProjectLevel,
        selectionRoots,
        {
          x: interaction.currentPointer.x - interaction.startPointer.x,
          z: interaction.currentPointer.z - interaction.startPointer.z
        }
      );
      if (!result.ok) {
        setEditingError("errors.selection.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
    },
    [
      activeProjectLevel,
      dispatch,
      editor.draft,
      editor.transient.interaction,
      selectionRoots
    ]
  );

  const handleSelectionTranslationPointerCancel = useCallback(
    (pointerId: number) => {
      if (
        editor.transient.interaction?.kind === "translate-selection" &&
        editor.transient.interaction.pointerId === pointerId
      )
        dispatch(editorTransientInteractionCleared());
    },
    [dispatch, editor.transient.interaction]
  );

  const handleNudgeSelection = useCallback(
    (delta: WorldPointXZ) => {
      if (
        !editor.draft ||
        !activeProjectLevel ||
        saveInteractionBlocked ||
        workspaceMode !== "edit"
      )
        return;
      const result = translateProjectSelection(
        editor.draft,
        activeProjectLevel,
        selectionRoots,
        delta
      );
      if (!result.ok) {
        setEditingError("errors.selection.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
    },
    [
      activeProjectLevel,
      dispatch,
      editor.draft,
      saveInteractionBlocked,
      selectionRoots,
      workspaceMode
    ]
  );

  const handleAlignSelection = useCallback(
    (alignment: FurnitureAlignment) => {
      if (!editor.draft || !activeProjectLevel || saveInteractionBlocked)
        return;
      const result = alignFurnitureSelection(
        editor.draft,
        activeProjectLevel,
        selectionRoots,
        alignment
      );
      if (!result.ok) {
        setEditingError("errors.selection.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
    },
    [
      activeProjectLevel,
      dispatch,
      editor.draft,
      saveInteractionBlocked,
      selectionRoots
    ]
  );

  const handleDistributeSelection = useCallback(
    (distribution: FurnitureDistribution) => {
      if (!editor.draft || !activeProjectLevel || saveInteractionBlocked)
        return;
      const result = distributeFurnitureSelection(
        editor.draft,
        activeProjectLevel,
        selectionRoots,
        distribution
      );
      if (!result.ok) {
        setEditingError("errors.selection.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
    },
    [
      activeProjectLevel,
      dispatch,
      editor.draft,
      saveInteractionBlocked,
      selectionRoots
    ]
  );

  const handleDeleteSelection = useCallback(() => {
    if (
      !editor.draft ||
      !activeProjectLevel ||
      saveInteractionBlocked ||
      workspaceMode !== "edit"
    )
      return;
    const result = deleteProjectSelection(
      editor.draft,
      activeProjectLevel,
      selectionRoots
    );
    if (!result.ok) {
      setEditingError("errors.selection.invalid");
      return;
    }
    setEditingError(undefined);
    dispatch(editorSelectionCleared());
    dispatch(editingDraftReplaced(result.project));
  }, [
    activeProjectLevel,
    dispatch,
    editor.draft,
    saveInteractionBlocked,
    selectionRoots,
    workspaceMode
  ]);

  const handleStairAdjustmentPointerDown = useCallback(
    (staircaseId: string, pointerId: number) => {
      if (
        !editor.activeLevelId ||
        editor.activeTool !== "select" ||
        !selectedStair ||
        selectedStair.staircase.id !== staircaseId ||
        saveInteractionBlocked
      )
        return;
      const staircase = selectedStair.staircase;
      const control =
        inferStairTemplate(staircase) === "STRAIGHT"
          ? staircase.flights.at(-1)?.end
          : staircase.flights[0]?.end;
      if (!control) return;
      dispatch(
        editorStairAdjustmentStarted({
          owningLevelId: editor.activeLevelId,
          staircaseId,
          pointerId,
          control
        })
      );
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.activeTool,
      saveInteractionBlocked,
      selectedStair
    ]
  );

  const handleStairTranslationPointerDown = useCallback(
    (staircaseId: string, point: WorldPointXZ, pointerId: number) => {
      if (
        !editor.activeLevelId ||
        editor.activeTool !== "select" ||
        !selectedStair ||
        selectedStair.staircase.id !== staircaseId ||
        saveInteractionBlocked
      )
        return;
      dispatch(
        editorStairTranslationStarted({
          owningLevelId: editor.activeLevelId,
          staircaseId,
          pointerId,
          startPointer: point
        })
      );
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.activeTool,
      saveInteractionBlocked,
      selectedStair
    ]
  );

  const handleStairTranslationPointerUp = useCallback(
    (pointerId: number) => {
      const interaction = editor.transient.interaction;
      if (
        interaction?.kind !== "move-stair-translation" ||
        interaction.pointerId !== pointerId ||
        !editor.draft ||
        !translatedStaircase
      )
        return;
      const result = updateStaircase(editor.draft, {
        owningLevelId: interaction.owningLevelId,
        staircaseId: interaction.staircaseId,
        staircase: translatedStaircase
      });
      dispatch(editorTransientInteractionCleared());
      if (!result.ok) {
        setEditingError("errors.stair.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
      dispatch(
        editorSelectionChanged(
          createGeometrySelectionState([
            selectStaircase(interaction.staircaseId)
          ])
        )
      );
    },
    [dispatch, editor.draft, editor.transient.interaction, translatedStaircase]
  );

  const handleStairTranslationPointerCancel = useCallback(
    (pointerId: number) => {
      if (
        editor.transient.interaction?.kind === "move-stair-translation" &&
        editor.transient.interaction.pointerId === pointerId
      ) {
        dispatch(editorTransientInteractionCleared());
      }
    },
    [dispatch, editor.transient.interaction]
  );

  const handleStairAdjustmentPointerUp = useCallback(
    (control: WorldPointXZ, pointerId: number) => {
      const interaction = editor.transient.interaction;
      if (
        interaction?.kind !== "move-stair-adjustment" ||
        interaction.pointerId !== pointerId ||
        !editor.draft ||
        !selectedStair
      )
        return;
      const staircase = selectedStair.staircase;
      const proposal = createStairProposal({
        project: editor.draft,
        owningLevelId: interaction.owningLevelId,
        destination: {
          toLevelId: staircase.toLevelId,
          ...(staircase.toRoomId ? { toRoomId: staircase.toRoomId } : {})
        },
        template: inferStairTemplate(staircase),
        parameters: getStairAuthoringParameters(staircase),
        start: staircase.flights[0]?.start ?? control,
        control,
        identifiers: {
          staircaseId: staircase.id,
          flightIds: staircase.flights.map((flight) => flight.id),
          landingIds: staircase.landings.map((landing) => landing.id)
        },
        name: staircase.name
      });
      dispatch(editorTransientInteractionCleared());
      if (!proposal?.valid) {
        setEditingError("errors.stair.invalid");
        return;
      }
      const editedStaircase = staircase.fromRoomId
        ? { ...proposal.staircase, fromRoomId: staircase.fromRoomId }
        : proposal.staircase;
      const result = updateStaircase(editor.draft, {
        owningLevelId: interaction.owningLevelId,
        staircaseId: staircase.id,
        staircase: editedStaircase
      });
      if (!result.ok) {
        setEditingError("errors.stair.invalid");
        return;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
      dispatch(
        editorSelectionChanged(
          createGeometrySelectionState([selectStaircase(staircase.id)])
        )
      );
    },
    [dispatch, editor.draft, editor.transient.interaction, selectedStair]
  );

  const handleStairAdjustmentPointerCancel = useCallback(
    (pointerId: number) => {
      const interaction = editor.transient.interaction;
      if (
        interaction?.kind === "move-stair-adjustment" &&
        interaction.pointerId === pointerId
      ) {
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

  const handleDeleteSelectedStair = useCallback(() => {
    if (
      !editor.draft ||
      !editor.activeLevelId ||
      !selectedStair ||
      saveInteractionBlocked
    )
      return;
    const result = deleteStaircase(editor.draft, {
      owningLevelId: editor.activeLevelId,
      staircaseId: selectedStair.staircase.id
    });
    if (!result.ok) {
      setEditingError("errors.stair.invalid");
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
    selectedStair
  ]);

  const handleUpdateSelectedStair = useCallback(
    (changes: StairParameterChanges): boolean => {
      if (
        !editor.draft ||
        !editor.activeLevelId ||
        !selectedStair ||
        saveInteractionBlocked
      )
        return false;
      const staircase = updateStaircaseParameters(
        selectedStair.staircase,
        changes
      );
      if (!staircase) return false;
      const result = updateStaircase(editor.draft, {
        owningLevelId: editor.activeLevelId,
        staircaseId: staircase.id,
        staircase
      });
      if (!result.ok) {
        setEditingError("errors.stair.invalid");
        return false;
      }
      setEditingError(undefined);
      dispatch(editingDraftReplaced(result.project));
      dispatch(
        editorSelectionChanged(
          createGeometrySelectionState([selectStaircase(staircase.id)])
        )
      );
      return true;
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.draft,
      saveInteractionBlocked,
      selectedStair
    ]
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
        onUpdateOpeningAuthoringType={(openingType) =>
          dispatch(editorOpeningAuthoringTypeChanged(openingType))
        }
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

  const shellContent = useMemo(
    () => ({
      title: projectResponse?.project.name ?? t("shell.title"),
      breadcrumb:
        workspaceMode === "edit"
          ? t("workspace.editingLevel", {
              level: activeProjectLevel?.name ?? ""
            })
          : t("shell.breadcrumb"),
      headerContextAccessory:
        !isPhone && projectResponse && !consistencyFailure ? (
          <ProjectLevelControl
            mode={workspaceMode}
            viewLevels={viewLevels}
            selectedViewLevel={selectedViewLevel}
            draftLevelIds={
              editor.draft?.building.levels.map((level) => ({
                id: level.id,
                name: level.name,
                elevation: level.elevation
              })) ?? []
            }
            projectLevelNames={projectResponse.project.building.levels.map(
              (level) => ({
                id: level.id,
                name: level.name
              })
            )}
            activeEditLevelId={editor.activeLevelId}
            onViewLevelChange={setSelectedViewLevelId}
            onEditLevelChange={(levelId) =>
              dispatch(editorActiveLevelChanged(levelId))
            }
            onCreateLevel={handleCreateLevel}
            onUpdateActiveLevel={handleUpdateActiveLevel}
          />
        ) : undefined,
      headerCenter:
        !isPhone &&
        projectResponse &&
        !consistencyFailure &&
        workspaceMode === "view" ? (
          <WorkspaceRepresentationControl
            representation={workspaceRepresentation}
            disabled={saveInteractionBlocked}
            threeDDisabled={false}
            onChange={handleRepresentationChange}
          />
        ) : undefined,
      headerAccessory:
        !isPhone && projectResponse && !consistencyFailure ? (
          workspaceMode === "view" ? (
            <ProjectViewEditAction
              fromThreeD={workspaceRepresentation === "3d"}
              disabled={saveInteractionBlocked}
              onEdit={() => handleModeChange("edit")}
            />
          ) : (
            <ProjectEditHeaderActions
              dirty={editor.dirty}
              disabled={saveInteractionBlocked}
              canUndo={editor.history.past.length > 0}
              canRedo={editor.history.future.length > 0}
              onBack={() => handleModeChange("view")}
              onUndo={() => dispatch(editorUndoRequested())}
              onRedo={() => dispatch(editorRedoRequested())}
              onDiscard={() => setPersistenceDialog("discard")}
              onSave={handleSave}
            />
          )
        ) : undefined,
      inspector: isTablet || isPhone ? undefined : inspector,
      status:
        workspaceRepresentation === "3d" && scene3DResult?.ok ? (
          t("threeD.status", {
            count: getVisibleLevelReferences3D(
              scene3DResult.model,
              levelVisibility3D,
              activeLevelId3D
            ).length
          })
        ) : selectedLevel && activeProject ? (
          <ProjectEditorStatusBar
            scale={
              workspaceMode === "edit"
                ? editor.presentation.scaleDenominator
                : 75
            }
            units={activeProject.units}
            gridVisible={
              workspaceMode === "edit" && editor.precision.gridVisible
            }
            snapToGrid={workspaceMode === "edit" && editor.precision.snapToGrid}
            gridSpacing={editor.precision.gridSpacing}
            zoom={activeViewport.zoom}
            editing={workspaceMode === "edit"}
            onScaleChange={(scale) =>
              dispatch(editorDocumentScaleChanged(scale))
            }
            onGridVisibleChange={(visible) =>
              dispatch(editorGridVisibilityChanged(visible))
            }
            onSnapToGridChange={(enabled) =>
              dispatch(editorGridSnappingChanged(enabled))
            }
            onGridSpacingChange={(spacing) =>
              dispatch(editorGridSpacingChanged(spacing))
            }
            onZoom={handleZoomViewport}
            onFit={handleFitViewport}
          />
        ) : (
          t("status.unavailable")
        ),
      immersiveWorkspace: true
    }),
    [
      activeProject,
      activeProjectLevel?.name,
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
          {saveFeedback ? t(`persistence.feedback.${saveFeedback}`) : ""}
        </Alert>
      </Snackbar>

      {workspaceRepresentation === "2d" && workspaceMode === "edit" ? (
        <EditorToolbar
          activeTool={editor.activeTool}
          disabled={saveInteractionBlocked}
          onToolToggle={(tool) => dispatch(editorToolToggled(tool))}
          shortcutsOpen={shortcutsOpen}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onCloseShortcuts={() => setShortcutsOpen(false)}
        />
      ) : null}

      {workspaceRepresentation === "3d" ? (
        scene3DResult?.ok ? (
          <Suspense
            fallback={
              <Stack
                role="status"
                spacing={1.5}
                sx={{ alignItems: "center", py: 8 }}
              >
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
          selectionFootprints={selectionFootprints}
          onSelectionStateChange={handleSelectionStateChange}
          onSelectionTranslationPointerDown={
            handleSelectionTranslationPointerDown
          }
          onSelectionTranslationPointerUp={handleSelectionTranslationPointerUp}
          onSelectionTranslationPointerCancel={
            handleSelectionTranslationPointerCancel
          }
          onViewportChange={setViewport}
          onFitViewport={handleFitViewport}
          onResetViewport={handleResetViewport}
          onZoomViewport={handleZoomViewport}
          documentScaleDenominator={
            workspaceMode === "edit" ? editor.presentation.scaleDenominator : 75
          }
          onDocumentScaleChange={
            workspaceMode === "edit"
              ? (denominator) =>
                  dispatch(editorDocumentScaleChanged(denominator))
              : undefined
          }
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
          furnitureModel={{
            items: furniture.model,
            preview: furniture.preview,
            previewValid: furniture.previewValid,
            editing: workspaceMode === "edit" && !saveInteractionBlocked
          }}
          onFurniturePointerDown={furniture.beginGesture}
          onFurniturePointerUp={furniture.endGesture}
          onFurniturePointerCancel={furniture.cancel}
          onEditorCanvasClick={(pointer) => {
            if (editor.activeTool === "furniture")
              furniture.canvasClick(pointer);
            else handleEditorCanvasClick(pointer);
          }}
          onEditorPointerMove={(pointer, pointerId) => {
            if (viewportPanModifierActive) return;
            furniture.pointerMove(pointer, pointerId);
            if (!furniture.transient)
              handleEditorPointerMove(pointer, pointerId);
          }}
          onWallEndpointPointerDown={handleWallEndpointPointerDown}
          onWallEndpointPointerUp={handleWallEndpointPointerUp}
          onWallEndpointPointerCancel={handleWallEndpointPointerCancel}
          onJunctionPointerDown={handleJunctionPointerDown}
          onOpeningPointerDown={handleOpeningPointerDown}
          onOpeningDragThresholdCrossed={handleOpeningDragThresholdCrossed}
          onOpeningPointerUp={handleOpeningPointerUp}
          onOpeningPointerCancel={handleOpeningPointerCancel}
          onStairAdjustmentPointerDown={handleStairAdjustmentPointerDown}
          onStairAdjustmentPointerUp={handleStairAdjustmentPointerUp}
          onStairAdjustmentPointerCancel={handleStairAdjustmentPointerCancel}
          onStairTranslationPointerDown={handleStairTranslationPointerDown}
          onStairTranslationPointerUp={handleStairTranslationPointerUp}
          onStairTranslationPointerCancel={handleStairTranslationPointerCancel}
          onRoomFaceCandidateClick={
            viewportPanModifierActive
              ? undefined
              : (faceKey) => {
                  dispatch(editorSelectionCleared());
                  handleCreateRoom(faceKey);
                }
          }
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
