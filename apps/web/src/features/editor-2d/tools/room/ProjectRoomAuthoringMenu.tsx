import {
  Box,
  ListSubheader,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Stack,
  Typography
} from "@mui/material";
import type { KeyboardEvent } from "react";

import { useCasaTranslation } from "../../../../core/i18n";

/** Compact contextual menu for selecting a Room authoring intent. */
export function ProjectRoomAuthoringMenu({
  anchorEl,
  templateAvailable,
  onDetectRoom,
  onSelectShape,
  onCancel
}: {
  readonly anchorEl: HTMLElement | null;
  readonly templateAvailable: boolean;
  readonly onDetectRoom: () => void;
  readonly onSelectShape: (kind: "RECTANGLE" | "L_SHAPE", boundaryKind: "WALLS" | "FREE") => void;
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
              <RoomShapeMenuItem kind="RECTANGLE" label={t("roomAuthoring.rectangle")} disabled={!templateAvailable} describedBy={!templateAvailable ? helpId : undefined} onClick={() => onSelectShape("RECTANGLE", "WALLS")} />
              <RoomShapeMenuItem kind="L_SHAPE" label={t("roomAuthoring.lShape")} disabled={!templateAvailable} describedBy={!templateAvailable ? helpId : undefined} onClick={() => onSelectShape("L_SHAPE", "WALLS")} />
            </Stack>
            {!templateAvailable ? (
              <Typography id={helpId} className="project-room-authoring-menu__help" component="p" variant="caption" color="text.secondary">
                {t("roomAuthoring.emptyLevelOnly")}
              </Typography>
            ) : null}
          </Box>
          <Box component="li" role="none" className="project-room-authoring-menu__shapes">
            <ListSubheader component="div" disableSticky>{t("roomAuthoring.elevatedSection")}</ListSubheader>
            <Stack direction="row">
              <RoomShapeMenuItem kind="RECTANGLE" label={t("roomAuthoring.elevatedRectangle")} disabled={false} onClick={() => onSelectShape("RECTANGLE", "FREE")} />
              <RoomShapeMenuItem kind="L_SHAPE" label={t("roomAuthoring.elevatedLShape")} disabled={false} onClick={() => onSelectShape("L_SHAPE", "FREE")} />
            </Stack>
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
  onClick
}: {
  readonly kind: "RECTANGLE" | "L_SHAPE";
  readonly label: string;
  readonly disabled: boolean;
  readonly describedBy?: string;
  readonly onClick: () => void;
}) {
  return (
    <MenuItem
      component="div"
      disabled={disabled}
      aria-describedby={describedBy}
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
