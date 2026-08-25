import DoorFrontRoundedIcon from "@mui/icons-material/DoorFrontRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";
import ViewStreamRoundedIcon from "@mui/icons-material/ViewStreamRounded";
import { Box, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import type { LevelMeasurement } from "@casastudio/geometry";
import {
  formatArchitecturalArea,
  formatArchitecturalLength,
  type Project
} from "@casastudio/schema";
import type { ReactNode } from "react";

import type { GeometryDisplayOptions } from "../geometry-playground/GeometrySvgViewer";
import { useCasaTranslation } from "../i18n";

/** Product-layer controls and plan measurements shown by the Project inspector. */
export type ProjectLayerControlsProps = {
  readonly options: GeometryDisplayOptions;
  readonly onOptionsChange: (options: GeometryDisplayOptions) => void;
  readonly measurement?: LevelMeasurement;
  readonly units?: Project["units"];
};

/** One semantic layer and its mapping to renderer presentation flags. */
type ProductLayer = {
  readonly id: "walls" | "rooms" | "openings" | "dimensions" | "annotations";
  readonly icon: ReactNode;
  readonly visible: (options: GeometryDisplayOptions) => boolean;
  readonly apply: (options: GeometryDisplayOptions, visible: boolean) => GeometryDisplayOptions;
};

/** Stable architectural layer order used by the Project inspector. */
const productLayers: readonly ProductLayer[] = Object.freeze([
  {
    id: "walls",
    icon: <ViewStreamRoundedIcon fontSize="small" />,
    visible: (options) => options.architecturalWalls,
    apply: (options, visible) => ({
      ...options,
      architecturalWalls: visible
    })
  },
  {
    id: "rooms",
    icon: <MeetingRoomRoundedIcon fontSize="small" />,
    visible: (options) => options.polygons || options.roomMetrics,
    apply: (options, visible) => ({
      ...options,
      polygons: visible,
      roomMetrics: visible
    })
  },
  {
    id: "openings",
    icon: <DoorFrontRoundedIcon fontSize="small" />,
    visible: (options) => options.openings,
    apply: (options, visible) => ({ ...options, openings: visible })
  },
  {
    id: "dimensions",
    icon: <StraightenRoundedIcon fontSize="small" />,
    visible: (options) => options.overallDimensions || options.selectedDimensions,
    apply: (options, visible) => ({
      ...options,
      overallDimensions: visible,
      selectedDimensions: visible
    })
  },
  {
    id: "annotations",
    icon: <NotesRoundedIcon fontSize="small" />,
    visible: (options) => options.annotations,
    apply: (options, visible) => ({ ...options, annotations: visible })
  }
]);

/** Renders architectural visibility concepts without exposing runtime diagnostics. */
export function ProjectLayerControls({
  options,
  onOptionsChange,
  measurement,
  units
}: ProjectLayerControlsProps) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <Stack component="section" spacing={2} aria-label={t("layers.label")}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Box className="inspector-section-icon" aria-hidden="true">
          <LayersRoundedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="subtitle2" component="h2">
            {t("layers.title")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("layers.description")}
          </Typography>
        </Box>
      </Stack>

      <Box className="project-layer-list">
        {productLayers.map((layer) => {
          const label = t(`layers.items.${layer.id}`);
          return (
            <FormControlLabel
              key={layer.id}
              className="project-layer-control"
              control={
                <Switch
                  checked={layer.visible(options)}
                  onChange={(_event, visible) =>
                    onOptionsChange(layer.apply(options, visible))
                  }
                  size="small"
                  slotProps={{ input: { "aria-label": label } }}
                />
              }
              label={
                <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                  <Box className="project-layer-control__icon" aria-hidden="true">
                    {layer.icon}
                  </Box>
                  <Typography variant="body2">{label}</Typography>
                </Stack>
              }
              labelPlacement="start"
            />
          );
        })}
      </Box>

      {measurement && units ? (
        <Box className="project-plan-summary" aria-label={t("planSummary.title")}>
          <Typography variant="overline" color="text.secondary">
            {t("planSummary.title")}
          </Typography>
          {measurement.rooms.length > 0 ? (
            <SummaryRow
              label={t("planSummary.totalArea")}
              value={formatArchitecturalArea(measurement.totalRoomArea, units.length)}
            />
          ) : null}
          {measurement.plan ? (
            <>
              <SummaryRow
                label={t("planSummary.width")}
                value={formatArchitecturalLength(measurement.plan.width, units.length)}
              />
              <SummaryRow
                label={t("planSummary.depth")}
                value={formatArchitecturalLength(measurement.plan.depth, units.length)}
              />
            </>
          ) : null}
        </Box>
      ) : null}
    </Stack>
  );
}

/** Renders one read-only plan measurement. */
function SummaryRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Stack direction="row" className="project-plan-summary__row">
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>{value}</Typography>
    </Stack>
  );
}
