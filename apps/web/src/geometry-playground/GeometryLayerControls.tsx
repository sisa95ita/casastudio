import { Checkbox, FormControlLabel, FormGroup, Stack, Typography } from "@mui/material";
import type { ChangeEvent } from "react";

import type { GeometryDisplayOptions } from "./GeometrySvgViewer";

const controlLabels: ReadonlyArray<{
  readonly option: keyof GeometryDisplayOptions;
  readonly label: string;
}> = [
  { option: "polygons", label: "Show polygons" },
  { option: "boundaryEdges", label: "Show boundary edges" },
  { option: "vertices", label: "Show vertices" },
  { option: "centroids", label: "Show centroids" },
  { option: "bounds", label: "Show bounds" },
  { option: "runtimeLabels", label: "Show runtime labels" }
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
 * The controls own only view state. They do not write to `GeometryModel`, and
 * toggling diagnostic overlays never changes the immutable runtime topology
 * produced by the Geometry Engine.
 */
export function GeometryLayerControls({
  options,
  onOptionsChange
}: GeometryLayerControlsProps) {
  const handleChange =
    (option: keyof GeometryDisplayOptions) => (event: ChangeEvent<HTMLInputElement>) => {
      onOptionsChange({
        ...options,
        [option]: event.currentTarget.checked
      });
    };

  return (
    <Stack spacing={1} aria-label="Geometry debug layers">
      <Typography variant="subtitle2" component="h2">
        Layers
      </Typography>
      {controlLabels.map((control) => (
        <FormGroup key={control.option}>
          <FormControlLabel
            control={
              <Checkbox
                checked={options[control.option]}
                onChange={handleChange(control.option)}
                slotProps={{ input: { "aria-label": control.label } }}
              />
            }
            label={control.label}
          />
        </FormGroup>
      ))}
    </Stack>
  );
}
