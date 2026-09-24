import LockOutlineRoundedIcon from "@mui/icons-material/LockOutlineRounded";
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { lazy, Suspense, type ComponentProps, type ReactNode } from "react";

import { EditorToolbar } from "../../../editor-2d/components/EditorToolbar";
import { GeometryViewerPanel } from "../../../geometry-2d/viewer/GeometryViewerPanel";
import type { ArchitecturalEntityIdentity3D } from "../../../project-3d/interaction/architectural-selection-3d";
import type { FurnitureManipulation3D } from "../../../project-3d/Project3DViewer";
import type {
  ArchitecturalScene3DModel,
  LevelVisibility3D
} from "../../../project-3d/model/architectural-scene-3d-model";
import { ProjectWorkspaceError } from "../persistence/project-errors";
import type { ProjectWorkspaceRepresentation } from "./WorkspaceRepresentationControl";

const Project3DViewer = lazy(() =>
  import("../../../project-3d/Project3DViewer").then((module) => ({
    default: module.Project3DViewer
  }))
);

type Translate = (key: string, options?: Record<string, unknown>) => string;

type ProjectWorkspaceCanvasProps = {
  readonly representation: ProjectWorkspaceRepresentation;
  readonly mode: "view" | "edit";
  readonly editorToolbarProps?: ComponentProps<typeof EditorToolbar>;
  readonly scene3D?: ArchitecturalScene3DModel;
  readonly activeLevelId3D?: string;
  readonly levelVisibility3D: LevelVisibility3D;
  readonly onLevelVisibility3DChange: (visibility: LevelVisibility3D) => void;
  readonly selection3D?: ArchitecturalEntityIdentity3D;
  readonly onSelection3DChange: (
    selection?: ArchitecturalEntityIdentity3D
  ) => void;
  readonly furnitureManipulation3D?: FurnitureManipulation3D;
  readonly editBuildFailed: boolean;
  readonly presentationFailed: boolean;
  readonly presentationError?: unknown;
  readonly viewerProps?: ComponentProps<typeof GeometryViewerPanel>;
  readonly tabletInspector?: ReactNode;
  readonly showMobileOverview: boolean;
  readonly t: Translate;
};

/** Composes the workspace toolbar, 2D/3D canvas, and responsive inspector surfaces. */
export function ProjectWorkspaceCanvas({
  representation,
  mode,
  editorToolbarProps,
  scene3D,
  activeLevelId3D,
  levelVisibility3D,
  onLevelVisibility3DChange,
  selection3D,
  onSelection3DChange,
  furnitureManipulation3D,
  editBuildFailed,
  presentationFailed,
  presentationError,
  viewerProps,
  tabletInspector,
  showMobileOverview,
  t
}: ProjectWorkspaceCanvasProps) {
  return (
    <>
      {editorToolbarProps ? <EditorToolbar {...editorToolbarProps} /> : null}

      {representation === "3d" ? (
        scene3D ? (
          <Suspense
            fallback={
              <Stack
                role="status"
                spacing={1.5}
                sx={{ alignItems: "center", py: 8 }}
              >
                <CircularProgress size={28} />
                <Typography>{t("threeD.loading")}</Typography>
              </Stack>
            }
          >
            <Project3DViewer
              mode={mode}
              model={scene3D}
              activeLevelId={activeLevelId3D}
              visibility={levelVisibility3D}
              onVisibilityChange={onLevelVisibility3DChange}
              selection={selection3D}
              onSelectionChange={onSelection3DChange}
              furnitureManipulation={furnitureManipulation3D}
            />
          </Suspense>
        ) : (
          <Alert className="project-workspace__geometry-error" severity="error">
            <Typography component="h2" variant="h3">
              {t("threeD.errors.derivationTitle")}
            </Typography>
            <Typography variant="body2">
              {t("threeD.errors.derivationDetail")}
            </Typography>
          </Alert>
        )
      ) : editBuildFailed ? (
        <Alert className="project-workspace__geometry-error" severity="error">
          <Typography component="h2" variant="h3">
            {t("errors.editGeometry.title")}
          </Typography>
          <Typography variant="body2">
            {t("errors.editGeometry.detail")}
          </Typography>
        </Alert>
      ) : presentationFailed ? (
        <ProjectWorkspaceError error={presentationError} />
      ) : viewerProps ? (
        <GeometryViewerPanel {...viewerProps} />
      ) : (
        <Paper className="geometry-empty-state" role="status" sx={{ p: 2 }}>
          {t("viewer.noLevels")}
        </Paper>
      )}

      {tabletInspector ? (
        <Paper
          className="project-workspace__tablet-inspector"
          variant="outlined"
        >
          {tabletInspector}
        </Paper>
      ) : null}

      {showMobileOverview ? (
        <Paper className="mobile-project-overview" variant="outlined">
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <LockOutlineRoundedIcon color="primary" />
            <Box>
              <Typography variant="subtitle2">{t("mobile.title")}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t("mobile.description")}
              </Typography>
            </Box>
          </Stack>
          <Typography variant="body2">{t("mobile.editRestriction")}</Typography>
        </Paper>
      ) : null}
    </>
  );
}
