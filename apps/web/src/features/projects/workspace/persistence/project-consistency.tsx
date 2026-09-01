import { Alert, Button, Typography } from "@mui/material";

import { useCasaTranslation } from "../../../../core/i18n";
import type { useProjectGeometryQuery } from "../../data/geometry-queries";
import type { useProjectQuery } from "../../data/project-queries";

/** Authoritative Project and Geometry identity mismatch categories. */
export type ConsistencyFailure = "project-id" | "revision";

/** Compares the authoritative Project and Geometry response identities. */
export function getConsistencyFailure(
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

/** Renders an authoritative Project and Geometry consistency failure. */
export function ProjectConsistencyError({
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

/** Renders a retryable authoritative refresh failure. */
export function ProjectAuthoritativeRefreshError({
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
