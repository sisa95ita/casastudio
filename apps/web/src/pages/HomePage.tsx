import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { useMemo, useState, type MouseEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useAppShellContent } from "../app-shell/AppShellContext";
import { useCasaTranslation } from "../i18n";
import { useProjectsQuery } from "../queries/project-queries";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import type { ProjectSummary } from "../api/api-types";

/** Renders the authenticated, backend-authoritative Projects entry surface. */
export function HomePage() {
  const { t } = useCasaTranslation("common");
  const { t: navigationT } = useCasaTranslation("navigation");
  const [creating, setCreating] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(
    null
  );
  const [actionsMenu, setActionsMenu] = useState<{
    readonly anchor: HTMLElement;
    readonly project: ProjectSummary;
  } | null>(null);
  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data?.projects ?? [];
  useAppShellContent(
    useMemo(
      () => ({
        title: t("routes.home.title"),
        breadcrumb: navigationT("breadcrumbs.home"),
        status: projectsQuery.isPending
          ? t("routes.home.loading")
          : t("routes.home.status", { count: projects.length })
      }),
      [navigationT, projects.length, projectsQuery.isPending, t]
    )
  );

  return (
    <Box className="project-home">
      <Box className="project-home__intro">
        <Typography variant="overline" color="primary.dark">
          {t("routes.home.eyebrow")}
        </Typography>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}
        >
          <Typography component="h1" variant="h2">
            {t("routes.home.heading")}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setCreating(true)}
          >
            {t("routes.home.newProject")}
          </Button>
        </Stack>
        <Typography color="text.secondary">
          {t("routes.home.description")}
        </Typography>
      </Box>
      {projectsQuery.isPending ? (
        <Stack role="status" sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress size={28} />
          <Typography>{t("routes.home.loading")}</Typography>
        </Stack>
      ) : null}
      {projectsQuery.isError ? (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              onClick={() => void projectsQuery.refetch()}
            >
              {t("routes.home.retry")}
            </Button>
          }
        >
          {t("routes.home.listError")}
        </Alert>
      ) : null}
      {projectsQuery.isSuccess && projects.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, mt: 4, textAlign: "center" }}>
          <FolderOpenRoundedIcon color="action" />
          <Typography component="h2" variant="h3">
            {t("routes.home.emptyTitle")}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t("routes.home.emptyDescription")}
          </Typography>
          <Button variant="contained" onClick={() => setCreating(true)}>
            {t("routes.home.newProject")}
          </Button>
        </Paper>
      ) : null}
      {projectsQuery.isSuccess && projects.length > 0 ? (
        <Stack spacing={1.5} sx={{ mt: 4 }}>
          {projects.map((project) => (
            <Paper
              key={project.id}
              component="article"
              variant="outlined"
              sx={{ p: 2.5 }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{
                  alignItems: { sm: "center" },
                  justifyContent: "space-between",
                  gap: 2
                }}
              >
                <Box>
                  <Typography component="h2" variant="h3">
                    {project.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("routes.home.updated", {
                      value: new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium"
                      }).format(new Date(project.updatedAt))
                    })}
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: "center" }}
                >
                  <Button
                    component={RouterLink}
                    to={`/app/projects/${project.id}`}
                    endIcon={<ArrowForwardRoundedIcon />}
                  >
                    {t("routes.home.openProject")}
                  </Button>
                  <IconButton
                    size="small"
                    aria-label={t("routes.home.projectActions", {
                      name: project.name
                    })}
                    aria-haspopup="menu"
                    aria-controls={
                      actionsMenu?.project.id === project.id
                        ? "project-actions-menu"
                        : undefined
                    }
                    aria-expanded={
                      actionsMenu?.project.id === project.id
                        ? "true"
                        : undefined
                    }
                    onClick={(event: MouseEvent<HTMLElement>) =>
                      setActionsMenu({
                        anchor: event.currentTarget,
                        project
                      })
                    }
                  >
                    <MoreHorizRoundedIcon />
                  </IconButton>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : null}
      <Menu
        id="project-actions-menu"
        anchorEl={actionsMenu?.anchor ?? null}
        open={actionsMenu !== null}
        onClose={() => setActionsMenu(null)}
      >
        <MenuItem
          onClick={() => {
            if (!actionsMenu) return;
            setProjectToDelete(actionsMenu.project);
            setActionsMenu(null);
          }}
        >
          <ListItemIcon>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </ListItemIcon>
          {t("routes.home.deleteProject")}
        </MenuItem>
      </Menu>
      <CreateProjectDialog
        open={creating}
        existingNames={projects
          .filter((project) => project.ownedByCurrentUser)
          .map((project) => project.name)}
        onClose={() => setCreating(false)}
      />
      <DeleteProjectDialog
        project={projectToDelete}
        onClose={() => setProjectToDelete(null)}
      />
    </Box>
  );
}
