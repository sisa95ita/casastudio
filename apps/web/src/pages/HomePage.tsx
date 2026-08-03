import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Box, Button, Divider, Paper, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";

import { useAppShellContent } from "../app-shell/AppShellContext";
import { useCasaTranslation } from "../i18n";

/**
 * Minimal CasaStudio foundation home route.
 *
 * The page avoids fake project data and keeps the first screen purposeful:
 * identify the product foundation and link directly to the only current
 * technical workspace.
 */
export function HomePage() {
  const { t } = useCasaTranslation("common");
  const { t: navigationT } = useCasaTranslation("navigation");
  const shellContent = useMemo(
    () => ({
      title: t("routes.home.title"),
      breadcrumb: navigationT("breadcrumbs.foundation"),
      inspector: (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">{t("routes.home.inspectorTitle")}</Typography>
          <Divider />
          <Typography variant="body2" color="text.secondary">
            {t("routes.home.inspectorDescription")}
          </Typography>
        </Stack>
      ),
      status: t("routes.home.status")
    }),
    [navigationT, t]
  );

  useAppShellContent(shellContent);

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Paper
        sx={{
          border: 1,
          borderColor: "divider",
          p: 2
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              {t("routes.home.eyebrow")}
            </Typography>
            <Typography variant="h1">{t("routes.home.heading")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t("routes.home.description")}
            </Typography>
          </Box>

          <Divider />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: "flex-start" }}>
            <Button
              component={RouterLink}
              to="/geometry-playground"
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
            >
              {t("routes.home.openGeometryPlayground")}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
