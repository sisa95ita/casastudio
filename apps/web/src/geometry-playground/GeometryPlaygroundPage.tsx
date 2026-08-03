import { GeometryEngine, type LevelGeometry } from "@casastudio/geometry";
import {
  Alert,
  Box,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from "@mui/material";
import type { Project } from "@casastudio/schema";
import { useMemo, useState } from "react";

import { useAppShellContent } from "../app-shell/AppShellContext";
import { GeometryBuildErrorPanel } from "./GeometryBuildErrorPanel";
import { geometryPlaygroundProject } from "./geometry-playground-fixture";
import { GeometryLayerControls } from "./GeometryLayerControls";
import { GeometryRuntimeSummary } from "./GeometryRuntimeSummary";
import {
  defaultGeometryDisplayOptions,
  type GeometryDisplayOptions,
  GeometrySvgViewer
} from "./GeometrySvgViewer";

/**
 * Props for the read-only geometry playground page.
 */
export type GeometryPlaygroundPageProps = {
  readonly project?: Project;
};

/**
 * Hosts the Phase 1 read-only geometry runtime playground.
 *
 * The page intentionally executes the real pipeline from canonical `Project`
 * through `GeometryEngine.build(project)` into `GeometryModel`, then passes one
 * selected `LevelGeometry` directly to SVG components. No complete editor
 * view-model is introduced in this phase because the page has no editing,
 * selection, commands, or mutable domain operations.
 */
export function GeometryPlaygroundPage({
  project = geometryPlaygroundProject
}: GeometryPlaygroundPageProps) {
  const buildResult = useMemo(() => GeometryEngine.build(project), [project]);
  const [displayOptions, setDisplayOptions] = useState(defaultGeometryDisplayOptions);
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
        <GeometryPlaygroundStatus level={selectedLevel} buildStatus="OK" />
      ) : (
        "Engine: OK | No levels"
      )
    }),
    [buildResult.ok, displayOptions, headerAccessory, selectedLevel]
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
            <Typography variant="subtitle2" component="h2" id="geometry-viewer-heading">
              SVG Debug Viewer
            </Typography>
          </Box>
          <GeometrySvgViewer level={selectedLevel} options={displayOptions} />
        </Paper>
      ) : (
        <Paper className="geometry-empty-state" role="status" sx={{ p: 2 }}>
          GeometryEngine produced a model with no levels.
        </Paper>
      )}
    </Stack>
  );
}

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
 * Inspector content for the read-only geometry playground route.
 *
 * Controls stay route-owned even though the shell renders the inspector, which
 * prevents geometry diagnostics from becoming permanent global shell controls.
 */
export type GeometryPlaygroundInspectorProps = {
  readonly level: LevelGeometry;
  readonly options: GeometryDisplayOptions;
  readonly onOptionsChange: (options: GeometryDisplayOptions) => void;
};

/**
 * Renders layer controls and compact runtime diagnostics for the active level.
 */
export function GeometryPlaygroundInspector({
  level,
  options,
  onOptionsChange
}: GeometryPlaygroundInspectorProps) {
  return (
    <Stack spacing={1.5}>
      <GeometryLayerControls options={options} onOptionsChange={onOptionsChange} />
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
  readonly buildStatus: "OK" | "Error";
};

/**
 * Renders glanceable Geometry Engine counts for the shell status bar.
 */
export function GeometryPlaygroundStatus({
  level,
  buildStatus
}: GeometryPlaygroundStatusProps) {
  return (
    <Typography variant="caption" color="text.secondary" noWrap>
      Level: {level.sourceLevelId} | Vertices: {level.vertices.length} | Edges:{" "}
      {level.boundaryEdges.length} | Polygons: {level.polygons.length} | Engine: {buildStatus}
    </Typography>
  );
}
