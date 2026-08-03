import type { GeometryBuildError } from "@casastudio/geometry";
import { Alert, AlertTitle, Box, Stack, Typography } from "@mui/material";

import { useCasaTranslation } from "../i18n";

/**
 * Props for the technical Geometry Engine build-error panel.
 */
export type GeometryBuildErrorPanelProps = {
  readonly errors: readonly GeometryBuildError[];
};

/**
 * Displays expected `GeometryEngine.build` failures as readable diagnostics.
 *
 * Build errors are part of the runtime build contract, so the playground shows
 * their stable code, message, source path, and source identifier instead of
 * throwing or presenting a blank viewer.
 */
export function GeometryBuildErrorPanel({ errors }: GeometryBuildErrorPanelProps) {
  const { t } = useCasaTranslation("geometry-playground");

  return (
    <Alert
      severity="error"
      variant="outlined"
      role="alert"
      aria-labelledby="geometry-error-heading"
      sx={{ alignItems: "flex-start" }}
    >
      <AlertTitle id="geometry-error-heading">{t("errors.buildFailedTitle")}</AlertTitle>
      <Stack component="ul" spacing={1.5} sx={{ m: 0, pl: 2.5 }}>
        {errors.map((error, index) => (
          <Box component="li" key={`${error.code}-${error.sourceId ?? "unknown"}-${index}`}>
            <Typography component="strong" variant="body2">
              {error.code}
            </Typography>
            <Typography variant="body2">{error.message}</Typography>
            {error.path ? (
              <Typography variant="caption">
                {t("errors.path")}: {error.path}
              </Typography>
            ) : null}
            {error.sourceId ? (
              <Typography variant="caption" sx={{ display: "block" }}>
                {t("errors.sourceId")}: {error.sourceId}
              </Typography>
            ) : null}
          </Box>
        ))}
      </Stack>
    </Alert>
  );
}
