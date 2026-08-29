import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import FlipRoundedIcon from "@mui/icons-material/FlipRounded";
import { Button, Divider, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
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
import type { OpeningAuthoringProperties, OpeningAuthoringType } from "../state/project-editor-slice";

/** Renders editable defaults for an Opening before it is placed. */
export function ProjectNewOpeningPropertiesDetails({
  openingType,
  properties,
  units,
  onChange
}: {
  readonly openingType: OpeningAuthoringType;
  readonly properties: OpeningAuthoringProperties;
  readonly units: Project["units"];
  readonly onChange: (properties: Partial<OpeningAuthoringProperties>) => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const title = openingType === "DOOR"
    ? "opening.newDoor"
    : openingType === "WINDOW" ? "opening.newWindow" : "opening.newWallOpening";
  return (
    <Stack component="section" spacing={1.5}>
      <Typography variant="subtitle2">{t(title)}</Typography>
      <OpeningMeasurementField label={t("opening.labels.width")} unit={units.length} value={properties.width} onCommit={(width) => { onChange({ width }); return true; }} />
      <OpeningMeasurementField label={t("opening.labels.height")} unit={units.length} value={properties.height} onCommit={(height) => { onChange({ height }); return true; }} />
      <OpeningMeasurementField label={t(openingType === "WINDOW" ? "opening.labels.sillHeight" : "opening.labels.elevation")} unit={units.length} value={properties.elevation} onCommit={(elevation) => { onChange({ elevation }); return true; }} />
      {openingType === "DOOR" ? (
        <>
          <FormControl size="small">
            <InputLabel id="new-door-hinge-label">{t("opening.labels.hingeSide")}</InputLabel>
            <Select labelId="new-door-hinge-label" label={t("opening.labels.hingeSide")} value={properties.hingeSide ?? "START"} onChange={(event) => onChange({ hingeSide: event.target.value as "START" | "END" })}>
              <MenuItem value="START">{t("wall.resizeFromStart")}</MenuItem>
              <MenuItem value="END">{t("wall.resizeFromEnd")}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel id="new-door-swing-label">{t("opening.labels.swingSide")}</InputLabel>
            <Select labelId="new-door-swing-label" label={t("opening.labels.swingSide")} value={properties.swingSide ?? "LEFT"} onChange={(event) => onChange({ swingSide: event.target.value as "LEFT" | "RIGHT" })}>
              <MenuItem value="LEFT">{t("opening.left")}</MenuItem>
              <MenuItem value="RIGHT">{t("opening.right")}</MenuItem>
            </Select>
          </FormControl>
        </>
      ) : null}
    </Stack>
  );
}

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
    [t("opening.labels.type"), t(opening.type === "DOOR" ? "opening.door" : opening.type === "WINDOW" ? "opening.window" : "opening.wallOpening")],
    [t("opening.labels.wall"), wall.name ?? wall.id],
    [t("opening.labels.width"), formatArchitecturalLength(opening.width, units.length)],
    [t("opening.labels.height"), formatArchitecturalLength(opening.height, units.length)],
    [t("opening.labels.offset"), formatArchitecturalLength(displayOffsetFromStart ?? opening.offsetFromStart, units.length)]
  ] as const;
  return (
    <Stack component="section" spacing={1.5}>
      <Typography variant="subtitle2">
        {t(opening.type === "DOOR" ? "opening.door" : opening.type === "WINDOW" ? "opening.window" : "opening.wallOpening")}
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
        {t(opening.type === "DOOR" ? "opening.doorProperties" : opening.type === "WINDOW" ? "opening.windowProperties" : "opening.wallOpeningProperties")}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t("opening.ownedBy", { wall: wall.name ?? wall.id })}
      </Typography>
      <OpeningMeasurementField label={t("opening.labels.width")} unit={units.length} value={opening.width} onCommit={(width) => onUpdate({ width })} />
      <OpeningMeasurementField label={t("opening.labels.height")} unit={units.length} value={opening.height} onCommit={(height) => onUpdate({ height })} />
      <OpeningMeasurementField label={t("opening.labels.offset")} unit={units.length} value={displayOffsetFromStart ?? opening.offsetFromStart} onCommit={(offsetFromStart) => onUpdate({ offsetFromStart })} />
      {opening.type !== "DOOR" ? (
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
