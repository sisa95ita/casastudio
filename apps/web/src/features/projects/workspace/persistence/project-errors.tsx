import { Alert, Typography } from "@mui/material";

import {
  ApiAuthenticationUnavailableError,
  ApiRequestError
} from "../../../../core/api/CasaStudioApiClient";
import { useCasaTranslation } from "../../../../core/i18n";

/** User feedback categories for Project save failures. */
export type SaveFeedback = "validation" | "forbidden" | "client" | "failure";

/** Identifies the optimistic Project revision conflict response. */
export function isProjectRevisionConflict(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    error.status === 409 &&
    error.problem?.code === "PROJECT_REVISION_CONFLICT"
  );
}

/** Classifies Project save failures for localized feedback. */
export function classifySaveFeedback(error: unknown): SaveFeedback {
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

type ErrorTranslator = (
  key: string,
  options?: Record<string, unknown>
) => string;

/** Renders an API or presentation failure for the Project workspace. */
export function ProjectWorkspaceError({ error }: { readonly error: unknown }) {
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
