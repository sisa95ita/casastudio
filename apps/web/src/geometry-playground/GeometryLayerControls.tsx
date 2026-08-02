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
    <fieldset className="geometry-controls" aria-label="Geometry debug layers">
      <legend>Layers</legend>
      {controlLabels.map((control) => (
        <label key={control.option} className="geometry-control">
          <input
            type="checkbox"
            checked={options[control.option]}
            onChange={handleChange(control.option)}
          />
          <span>{control.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
