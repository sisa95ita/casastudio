import {
  Box,
  Divider,
  InputAdornment,
  ListSubheader,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  FormControl,
  InputLabel,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import type { ChangeEvent, KeyboardEvent } from "react";

import { useCasaTranslation } from "../../../../core/i18n";

/** Editable physical parameters displayed by Room shape placement. */
export type RoomShapeDimensionDraft = {
  readonly width: string;
  readonly depth: string;
  readonly notchWidth: string;
  readonly notchDepth: string;
  readonly rotation: string;
};

/** Compact contextual menu for selecting and parameterizing Room authoring. */
export function ProjectRoomAuthoringMenu({
  anchorEl,
  templateAvailable,
  activeShape,
  dimensions,
  unit,
  onDetectRoom,
  onSelectShape,
  onDimensionChange,
  onSpacePanChange,
  onCancel
}: {
  readonly anchorEl: HTMLElement | null;
  readonly templateAvailable: boolean;
  readonly activeShape?: "RECTANGLE" | "L_SHAPE";
  readonly dimensions: RoomShapeDimensionDraft;
  readonly unit: string;
  readonly onDetectRoom: () => void;
  readonly onSelectShape: (kind: "RECTANGLE" | "L_SHAPE") => void;
  readonly onDimensionChange: (
    field: keyof RoomShapeDimensionDraft,
    value: string
  ) => void;
  readonly onSpacePanChange: (active: boolean) => void;
  readonly onCancel: () => void;
}) {
  const { t } = useCasaTranslation("project-viewer");
  const helpId = "room-shape-availability-help";
  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  };

  return (
    <Popper
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      placement="bottom-start"
      sx={{ zIndex: (theme) => theme.zIndex.modal }}
    >
      <Paper
        className="project-room-authoring-menu"
        elevation={5}
        role="presentation"
      >
        <MenuList
          id="room-authoring-menu"
          className="project-room-authoring-menu__layout"
          aria-label={t("roomAuthoring.menuLabel")}
          autoFocusItem
          dense
          onKeyDown={handleKeyDown}
        >
          <Box component="li" role="none" className="project-room-authoring-menu__existing">
            <ListSubheader component="div" disableSticky>{t("roomAuthoring.existingSection")}</ListSubheader>
            <MenuItem component="div" onClick={onDetectRoom}>{t("roomAuthoring.detectRoom")}</MenuItem>
          </Box>
          <Box component="li" role="none" className="project-room-authoring-menu__shapes">
            <ListSubheader component="div" disableSticky>{t("roomAuthoring.shapeSection")}</ListSubheader>
            <Stack direction="row">
              <RoomShapeMenuItem kind="RECTANGLE" label={t("roomAuthoring.rectangle")} disabled={!templateAvailable} describedBy={!templateAvailable ? helpId : undefined} selected={activeShape === "RECTANGLE"} onClick={() => onSelectShape("RECTANGLE")} />
              <RoomShapeMenuItem kind="L_SHAPE" label={t("roomAuthoring.lShape")} disabled={!templateAvailable} describedBy={!templateAvailable ? helpId : undefined} selected={activeShape === "L_SHAPE"} onClick={() => onSelectShape("L_SHAPE")} />
            </Stack>
            {!templateAvailable ? (
              <Typography id={helpId} className="project-room-authoring-menu__help" component="p" variant="caption" color="text.secondary">
                {t("roomAuthoring.emptyLevelOnly")}
              </Typography>
            ) : null}
            {activeShape ? (
              <Box className="project-room-authoring-menu__dimensions" component="div" role="none">
              <Divider sx={{ mb: 1 }} />
              <Typography variant="caption" color="text.secondary">
                {t("roomAuthoring.dimensions")}
              </Typography>
              <Box className="project-room-authoring-menu__dimension-grid" sx={{ mt: 1 }}>
                <DimensionField
                  label={t("roomAuthoring.width")}
                  value={dimensions.width}
                  unit={unit}
                  onChange={(value) => onDimensionChange("width", value)}
                  onSpacePanChange={onSpacePanChange}
                />
                <DimensionField
                  label={t("roomAuthoring.depth")}
                  value={dimensions.depth}
                  unit={unit}
                  onChange={(value) => onDimensionChange("depth", value)}
                  onSpacePanChange={onSpacePanChange}
                />
                {activeShape === "L_SHAPE" ? (
                  <>
                    <DimensionField
                      label={t("roomAuthoring.notchWidth")}
                      value={dimensions.notchWidth}
                      unit={unit}
                      onChange={(value) => onDimensionChange("notchWidth", value)}
                      onSpacePanChange={onSpacePanChange}
                    />
                    <DimensionField
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
                    onChange={(event) => onDimensionChange("rotation", String(event.target.value))}
                  >
                    {[0, 90, 180, 270].map((value) => (
                      <MenuItem key={value} value={String(value)}>{value}°</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              </Box>
            ) : null}
          </Box>
        </MenuList>
      </Paper>
    </Popper>
  );
}

/** Renders one keyboard-accessible shape choice with an inline plan thumbnail. */
function RoomShapeMenuItem({
  kind,
  label,
  disabled,
  describedBy,
  selected,
  onClick
}: {
  readonly kind: "RECTANGLE" | "L_SHAPE";
  readonly label: string;
  readonly disabled: boolean;
  readonly describedBy?: string;
  readonly selected: boolean;
  readonly onClick: () => void;
}) {
  return (
    <MenuItem
      component="div"
      disabled={disabled}
      aria-describedby={describedBy}
      selected={selected}
      onClick={onClick}
    >
      <RoomShapeThumbnail kind={kind} />
      {label}
    </MenuItem>
  );
}

/** Draws a compact vector footprint without introducing image assets. */
function RoomShapeThumbnail({ kind }: { readonly kind: "RECTANGLE" | "L_SHAPE" }) {
  return (
    <svg
      className="project-room-authoring-menu__thumbnail"
      width="30"
      height="22"
      viewBox="0 0 30 22"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={kind === "RECTANGLE" ? "M3 3H27V19H3Z" : "M3 3H18V10H27V19H3Z"}
      />
    </svg>
  );
}

/** Edits one physical Room shape parameter without committing Project state. */
function DimensionField({
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
  const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
    onChange(event.target.value);
  return (
    <TextField
      label={label}
      value={value}
      onChange={handleChange}
      onKeyDown={(event) => {
        if (event.key !== " " && event.code !== "Space") return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.blur();
        onSpacePanChange(true);
      }}
      onKeyUp={(event) => {
        if (event.key !== " " && event.code !== "Space") return;
        event.preventDefault();
        event.stopPropagation();
        onSpacePanChange(false);
      }}
      type="number"
      size="small"
      slotProps={{
        htmlInput: { step: "any", inputMode: "decimal" },
        input: {
          endAdornment: <InputAdornment position="end">{unit}</InputAdornment>
        }
      }}
    />
  );
}
