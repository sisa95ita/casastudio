import { Divider, Stack, Typography } from "@mui/material";
import {
  formatArchitecturalArea,
  formatArchitecturalLength,
  formatDisplayValue,
  type Opening,
  type Project,
  type Room,
  type UpdateOpeningProperties,
  type Wall
} from "@casastudio/schema";
import type { RoomMeasurement } from "@casastudio/geometry";

import type { GeometryPresentationModel2D } from "../geometry-playground/geometry-presentation-model-2d";
import { GeometrySelectionDetails } from "../geometry-playground/GeometrySelectionDetails";
import type { GeometrySelectionState } from "../geometry-playground/geometry-selection-state";
import { useCasaTranslation } from "../i18n";
import type { WallEndpointEditingAvailability } from "../state/project-wall-editing";
import { ProjectWallSelectionDetails } from "./ProjectWallSelectionDetails";
import { ProjectOpeningSelectionDetails } from "./ProjectOpeningSelectionDetails";

/** Dispatches Edit-mode selection details by runtime geometry kind. */
export function ProjectSelectionDetails({
  model,
  selectionState,
  wall,
  units,
  endpointAvailability,
  onDeleteWall,
  onUpdateWallProperties,
  opening,
  room,
  roomMeasurement,
  openingWall,
  openingDisplayOffsetFromStart,
  onDeleteOpening,
  onUpdateOpening
}: {
  readonly model: GeometryPresentationModel2D;
  readonly selectionState: GeometrySelectionState;
  readonly wall?: Wall;
  readonly units: Project["units"];
  readonly endpointAvailability?: WallEndpointEditingAvailability;
  readonly onDeleteWall: () => void;
  readonly onUpdateWallProperties: (properties: {
    readonly height?: number;
    readonly thickness?: number;
  }) => boolean;
  readonly opening?: Opening;
  readonly room?: Room;
  readonly roomMeasurement?: RoomMeasurement;
  readonly openingWall?: Wall;
  /** Transient Wall-local Opening offset used only for Inspector display. */
  readonly openingDisplayOffsetFromStart?: number;
  readonly onDeleteOpening?: () => void;
  readonly onUpdateOpening?: (properties: UpdateOpeningProperties) => boolean;
}) {
  const selection = selectionState.selected;

  if (selection.length === 0) {
    return <EmptySelectionDetails />;
  }
  if (
    selection.length === 1 &&
    (selection[0]?.kind === "DOOR" || selection[0]?.kind === "WINDOW") &&
    opening && openingWall
  ) {
    return <ProjectOpeningSelectionDetails wall={openingWall} opening={opening} displayOffsetFromStart={openingDisplayOffsetFromStart} units={units} onDelete={onDeleteOpening ?? (() => undefined)} onUpdate={onUpdateOpening ?? (() => false)} />;
  }
  if (
    selection.length === 1 &&
    selection[0]?.kind === "POLYGON" &&
    room &&
    roomMeasurement
  ) {
    return <ProjectRoomSelectionDetails room={room} measurement={roomMeasurement} units={units} />;
  }
  if (
    selection.length === 1 &&
    (selection[0]?.kind === "BOUNDARY_EDGE" || selection[0]?.kind === "WALL") &&
    wall
  ) {
    return (
      <ProjectWallSelectionDetails
        wall={wall}
        units={units}
        endpointAvailability={endpointAvailability}
        onDelete={onDeleteWall}
        onUpdateProperties={onUpdateWallProperties}
      />
    );
  }
  if (selection.length === 1 && selection[0]?.kind === "VERTEX") {
    const vertex = model.vertices.find(
      (candidate) => candidate.geometryId === selection[0]?.geometryId
    );
    if (vertex)
      return (
        <ProjectVertexSelectionDetails
          model={model}
          vertexId={vertex.geometryId}
          unit={units.length}
        />
      );
  }

  return (
    <GeometrySelectionDetails model={model} selectionState={selectionState} />
  );
}

