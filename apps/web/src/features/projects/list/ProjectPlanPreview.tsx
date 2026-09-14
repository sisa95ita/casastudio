import ArchitectureRoundedIcon from "@mui/icons-material/ArchitectureRounded";
import { Box, Typography } from "@mui/material";
import { memo, useMemo } from "react";

import type { ProjectPreview } from "../../../core/api/api-types";
import { useCasaTranslation } from "../../../core/i18n";
import {
  createProjectPreviewModel,
  projectPreviewViewport
} from "./project-preview-model";

type ProjectPlanPreviewProps = {
  readonly preview?: ProjectPreview;
};

/** Renders one lightweight, non-interactive architectural plan thumbnail. */
export const ProjectPlanPreview = memo(function ProjectPlanPreview({
  preview
}: ProjectPlanPreviewProps) {
  const { t } = useCasaTranslation("common");
  const model = useMemo(() => createProjectPreviewModel(preview), [preview]);

  return (
    <Box className="project-card__preview" aria-hidden="true">
      {model.empty ? (
        <Box className="project-card__empty-preview">
          <ArchitectureRoundedIcon />
          <Typography variant="caption">
            {t("routes.home.emptyPlan")}
          </Typography>
        </Box>
      ) : (
        <svg
          className="project-card__plan"
          viewBox={`0 0 ${projectPreviewViewport.width} ${projectPreviewViewport.height}`}
          preserveAspectRatio="xMidYMid meet"
          focusable="false"
          data-preview-level={model.levelId}
        >
          <g className="project-card__wall-shapes">
            {model.wallShapes.map((wall) => (
              <polygon key={wall.id} points={wall.svgPoints} />
            ))}
          </g>
        </svg>
      )}
    </Box>
  );
});
