import FitScreenIcon from "@mui/icons-material/FitScreen";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import { Box, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { useCasaTranslation } from "../i18n";
import type { GeometryPresentationModel2D } from "./geometry-presentation-model-2d";
import type { GeometrySelectionState } from "./geometry-selection-state";
import {
  type GeometryDisplayOptions,
  GeometrySvgViewer
} from "./GeometrySvgViewer";
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

/**
 * Renders shared viewer chrome around a source-independent 2D presentation
 * model.
 */
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
    <Paper
      component="section"
      className="geometry-viewer-panel"
      aria-labelledby={headingId}
      sx={{
        border: 1,
        borderColor: "divider",
        display: "flex",
        flex: "1 1 auto",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden"
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: "divider", px: 1.5, py: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography
            variant="subtitle2"
            component="h2"
            id={headingId}
            sx={{ flex: "1 1 auto" }}
          >
            {title}
          </Typography>
          <ViewportButton label={t("toolbar.zoomOut")} onClick={() => onZoomViewport(0.85)}>
            <ZoomOutIcon fontSize="small" />
          </ViewportButton>
          <ViewportButton label={t("toolbar.zoomIn")} onClick={() => onZoomViewport(1.18)}>
            <ZoomInIcon fontSize="small" />
          </ViewportButton>
          <ViewportButton label={t("toolbar.fit")} onClick={onFitViewport}>
            <FitScreenIcon fontSize="small" />
          </ViewportButton>
          <ViewportButton label={t("toolbar.reset")} onClick={onResetViewport}>
            <RestartAltIcon fontSize="small" />
          </ViewportButton>
        </Stack>
      </Box>
      <GeometrySvgViewer
        presentationModel={presentationModel}
        options={options}
        viewport={viewport}
        selectionState={selectionState}
        onSelectionStateChange={onSelectionStateChange}
        onViewportChange={onViewportChange}
      />
    </Paper>
  );
}

type ViewportButtonProps = {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
};

function ViewportButton({ label, onClick, children }: ViewportButtonProps) {
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={onClick}>
        {children}
      </IconButton>
    </Tooltip>
  );
}
