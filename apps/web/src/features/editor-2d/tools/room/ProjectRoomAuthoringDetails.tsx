import {
  Alert,
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import type { KeyboardEvent } from "react";

import { useCasaTranslation } from "../../../../core/i18n";
import type { RoomShapeDimensionDraft } from "./room-shape-authoring";

/** Detailed transient Room controls rendered by the contextual Properties surface. */
export function ProjectRoomAuthoringDetails({
  activeShape,
  boundaryKind,
  detectionActive,
  elevation,
  levelElevation,
  dimensions,
  unit,
  valid,
  onDimensionChange,
  onElevationChange,
  onSpacePanChange,
  onCancel
}: {
  readonly activeShape?: "RECTANGLE" | "L_SHAPE";
  readonly boundaryKind?: "WALLS" | "FREE";
  readonly detectionActive: boolean;
  readonly elevation: string;
  readonly levelElevation: number;
  readonly dimensions: RoomShapeDimensionDraft;
  readonly unit: string;
  readonly valid: boolean;
  readonly onDimensionChange: (field: keyof RoomShapeDimensionDraft, value: string) => void;
  readonly onElevationChange: (value: string) => void;
  readonly onSpacePanChange: (active: boolean) => void;
  readonly onCancel: () => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const subtype = detectionActive
    ? t("roomAuthoring.detectRoom")
    : activeShape
      ? t(
          boundaryKind === "FREE"
            ? activeShape === "RECTANGLE"
              ? "roomAuthoring.elevatedRectangle"
              : "roomAuthoring.elevatedLShape"
            : activeShape === "RECTANGLE"
              ? "roomAuthoring.rectangle"
              : "roomAuthoring.lShape"
        )
      : undefined;

  return (
    <Stack
      component="section"
      spacing={1.5}
      data-testid="room-authoring-inspector"
      data-room-authoring-parameters="true"
    >
      <Typography variant="subtitle2">{t("roomAuthoring.propertiesTitle")}</Typography>
      <Typography variant="caption" color="text.secondary">
        {subtype ?? t("roomAuthoring.chooseMode")}
      </Typography>
      {activeShape ? (
        <>
          <RoomDimensionField
            label={t("roomAuthoring.width")}
            value={dimensions.width}
            unit={unit}
            onChange={(value) => onDimensionChange("width", value)}
            onSpacePanChange={onSpacePanChange}
          />
          <RoomDimensionField
            label={t("roomAuthoring.depth")}
            value={dimensions.depth}
            unit={unit}
            onChange={(value) => onDimensionChange("depth", value)}
            onSpacePanChange={onSpacePanChange}
          />
          {activeShape === "L_SHAPE" ? (
            <>
              <RoomDimensionField
                label={t("roomAuthoring.notchWidth")}
                value={dimensions.notchWidth}
                unit={unit}
                onChange={(value) => onDimensionChange("notchWidth", value)}
                onSpacePanChange={onSpacePanChange}
              />
              <RoomDimensionField
                label={t("roomAuthoring.notchDepth")}
                value={dimensions.notchDepth}
                unit={unit}
                onChange={(value) => onDimensionChange("notchDepth", value)}
                onSpacePanChange={onSpacePanChange}
              />
            </>
          ) : null}
          <FormControl size="small" fullWidth>
            <InputLabel id="room-shape-rotation-label">{t("roomAuthoring.rotation")}</InputLabel>
            <Select
              labelId="room-shape-rotation-label"
              label={t("roomAuthoring.rotation")}
              value={dimensions.rotation}
              inputProps={{ "aria-label": t("roomAuthoring.rotation") }}
              onChange={(event) => onDimensionChange("rotation", String(event.target.value))}
            >
              {[0, 90, 180, 270].map((value) => (
                <MenuItem key={value} value={String(value)}>{value}°</MenuItem>
              ))}
            </Select>
          </FormControl>
          {boundaryKind === "FREE" ? (
            <>
              <RoomDimensionField
                label={t("roomAuthoring.elevation")}
                value={elevation}
                unit={unit}
                onChange={onElevationChange}
                onSpacePanChange={onSpacePanChange}
              />
              <TextField
                size="small"
                label={t("room.labels.globalFloorElevation")}
                value={Number.isFinite(Number(elevation)) ? levelElevation + Number(elevation) : ""}
                slotProps={{
                  htmlInput: { readOnly: true },
                  input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }
                }}
              />
            </>
          ) : null}
          <Alert severity={valid ? "info" : "warning"}>
            {t(valid ? "roomAuthoring.placeHint" : "roomAuthoring.invalidParameters")}
          </Alert>
        </>
      ) : detectionActive ? (
        <Alert severity="info">{t("roomAuthoring.detectHint")}</Alert>
      ) : (
        <Alert severity="info">{t("roomAuthoring.chooseModeHint")}</Alert>
      )}
      <Button size="small" onClick={onCancel}>{t("roomAuthoring.cancel")}</Button>
    </Stack>
  );
}

function RoomDimensionField({
  label,
  value,
  unit,
  onChange,
  onSpacePanChange
}: {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly onChange: (value: string) => void;
  readonly onSpacePanChange: (active: boolean) => void;
}) {
  const handleSpace = (event: KeyboardEvent<HTMLElement>, active: boolean) => {
    if (event.key !== " " && event.code !== "Space") return;
    event.preventDefault();
    event.stopPropagation();
    if (active) event.currentTarget.blur();
    onSpacePanChange(active);
  };
  return (
    <TextField
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => handleSpace(event, true)}
      onKeyUp={(event) => handleSpace(event, false)}
      type="number"
      size="small"
      slotProps={{
        htmlInput: { step: "any", inputMode: "decimal", "aria-label": label },
        input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }
      }}
    />
  );
}
