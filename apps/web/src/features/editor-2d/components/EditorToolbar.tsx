import ChairRoundedIcon from "@mui/icons-material/ChairRounded";
import DoorFrontRoundedIcon from "@mui/icons-material/DoorFrontRounded";
import LinearScaleRoundedIcon from "@mui/icons-material/LinearScaleRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";
import StairsRoundedIcon from "@mui/icons-material/StairsRounded";
import { Box, Divider, ToggleButton, Tooltip } from "@mui/material";
import type { ReactNode } from "react";

import { useCasaTranslation } from "../../../core/i18n";
import type { ProjectEditorTool } from "../state/project-editor-tools";
import { EditorShortcutsControl } from "./EditorShortcutsControl";

type EditorToolbarProps = {
  readonly activeTool: ProjectEditorTool | null;
  readonly disabled: boolean;
  readonly onToolToggle: (tool: ProjectEditorTool) => void;
  readonly shortcutsOpen: boolean;
  readonly onOpenShortcuts: () => void;
  readonly onCloseShortcuts: () => void;
};

/** Renders compact interaction, build, and document tool groups. */
export function EditorToolbar({
  activeTool,
  disabled,
  onToolToggle,
  shortcutsOpen,
  onOpenShortcuts,
  onCloseShortcuts
}: EditorToolbarProps) {
  const { t } = useCasaTranslation("project-viewer");
  return (
    <Box
      className="project-editor-toolbar"
      role="toolbar"
      aria-label={t("tools.label")}
    >
      <ToolButton
        tool="select"
        label={t("tools.select")}
        help={t("tools.help.select")}
        icon={<NearMeRoundedIcon fontSize="small" />}
        selected={activeTool === "select"}
        disabled={disabled}
        onClick={() => onToolToggle("select")}
      />
      <Divider orientation="vertical" flexItem />
      <Box className="project-editor-toolbar__group">
        <ToolButton
          tool="draw-wall"
          label={t("tools.draw-wall")}
          help={t("tools.help.draw-wall")}
          icon={<LinearScaleRoundedIcon fontSize="small" />}
          selected={activeTool === "draw-wall"}
          disabled={disabled}
          onClick={() => onToolToggle("draw-wall")}
        />
        <ToolButton
          tool="openings"
          label={t("tools.openings")}
          help={t("tools.help.openings")}
          icon={<DoorFrontRoundedIcon fontSize="small" />}
          selected={activeTool === "openings"}
          disabled={disabled}
          onClick={() => onToolToggle("openings")}
        />
        <ToolButton
          tool="room"
          label={t("tools.room")}
          help={t("tools.help.room")}
          icon={<MeetingRoomRoundedIcon fontSize="small" />}
          selected={activeTool === "room"}
          disabled={disabled}
          onClick={() => onToolToggle("room")}
        />
        <ToolButton
          tool="stair"
          label={t("tools.stair")}
          help={t("tools.help.stair")}
          icon={<StairsRoundedIcon fontSize="small" />}
          selected={activeTool === "stair"}
          disabled={disabled}
          onClick={() => onToolToggle("stair")}
        />
        <ToolButton
          tool="furniture" label={t("tools.furniture")} help={t("tools.help.furniture")}
          icon={<ChairRoundedIcon fontSize="small" />} selected={activeTool === "furniture"}
          disabled={disabled} onClick={() => onToolToggle("furniture")}
        />
      </Box>
      <Divider orientation="vertical" flexItem />
      <ToolButton
        tool="measure"
        label={t("tools.measure")}
        help={t("tools.help.measure")}
        icon={<StraightenRoundedIcon fontSize="small" />}
        selected={activeTool === "measure"}
        disabled={disabled}
        onClick={() => onToolToggle("measure")}
      />
      <Box className="project-editor-toolbar__spacer" />
      <EditorShortcutsControl
        open={shortcutsOpen}
        onOpen={onOpenShortcuts}
        onClose={onCloseShortcuts}
      />
    </Box>
  );
}

function ToolButton({
  tool,
  label,
  help,
  icon,
  selected,
  disabled,
  onClick
}: {
  readonly tool: ProjectEditorTool | "openings";
  readonly label: string;
  readonly help: string;
  readonly icon: ReactNode;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onClick: (button: HTMLElement) => void;
}) {
  return (
    <Tooltip title={help} describeChild>
            <ToggleButton
        value={tool}
        selected={selected}
        disabled={disabled}
        aria-label={label}
        onClick={(event) => onClick(event.currentTarget)}
            >
        {icon}
              <span>{label}</span>
            </ToggleButton>
            </Tooltip>
          );
}
