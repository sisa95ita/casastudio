import { GeometryEngine, type LevelGeometry } from "@casastudio/geometry";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
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
import { useEffect, useMemo, useState } from "react";

import { useAppShellContent } from "../app-shell/AppShellContext";
import { GeometryBuildErrorPanel } from "./GeometryBuildErrorPanel";
import {
  createGeometryPresentationModel2D,
  type GeometryPresentationModel2D
} from "./geometry-presentation-model-2d";
import { geometryPlaygroundProject } from "./geometry-playground-fixture";
import {
  clearGeometrySelection,
  type GeometryHoverState,
  type GeometrySelection
} from "./geometry-selection-state";
import { collectLevelBounds } from "./geometry-svg-helpers";
import { GeometryLayerControls } from "./GeometryLayerControls";
import { GeometryRuntimeSummary } from "./GeometryRuntimeSummary";
import { GeometrySelectionDetails } from "./GeometrySelectionDetails";
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
  type ViewportState
} from "./viewport-transform-2d";

/**
 * Props for the interactive geometry playground page.
 */
export type GeometryPlaygroundPageProps = {
  readonly project?: Project;
};

/**
 * Hosts the Phase 2 interactive geometry runtime playground.
 *
 * The page intentionally executes the real pipeline from canonical `Project`
 * through `GeometryEngine.build(project)` into `GeometryModel`, then adapts one
 * selected `LevelGeometry` into frontend-only 2D presentation state. Selection,
 * hover, pan, and zoom remain UI state and never mutate the runtime model.
 */
export function GeometryPlaygroundPage({
  project = geometryPlaygroundProject
}: GeometryPlaygroundPageProps) {
  const buildResult = useMemo(() => GeometryEngine.build(project), [project]);
  const [displayOptions, setDisplayOptions] = useState(defaultGeometryDisplayOptions);
  const [selection, setSelection] = useState<GeometrySelection | undefined>(undefined);
  const [hover, setHover] = useState<GeometryHoverState>(undefined);
  const [selectedLevelId, setSelectedLevelId] = useState(() =>
    buildResult.ok ? (buildResult.model.levels[0]?.id ?? "") : ""
  );

  const headerAccessory = useMemo(
    () => <Chip label="Technical preview" color="warning" variant="outlined" />,
    []
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
            selection,
            hover
          })
        : undefined,
    [hover, selectedLevel, selection, viewport]
  );

  useEffect(() => {
    setViewport(createInitialViewportState(selectedLevel));
    setSelection(clearGeometrySelection());
    setHover(undefined);
  }, [selectedLevel]);

  const handleFitViewport = () => {
    setViewport(createInitialViewportState(selectedLevel));
  };

  const handleResetViewport = () => {
    setViewport(resetViewportState());
  };

  const shellContent = useMemo(
    () => ({
      title: "Geometry Playground",
      breadcrumb: "Runtime",
      headerAccessory,
      inspector: !buildResult.ok ? (
        <Alert severity="error" variant="outlined">
          Geometry Engine build failed before a runtime level could be inspected.
        </Alert>
      ) : selectedLevel ? (
        <GeometryPlaygroundInspector
          level={selectedLevel}
          presentationModel={presentationModel}
          selection={selection}
          options={displayOptions}
          onOptionsChange={setDisplayOptions}
        />
      ) : (
        <Alert severity="info" variant="outlined">
          GeometryEngine produced a model with no levels.
        </Alert>
      ),
      status: !buildResult.ok ? (
        "Engine: build failed"
      ) : selectedLevel ? (
        <GeometryPlaygroundStatus level={selectedLevel} selection={selection} buildStatus="OK" />
      ) : (
        "Engine: OK | No levels"
      )
    }),
    [buildResult.ok, displayOptions, headerAccessory, presentationModel, selectedLevel, selection]
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
          <InputLabel id="geometry-level-selector-label">Level</InputLabel>
          <Select
            labelId="geometry-level-selector-label"
            label="Level"
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
                SVG Technical Viewer
              </Typography>
              <Tooltip title="Fit to view">
                <IconButton aria-label="Fit to view" onClick={handleFitViewport}>
                  <FitScreenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reset viewport">
                <IconButton aria-label="Reset viewport" onClick={handleResetViewport}>
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
          <GeometrySvgViewer
            level={selectedLevel}
            options={displayOptions}
            viewport={viewport}
            selection={selection}
            hover={hover}
            onSelectionChange={setSelection}
            onHoverChange={setHover}
            onViewportChange={setViewport}
          />
        </Paper>
      ) : (
        <Paper className="geometry-empty-state" role="status" sx={{ p: 2 }}>
          GeometryEngine produced a model with no levels.
        </Paper>
      )}
    </Stack>
  );
}

/**
 * Renders the route-local title block for the playground workspace.
 */
function PageIntro() {
  return (
    <Box className="geometry-page-header">
      <Typography variant="overline" color="warning.dark">
        Technical Runtime Viewer
      </Typography>
      <Typography variant="h1">Geometry Playground</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 820 }}>
        This route renders a canonical Project through GeometryEngine.build into
        an immutable GeometryModel, fitted through a small XZ-to-SVG viewport
        transform.
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
  readonly selection?: GeometrySelection;
  readonly options: GeometryDisplayOptions;
  readonly onOptionsChange: (options: GeometryDisplayOptions) => void;
};

/**
 * Renders layer controls and compact runtime diagnostics for the active level.
 */
export function GeometryPlaygroundInspector({
  level,
  presentationModel,
  selection,
  options,
  onOptionsChange
}: GeometryPlaygroundInspectorProps) {
  return (
    <Stack spacing={1.5}>
      <GeometryLayerControls options={options} onOptionsChange={onOptionsChange} />
      <Divider />
      {presentationModel ? (
        <>
          <GeometrySelectionDetails model={presentationModel} selection={selection} />
          <Divider />
        </>
      ) : null}
      <GeometryRuntimeSummary level={level} />
    </Stack>
  );
}

/**
 * Props for compact status-bar geometry runtime information.
 */
export type GeometryPlaygroundStatusProps = {
  readonly level: GeometryPlaygroundInspectorProps["level"];
  readonly selection?: GeometrySelection;
  readonly buildStatus: "OK" | "Error";
};

/**
 * Renders glanceable Geometry Engine counts for the shell status bar.
 */
export function GeometryPlaygroundStatus({
  level,
  selection,
  buildStatus
}: GeometryPlaygroundStatusProps) {
  return (
    <Typography variant="caption" color="text.secondary" noWrap>
      Level: {level.sourceLevelId} | Vertices: {level.vertices.length} | Edges:{" "}
      {level.boundaryEdges.length} | Polygons: {level.polygons.length} | Selection:{" "}
      {selection ? `${selection.kind} ${selection.geometryId}` : "None"} | Engine: {buildStatus}
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
