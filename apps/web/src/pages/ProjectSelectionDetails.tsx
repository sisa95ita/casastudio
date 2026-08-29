import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { Button, Divider, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import {
  formatArchitecturalArea,
  formatArchitecturalLength,
  formatDisplayValue,
  type Opening,
  type Project,
  type Room,
  RoomTypeValues,
  type UpdateRoomProperties,
  type UpdateOpeningProperties,
  type Wall
} from "@casastudio/schema";
import type { RoomMeasurement } from "@casastudio/geometry";
import { useEffect, useState } from "react";

import type { GeometryPresentationModel2D } from "../geometry-playground/geometry-presentation-model-2d";
import type { GeometrySelectionState } from "../geometry-playground/geometry-selection-state";
import { useCasaTranslation } from "../i18n";
import type { WallEndpointEditingAvailability } from "../state/project-wall-editing";
import {
  ProjectWallPropertiesDetails,
  ProjectWallSelectionDetails
} from "./ProjectWallSelectionDetails";
import {
  ProjectNewOpeningPropertiesDetails,
  ProjectOpeningPropertiesDetails,
  ProjectOpeningSelectionDetails
} from "./ProjectOpeningSelectionDetails";
import type { OpeningAuthoringProperties, OpeningAuthoringType } from "../state/project-editor-slice";

/** Dispatches Edit-mode selection details by runtime geometry kind. */
export function ProjectSelectionDetails({
  model,
  selectionState,
  wall,
  units,
  endpointAvailability,
  selectedVertexRemovable = false,
  onDeleteWall,
  onAddWallVertex,
  onRemoveVertex,
  opening,
  room,
  roomMeasurement,
  openingWall,
  openingDisplayOffsetFromStart,
  onDeleteOpening,
  onUpdateOpening,
  onDeleteRoom,
  editable = true
}: {
  readonly model: GeometryPresentationModel2D;
  readonly selectionState: GeometrySelectionState;
  readonly wall?: Wall;
  readonly units: Project["units"];
  readonly endpointAvailability?: WallEndpointEditingAvailability;
  readonly selectedVertexRemovable?: boolean;
  readonly onDeleteWall: () => void;
  readonly onAddWallVertex?: () => void;
  readonly onRemoveVertex?: () => void;
  readonly opening?: Opening;
  readonly room?: Room;
  readonly roomMeasurement?: RoomMeasurement;
  readonly openingWall?: Wall;
  /** Transient Wall-local Opening offset used only for Inspector display. */
  readonly openingDisplayOffsetFromStart?: number;
  readonly onDeleteOpening?: () => void;
  readonly onUpdateOpening?: (properties: UpdateOpeningProperties) => boolean;
  readonly onDeleteRoom?: () => void;
  readonly editable?: boolean;
}) {
  const selection = selectionState.selected;

  if (selection.length === 0) {
    return <EmptySelectionDetails />;
  }
  if (
    selection.length === 1 &&
    (selection[0]?.kind === "DOOR" || selection[0]?.kind === "WINDOW" || selection[0]?.kind === "OPENING") &&
    opening && openingWall
  ) {
    return <ProjectOpeningSelectionDetails wall={openingWall} opening={opening} displayOffsetFromStart={openingDisplayOffsetFromStart} units={units} onDelete={onDeleteOpening ?? (() => undefined)} onUpdate={onUpdateOpening ?? (() => false)} editable={editable} />;
  }
  if (
    selection.length === 1 &&
    selection[0]?.kind === "POLYGON" &&
    room &&
    roomMeasurement
  ) {
    return <ProjectRoomSelectionDetails room={room} measurement={roomMeasurement} units={units} onDelete={onDeleteRoom} editable={editable} />;
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
        onAddVertex={onAddWallVertex}
        editable={editable}
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
          removable={selectedVertexRemovable}
          onRemove={onRemoveVertex}
        />
      );
  }

  return <ProjectMultiSelectionDetails selectionState={selectionState} />;
}

