import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";

import { useCasaTranslation } from "../i18n";
import {
  getVisibleLevelReferences3D,
  type ArchitecturalScene3DModel,
  type LevelVisibility3D
} from "./architectural-scene-3d-model";

/** Inputs for the read-only 3D Project inspector summary. */
export type Project3DInspectorProps = {
  readonly projectName: string;
  readonly model: ArchitecturalScene3DModel;
  readonly visibility: LevelVisibility3D;
  readonly activeLevelId?: string;
};

/** Renders coherent Project and Level status without exposing 2D edit controls. */
export function Project3DInspector({
  projectName,
  model,
  visibility,
  activeLevelId
}: Project3DInspectorProps) {
  const { t } = useCasaTranslation("project-viewer");
  const visibleLevels = getVisibleLevelReferences3D(model, visibility, activeLevelId);

  return (
    <Stack className="project-3d-inspector" spacing={2.25} sx={{ p: 2.5 }}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
          <ViewInArRoundedIcon color="primary" fontSize="small" />
          <Typography component="h2" variant="h3">{t("threeD.inspector.title")}</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t("threeD.inspector.readOnly")}
        </Typography>
      </Box>
      <Divider />
      <Stack spacing={1}>
        <Typography variant="overline" color="text.secondary">
          {t("threeD.inspector.project")}
        </Typography>
        <Typography variant="body2">{projectName}</Typography>
        <Chip
          size="small"
          variant="outlined"
          label={model.hasArchitecturalGeometry
            ? t("threeD.inspector.referenceReady")
            : t("threeD.inspector.empty")}
        />
      </Stack>
      <Divider />
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <LayersOutlinedIcon fontSize="small" color="action" />
          <Typography variant="overline" color="text.secondary">
            {t("threeD.inspector.visibleLevels")}
          </Typography>
        </Stack>
        {visibleLevels.length > 0 ? visibleLevels.map((level) => (
          <Stack key={level.id} direction="row" sx={{ justifyContent: "space-between" }}>
            <Typography variant="body2">{level.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {level.y.toFixed(2)} m
            </Typography>
          </Stack>
        )) : (
          <Typography variant="body2" color="text.secondary">
            {t("threeD.inspector.noVisibleLevels")}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
