import type { GeometrySvgViewerProps } from "./GeometrySvgViewer";
import FitScreenRoundedIcon from "@mui/icons-material/FitScreenRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import ZoomInRoundedIcon from "@mui/icons-material/ZoomInRounded";
import ZoomOutRoundedIcon from "@mui/icons-material/ZoomOutRounded";
import {
  Box,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import type { ReactNode } from "react";

import { useCasaTranslation } from "../../../core/i18n";
import type { GeometryPresentationModel2D } from "../presentation/geometry-presentation-model-2d";
import type { ArchitecturalPresentationModel2D } from "../presentation/architectural-presentation-model-2d";
import type { ArchitecturalDimensionPresentationModel2D } from "../presentation/architectural-dimension-presentation-model-2d";
import type { GeometrySelectionState } from "../selection/geometry-selection-state";
import {
  type GeometryDisplayOptions,
  type GeometryEditorOverlay,
  GeometrySvgViewer,
  type SvgViewportPointer
} from "./GeometrySvgViewer";
import type { ViewportState, WorldPointXZ } from "../viewport/viewport-transform-2d";
import type { ProjectEditorInteraction } from "../../editor-2d/state/project-editor-tools";
import type { WallEndpoint } from "@casastudio/schema";
import {
  formatArchitecturalArea,
  formatArchitecturalLength,
  type Units
} from "@casastudio/schema";
import {
  architecturalScaleDenominators,
  type ArchitecturalScaleDenominator,
  type LevelMeasurement
} from "@casastudio/geometry";

/** Props for the shared interactive 2D geometry viewer panel. */
export type GeometryViewerPanelProps = Pick<GeometrySvgViewerProps, "furnitureModel" | "onFurniturePointerDown" | "onFurniturePointerUp" | "onFurniturePointerCancel"> & {
  /** Whether the surrounding Project shell owns all viewer chrome. */
  readonly workspaceCanvas?: boolean;
  readonly title: string;
  readonly headingId: string;
  readonly presentationModel: GeometryPresentationModel2D;
  readonly architecturalModel?: ArchitecturalPresentationModel2D;
  readonly dimensionModel?: ArchitecturalDimensionPresentationModel2D;
  readonly options: GeometryDisplayOptions;
  readonly viewport: ViewportState;
  readonly selectionState: GeometrySelectionState;
  readonly onSelectionStateChange: (
    selectionState: GeometrySelectionState
  ) => void;
  readonly onViewportChange: (viewport: ViewportState) => void;
  readonly onFitViewport: () => void;
  readonly onResetViewport: () => void;
  readonly onZoomViewport: (zoomFactor: number) => void;
  readonly documentScaleDenominator?: ArchitecturalScaleDenominator;
  readonly onDocumentScaleChange?: (denominator: ArchitecturalScaleDenominator) => void;
  readonly levelMeasurement?: LevelMeasurement;
  readonly units?: Pick<Units, "length">;
  readonly statusLabel?: string;
  readonly interaction?: ProjectEditorInteraction;
  readonly editorOverlay?: GeometryEditorOverlay;
  readonly onEditorCanvasClick?: (pointer: SvgViewportPointer) => void;
  readonly onEditorPointerMove?: (
    pointer: SvgViewportPointer,
    pointerId: number
  ) => void;
  readonly onWallEndpointPointerDown?: (
    endpoint: WallEndpoint,
    pointerId: number
  ) => void;
  readonly onWallEndpointPointerUp?: (
    point: WorldPointXZ,
    pointerId: number
  ) => void;
  readonly onWallEndpointPointerCancel?: (pointerId: number) => void;
  readonly onJunctionPointerDown?: (pointerId: number) => void;
  readonly onOpeningPointerDown?: (openingId: string, wallId: string, pointerId: number) => void;
  readonly onOpeningDragThresholdCrossed?: (pointerId: number) => void;
  readonly onOpeningPointerUp?: (pointerId: number, dragged: boolean) => void;
  readonly onOpeningPointerCancel?: (pointerId: number) => void;
  readonly onRoomFaceCandidateClick?: (faceKey: string) => void;
  readonly onStairAdjustmentPointerDown?: (staircaseId: string, pointerId: number) => void;
  readonly onStairAdjustmentPointerUp?: (point: WorldPointXZ, pointerId: number) => void;
  readonly onStairAdjustmentPointerCancel?: (pointerId: number) => void;
};

/** Renders professional canvas chrome around a source-independent 2D model. */
export function GeometryViewerPanel({
  furnitureModel, onFurniturePointerDown, onFurniturePointerUp, onFurniturePointerCancel,
  workspaceCanvas = false,
  title,
  headingId,
  presentationModel,
  architecturalModel,
  dimensionModel,
  options,
  viewport,
  selectionState,
  onSelectionStateChange,
  onViewportChange,
  onFitViewport,
  onResetViewport,
  onZoomViewport,
  documentScaleDenominator,
  onDocumentScaleChange,
  levelMeasurement,
  units,
  statusLabel,
  interaction,
  editorOverlay,
  onEditorCanvasClick,
  onEditorPointerMove,
  onWallEndpointPointerDown,
  onWallEndpointPointerUp,
  onWallEndpointPointerCancel,
  onJunctionPointerDown,
  onOpeningPointerDown,
  onOpeningDragThresholdCrossed,
  onOpeningPointerUp,
  onOpeningPointerCancel,
  onRoomFaceCandidateClick,
  onStairAdjustmentPointerDown,
  onStairAdjustmentPointerUp,
  onStairAdjustmentPointerCancel
}: GeometryViewerPanelProps) {
  const { t } = useCasaTranslation("geometry-playground");

  return (
    <Paper
      component="section"
      className={workspaceCanvas ? "geometry-viewer-panel geometry-viewer-panel--workspace" : "geometry-viewer-panel"}
      aria-labelledby={headingId}
      variant="outlined"
    >
      {!workspaceCanvas ? <Box className="geometry-viewer-panel__toolbar">
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", minWidth: 0 }}
        >
          <Typography variant="subtitle2" component="h2" id={headingId} noWrap>
            {title}
          </Typography>
          <Chip
            label={statusLabel ?? t("viewer.readOnly")}
            size="small"
            variant="outlined"
          />
        </Stack>
        <Stack
          direction="row"
          spacing={0.25}
          role="toolbar"
          aria-label={t("toolbar.label")}
        >
          <ViewportButton
            label={t("toolbar.zoomOut")}
            onClick={() => onZoomViewport(0.85)}
          >
            <ZoomOutRoundedIcon fontSize="small" />
          </ViewportButton>
          <ViewportButton
            label={t("toolbar.zoomIn")}
            onClick={() => onZoomViewport(1.18)}
          >
            <ZoomInRoundedIcon fontSize="small" />
          </ViewportButton>
          <ViewportButton label={t("toolbar.fit")} onClick={onFitViewport}>
            <FitScreenRoundedIcon fontSize="small" />
          </ViewportButton>
          <ViewportButton label={t("toolbar.reset")} onClick={onResetViewport}>
            <RestartAltRoundedIcon fontSize="small" />
          </ViewportButton>
        </Stack>
      </Box> : null}
      <Box className="geometry-viewer-panel__canvas">
        <GeometrySvgViewer
          furnitureModel={furnitureModel} onFurniturePointerDown={onFurniturePointerDown} onFurniturePointerUp={onFurniturePointerUp} onFurniturePointerCancel={onFurniturePointerCancel}
          presentationModel={presentationModel}
          architecturalModel={architecturalModel}
          dimensionModel={dimensionModel}
          options={options}
          viewport={viewport}
          selectionState={selectionState}
          onSelectionStateChange={onSelectionStateChange}
          onViewportChange={onViewportChange}
          interaction={interaction}
          editorOverlay={editorOverlay}
          onEditorCanvasClick={onEditorCanvasClick}
          onEditorPointerMove={onEditorPointerMove}
          onWallEndpointPointerDown={onWallEndpointPointerDown}
          onWallEndpointPointerUp={onWallEndpointPointerUp}
          onWallEndpointPointerCancel={onWallEndpointPointerCancel}
          onJunctionPointerDown={onJunctionPointerDown}
          onOpeningPointerDown={onOpeningPointerDown}
          onOpeningDragThresholdCrossed={onOpeningDragThresholdCrossed}
          onOpeningPointerUp={onOpeningPointerUp}
          onOpeningPointerCancel={onOpeningPointerCancel}
          onRoomFaceCandidateClick={onRoomFaceCandidateClick}
          onStairAdjustmentPointerDown={onStairAdjustmentPointerDown}
          onStairAdjustmentPointerUp={onStairAdjustmentPointerUp}
          onStairAdjustmentPointerCancel={onStairAdjustmentPointerCancel}
        />
        <Box className="geometry-canvas-hint">
          <Typography variant="caption">{t("viewer.canvasHint")}</Typography>
        </Box>
      </Box>
      {!workspaceCanvas ? <Box className="geometry-viewer-panel__technical-bar" role="group" aria-label={t("toolbar.technical")}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          {documentScaleDenominator ? (
            onDocumentScaleChange ? (
              <FormControl size="small" className="geometry-document-scale">
                <InputLabel id="geometry-document-scale-label">{t("toolbar.scale")}</InputLabel>
                <Select
                  labelId="geometry-document-scale-label"
                  label={t("toolbar.scale")}
                  value={documentScaleDenominator}
                  onChange={(event) => onDocumentScaleChange(event.target.value as ArchitecturalScaleDenominator)}
                >
                  {architecturalScaleDenominators.map((denominator) => (
                    <MenuItem key={denominator} value={denominator}>1:{denominator}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Chip size="small" variant="outlined" label={`${t("toolbar.scale")}: 1:${documentScaleDenominator}`} />
            )
          ) : null}
          <Chip size="small" variant="outlined" label={`${t("toolbar.zoom")}: ${Math.round(viewport.zoom * 100)}%`} />
        </Stack>
        {levelMeasurement && units ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {levelMeasurement.rooms.length > 0 ? (
              <Typography variant="caption">{t("metrics.totalArea")}: {formatArchitecturalArea(levelMeasurement.totalRoomArea, units.length)}</Typography>
            ) : null}
            {levelMeasurement.plan ? (
              <>
                <Typography variant="caption">{t("metrics.width")}: {formatArchitecturalLength(levelMeasurement.plan.width, units.length)}</Typography>
                <Typography variant="caption">{t("metrics.depth")}: {formatArchitecturalLength(levelMeasurement.plan.depth, units.length)}</Typography>
              </>
            ) : null}
          </Stack>
        ) : null}
      </Box> : null}
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
