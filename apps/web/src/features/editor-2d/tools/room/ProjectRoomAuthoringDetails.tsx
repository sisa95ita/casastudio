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
import type { RoomShapeKind, RoomType } from "@casastudio/schema";

import { useCasaTranslation } from "../../../../core/i18n";
import type { RoomAuthoringPreset, RoomShapeDimensionDraft } from "./room-shape-authoring";

/** Detailed transient Room controls rendered by the contextual Properties surface. */
export function ProjectRoomAuthoringDetails({
  activeShape,
  detectionActive,
  preset,
  roomType,
  elevation,
  levelElevation,
  dimensions,
  unit,
  valid,
  validationIssue,
  onDimensionChange,
  onMethodChange,
  onShapeChange,
  onPresetChange,
  onElevationChange,
  onSpacePanChange,
  onCancel
}: {
  readonly activeShape?: RoomShapeKind;
  readonly detectionActive: boolean;
  readonly preset: RoomAuthoringPreset;
  readonly roomType: RoomType;
  readonly elevation: string;
  readonly levelElevation: number;
  readonly dimensions: RoomShapeDimensionDraft;
  readonly unit: string;
  readonly valid: boolean;
  readonly validationIssue?: "PARAMETERS" | "TOPOLOGY";
  readonly onDimensionChange: (field: keyof RoomShapeDimensionDraft, value: string) => void;
  readonly onMethodChange: (method: "DETECT" | "SHAPE") => void;
  readonly onShapeChange: (shape: RoomShapeKind) => void;
  readonly onPresetChange: (preset: RoomAuthoringPreset) => void;
  readonly onElevationChange: (value: string) => void;
  readonly onSpacePanChange: (active: boolean) => void;
  readonly onCancel: () => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  return (
    <Stack
      component="section"
      spacing={1.5}
      data-testid="room-authoring-inspector"
      data-room-authoring-parameters="true"
    >
      <Typography variant="subtitle2">{t("roomAuthoring.propertiesTitle")}</Typography>
      <FormControl size="small" fullWidth>
        <InputLabel id="room-authoring-method-label">{t("roomAuthoring.method")}</InputLabel>
        <Select labelId="room-authoring-method-label" label={t("roomAuthoring.method")} value={detectionActive ? "DETECT" : "SHAPE"} onChange={(event) => onMethodChange(event.target.value as "DETECT" | "SHAPE")}>
          <MenuItem value="DETECT">{t("roomAuthoring.detectRoom")}</MenuItem>
          <MenuItem value="SHAPE">{t("roomAuthoring.shapeMethod")}</MenuItem>
        </Select>
      </FormControl>
      {!detectionActive ? (
        <>
          <FormControl size="small" fullWidth>
            <InputLabel id="room-authoring-shape-label">{t("roomAuthoring.shape")}</InputLabel>
            <Select labelId="room-authoring-shape-label" label={t("roomAuthoring.shape")} value={activeShape ?? "RECTANGLE"} onChange={(event) => onShapeChange(event.target.value as RoomShapeKind)}>
              <MenuItem value="RECTANGLE">{t("roomAuthoring.rectangle")}</MenuItem>
              <MenuItem value="L_SHAPE">{t("roomAuthoring.lShape")}</MenuItem>
              <MenuItem value="U_SHAPE">{t("roomAuthoring.uShape")}</MenuItem>
              <MenuItem value="T_SHAPE">{t("roomAuthoring.tShape")}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel id="room-authoring-preset-label">{t("roomAuthoring.preset")}</InputLabel>
            <Select labelId="room-authoring-preset-label" label={t("roomAuthoring.preset")} value={preset} onChange={(event) => onPresetChange(event.target.value as RoomAuthoringPreset)}>
              {(["CUSTOM", "BEDROOM", "BATHROOM", "KITCHEN", "LIVING_ROOM"] as const).map((value) => <MenuItem key={value} value={value}>{t(`roomAuthoring.presets.${value}`)}</MenuItem>)}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary">{t("roomAuthoring.roomType", { type: t(`room.types.${roomType}`) })}</Typography>
        </>
      ) : null}
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
          {activeShape === "U_SHAPE" ? (
            <>
              <RoomDimensionField label={t("roomAuthoring.leftWingWidth")} value={dimensions.leftWingWidth} unit={unit} onChange={(value) => onDimensionChange("leftWingWidth", value)} onSpacePanChange={onSpacePanChange} />
              <RoomDimensionField label={t("roomAuthoring.rightWingWidth")} value={dimensions.rightWingWidth} unit={unit} onChange={(value) => onDimensionChange("rightWingWidth", value)} onSpacePanChange={onSpacePanChange} />
              <RoomDimensionField label={t("roomAuthoring.notchDepth")} value={dimensions.notchDepth} unit={unit} onChange={(value) => onDimensionChange("notchDepth", value)} onSpacePanChange={onSpacePanChange} />
            </>
          ) : null}
          {activeShape === "T_SHAPE" ? (
            <>
              <RoomDimensionField label={t("roomAuthoring.stemWidth")} value={dimensions.stemWidth} unit={unit} onChange={(value) => onDimensionChange("stemWidth", value)} onSpacePanChange={onSpacePanChange} />
              <RoomDimensionField label={t("roomAuthoring.stemDepth")} value={dimensions.stemDepth} unit={unit} onChange={(value) => onDimensionChange("stemDepth", value)} onSpacePanChange={onSpacePanChange} />
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
          <RoomDimensionField
            label={t("roomAuthoring.elevation")}
            value={elevation}
            unit={unit}
            onChange={onElevationChange}
            onSpacePanChange={onSpacePanChange}
          />
          {Number(elevation) !== 0 ? (
            <>
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
            {t(valid
              ? "roomAuthoring.placeHint"
              : validationIssue === "TOPOLOGY"
                ? "roomAuthoring.topologyConflict"
                : "roomAuthoring.invalidParameters")}
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
