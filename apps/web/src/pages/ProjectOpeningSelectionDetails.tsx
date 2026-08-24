import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import FlipRoundedIcon from "@mui/icons-material/FlipRounded";
import { Button, Divider, Stack, TextField, Typography } from "@mui/material";
import {
  formatArchitecturalLength,
  getDoorHingeSide,
  getDoorSwingSide,
  type Opening,
  type Project,
  type UpdateOpeningProperties,
  type Wall
} from "@casastudio/schema";
import { useEffect, useState, type KeyboardEvent } from "react";

import { useCasaTranslation } from "../i18n";
import { formatEditorMeasurement, normalizeEditorMeasurement } from "./editor-measurement";

/** Displays one canonical Wall-owned Door or Window and safe contextual actions. */
export function ProjectOpeningSelectionDetails({
  wall,
  opening,
  displayOffsetFromStart,
  units,
  onUpdate,
  onDelete,
  editable = true
}: {
  readonly wall: Wall;
  readonly opening: Opening;
  /** Transient Wall-local offset shown without changing the canonical Opening. */
  readonly displayOffsetFromStart?: number;
  readonly units: Project["units"];
  readonly onUpdate: (properties: UpdateOpeningProperties) => boolean;
  readonly onDelete: () => void;
  readonly editable?: boolean;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const rows = [
    [t("opening.labels.type"), t(opening.type === "DOOR" ? "opening.door" : "opening.window")],
    [t("opening.labels.wall"), wall.name ?? wall.id],
    [t("opening.labels.width"), formatArchitecturalLength(opening.width, units.length)],
    [t("opening.labels.height"), formatArchitecturalLength(opening.height, units.length)],
    [t("opening.labels.offset"), formatArchitecturalLength(displayOffsetFromStart ?? opening.offsetFromStart, units.length)]
  ] as const;
  return (
    <Stack component="section" spacing={1.5}>
      <Typography variant="subtitle2">
        {t(opening.type === "DOOR" ? "opening.door" : "opening.window")}
      </Typography>
      <Stack component="dl" spacing={0} sx={{ m: 0 }}>
        {rows.map(([label, value]) => (
          <Stack key={label} spacing={0.75}>
            <Divider />
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
              <Typography component="dd" variant="caption" sx={{ fontWeight: 700, m: 0 }}>{value}</Typography>
            </Stack>
          </Stack>
        ))}
      </Stack>
      {editable && opening.type === "DOOR" ? (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" startIcon={<SwapHorizRoundedIcon />} onClick={() => onUpdate({ hingeSide: getDoorHingeSide(opening) === "START" ? "END" : "START" })}>
            {t("opening.flipHinge")}
          </Button>
          <Button size="small" variant="outlined" startIcon={<FlipRoundedIcon />} onClick={() => onUpdate({ swingSide: getDoorSwingSide(opening) === "LEFT" ? "RIGHT" : "LEFT" })}>
            {t("opening.flipSwing")}
          </Button>
        </Stack>
      ) : null}
      {editable ? <Button color="error" variant="outlined" size="small" startIcon={<DeleteOutlineRoundedIcon />} onClick={onDelete}>
        {t("opening.delete")}
      </Button> : null}
    </Stack>
  );
}

/** Renders editable values supported for the selected Wall-owned Opening. */
export function ProjectOpeningPropertiesDetails({ wall, opening, displayOffsetFromStart, units, onUpdate }: {
  readonly wall: Wall;
  readonly opening: Opening;
  /** Transient Wall-local offset shown while the Opening is dragged. */
  readonly displayOffsetFromStart?: number;
  readonly units: Project["units"];
  readonly onUpdate: (properties: UpdateOpeningProperties) => boolean;
}) {
  const { t } = useCasaTranslation("project-viewer");
  return (
    <Stack component="section" spacing={1.5}>
      <Typography variant="subtitle2">
        {t(opening.type === "DOOR" ? "opening.doorProperties" : "opening.windowProperties")}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t("opening.ownedBy", { wall: wall.name ?? wall.id })}
      </Typography>
      <OpeningMeasurementField label={t("opening.labels.width")} unit={units.length} value={opening.width} onCommit={(width) => onUpdate({ width })} />
      <OpeningMeasurementField label={t("opening.labels.height")} unit={units.length} value={opening.height} onCommit={(height) => onUpdate({ height })} />
      <OpeningMeasurementField label={t("opening.labels.offset")} unit={units.length} value={displayOffsetFromStart ?? opening.offsetFromStart} onCommit={(offsetFromStart) => onUpdate({ offsetFromStart })} />
      {opening.type === "WINDOW" ? (
        <OpeningMeasurementField label={t("opening.labels.sillHeight")} unit={units.length} value={opening.elevation} onCommit={(elevation) => onUpdate({ elevation })} />
      ) : null}
    </Stack>
  );
}

/** Commits one normalized Opening measurement on blur or Enter. */
function OpeningMeasurementField({ label, unit, value, onCommit }: {
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly onCommit: (value: number) => boolean;
}) {
  const [draft, setDraft] = useState(formatEditorMeasurement(value));
  useEffect(() => setDraft(formatEditorMeasurement(value)), [value]);
  const commit = () => {
    const normalized = normalizeEditorMeasurement(Number(draft));
    if (normalized === normalizeEditorMeasurement(value)) {
      setDraft(formatEditorMeasurement(value));
      return;
    }
    if (!onCommit(normalized)) setDraft(formatEditorMeasurement(value));
    else setDraft(formatEditorMeasurement(normalized));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") { commit(); event.currentTarget.blur(); }
    if (event.key === "Escape") { setDraft(formatEditorMeasurement(value)); event.currentTarget.blur(); }
  };
  return <TextField size="small" type="number" label={label} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={onKeyDown} slotProps={{ htmlInput: { step: "any", "aria-label": `${label} (${unit})` }, input: { endAdornment: <Typography variant="caption">{unit}</Typography> } }} />;
}
