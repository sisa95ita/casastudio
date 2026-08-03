import { GeometryEngine, type LevelGeometry } from "@casastudio/geometry";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import {
  Alert,
  Box,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import type { Project } from "@casastudio/schema";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppShellContent } from "../app-shell/AppShellContext";
import { useCasaTranslation } from "../i18n";
import { GeometryBuildErrorPanel } from "./GeometryBuildErrorPanel";
import {
  createGeometryPresentationModel2D,
  type GeometryPresentationModel2D
} from "./geometry-presentation-model-2d";
import { geometryPlaygroundProject } from "./geometry-playground-fixture";
import {
  clearGeometrySelection,
  createGeometrySelectionState,
  type GeometrySelectionState
} from "./geometry-selection-state";
import { collectLevelBounds } from "./geometry-svg-helpers";
import { GeometryLayerControls } from "./GeometryLayerControls";
import { GeometryRuntimeSummary } from "./GeometryRuntimeSummary";
import { GeometryShortcutGuide } from "./GeometryShortcutGuide";
import { GeometrySelectionDetails } from "./GeometrySelectionDetails";
import { getGeometryViewerShortcutAction } from "./geometry-viewer-shortcuts";
import {
  defaultGeometryDisplayOptions,
  geometrySvgViewport,
  type GeometryDisplayOptions,
  GeometrySvgViewer
} from "./GeometrySvgViewer";
import {
  createFitViewportState,
  createViewportTransform2D,
  resetViewportState,
  type ViewportState,
  zoomViewportState
} from "./viewport-transform-2d";

/**
 * Props for the interactive geometry playground page.
 */
export type GeometryPlaygroundPageProps = {
  readonly project?: Project;
};

/**
 * Hosts the Phase 3 interactive geometry runtime playground.
 *
 * The page intentionally executes the real pipeline from canonical `Project`
 * through `GeometryEngine.build(project)` into `GeometryModel`, then adapts one
 * selected `LevelGeometry` into frontend-only 2D presentation state. Selection,
 * hover, pan, and zoom remain UI state and never mutate the runtime model.
 */