/** Routes the selected entity to the supported editable property surface. */
export function ProjectPropertiesDetails({
  selectionState,
  wall,
  opening,
  openingWall,
  openingDisplayOffsetFromStart,
  room,
  units,
  onUpdateWallProperties,
  onUpdateOpening,
  onUpdateRoomProperties,
  openingAuthoring,
  onUpdateOpeningAuthoring
}: {
  readonly selectionState: GeometrySelectionState;
  readonly wall?: Wall;
  readonly opening?: Opening;
  readonly openingWall?: Wall;
  /** Transient Wall-local Opening offset used only for Properties display. */
  readonly openingDisplayOffsetFromStart?: number;
  readonly room?: Room;
  readonly units: Project["units"];
  readonly onUpdateWallProperties: (properties: {
    readonly length?: number;
    readonly anchoredEndpoint?: "START" | "END";
    readonly height?: number;
    readonly thickness?: number;
  }) => boolean;
  readonly onUpdateOpening?: (properties: UpdateOpeningProperties) => boolean;
  readonly onUpdateRoomProperties?: (properties: Partial<UpdateRoomProperties>) => boolean;
  readonly openingAuthoring?: {
    readonly openingType: OpeningAuthoringType;
    readonly properties: OpeningAuthoringProperties;
  };
  readonly onUpdateOpeningAuthoring?: (properties: Partial<OpeningAuthoringProperties>) => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  if (openingAuthoring) {
    return (
      <ProjectNewOpeningPropertiesDetails
        openingType={openingAuthoring.openingType}
        properties={openingAuthoring.properties}
        units={units}
        onChange={onUpdateOpeningAuthoring ?? (() => undefined)}
      />
    );
  }
  if (selectionState.selected.length === 0) {
    return <PropertiesMessage message={t("properties.selectObject")} />;
  }
  if (selectionState.selected.length > 1) {
    return <PropertiesMessage message={t("properties.multipleUnsupported")} />;
  }
  const selection = selectionState.selected[0];
  if ((selection?.kind === "BOUNDARY_EDGE" || selection?.kind === "WALL") && wall) {
    return (
      <ProjectWallPropertiesDetails
        wall={wall}
        units={units}
        onUpdateProperties={onUpdateWallProperties}
      />
    );
  }
  if (
    (selection?.kind === "DOOR" || selection?.kind === "WINDOW" || selection?.kind === "OPENING") &&
    opening &&
    openingWall
  ) {
    return (
      <ProjectOpeningPropertiesDetails
        wall={openingWall}
        opening={opening}
        displayOffsetFromStart={openingDisplayOffsetFromStart}
        units={units}
        onUpdate={onUpdateOpening ?? (() => false)}
      />
    );
  }
  if (selection?.kind === "POLYGON" && room) {
    return <ProjectRoomPropertiesDetails room={room} onUpdate={onUpdateRoomProperties ?? (() => false)} />;
  }
  return <PropertiesMessage message={t("properties.unavailable")} />;
}

/** Displays a product-oriented summary for heterogeneous or homogeneous selections. */
function ProjectMultiSelectionDetails({
  selectionState
}: {
  readonly selectionState: GeometrySelectionState;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const counts = new Map<string, number>();
  for (const selection of selectionState.selected) {
    const kind = selection.kind === "BOUNDARY_EDGE" || selection.kind === "WALL"
      ? "walls"
      : selection.kind === "POLYGON"
        ? "rooms"
        : selection.kind === "DOOR"
          ? "doors"
        : selection.kind === "WINDOW"
          ? "windows"
          : selection.kind === "OPENING"
            ? "openings"
            : "junctions";
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const composition = [...counts.entries()]
    .map(([kind, count]) => t(`selection.summary.${kind}`, { count }))
    .join(", ");

  return (
    <Stack component="section" spacing={1}>
      <Typography variant="subtitle2">
        {t("selection.multipleTitle", { count: selectionState.selected.length })}
      </Typography>
      <Typography variant="body2">{composition}</Typography>
      <Typography variant="caption" color="text.secondary">
        {t("selection.multipleHint")}
      </Typography>
    </Stack>
  );
}

/** Displays a restrained explanation when no safe property editor applies. */
function PropertiesMessage({ message }: { readonly message: string }) {
  const { t } = useCasaTranslation("project-viewer");
  return (
    <Stack component="section" spacing={1}>
      <Typography variant="subtitle2">{t("properties.title")}</Typography>
      <Typography variant="caption" color="text.secondary">{message}</Typography>
    </Stack>
  );
}

/** Displays semantic Room identity and metrics from the reusable measurement model. */
function ProjectRoomSelectionDetails({
  room,
  measurement,
  units,
  onDelete,
  editable
}: {
  readonly room: Room;
  readonly measurement: RoomMeasurement;
  readonly units: Project["units"];
  readonly onDelete?: () => void;
  readonly editable: boolean;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const rows = [
    [t("room.labels.name"), room.name],
    [t("room.labels.type"), t(`room.types.${room.type}`)],
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
      {editable ? <Button
        color="error"
        variant="outlined"
        size="small"
        startIcon={<DeleteOutlineRoundedIcon />}
        onClick={onDelete}
      >
        {t("room.delete")}
      </Button> : null}
    </Stack>
  );
}

/** Renders canonical Room metadata fields without exposing topology. */
function ProjectRoomPropertiesDetails({
  room,
  onUpdate
}: {
  readonly room: Room;
  readonly onUpdate: (properties: Partial<UpdateRoomProperties>) => boolean;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const [name, setName] = useState(room.name);
  useEffect(() => setName(room.name), [room.name]);
  const commitName = () => {
    const nextName = name.trim();
    if (nextName === room.name) {
      setName(room.name);
      return;
    }
    if (!onUpdate({ name: nextName })) setName(room.name);
  };

  return (
    <Stack component="section" spacing={1.5}>
      <Typography variant="subtitle2">{t("room.propertiesTitle")}</Typography>
      <TextField
        size="small"
        label={t("room.labels.name")}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commitName();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setName(room.name);
            event.currentTarget.blur();
          }
        }}
        slotProps={{ htmlInput: { "aria-label": t("room.labels.name") } }}
      />
      <FormControl size="small">
        <InputLabel id="room-type-label">{t("room.labels.type")}</InputLabel>
        <Select
          labelId="room-type-label"
          label={t("room.labels.type")}
          value={room.type}
          inputProps={{ "aria-label": t("room.labels.type") }}
          onChange={(event) => onUpdate({ type: event.target.value as Room["type"] })}
        >
          {RoomTypeValues.map((type) => (
            <MenuItem key={type} value={type}>{t(`room.types.${type}`)}</MenuItem>
          ))}
        </Select>
      </FormControl>
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
  unit,
  removable,
  onRemove
}: {
  readonly model: GeometryPresentationModel2D;
  readonly vertexId: string;
  readonly unit: string;
  readonly removable: boolean;
  readonly onRemove?: () => void;
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
      {removable ? (
        <Button size="small" variant="outlined" onClick={onRemove}>
          {t("wall.removeVertex")}
        </Button>
      ) : null}
    </Stack>
  );
}

const formatNumber = (value: number): string => formatDisplayValue(value, 2);
