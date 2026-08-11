import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
  ApiAuthenticationUnavailableError,
  ApiRequestError
} from "../api/CasaStudioApiClient";
import type { GeometryLevel, GeometrySnapshot } from "../api/api-types";
import { useAppShellContent } from "../app-shell/AppShellContext";
import { GeometryLayerControls } from "../geometry-playground/GeometryLayerControls";
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
  geometrySelectionChanged,
  geometrySelectionCleared,
  geometrySelectionReset,
  selectGeometrySelection
} from "../state/viewer-slice";

const emptySelectionState = createGeometrySelectionState();

/** Renders the authoritative read-only Project geometry workspace. */
export function ProjectViewerPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { t } = useCasaTranslation("project-viewer");
  const dispatch = useAppDispatch();
  const selectionState = useAppSelector(selectGeometrySelection);
  const projectQuery = useProjectQuery(projectId);
  const geometryQuery = useProjectGeometryQuery(projectId);
  const [displayOptions, setDisplayOptions] = useState(defaultGeometryDisplayOptions);
  const [selectedLevelId, setSelectedLevelId] = useState("");
  const [viewport, setViewport] = useState<ViewportState>(resetViewportState);
  const [selectionOwnerSnapshot, setSelectionOwnerSnapshot] = useState<GeometrySnapshot>();
  const [viewportOwnerSnapshot, setViewportOwnerSnapshot] = useState<GeometrySnapshot>();

  const projectResponse = projectQuery.data;
  const geometryResponse = geometryQuery.data;
  const consistencyFailure = getConsistencyFailure(projectResponse, geometryResponse);
  const geometryIdentity =
    projectResponse && geometryResponse && !consistencyFailure
      ? `${projectResponse.project.id}:${geometryResponse.sourceRevision}:${geometryResponse.geometry.id}`
      : undefined;
  const levels = geometryResponse?.geometry.levels ?? [];
  const selectedLevel =
    levels.find((level) => level.id === selectedLevelId) ?? levels[0];
  const safeSelectionState =
    geometryResponse && selectionOwnerSnapshot === geometryResponse.geometry
      ? selectionState
      : emptySelectionState;
  const activeViewport =
    geometryResponse && viewportOwnerSnapshot === geometryResponse.geometry
      ? viewport
      : createInitialViewportState(selectedLevel);

  const presentationResult = useMemo(() => {
    if (!selectedLevel || consistencyFailure) {
      return undefined;
    }

    try {
      return {
        ok: true as const,
        model: createGeometrySnapshotPresentationModel2D({
          level: selectedLevel,
          transform: createViewportTransform2D(activeViewport),
          selectionState: safeSelectionState
        })
      };
    } catch (error) {
      return { ok: false as const, error };
    }
  }, [activeViewport, consistencyFailure, safeSelectionState, selectedLevel]);

  useEffect(() => {
    dispatch(geometrySelectionReset());
    setSelectionOwnerSnapshot(undefined);
    setViewportOwnerSnapshot(undefined);
  }, [dispatch, projectId]);

  useEffect(() => {
    if (!geometryIdentity) {
      return;
    }

    const firstLevel = levels[0];
    setSelectedLevelId(firstLevel?.id ?? "");
    setViewport(createInitialViewportState(firstLevel));
    dispatch(geometrySelectionReset());
    setSelectionOwnerSnapshot(geometryResponse?.geometry);
    setViewportOwnerSnapshot(geometryResponse?.geometry);
  }, [dispatch, geometryIdentity, geometryResponse, levels]);

  useEffect(() => {
    if (!selectedLevel || !geometryIdentity) {
      return;
    }

    setViewport(createInitialViewportState(selectedLevel));
    dispatch(geometrySelectionReset());
    setSelectionOwnerSnapshot(geometryResponse?.geometry);
    setViewportOwnerSnapshot(geometryResponse?.geometry);
  }, [dispatch, geometryIdentity, geometryResponse, selectedLevel]);

  const handleSelectionStateChange = useCallback(
    (nextSelectionState: GeometrySelectionState) => {
      dispatch(geometrySelectionChanged(nextSelectionState));
    },
    [dispatch]
  );

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
    if (!geometryIdentity) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = getGeometryViewerShortcutAction(event);

      if (!action) {
        return;
      }

      event.preventDefault();

      if (action === "CLEAR_SELECTION") {
        dispatch(geometrySelectionCleared());
      } else if (action === "FIT_VIEWPORT") {
        handleFitViewport();
      } else {
        handleResetViewport();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, geometryIdentity, handleFitViewport, handleResetViewport]);

  const inspector = useMemo(() => {
    if (!presentationResult?.ok || !selectedLevel || !geometryResponse) {
      return undefined;
    }

    return (
      <ProjectGeometryInspector
        level={selectedLevel}
        model={presentationResult.model}
        selectionState={safeSelectionState}
        options={displayOptions}
        onOptionsChange={setDisplayOptions}
        revision={geometryResponse.sourceRevision}
      />
    );
  }, [
    displayOptions,
    geometryResponse,
    presentationResult,
    safeSelectionState,
    selectedLevel
  ]);

  const shellContent = useMemo(
    () => ({
      title: projectResponse?.project.name ?? t("shell.title"),
      breadcrumb: t("shell.breadcrumb"),
      inspector,
      status:
        projectQuery.isFetching || geometryQuery.isFetching
          ? t("status.loading")
          : geometryIdentity && selectedLevel
            ? t("status.ready", {
                level: selectedLevel.sourceLevelId,
                polygons: selectedLevel.polygons.length,
                selection: safeSelectionState.selected.length
              })
            : t("status.unavailable")
    }),
    [
      geometryIdentity,
      geometryQuery.isFetching,
      inspector,
      projectQuery.isFetching,
      projectResponse,
      safeSelectionState.selected.length,
      selectedLevel,
      t
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

  if (failure) {
    return <ProjectViewerError error={failure} />;
  }

  if (!projectResponse || !geometryResponse) {
    return <ProjectViewerError error={new Error("Query completed without data.")} />;
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

  if (presentationResult && !presentationResult.ok) {
    return <ProjectViewerError error={presentationResult.error} />;
  }

  return (
    <Stack className="geometry-page" spacing={1.5}>
      <Box className="geometry-page-header">
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography variant="overline" color="primary.dark">
            {t("intro.eyebrow")}
          </Typography>
          <Chip
            size="small"
            color="success"
            variant="outlined"
            label={t("revision.agreement", { revision: projectResponse.sourceRevision })}
          />
        </Stack>
        <Typography variant="h1">{projectResponse.project.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {projectResponse.project.id}
        </Typography>
      </Box>

      {selectedLevel && levels.length > 1 ? (
        <FormControl size="small" sx={{ maxWidth: 280 }}>
          <InputLabel id="project-geometry-level-selector-label">{t("levelSelector.label")}</InputLabel>
          <Select
            labelId="project-geometry-level-selector-label"
            label={t("levelSelector.label")}
            value={selectedLevel.id}
            onChange={(event) => setSelectedLevelId(event.target.value)}
          >
            {levels.map((level) => (
              <MenuItem key={level.id} value={level.id}>
                {level.sourceLevelId}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}

      {selectedLevel && presentationResult?.ok ? (
        <GeometryViewerPanel
          title={t("viewer.title")}
          headingId="project-geometry-viewer-heading"
          presentationModel={presentationResult.model}
          options={displayOptions}
          viewport={activeViewport}
          selectionState={safeSelectionState}
          onSelectionStateChange={handleSelectionStateChange}
          onViewportChange={setViewport}
          onFitViewport={handleFitViewport}
          onResetViewport={handleResetViewport}
          onZoomViewport={handleZoomViewport}
        />
      ) : (
        <Paper className="geometry-empty-state" role="status" sx={{ p: 2 }}>
          {t("viewer.noLevels")}
        </Paper>
      )}
    </Stack>
  );
}

type ProjectGeometryInspectorProps = {
  readonly level: GeometryLevel;
  readonly model: NonNullable<ReturnType<typeof createGeometrySnapshotPresentationModel2D>>;
  readonly selectionState: GeometrySelectionState;
  readonly options: GeometryDisplayOptions;
  readonly onOptionsChange: (options: GeometryDisplayOptions) => void;
  readonly revision: number;
};

function ProjectGeometryInspector({
  level,
  model,
  selectionState,
  options,
  onOptionsChange,
  revision
}: ProjectGeometryInspectorProps) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <Stack spacing={1.5}>
      <GeometryLayerControls options={options} onOptionsChange={onOptionsChange} />
      <Divider />
      <GeometrySelectionDetails model={model} selectionState={selectionState} />
      <Divider />
      <GeometryShortcutGuide />
      <Divider />
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">{t("inspector.snapshot")}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t("inspector.level", { level: level.sourceLevelId })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t("inspector.revision", { revision })}
        </Typography>
      </Stack>
    </Stack>
  );
}

type ConsistencyFailure = "project-id" | "revision";

function getConsistencyFailure(
  projectResponse: ReturnType<typeof useProjectQuery>["data"],
  geometryResponse: ReturnType<typeof useProjectGeometryQuery>["data"]
): ConsistencyFailure | undefined {
  if (!projectResponse || !geometryResponse) {
    return undefined;
  }

  if (projectResponse.project.id !== geometryResponse.sourceProjectId) {
    return "project-id";
  }

  if (projectResponse.sourceRevision !== geometryResponse.sourceRevision) {
    return "revision";
  }

  return undefined;
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

type ProjectViewerErrorProps = {
  readonly error: unknown;
};

function ProjectViewerError({ error }: ProjectViewerErrorProps) {
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

type ErrorTranslator = (key: string, options?: Record<string, unknown>) => string;

function describeError(error: unknown, t: ErrorTranslator) {
  if (error instanceof ApiAuthenticationUnavailableError) {
    return { title: t("errors.authentication.title"), detail: t("errors.authentication.detail") };
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

  if (error instanceof ApiRequestError && error.kind === "problem" && error.problem) {
    return {
      title: error.problem.title,
      detail: error.problem.detail,
      requestId: error.problem.requestId
    };
  }

  if (error instanceof ApiRequestError && error.kind === "network") {
    return { title: t("errors.network.title"), detail: t("errors.network.detail") };
  }

  return { title: t("errors.unexpected.title"), detail: t("errors.unexpected.detail") };
}

const createInitialViewportState = (level: GeometryLevel | undefined): ViewportState => {
  let bounds;

  try {
    bounds = level ? collectGeometrySnapshotLevelBounds(level) : undefined;
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
