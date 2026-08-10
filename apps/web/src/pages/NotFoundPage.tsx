import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";

import { useAppShellContent } from "../app-shell/AppShellContext";
import { useCasaTranslation } from "../i18n";

/**
 * Stable not-found route rendered inside the shared application shell.
 */
export function NotFoundPage() {
  const { t } = useCasaTranslation("common");
  const shellContent = useMemo(
    () => ({
      title: t("routes.notFound.title"),
      breadcrumb: t("routes.notFound.breadcrumb"),
      status: t("routes.notFound.status")
    }),
    [t]
  );

  useAppShellContent(shellContent);

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Paper sx={{ border: 1, borderColor: "divider", p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="h1">{t("routes.notFound.heading")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("routes.notFound.description")}
          </Typography>
          <Box>
            <Button component={RouterLink} to="/app" startIcon={<ArrowBackRoundedIcon />}>
              {t("actions.backToHome")}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
