import { Checkbox, FormControlLabel, FormGroup, Stack, Typography } from "@mui/material";
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

/**
 * Props for the local read-only geometry debug layer controls.
 */
export type GeometryLayerControlsProps = {
  readonly options: GeometryDisplayOptions;
  readonly onOptionsChange: (options: GeometryDisplayOptions) => void;
};

/**
 * Renders accessible checkboxes for SVG diagnostic layers.
 *
 * The controls own only view state. Toggling diagnostic overlays never changes
 * authoritative geometry or runtime topology.
 */
export function GeometryLayerControls({
  options,
  onOptionsChange
}: GeometryLayerControlsProps) {
  const { t } = useCasaTranslation("inspector");
  const handleChange =
    (option: keyof GeometryDisplayOptions) => (event: ChangeEvent<HTMLInputElement>) => {
      onOptionsChange({
        ...options,
        [option]: event.currentTarget.checked
      });
    };

  return (
    <Stack spacing={1} aria-label={t("layers.label")}>
      <Typography variant="subtitle2" component="h2">
        {t("layers.title")}
      </Typography>
      {controlLabels.map((control) => {
        const label = t(control.labelKey);

        return (
          <FormGroup key={control.option}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={options[control.option]}
                  onChange={handleChange(control.option)}
                  slotProps={{ input: { "aria-label": label } }}
                />
              }
              label={label}
            />
          </FormGroup>
        );
      })}
    </Stack>
  );
}
