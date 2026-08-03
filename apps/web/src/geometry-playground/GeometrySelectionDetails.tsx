import { Divider, Stack, Typography } from "@mui/material";

import type {
  GeometryPresentationBoundaryEdge2D,
  GeometryPresentationModel2D,
  GeometryPresentationPolygon2D,
  GeometryPresentationVertex2D
} from "./geometry-presentation-model-2d";
import type { GeometrySelection } from "./geometry-selection-state";

/**
 * Props for the contextual geometry selection inspector.
 */
export type GeometrySelectionDetailsProps = {
  readonly model: GeometryPresentationModel2D;
  readonly selection?: GeometrySelection;
};

/**
 * Renders selected runtime geometry details without mutating the runtime model.
 */
export function GeometrySelectionDetails({
  model,
  selection
}: GeometrySelectionDetailsProps) {
  const selectedEntity = findSelectedEntity(model, selection);

  if (!selection || !selectedEntity) {
    return (
      <Stack component="section" spacing={1} aria-labelledby="geometry-selection-heading">
        <Typography variant="subtitle2" component="h2" id="geometry-selection-heading">
          Selection
        </Typography>
        <Typography variant="caption" color="text.secondary">
          No geometry selected.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack component="section" spacing={1} aria-labelledby="geometry-selection-heading">
      <Typography variant="subtitle2" component="h2" id="geometry-selection-heading">
        Selection
      </Typography>
      <Stack component="dl" spacing={0} sx={{ m: 0 }}>
        {getSelectionItems(selectedEntity).map((item) => (
          <Stack key={item.label} spacing={0.75}>
            <Divider />
            <Stack
              className="geometry-summary-item"
              direction="row"
              spacing={1.5}
              sx={{ justifyContent: "space-between" }}
            >
              <Typography component="dt" variant="caption" color="text.secondary">
                {item.label}
              </Typography>
              <Typography
                component="dd"
                variant="caption"
                sx={{ fontWeight: 700, m: 0, textAlign: "right" }}
              >
                {item.value}
              </Typography>
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

type SelectedPresentationEntity =
  | GeometryPresentationPolygon2D
  | GeometryPresentationBoundaryEdge2D
  | GeometryPresentationVertex2D;

const findSelectedEntity = (
  model: GeometryPresentationModel2D,
  selection: GeometrySelection | undefined
): SelectedPresentationEntity | undefined => {
  if (!selection) {
    return undefined;
  }

  if (selection.kind === "POLYGON") {
    return model.polygons.find((polygon) => polygon.geometryId === selection.geometryId);
  }

  if (selection.kind === "BOUNDARY_EDGE") {
    return model.boundaryEdges.find((edge) => edge.geometryId === selection.geometryId);
  }

  return model.vertices.find((vertex) => vertex.geometryId === selection.geometryId);
};

const getSelectionItems = (
  entity: SelectedPresentationEntity
): ReadonlyArray<{ readonly label: string; readonly value: string }> => {
  if (entity.kind === "POLYGON") {
    return [
      { label: "Type", value: "Polygon" },
      { label: "Runtime id", value: entity.geometryId },
      { label: "Source room id", value: entity.sourceRoomId },
      { label: "Area", value: formatMeasurement(entity.area) },
      { label: "Winding", value: entity.winding },
      {
        label: "Centroid",
        value: `${formatMeasurement(entity.centroid.world.x)}, ${formatMeasurement(entity.centroid.world.z)}`
      }
    ];
  }

  if (entity.kind === "BOUNDARY_EDGE") {
    return [
      { label: "Type", value: "Boundary edge" },
      { label: "Runtime id", value: entity.geometryId },
      { label: "Source wall id", value: entity.sourceWallId },
      { label: "Start vertex", value: entity.startVertexId },
      { label: "End vertex", value: entity.endVertexId },
      { label: "Shared usage count", value: `${entity.sharedUsageCount}` }
    ];
  }

  return [
    { label: "Type", value: "Vertex" },
    { label: "Runtime id", value: entity.geometryId },
    {
      label: "Coordinates",
      value: `${formatMeasurement(entity.coordinates.x)}, ${formatMeasurement(entity.coordinates.z)}`
    }
  ];
};

const formatMeasurement = (value: number): string => Number(value.toFixed(2)).toString();
