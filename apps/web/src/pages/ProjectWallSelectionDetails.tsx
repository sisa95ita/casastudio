import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  Alert,
  Button,
  Divider,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { formatArchitecturalLength, type Project, type Wall } from "@casastudio/schema";
import { measureWall } from "@casastudio/geometry";
import { useEffect, useState, type KeyboardEvent } from "react";

import { useCasaTranslation } from "../i18n";
import type { WallEndpointEditingAvailability } from "../state/project-wall-editing";
import { formatEditorMeasurement, normalizeEditorMeasurement } from "./editor-measurement";

/** Displays canonical Wall identity, geometry summary, and safe contextual actions. */
export function ProjectWallSelectionDetails({
  wall,
  units,
  endpointAvailability,
  onDelete,
  editable = true
}: {
  readonly wall?: Wall;
  readonly units: Project["units"];
  readonly endpointAvailability?: WallEndpointEditingAvailability;
  readonly onDelete: () => void;
  readonly editable?: boolean;
}) {
  const { t } = useCasaTranslation("project-viewer");

  if (!wall) {
    return (
      <Stack component="section" spacing={1}>
        <Typography variant="subtitle2">{t("wall.selectionTitle")}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t("wall.emptySelection")}
        </Typography>
      </Stack>
    );
  }

  const length = measureWall(wall).length;
  const items = [
    [t("wall.labels.identity"), wall.name ?? wall.id],
    [t("wall.labels.type"), t("wall.type")],
    [t("wall.labels.length"), formatArchitecturalLength(length, units.length)],
    [t("wall.labels.start"), formatPoint(wall.start, units.length)],
    [t("wall.labels.end"), formatPoint(wall.end, units.length)]
  ] as const;

  return (
    <Stack component="section" spacing={1.5}>
      <Typography variant="subtitle2">{t("wall.selectionTitle")}</Typography>
      <Stack component="dl" spacing={0} sx={{ m: 0 }}>
        {items.map(([label, value]) => (
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
      {endpointAvailability ? (
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            {t("wall.endpointStatus", {
              endpoint: t("wall.labels.start"),
              status: t(
                endpointAvailability.start.draggable
                  ? "wall.endpointFree"
                  : endpointAvailability.start.topology === "shared-junction"
                    ? "wall.endpointConnected"
                    : "wall.endpointRoomBoundary"
              )
            })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("wall.endpointStatus", {
              endpoint: t("wall.labels.end"),
              status: t(
                endpointAvailability.end.draggable
                  ? "wall.endpointFree"
                  : endpointAvailability.end.topology === "shared-junction"
                    ? "wall.endpointConnected"
                    : "wall.endpointRoomBoundary"
              )
            })}
          </Typography>
        </Stack>
      ) : null}
      {endpointAvailability?.roomReferenced ? (
        <Alert severity="info" variant="outlined">
          {t("wall.roomEndpointEditingUnavailable")}
        </Alert>
      ) : null}
      {!endpointAvailability?.roomReferenced &&
      (endpointAvailability?.start.topology === "shared-junction" ||
        endpointAvailability?.end.topology === "shared-junction") ? (
        <Alert severity="info" variant="outlined">
          {t("wall.sharedEndpointEditingUnavailable")}
        </Alert>
      ) : null}
      {editable ? <Button
        color="error"
        variant="outlined"
        size="small"
        startIcon={<DeleteOutlineRoundedIcon />}
        onClick={onDelete}
      >
        {t("wall.delete")}
      </Button> : null}
    </Stack>
  );
}

/** Renders the scalar Wall values supported by semantic property operations. */
export function ProjectWallPropertiesDetails({
  wall,
  units,
  onUpdateProperties
}: {
  readonly wall?: Wall;
  readonly units: Project["units"];
  readonly onUpdateProperties: (properties: {
    readonly height?: number;
    readonly thickness?: number;
  }) => boolean;
}) {
  const { t } = useCasaTranslation("project-viewer");
  if (!wall) return <PropertiesUnavailable />;

  return (
    <Stack component="section" spacing={1.5}>
      <Typography variant="subtitle2">{t("wall.propertiesTitle")}</Typography>
      <WallMeasurementField
        label={t("wall.labels.thickness")}
        unit={units.length}
        value={wall.thickness}
        onCommit={(thickness) => onUpdateProperties({ thickness })}
      />
      <WallMeasurementField
        label={t("wall.labels.height")}
        unit={units.length}
        value={wall.height}
        onCommit={(height) => onUpdateProperties({ height })}
      />
    </Stack>
  );
}

/** Renders the empty Wall properties state without implying unsupported edits. */
function PropertiesUnavailable() {
  const { t } = useCasaTranslation("project-viewer");
  return (
    <Typography variant="caption" color="text.secondary">
      {t("properties.selectObject")}
    </Typography>
  );
}

/** Commits one normalized Wall measurement on blur or Enter. */
function WallMeasurementField({
  label,
  unit,
  value,
  onCommit
}: {
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly onCommit: (value: number) => boolean;
}) {
  const [draftValue, setDraftValue] = useState(formatEditorMeasurement(value));

  useEffect(() => setDraftValue(formatEditorMeasurement(value)), [value]);

  const commit = () => {
    const normalized = normalizeEditorMeasurement(Number(draftValue));
    if (normalized === normalizeEditorMeasurement(value)) {
      setDraftValue(formatEditorMeasurement(value));
      return;
    }
    if (!onCommit(normalized)) setDraftValue(formatEditorMeasurement(value));
    else setDraftValue(formatEditorMeasurement(normalized));
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commit();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraftValue(formatEditorMeasurement(value));
      event.currentTarget.blur();
    }
  };

  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={draftValue}
      onChange={(event) => setDraftValue(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      slotProps={{
        htmlInput: { step: "any", "aria-label": `${label} (${unit})` },
        input: {
          endAdornment: <Typography variant="caption">{unit}</Typography>
        }
      }}
    />
  );
}

const formatPoint = (point: Wall["start"], unit: string): string =>
  `${formatEditorMeasurement(point.x)}, ${formatEditorMeasurement(point.z)} ${unit}`;
