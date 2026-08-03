import { Divider, Stack, Typography } from "@mui/material";

import { useCasaTranslation } from "../i18n";
import type {
  GeometryPresentationBoundaryEdge2D,
  GeometryPresentationModel2D,
  GeometryPresentationPolygon2D,
  GeometryPresentationVertex2D
} from "./geometry-presentation-model-2d";
import type { GeometrySelection, GeometrySelectionState } from "./geometry-selection-state";

/**
 * Props for the contextual geometry selection inspector.
 */
export type GeometrySelectionDetailsProps = {
  readonly model: GeometryPresentationModel2D;
  readonly selectionState: GeometrySelectionState;
};

/**
 * Renders selected runtime geometry details without mutating the runtime model.
 */
export function GeometrySelectionDetails({
  model,
  selectionState
}: GeometrySelectionDetailsProps) {
  const { t } = useCasaTranslation("inspector");
  const selectedSelections = selectionState.selected;
  const selectedEntity =
    selectedSelections.length === 1 ? findSelectedEntity(model, selectedSelections[0]) : undefined;

  if (selectedSelections.length === 0 || (selectedSelections.length === 1 && !selectedEntity)) {
    return (
      <Stack component="section" spacing={1} aria-labelledby="geometry-selection-heading">
        <Typography variant="subtitle2" component="h2" id="geometry-selection-heading">
          {t("selection.title")}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t("selection.empty")}
        </Typography>
      </Stack>
    );
  }

  if (!selectedEntity) {
    return (
      <Stack component="section" spacing={1} aria-labelledby="geometry-selection-heading">
        <Typography variant="subtitle2" component="h2" id="geometry-selection-heading">
          {t("selection.title")}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t("selection.multiple", { count: selectedSelections.length })}
        </Typography>
        <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2 }}>
          {selectedSelections.map((selection) => (
            <Typography
              component="li"
              key={`${selection.kind}-${selection.geometryId}`}
              variant="caption"
            >
              {formatSelectionReference(selection)}
            </Typography>
          ))}
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack component="section" spacing={1} aria-labelledby="geometry-selection-heading">
      <Typography variant="subtitle2" component="h2" id="geometry-selection-heading">
        {t("selection.title")}
      </Typography>
      <Stack component="dl" spacing={0} sx={{ m: 0 }}>
        {getSelectionItems(selectedEntity, t).map((item) => (
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
  entity: SelectedPresentationEntity,
  t: (key: string) => string
): ReadonlyArray<{ readonly label: string; readonly value: string }> => {
  if (entity.kind === "POLYGON") {
    return [
      { label: t("selection.labels.type"), value: t("selection.types.polygon") },
      { label: t("selection.labels.runtimeId"), value: entity.geometryId },
      { label: t("selection.labels.sourceRoomId"), value: entity.sourceRoomId },
      { label: t("selection.labels.area"), value: formatMeasurement(entity.area) },
      { label: t("selection.labels.winding"), value: entity.winding },
      {
        label: t("selection.labels.centroid"),
        value: `${formatMeasurement(entity.centroid.world.x)}, ${formatMeasurement(entity.centroid.world.z)}`
      }
    ];
  }

  if (entity.kind === "BOUNDARY_EDGE") {
    return [
      { label: t("selection.labels.type"), value: t("selection.types.boundaryEdge") },
      { label: t("selection.labels.runtimeId"), value: entity.geometryId },
      { label: t("selection.labels.sourceWallId"), value: entity.sourceWallId },
      { label: t("selection.labels.startVertex"), value: entity.startVertexId },
      { label: t("selection.labels.endVertex"), value: entity.endVertexId },
      { label: t("selection.labels.sharedUsageCount"), value: `${entity.sharedUsageCount}` }
    ];
  }

  return [
    { label: t("selection.labels.type"), value: t("selection.types.vertex") },
    { label: t("selection.labels.runtimeId"), value: entity.geometryId },
    {
      label: t("selection.labels.coordinates"),
      value: `${formatMeasurement(entity.coordinates.x)}, ${formatMeasurement(entity.coordinates.z)}`
    }
  ];
};

const formatSelectionReference = (selection: GeometrySelection): string =>
  `${selection.kind} ${selection.geometryId}`;

const formatMeasurement = (value: number): string => Number(value.toFixed(2)).toString();
