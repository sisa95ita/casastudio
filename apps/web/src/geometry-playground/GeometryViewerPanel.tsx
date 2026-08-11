import FitScreenRoundedIcon from "@mui/icons-material/FitScreenRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import ZoomInRoundedIcon from "@mui/icons-material/ZoomInRounded";
import ZoomOutRoundedIcon from "@mui/icons-material/ZoomOutRounded";
import { Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { useCasaTranslation } from "../i18n";
import type { GeometryPresentationModel2D } from "./geometry-presentation-model-2d";
import type { GeometrySelectionState } from "./geometry-selection-state";
import { type GeometryDisplayOptions, GeometrySvgViewer } from "./GeometrySvgViewer";
import type { ViewportState } from "./viewport-transform-2d";

/** Props for the shared interactive 2D geometry viewer panel. */
export type GeometryViewerPanelProps = {
  readonly title: string;
  readonly headingId: string;
  readonly presentationModel: GeometryPresentationModel2D;
  readonly options: GeometryDisplayOptions;
  readonly viewport: ViewportState;
  readonly selectionState: GeometrySelectionState;
  readonly onSelectionStateChange: (selectionState: GeometrySelectionState) => void;
  readonly onViewportChange: (viewport: ViewportState) => void;
  readonly onFitViewport: () => void;
  readonly onResetViewport: () => void;
  readonly onZoomViewport: (zoomFactor: number) => void;
};

/** Renders professional canvas chrome around a source-independent 2D model. */
export function GeometryViewerPanel({
  title,
  headingId,
  presentationModel,
  options,
  viewport,
  selectionState,
  onSelectionStateChange,
  onViewportChange,
  onFitViewport,
  onResetViewport,
  onZoomViewport
}: GeometryViewerPanelProps) {
  const { t } = useCasaTranslation("geometry-playground");

  return (
    <Paper component="section" className="geometry-viewer-panel" aria-labelledby={headingId} variant="outlined">
      <Box className="geometry-viewer-panel__toolbar">
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <Typography variant="subtitle2" component="h2" id={headingId} noWrap>
            {title}
          </Typography>
          <Chip label={t("viewer.readOnly")} size="small" variant="outlined" />
        </Stack>
        <Stack direction="row" spacing={0.25} role="toolbar" aria-label={t("toolbar.label")}>
          <ViewportButton label={t("toolbar.zoomOut")} onClick={() => onZoomViewport(0.85)}>
            <ZoomOutRoundedIcon fontSize="small" />
          </ViewportButton>
          <ViewportButton label={t("toolbar.zoomIn")} onClick={() => onZoomViewport(1.18)}>
            <ZoomInRoundedIcon fontSize="small" />
          </ViewportButton>
          <ViewportButton label={t("toolbar.fit")} onClick={onFitViewport}>
            <FitScreenRoundedIcon fontSize="small" />
          </ViewportButton>
          <ViewportButton label={t("toolbar.reset")} onClick={onResetViewport}>
            <RestartAltRoundedIcon fontSize="small" />
          </ViewportButton>
        </Stack>
      </Box>
      <Box className="geometry-viewer-panel__canvas">
        <GeometrySvgViewer
          presentationModel={presentationModel}
          options={options}
          viewport={viewport}
          selectionState={selectionState}
          onSelectionStateChange={onSelectionStateChange}
          onViewportChange={onViewportChange}
        />
        <Box className="geometry-canvas-hint">
          <Typography variant="caption">{t("viewer.canvasHint")}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

type ViewportButtonProps = {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: ReactNode;
};

/** Renders one labelled viewport toolbar action. */
function ViewportButton({ label, onClick, children }: ViewportButtonProps) {
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={onClick} size="small">
        {children}
      </IconButton>
    </Tooltip>
  );
}