/** Displays semantic Room identity and metrics from the reusable measurement model. */
function ProjectRoomSelectionDetails({
  room,
  measurement,
  units
}: {
  readonly room: Room;
  readonly measurement: RoomMeasurement;
  readonly units: Project["units"];
}) {
  const { t } = useCasaTranslation("project-viewer");
  const rows = [
    [t("room.labels.name"), room.name],
    [t("room.labels.type"), room.type],
    [t("room.labels.area"), formatArchitecturalArea(measurement.area, units.length)],
    [t("room.labels.perimeter"), formatArchitecturalLength(measurement.perimeter, units.length)]
  ] as const;
  return (
    <Stack component="section" spacing={1.5}>
      <Typography variant="subtitle2">{t("room.selectionTitle")}</Typography>
      <Stack component="dl" spacing={0} sx={{ m: 0 }}>
        {rows.map(([label, value]) => (
          <Stack key={label} spacing={0.75}>
            <Divider />
            <Stack className="geometry-summary-item" direction="row" spacing={1.5} sx={{ justifyContent: "space-between" }}>
              <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
              <Typography component="dd" variant="caption" sx={{ fontWeight: 700, m: 0, textAlign: "right" }}>{value}</Typography>
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

function EmptySelectionDetails() {
  const { t } = useCasaTranslation("project-viewer");
  return (
    <Stack component="section" spacing={1}>
      <Typography variant="subtitle2">{t("selection.title")}</Typography>
      <Typography variant="caption" color="text.secondary">
        {t("selection.empty")}
      </Typography>
    </Stack>
  );
}

function ProjectVertexSelectionDetails({
  model,
  vertexId,
  unit
}: {
  readonly model: GeometryPresentationModel2D;
  readonly vertexId: string;
  readonly unit: string;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const vertex = model.vertices.find(
    (candidate) => candidate.geometryId === vertexId
  );
  if (!vertex) return <EmptySelectionDetails />;
  const incidentEdges = model.boundaryEdges.filter(
    (edge) => edge.startVertexId === vertexId || edge.endVertexId === vertexId
  );
  const wallIds = [...new Set(incidentEdges.map((edge) => edge.sourceWallId))];
  const rows = [
    [t("selection.labels.type"), t("selection.vertex")],
    [
      t("selection.labels.position"),
      `X: ${formatNumber(vertex.coordinates.x)} ${unit} · Z: ${formatNumber(vertex.coordinates.z)} ${unit}`
    ],
    [t("selection.labels.connectedWalls"), String(wallIds.length)]
  ] as const;

  return (
    <Stack component="section" spacing={1.5}>
      <Typography variant="subtitle2">{t("selection.title")}</Typography>
      <Stack component="dl" spacing={0} sx={{ m: 0 }}>
        {rows.map(([label, value]) => (
          <Stack key={label} spacing={0.75}>
            <Divider />
            <Stack
              className="geometry-summary-item"
              direction="row"
              spacing={1.5}
              sx={{ justifyContent: "space-between" }}
            >
              <Typography
                component="dt"
                variant="caption"
                color="text.secondary"
              >
                {label}
              </Typography>
              <Typography
                component="dd"
                variant="caption"
                sx={{ fontWeight: 700, m: 0, textAlign: "right" }}
              >
                {value}
              </Typography>
            </Stack>
          </Stack>
        ))}
      </Stack>
      {wallIds.length > 0 ? (
        <Stack
          spacing={0.25}
          aria-label={t("selection.labels.connectedWallIds")}
        >
          <Typography variant="caption" color="text.secondary">
            {t("selection.labels.connectedWallIds")}
          </Typography>
          {wallIds.map((wallId) => (
            <Typography key={wallId} variant="caption">
              {wallId}
            </Typography>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

const formatNumber = (value: number): string => formatDisplayValue(value, 2);
