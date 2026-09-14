import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useMemo, useState, type MouseEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useAppShellContent } from "../../../shell/AppShellContext";
import { useCasaTranslation } from "../../../core/i18n";
import { useProjectsQuery } from "../data/project-queries";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { ProjectPlanPreview } from "./ProjectPlanPreview";
import type { ProjectSummary } from "../../../core/api/api-types";

/** Renders the authenticated, backend-authoritative Projects entry surface. */
export function ProjectsPage() {
  const { t } = useCasaTranslation("common");
  const { t: navigationT } = useCasaTranslation("navigation");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(
    null
  );
  const [actionsMenu, setActionsMenu] = useState<{
    readonly anchor: HTMLElement;
    readonly project: ProjectSummary;
  } | null>(null);
  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data?.projects ?? [];
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleProjects = useMemo(
    () =>
      normalizedSearch.length === 0
        ? projects
        : projects.filter((project) =>
            project.name.toLocaleLowerCase().includes(normalizedSearch)
          ),
    [normalizedSearch, projects]
  );
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
      <Box className="project-home__header">
        <Box className="project-home__intro">
          <Typography variant="overline" color="primary.dark">
            {t("routes.home.eyebrow")}
          </Typography>
          <Typography component="h1" variant="h2">
            {t("routes.home.heading")}
          </Typography>
          <Typography color="text.secondary">
            {t("routes.home.description")}
          </Typography>
        </Box>
        <Stack
          className="project-home__controls"
          direction={{ xs: "column", sm: "row" }}
          sx={{ alignItems: { sm: "center" }, gap: 1.25 }}
        >
          <TextField
            className="project-home__search"
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            label={t("routes.home.searchLabel")}
            placeholder={t("routes.home.searchPlaceholder")}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      size="small"
                      aria-label={t("routes.home.clearSearch")}
                      onClick={() => setSearch("")}
                    >
                      <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined
              }
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setCreating(true)}
            sx={{ whiteSpace: "nowrap" }}
          >
            {t("routes.home.newProject")}
          </Button>
        </Stack>
      </Box>
      {projectsQuery.isPending ? (
        <Box
          role="status"
          aria-label={t("routes.home.loading")}
          className="project-grid"
        >
          {[0, 1, 2].map((item) => (
            <Paper
              key={item}
              variant="outlined"
              className="project-card project-card--loading"
            >
              <Skeleton variant="rectangular" height={190} />
              <Box sx={{ p: 2.25 }}>
                <Skeleton width="65%" height={30} />
                <Skeleton width="44%" />
                <Skeleton width="52%" />
              </Box>
            </Paper>
          ))}
          <Box
            sx={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden"
            }}
          >
            <CircularProgress size={1} />
          </Box>
        </Box>
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
      {projectsQuery.isSuccess &&
      projects.length > 0 &&
      visibleProjects.length === 0 ? (
        <Paper variant="outlined" className="project-home__no-results">
          <SearchRoundedIcon color="action" />
          <Typography component="h2" variant="h3">
            {t("routes.home.noMatches", { query: search.trim() })}
          </Typography>
          <Button onClick={() => setSearch("")}>
            {t("routes.home.clearSearch")}
          </Button>
        </Paper>
      ) : null}
      {projectsQuery.isSuccess && visibleProjects.length > 0 ? (
        <Box
          className="project-grid"
          aria-label={t("routes.home.availableProjects")}
        >
          {visibleProjects.map((project) => (
            <Paper
              key={project.id}
              component="article"
              variant="outlined"
              className="project-card"
            >
              <Box
                component={RouterLink}
                to={`/app/projects/${project.id}`}
                className="project-card__open"
                aria-label={t("routes.home.openProjectNamed", {
                  name: project.name
                })}
              >
                <ProjectPlanPreview preview={project.preview} />
                <Box className="project-card__content">
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
                  <Typography variant="body2" color="text.secondary">
                    {t("routes.home.summary", {
                      levels: t("routes.home.levelCount", {
                        count: project.levelCount
                      }),
                      rooms: t("routes.home.roomCount", {
                        count: project.roomCount
                      })
                    })}
                  </Typography>
                  <Box className="project-card__open-hint">
                    <Typography component="span" variant="button">
                      {t("routes.home.openProject")}
                    </Typography>
                    <ArrowForwardRoundedIcon fontSize="small" />
                  </Box>
                </Box>
              </Box>
              <IconButton
                className="project-card__actions"
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
                  actionsMenu?.project.id === project.id ? "true" : undefined
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
            </Paper>
          ))}
        </Box>
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
