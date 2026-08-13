import { GeometryEngine, LevelGeometry } from "@casastudio/geometry";
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
  ApiRequestError
} from "../api/CasaStudioApiClient";
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
  type GeometryDisplayOptions
} from "../geometry-playground/GeometrySvgViewer";
import {
  createFitViewportState,
  createViewportTransform2D,
  resetViewportState,
  type ViewportState,
  zoomViewportState
} from "../geometry-playground/viewport-transform-2d";
import { useCasaTranslation } from "../i18n";
import { useProjectGeometryQuery } from "../queries/geometry-queries";
import { useProjectQuery } from "../queries/project-queries";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import {
  cleanEditingSessionLeft,
  editingSessionEntered,
  editorActiveLevelChanged,
  editorActiveToolChanged,
  editorSelectionChanged,
  editorSelectionCleared,
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
  geometrySelectionChanged,
  geometrySelectionCleared,
  geometrySelectionReset,
  selectGeometrySelection
} from "../state/viewer-slice";

const emptySelectionState = createGeometrySelectionState();

/** Renders the authoritative View and local-draft Edit workspace for one Project. */
export function ProjectViewerPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { t } = useCasaTranslation("project-viewer");
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "lg"));
  const dispatch = useAppDispatch();
  const editor = useAppSelector(selectProjectEditor);
  const viewSelection = useAppSelector(selectGeometrySelection);
  const editSelection = useAppSelector(selectEditorGeometrySelection);
  const shouldProtectNavigation = useAppSelector((state) =>
    selectShouldProtectProjectNavigation(state, projectId)
  );
  const blocker = useBlocker(shouldProtectNavigation);
  const projectQuery = useProjectQuery(projectId);
  const geometryQuery = useProjectGeometryQuery(projectId);
  const [displayOptions, setDisplayOptions] = useState(
    defaultGeometryDisplayOptions
  );
  const [selectedViewLevelId, setSelectedViewLevelId] = useState("");
  const [viewport, setViewport] = useState<ViewportState>(resetViewportState);
  const [selectionOwnerSnapshot, setSelectionOwnerSnapshot] =
    useState<GeometrySnapshot>();
  const [viewportOwnerKey, setViewportOwnerKey] = useState("");
  const [dirtyExitBlocked, setDirtyExitBlocked] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

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
    if (!selectedLevel) {
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
  }, [dispatch, geometryResponse, selectedLevel, viewportKey, workspaceMode]);

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

  useEffect(() => {
    if (!selectedLevel) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shortcutsOpen) return;
      const action = getGeometryViewerShortcutAction(event);
      if (!action) return;
      event.preventDefault();
      if (action === "CLEAR_SELECTION") {
        dispatch(
          workspaceMode === "edit"
            ? editorSelectionCleared()
            : geometrySelectionCleared()
        );
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
    handleResetViewport,
    selectedLevel,
    shortcutsOpen,
    workspaceMode
  ]);

  const handleModeChange = useCallback(
    (nextMode: ProjectWorkspaceMode | null) => {
      if (
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
        setDirtyExitBlocked(false);
        return;
      }

      if (editor.dirty) {
        setDirtyExitBlocked(true);
        return;
      }

      dispatch(cleanEditingSessionLeft());
      dispatch(geometrySelectionReset());
      setDirtyExitBlocked(false);
    },
    [
      consistencyFailure,
      dispatch,
      editor.dirty,
      projectResponse,
      selectedViewLevel,
      workspaceMode
    ]
  );

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
      />
    );
  }, [
    displayOptions,
    editor.baseRevision,
    geometryResponse,
    presentationResult,
    selectedLevel,
    selectionState,
    workspaceMode
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

  if (projectQuery.isPending || geometryQuery.isPending) {
    return (
      <Stack role="status" spacing={1.5} sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress size={28} />
        <Typography>{t("loading")}</Typography>
      </Stack>
    );
  }

  const failure = projectQuery.error ?? geometryQuery.error;
  if (failure) return <ProjectViewerError error={failure} />;
  if (!projectResponse || !geometryResponse) {
    return (
      <ProjectViewerError error={new Error("Query completed without data.")} />
    );
  }
  if (consistencyFailure) {
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
      {blocker.state === "blocked" ? (
        <Alert
          severity="warning"
          action={
            <Button onClick={() => blocker.reset()}>
              {t("guard.keepEditing")}
            </Button>
          }
        >
          {t("guard.navigationBlocked")}
        </Alert>
      ) : null}
      {dirtyExitBlocked ? (
        <Alert severity="warning" onClose={() => setDirtyExitBlocked(false)}>
          {t("guard.viewBlocked")}
        </Alert>
      ) : null}

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
                ? t(editor.dirty ? "workspace.unsaved" : "workspace.editing")
                : t("workspace.saved")
            }
          />
        </Stack>
      </Box>

      {workspaceMode === "edit" ? (
        <ProjectEditorToolbar
          activeTool={editor.activeTool}
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
  readonly onChange: (mode: ProjectWorkspaceMode | null) => void;
};

/** Renders the View/Edit control independently from future representation choices. */
function WorkspaceModeControl({ mode, onChange }: WorkspaceModeControlProps) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={mode}
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
  readonly onToolChange: (tool: ProjectEditorTool | null) => void;
};

/** Renders enabled editor tools and explicitly disabled future actions. */
function ProjectEditorToolbar({
  activeTool,
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
              disabled={!tool.enabled}
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
};

/** Provides the durable Layers, Selection, and Properties inspector foundation. */
function ProjectWorkspaceInspector({
  model,
  selectionState,
  options,
  onOptionsChange,
  level,
  revision,
  mode
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
          <GeometrySelectionDetails
            model={model}
            selectionState={selectionState}
          />
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
