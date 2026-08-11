import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import { Box, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import type { ChangeEvent } from "react";

import { useCasaTranslation } from "../i18n";
import type { GeometryDisplayOptions } from "./GeometrySvgViewer";

const controlLabels: ReadonlyArray<{
  readonly option: keyof GeometryDisplayOptions;
  readonly labelKey: string;
}> = [
  { option: "polygons", labelKey: "layers.showPolygons" },
  { option: "boundaryEdges", labelKey: "layers.showBoundaryEdges" },
  { option: "vertices", labelKey: "layers.showVertices" },
  { option: "centroids", labelKey: "layers.showCentroids" },
  { option: "bounds", labelKey: "layers.showBounds" },
  { option: "entityLabels", labelKey: "layers.showEntityLabels" }
];

/** Props for local read-only geometry layer controls. */
export type GeometryLayerControlsProps = {
  readonly options: GeometryDisplayOptions;
  readonly onOptionsChange: (options: GeometryDisplayOptions) => void;
};

/** Renders accessible visibility switches for presentation-only SVG layers. */
export function GeometryLayerControls({ options, onOptionsChange }: GeometryLayerControlsProps) {
  const { t } = useCasaTranslation("inspector");
  const handleChange =
    (option: keyof GeometryDisplayOptions) => (event: ChangeEvent<HTMLInputElement>) => {
      onOptionsChange({ ...options, [option]: event.currentTarget.checked });
    };

  return (
    <Stack component="section" spacing={1} aria-label={t("layers.label")}>
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
      <Box className="geometry-layer-list">
        {controlLabels.map((control) => {
          const label = t(control.labelKey);

          return (
            <FormControlLabel
              key={control.option}
              className="geometry-layer-control"
              control={
                <Switch
                  checked={options[control.option]}
                  onChange={handleChange(control.option)}
                  size="small"
                  slotProps={{ input: { "aria-label": label } }}
                />
              }
              label={label}
              labelPlacement="start"
            />
          );
        })}
      </Box>
    </Stack>
  );
}
