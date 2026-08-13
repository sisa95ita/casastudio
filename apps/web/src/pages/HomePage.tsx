import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArchitectureRoundedIcon from "@mui/icons-material/ArchitectureRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import LockOutlineRoundedIcon from "@mui/icons-material/LockOutlineRounded";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";

import { useAppShellContent } from "../app-shell/AppShellContext";
import { demoProjectEntry } from "../development/demo-project-entry";
import { useCasaTranslation } from "../i18n";

/** Renders the authenticated Projects entry surface. */
export function HomePage() {
  const { t } = useCasaTranslation("common");
  const { t: navigationT } = useCasaTranslation("navigation");
  const shellContent = useMemo(
    () => ({
      title: t("routes.home.title"),
      breadcrumb: navigationT("breadcrumbs.home"),
      status: t("routes.home.status")
    }),
    [navigationT, t]
  );

  useAppShellContent(shellContent);

  return (
    <Box className="project-home">
      <Box className="project-home__intro">
        <Typography variant="overline" color="primary.dark">
          {t("routes.home.eyebrow")}
        </Typography>
        <Typography component="h1" variant="h2">
          {t("routes.home.heading")}
        </Typography>
        <Typography color="text.secondary">{t("routes.home.description")}</Typography>
      </Box>

      <Box className="project-home__section-heading">
        <Typography component="h2" variant="h3">
          {t("routes.home.availableProjects")}
        </Typography>
        <Chip label={t("routes.home.projectCount", { count: 1 })} variant="outlined" />
      </Box>

      <Paper className="project-entry-card" component="article" variant="outlined">
        <Box className="project-entry-card__visual" aria-hidden="true">
          <Box className="project-entry-card__plan">
            <span />
            <span />
            <span />
            <span />
          </Box>
          <ArchitectureRoundedIcon />
        </Box>

        <Stack className="project-entry-card__content" spacing={2}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Box className="project-entry-card__icon" aria-hidden="true">
              <FolderOpenRoundedIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h2" variant="h3" noWrap>
                {demoProjectEntry.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("routes.home.projectType")}
              </Typography>
            </Box>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {t("routes.home.projectDescription")}
          </Typography>

          <Stack className="project-entry-card__meta" direction="row" spacing={2}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <LockOutlineRoundedIcon fontSize="small" />
              <Typography variant="caption">{t("routes.home.readOnly")}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t("routes.home.authoritativeGeometry")}
            </Typography>
          </Stack>

          <Button
            component={RouterLink}
            to={`/app/projects/${demoProjectEntry.id}`}
            variant="contained"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ alignSelf: "flex-start" }}
          >
            {t("routes.home.openProject")}
          </Button>
        </Stack>
      </Paper>

      <Typography className="project-home__footnote" variant="caption" color="text.secondary">
        {t("routes.home.futureListNote")}
      </Typography>
    </Box>
  );
}
