import { Alert, Box, CircularProgress, Divider, Paper, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

import {
  ApiAuthenticationUnavailableError,
  ApiRequestError
} from "../api/CasaStudioApiClient";
import { useAppShellContent } from "../app-shell/AppShellContext";
import { useCasaTranslation } from "../i18n";
import { useProjectGeometryQuery } from "../queries/geometry-queries";
import { useProjectQuery } from "../queries/project-queries";

/** Technical authenticated route proving authoritative Project and Geometry connectivity. */
export function ConnectedProjectPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { t } = useCasaTranslation("connected-project");
  const projectQuery = useProjectQuery(projectId);
  const geometryQuery = useProjectGeometryQuery(projectId);
  const shellContent = useMemo(
    () => ({
      title: t("shell.title"),
      breadcrumb: t("shell.breadcrumb"),
      status: projectQuery.isFetching || geometryQuery.isFetching ? t("status.loading") : t("status.ready")
    }),
    [geometryQuery.isFetching, projectQuery.isFetching, t]
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
    return <ConnectedProjectError error={failure} />;
  }

  const projectResponse = projectQuery.data;
  const geometryResponse = geometryQuery.data;

  if (!projectResponse || !geometryResponse) {
    return <ConnectedProjectError error={new Error("Query completed without data.")} />;
  }

  const levels = geometryResponse.geometry.levels;
  const roomCount = levels.reduce((count, level) => count + level.polygons.length, 0);
  const wallCount = levels.reduce((count, level) => count + level.boundaryEdges.length, 0);

  return (
    <Stack spacing={1.5} sx={{ maxWidth: 760 }}>
      <Box>
        <Typography variant="overline" color="primary.dark">
          {t("eyebrow")}
        </Typography>
        <Typography variant="h1">{projectResponse.project.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {projectResponse.project.id}
        </Typography>
      </Box>

      <Paper component="section" sx={{ border: 1, borderColor: "divider", p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="h2">{t("summary.title")}</Typography>
          <Divider />
          <SummaryRow label={t("summary.projectRevision")} value={projectResponse.sourceRevision} />
          <SummaryRow label={t("summary.geometryRevision")} value={geometryResponse.sourceRevision} />
          <SummaryRow label={t("summary.levels")} value={levels.length} />
          <SummaryRow label={t("summary.rooms")} value={roomCount} />
          <SummaryRow label={t("summary.walls")} value={wallCount} />
        </Stack>
      </Paper>

      {geometryResponse.sourceProjectId !== projectResponse.project.id ||
      geometryResponse.sourceRevision !== projectResponse.sourceRevision ? (
        <Alert severity="warning">{t("revisionMismatch")}</Alert>
      ) : (
        <Alert severity="success">{t("connected")}</Alert>
      )}
    </Stack>
  );
}

/** Props for one compact connected-project summary row. */
type SummaryRowProps = {
  readonly label: string;
  readonly value: string | number;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
    </Stack>
  );
}

/** Props for a safe connected-project error presentation. */
type ConnectedProjectErrorProps = {
  readonly error: unknown;
};

function ConnectedProjectError({ error }: ConnectedProjectErrorProps) {
  const { t } = useCasaTranslation("connected-project");
  const presentation = describeError(error, t);

  return (
    <Alert severity="error">
      <Typography component="h1" variant="h2">
        {presentation.title}
      </Typography>
      <Typography variant="body2">{presentation.detail}</Typography>
      {presentation.requestId ? (
        <Typography variant="caption">{t("errors.requestId", { requestId: presentation.requestId })}</Typography>
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
    return { title: t("errors.forbidden.title"), detail: t("errors.forbidden.detail"), requestId: error.problem?.requestId };
  }

  if (error instanceof ApiRequestError && error.status === 404) {
    return { title: t("errors.notFound.title"), detail: t("errors.notFound.detail"), requestId: error.problem?.requestId };
  }

  if (error instanceof ApiRequestError && error.kind === "problem" && error.problem) {
    return { title: error.problem.title, detail: error.problem.detail, requestId: error.problem.requestId };
  }

  if (error instanceof ApiRequestError && error.kind === "network") {
    return { title: t("errors.network.title"), detail: t("errors.network.detail") };
  }

  return { title: t("errors.unexpected.title"), detail: t("errors.unexpected.detail") };
}
