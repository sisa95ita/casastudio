import DoorFrontRoundedIcon from "@mui/icons-material/DoorFrontRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import { ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import type { ReactNode } from "react";

import { useCasaTranslation } from "../../../../core/i18n";
import type { ProjectEditorTool } from "../../state/project-editor-tools";

const openingTools = [
  { id: "door", icon: <DoorFrontRoundedIcon fontSize="small" /> },
  { id: "window", icon: <WindowRoundedIcon fontSize="small" /> },
  { id: "opening", icon: <MeetingRoomRoundedIcon fontSize="small" /> }
] as const satisfies readonly {
  readonly id: ProjectEditorTool;
  readonly icon: ReactNode;
}[];

/** Presents the existing opening authoring tools as one compact group. */
export function ProjectOpeningAuthoringMenu({
  anchorEl,
  activeTool,
  onSelect,
  onClose
}: {
  readonly anchorEl: HTMLElement | null;
  readonly activeTool: ProjectEditorTool | null;
  readonly onSelect: (tool: "door" | "window" | "opening") => void;
  readonly onClose: () => void;
}) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <Menu
      id="opening-authoring-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      slotProps={{
        list: { "aria-label": t("openingAuthoring.menuLabel"), dense: true }
      }}
    >
      {openingTools.map((tool) => (
        <MenuItem
          key={tool.id}
          selected={activeTool === tool.id}
          onClick={() => onSelect(tool.id)}
        >
          <ListItemIcon>{tool.icon}</ListItemIcon>
          <ListItemText>{t(`tools.${tool.id}`)}</ListItemText>
        </MenuItem>
      ))}
    </Menu>
  );
}