export function GeometryPlaygroundPage({
  project = geometryPlaygroundProject
}: GeometryPlaygroundPageProps) {
  const { t } = useCasaTranslation("geometry-playground");
  const { t: navigationT } = useCasaTranslation("navigation");
  const buildResult = useMemo(() => GeometryEngine.build(project), [project]);
  const [displayOptions, setDisplayOptions] = useState(defaultGeometryDisplayOptions);
  const [selectionState, setSelectionState] = useState<GeometrySelectionState>(() =>
    createGeometrySelectionState()
  );
  const [selectedLevelId, setSelectedLevelId] = useState(() =>
    buildResult.ok ? (buildResult.model.levels[0]?.id ?? "") : ""
  );

  const headerAccessory = useMemo(
    () => <Chip label={t("shell.technicalPreview")} color="warning" variant="outlined" />,
    [t]
  );

  const selectedLevel = buildResult.ok
    ? (buildResult.model.levels.find((level) => level.id === selectedLevelId) ??
      buildResult.model.levels[0])
    : undefined;
  const [viewport, setViewport] = useState<ViewportState>(() =>
    createInitialViewportState(selectedLevel)
  );
  const presentationModel = useMemo(
    () =>
      selectedLevel
        ? createGeometryPresentationModel2D({
            level: selectedLevel,
            transform: createViewportTransform2D(viewport),
            selectionState
          })
        : undefined,
    [selectedLevel, selectionState, viewport]
  );

  useEffect(() => {
    setViewport(createInitialViewportState(selectedLevel));
    setSelectionState(createGeometrySelectionState());
  }, [selectedLevel]);

  const handleFitViewport = useCallback(() => {
    setViewport(createInitialViewportState(selectedLevel));
  }, [selectedLevel]);

  const handleResetViewport = useCallback(() => {
    setViewport(resetViewportState());
  }, []);

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
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = getGeometryViewerShortcutAction(event);

      if (!action) {
        return;
      }

      event.preventDefault();

      if (action === "CLEAR_SELECTION") {
        setSelectionState((currentState) => clearGeometrySelection(currentState));
        return;
      }

      if (action === "FIT_VIEWPORT") {
        handleFitViewport();
        return;
      }

      handleResetViewport();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleFitViewport, handleResetViewport]);

  const shellContent = useMemo(
    () => ({
      title: t("shell.title"),
      breadcrumb: navigationT("breadcrumbs.runtime"),
      headerAccessory,
      inspector: !buildResult.ok ? (
        <Alert severity="error" variant="outlined">
          {t("errors.buildFailedInspector")}
        </Alert>
      ) : selectedLevel ? (
        <GeometryPlaygroundInspector
          level={selectedLevel}
          presentationModel={presentationModel}
          selectionState={selectionState}
          options={displayOptions}
          onOptionsChange={setDisplayOptions}
        />
      ) : (
        <Alert severity="info" variant="outlined">
          {t("viewer.noLevels")}
        </Alert>
      ),
      status: !buildResult.ok ? (
        t("status.engineBuildFailed")
      ) : selectedLevel ? (
        <GeometryPlaygroundStatus
          level={selectedLevel}
          selectionState={selectionState}
          buildStatus="ok"
        />
      ) : (
        t("status.engineNoLevels")
      )
    }),
    [
      buildResult.ok,
      displayOptions,
      headerAccessory,
      navigationT,
      presentationModel,
      selectedLevel,
      selectionState,
      t
    ]
  );

  useAppShellContent(shellContent);

  if (!buildResult.ok) {
    return (
      <Stack className="geometry-page" spacing={1.5}>
        <PageIntro />
        <GeometryBuildErrorPanel errors={buildResult.errors} />
      </Stack>
    );
  }

  return (
    <Stack className="geometry-page" spacing={1.5}>
      <PageIntro />

      {selectedLevel && buildResult.model.levels.length > 1 ? (
        <FormControl size="small" sx={{ maxWidth: 280 }}>
          <InputLabel id="geometry-level-selector-label">{t("levelSelector.label")}</InputLabel>
          <Select
            labelId="geometry-level-selector-label"
            label={t("levelSelector.label")}
            value={selectedLevel.id}
            onChange={(event) => setSelectedLevelId(event.target.value)}
          >
            {buildResult.model.levels.map((level) => (
              <MenuItem key={level.id} value={level.id}>
                {level.sourceLevelId}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}

      {selectedLevel ? (
        <Paper
          component="section"
          className="geometry-viewer-panel"
          aria-labelledby="geometry-viewer-heading"
          sx={{
            border: 1,
            borderColor: "divider",
            display: "flex",
            flex: "1 1 auto",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden"
          }}
        >
          <Box sx={{ borderBottom: 1, borderColor: "divider", px: 1.5, py: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography
                variant="subtitle2"
                component="h2"
                id="geometry-viewer-heading"
                sx={{ flex: "1 1 auto" }}
              >
                {t("viewer.title")}
              </Typography>
              <Tooltip title={t("toolbar.zoomOut")}>
                <IconButton
                  aria-label={t("toolbar.zoomOut")}
                  onClick={() => handleZoomViewport(0.85)}
                >
                  <ZoomOutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t("toolbar.zoomIn")}>
                <IconButton
                  aria-label={t("toolbar.zoomIn")}
                  onClick={() => handleZoomViewport(1.18)}
                >
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t("toolbar.fit")}>
                <IconButton aria-label={t("toolbar.fit")} onClick={handleFitViewport}>
                  <FitScreenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t("toolbar.reset")}>
                <IconButton aria-label={t("toolbar.reset")} onClick={handleResetViewport}>
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
          <GeometrySvgViewer
            level={selectedLevel}
            options={displayOptions}
            viewport={viewport}
            selectionState={selectionState}
            onSelectionStateChange={setSelectionState}
            onViewportChange={setViewport}
          />
        </Paper>
      ) : (
        <Paper className="geometry-empty-state" role="status" sx={{ p: 2 }}>
          {t("viewer.noLevels")}
        </Paper>
      )}
    </Stack>
  );
}

/**
 * Renders the route-local title block for the playground workspace.
 */
function PageIntro() {
  const { t } = useCasaTranslation("geometry-playground");

  return (
    <Box className="geometry-page-header">
      <Typography variant="overline" color="warning.dark">
        {t("intro.eyebrow")}
      </Typography>
      <Typography variant="h1">{t("intro.heading")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 820 }}>
        {t("intro.description")}
      </Typography>
    </Box>
  );
}

/**
 * Inspector content for the interactive geometry playground route.
 *
 * Controls stay route-owned even though the shell renders the inspector, which
 * prevents geometry diagnostics from becoming permanent global shell controls.
 */
export type GeometryPlaygroundInspectorProps = {
  readonly level: LevelGeometry;
  readonly presentationModel?: GeometryPresentationModel2D;
  readonly selectionState: GeometrySelectionState;
  readonly options: GeometryDisplayOptions;
  readonly onOptionsChange: (options: GeometryDisplayOptions) => void;
};

/**
 * Renders layer controls and compact runtime diagnostics for the active level.
 */
export function GeometryPlaygroundInspector({
  level,
  presentationModel,
  selectionState,
  options,
  onOptionsChange
}: GeometryPlaygroundInspectorProps) {
  return (
    <Stack spacing={1.5}>
      <GeometryLayerControls options={options} onOptionsChange={onOptionsChange} />
      <Divider />
      {presentationModel ? (
        <>
          <GeometrySelectionDetails model={presentationModel} selectionState={selectionState} />
          <Divider />
        </>
      ) : null}
      <GeometryShortcutGuide />
      <Divider />
      <GeometryRuntimeSummary level={level} />
    </Stack>
  );
}

/**
 * Props for compact status-bar geometry runtime information.
 */
export type GeometryPlaygroundStatusProps = {
  readonly level: GeometryPlaygroundInspectorProps["level"];
  readonly selectionState: GeometrySelectionState;
  readonly buildStatus: "ok" | "error";
};

/**
 * Renders glanceable Geometry Engine counts for the shell status bar.
 */
export function GeometryPlaygroundStatus({
  level,
  selectionState,
  buildStatus
}: GeometryPlaygroundStatusProps) {
  const { t } = useCasaTranslation("geometry-playground");
  const selectionLabel =
    selectionState.selected.length === 0
      ? t("status.none")
      : selectionState.selected
          .map((selection) => `${selection.kind} ${selection.geometryId}`)
          .join(", ");

  return (
    <Typography variant="caption" color="text.secondary" noWrap>
      {t("status.level")}: {level.sourceLevelId} | {t("status.vertices")}:{" "}
      {level.vertices.length} | {t("status.edges")}: {level.boundaryEdges.length} |{" "}
      {t("status.polygons")}: {level.polygons.length} | {t("status.selection")}:{" "}
      {selectionLabel} | {t("status.engine")}: {t(`status.${buildStatus}`)}
    </Typography>
  );
}

const createInitialViewportState = (level: LevelGeometry | undefined): ViewportState => {
  const bounds = level ? collectLevelBounds(level) : undefined;

  if (!bounds) {
    return resetViewportState();
  }

  return createFitViewportState({
    bounds,
    viewportWidth: geometrySvgViewport.width,
    viewportHeight: geometrySvgViewport.height,
    padding: geometrySvgViewport.padding
  });
};
