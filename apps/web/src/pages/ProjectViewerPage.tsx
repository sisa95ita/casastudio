import { GeometryEngine, LevelGeometry } from "@casastudio/geometry";
import {
  createConnectedWall,
  deleteWallAndCollapseRedundantTopology,
  moveWallEndpoint,
  updateWallProperties,
  type Project,
  type Wall,
  type WallEndpoint
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
import PanToolAltRoundedIcon from "@mui/icons-material/PanToolAltRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
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
import { GeometryLayerControls } from "../geometry-playground/GeometryLayerControls";
import type { GeometryPresentationModel2D } from "../geometry-playground/geometry-presentation-model-2d";
import { createRuntimeGeometryPresentationModel2D } from "../geometry-playground/geometry-presentation-model-2d";
import { GeometrySelectionDetails } from "../geometry-playground/GeometrySelectionDetails";
import { GeometryShortcutGuide } from "../geometry-playground/GeometryShortcutGuide";
import { GeometryViewerPanel } from "../geometry-playground/GeometryViewerPanel";
import {
  collectGeometrySnapshotLevelBounds,
  createGeometrySnapshotPresentationModel2D
} from "../geometry-playground/geometry-snapshot-presentation-adapter";
import {
  createGeometrySelectionState,
  type GeometrySelectionState
} from "../geometry-playground/geometry-selection-state";
import { collectLevelBounds } from "../geometry-playground/geometry-svg-helpers";
import { getGeometryViewerShortcutAction } from "../geometry-playground/geometry-viewer-shortcuts";
import {
  defaultGeometryDisplayOptions,
  geometrySvgViewport,
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
  editorEndpointDragStarted,
  editorSelectionChanged,
  editorSelectionCleared,
  editorTransientInteractionCleared,
  editorTransientPointerMoved,
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
  createWallIdentifier,
  doesWallCloseCycle,
  findProjectWall,
  getWallEndpointEditingAvailability,
  getWallEditingErrorKey,
  type WallEditingErrorKey
} from "../state/project-wall-editing";
import { resolveDrawWallSnapCandidate } from "../state/project-wall-snapping";
import {
  geometrySelectionChanged,
  geometrySelectionCleared,
  geometrySelectionReset,
  selectGeometrySelection
} from "../state/viewer-slice";
import { ProjectSelectionDetails } from "./ProjectSelectionDetails";
import {
  ProjectPersistenceDialogs,
  type ProjectPersistenceDialog
} from "./ProjectPersistenceDialogs";

const emptySelectionState = createGeometrySelectionState();

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
    defaultGeometryDisplayOptions
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
  const [editingError, setEditingError] = useState<WallEditingErrorKey>();

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

      return { ok: true as const, model };
    } catch (error) {
      return { ok: false as const, error };
    }
  }, [
    activeViewport,
    consistencyFailure,
    selectedLevel,
    selectionState,
    workspaceMode
  ]);

  const selectedEditWall = useMemo(() => {
    if (
      workspaceMode !== "edit" ||
      !presentationResult?.ok ||
      selectionState.selected.length !== 1 ||
      selectionState.selected[0]?.kind !== "BOUNDARY_EDGE"
    ) {
      return undefined;
    }

    const selectedEdge = presentationResult.model.boundaryEdges.find(
      (edge) => edge.geometryId === selectionState.selected[0]?.geometryId
    );
    return findProjectWall(
      editor.draft,
      editor.activeLevelId,
      selectedEdge?.sourceWallId
    );
  }, [
    editor.activeLevelId,
    editor.draft,
    presentationResult,
    selectionState.selected,
    workspaceMode
  ]);
  const selectedWallEndpointAvailability =
    getWallEndpointEditingAvailability(
      editor.draft,
      editor.activeLevelId,
      selectedEditWall?.id
    );

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
              : selectedEditWall.start,
          end:
            transient?.kind === "move-wall-endpoint" &&
            transient.wallId === selectedEditWall.id &&
            transient.endpoint === "end"
              ? transient.currentPointerPoint
              : selectedEditWall.end,
          draggingEndpoint:
            transient?.kind === "move-wall-endpoint" &&
            transient.wallId === selectedEditWall.id
              ? transient.endpoint
              : undefined
        }
      : undefined;

    return {
      drawWall:
        transient?.kind === "draw-wall"
          ? {
              start: transient.startPoint,
              end: transient.currentPointerPoint
            }
          : undefined,
      snapCandidate: editor.transient.snapCandidate,
      selectedWall
    };
  }, [
    editor.transient.interaction,
    editor.transient.snapCandidate,
    selectedEditWall,
    selectedWallEndpointAvailability,
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
        editor.activeTool !== "draw-wall" ||
        !editor.draft ||
        !editor.activeLevelId
      ) {
        return;
      }

      const snapCandidate =
        presentationResult?.ok
          ? resolveDrawWallSnapCandidate(
              pointer.svgPoint,
              presentationResult.model,
              pointer.cssPixelsPerSvgUnit
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
        startConnection: interaction.startConnectionWallId
          ? {
              wallId: interaction.startConnectionWallId,
              newWallId: createWallIdentifier()
            }
          : undefined,
        endConnection:
          snapCandidate?.kind === "wall-interior"
            ? {
                wallId: snapCandidate.wallId,
                newWallId: createWallIdentifier()
              }
            : undefined
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
      editor.transient.interaction,
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
        editor.activeTool === "draw-wall" &&
        presentationResult?.ok
      ) {
        const snapCandidate = resolveDrawWallSnapCandidate(
          pointer.svgPoint,
          presentationResult.model,
          pointer.cssPixelsPerSvgUnit
        );
        dispatch(
          editorDrawWallPointerMoved({
            point: snapCandidate?.point ?? pointer.worldPoint,
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
      editor.transient.interaction,
      presentationResult,
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
      dispatch(
        editorEndpointDragStarted({
          levelId: editor.activeLevelId,
          wallId: selectedEditWall.id,
          endpoint,
          pointerId,
          point: selectedEditWall[endpoint]
        })
      );
    },
    [
      dispatch,
      editor.activeLevelId,
      editor.activeTool,
      selectedEditWall,
      selectedWallEndpointAvailability,
      saveInteractionBlocked,
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
        interaction?.kind !== "move-wall-endpoint" ||
        interaction.pointerId !== pointerId
      ) {
        return;
      }

      const availability = getWallEndpointEditingAvailability(
        editor.draft,
        interaction.levelId,
        interaction.wallId
      );
      if (!availability?.[interaction.endpoint].draggable) {
        dispatch(editorTransientInteractionCleared());
        return;
      }

      const result = moveWallEndpoint(editor.draft, {
        levelId: interaction.levelId,
        wallId: interaction.wallId,
        endpoint: interaction.endpoint,
        position: point
      });
      dispatch(editorTransientInteractionCleared());

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
        interaction?.kind === "move-wall-endpoint" &&
        interaction.pointerId === pointerId
      ) {
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

  useEffect(() => {
    if (!selectedLevel) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shortcutsOpen || saveInteractionBlocked) return;
      const action = getGeometryViewerShortcutAction(event);
      if (!action) return;
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
    handleResetViewport,
    editor.transient.interaction,
    editor.transient.snapCandidate,
    selectedLevel,
    selectedEditWall,
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

  const inspector = useMemo(() => {
    if (!presentationResult?.ok || !selectedLevel) {
      return undefined;
    }

    return (
      <ProjectWorkspaceInspector
        model={presentationResult.model}
        selectionState={selectionState}
        options={displayOptions}
        onOptionsChange={setDisplayOptions}
        level={selectedLevel.sourceLevelId}
        revision={
          workspaceMode === "edit"
            ? editor.baseRevision
            : geometryResponse?.sourceRevision
        }
        mode={workspaceMode}
        selectedWall={selectedEditWall}
        endpointAvailability={selectedWallEndpointAvailability}
        units={projectResponse?.project.units}
        onDeleteWall={handleDeleteSelectedWall}
        onUpdateWallProperties={handleUpdateSelectedWallProperties}
      />
    );
  }, [
    displayOptions,
    editor.baseRevision,
    geometryResponse,
    presentationResult,
    selectedLevel,
    selectedEditWall,
    selectedWallEndpointAvailability,
    selectionState,
    workspaceMode,
    projectResponse?.project.units,
    handleDeleteSelectedWall,
    handleUpdateSelectedWallProperties
  ]);

  const shellContent = useMemo(
    () => ({
      title: projectResponse?.project.name ?? t("shell.title"),
      breadcrumb: t("shell.breadcrumb"),
      inspector: isTablet || isPhone ? undefined : inspector,
      status:
        projectQuery.isFetching || geometryQuery.isFetching
          ? t("status.loading")
          : selectedLevel
            ? t(workspaceMode === "edit" ? "status.editing" : "status.saved", {
                level: selectedLevel.sourceLevelId,
                revision:
                  workspaceMode === "edit"
                    ? editor.baseRevision
                    : geometryResponse?.sourceRevision
              })
            : t("status.unavailable")
    }),
    [
      editor.baseRevision,
      geometryQuery.isFetching,
      geometryResponse,
      inspector,
      isPhone,
      isTablet,
      projectQuery.isFetching,
      projectResponse,
      selectedLevel,
      t,
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

      <Box className="project-viewer-context">
        <Box className="project-viewer-context__title">
          <Typography variant="overline" color="primary.dark">
            {t(
              workspaceMode === "edit" ? "intro.editEyebrow" : "intro.eyebrow"
            )}
          </Typography>
          <Typography component="h1" variant="h3">
            {projectResponse.project.name}
          </Typography>
        </Box>

        {!isPhone ? (
          <WorkspaceModeControl
            mode={workspaceMode}
            disabled={saveInteractionBlocked}
            onChange={handleModeChange}
          />
        ) : (
          <Chip
            icon={<LockOutlineRoundedIcon />}
            label={t("workspace.readOnly")}
          />
        )}

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <ProjectLevelControl
            mode={workspaceMode}
            viewLevels={viewLevels}
            selectedViewLevel={selectedViewLevel}
            draftLevelIds={
              editor.draft?.building.levels.map((level) => ({
                id: level.id,
                name: level.name
              })) ?? []
            }
            activeEditLevelId={editor.activeLevelId}
            onViewLevelChange={setSelectedViewLevelId}
            onEditLevelChange={(levelId) =>
              dispatch(editorActiveLevelChanged(levelId))
            }
          />
          {!isPhone ? (
            <ShortcutsHelpControl
              open={shortcutsOpen}
              onOpen={() => setShortcutsOpen(true)}
              onClose={() => setShortcutsOpen(false)}
            />
          ) : null}
          <Chip
            icon={
              workspaceMode === "edit" ? (
                <EditRoundedIcon />
              ) : (
                <CheckCircleRoundedIcon />
              )
            }
            color={
              editor.dirty && workspaceMode === "edit" ? "warning" : "success"
            }
            variant="outlined"
            label={
              workspaceMode === "edit"
                ? t(editor.dirty ? "workspace.unsaved" : "workspace.clean")
                : t("workspace.saved")
            }
          />
          {workspaceMode === "edit" ? (
            <Stack direction="row" spacing={1}>
              {editor.dirty ? (
                <Button
                  color="inherit"
                  disabled={saveInteractionBlocked}
                  onClick={() => setPersistenceDialog("discard")}
                >
                  {t("persistence.discardAction")}
                </Button>
              ) : null}
              <Button
                variant="contained"
                disabled={!editor.dirty || saveInteractionBlocked}
                onClick={handleSave}
              >
                {t("persistence.save")}
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Box>

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
          title={t("viewer.title")}
          headingId="project-geometry-viewer-heading"
          presentationModel={presentationResult.model}
          options={displayOptions}
          viewport={activeViewport}
          selectionState={selectionState}
          onSelectionStateChange={handleSelectionStateChange}
          onViewportChange={setViewport}
          onFitViewport={handleFitViewport}
          onResetViewport={handleResetViewport}
          onZoomViewport={handleZoomViewport}
          statusLabel={t(
            workspaceMode === "edit"
              ? "workspace.editing"
              : "workspace.readOnly"
          )}
          interaction={
            workspaceMode === "edit"
              ? getProjectEditorInteraction(editor.activeTool)
              : undefined
          }
          editorOverlay={editorOverlay}
          onEditorCanvasClick={handleEditorCanvasClick}
          onEditorPointerMove={handleEditorPointerMove}
          onWallEndpointPointerDown={handleWallEndpointPointerDown}
          onWallEndpointPointerUp={handleWallEndpointPointerUp}
          onWallEndpointPointerCancel={handleWallEndpointPointerCancel}
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

type ProjectEditorToolbarProps = {
  readonly activeTool: ProjectEditorTool | null;
  readonly disabled: boolean;
  readonly onToolChange: (tool: ProjectEditorTool | null) => void;
};

/** Renders enabled editor tools and explicitly disabled future actions. */
function ProjectEditorToolbar({
  activeTool,
  disabled,
  onToolChange
}: ProjectEditorToolbarProps) {
  const { t } = useCasaTranslation("project-viewer");
  const icons = {
    select: <NearMeRoundedIcon fontSize="small" />,
    "draw-wall": <LinearScaleRoundedIcon fontSize="small" />,
    pan: <PanToolAltRoundedIcon fontSize="small" />
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

      <Stack direction="row" spacing={0.5}>
        <FutureToolButton label={t("tools.undo")} icon={<UndoRoundedIcon />} />
        <FutureToolButton label={t("tools.redo")} icon={<RedoRoundedIcon />} />
      </Stack>
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
            <GeometryShortcutGuide showTitle={false} />
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FutureToolButton({
  label,
  icon
}: {
  readonly label: string;
  readonly icon: ReactNode;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const accessibleLabel = t("tools.comingSoon", { tool: label });

  return (
    <Tooltip title={accessibleLabel}>
      <span>
        <Button
          disabled
          startIcon={icon}
          aria-label={accessibleLabel}
          size="small"
        >
          {label}
        </Button>
      </span>
    </Tooltip>
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
  readonly level: string;
  readonly revision?: number | null;
  readonly mode: ProjectWorkspaceMode;
  readonly selectedWall?: Wall;
  readonly endpointAvailability?: ReturnType<
    typeof getWallEndpointEditingAvailability
  >;
  readonly units?: Project["units"];
  readonly onDeleteWall: () => void;
  readonly onUpdateWallProperties: (properties: {
    readonly height?: number;
    readonly thickness?: number;
  }) => boolean;
};

/** Provides the durable Layers, Selection, and Properties inspector foundation. */
function ProjectWorkspaceInspector({
  model,
  selectionState,
  options,
  onOptionsChange,
  level,
  revision,
  mode,
  selectedWall,
  endpointAvailability,
  units,
  onDeleteWall,
  onUpdateWallProperties
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
          <GeometryLayerControls
            options={options}
            onOptionsChange={onOptionsChange}
          />
        ) : tab === "selection" ? (
          mode === "edit" && units ? (
            <ProjectSelectionDetails
              model={model}
              selectionState={selectionState}
              wall={selectedWall}
              units={units}
              endpointAvailability={endpointAvailability}
              onDeleteWall={onDeleteWall}
              onUpdateWallProperties={onUpdateWallProperties}
            />
          ) : (
            <GeometrySelectionDetails
              model={model}
              selectionState={selectionState}
            />
          )
        ) : (
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">
              {t(mode === "edit" ? "inspector.draft" : "inspector.snapshot")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("inspector.level", { level })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("inspector.revision", { revision })}
            </Typography>
          </Stack>
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
