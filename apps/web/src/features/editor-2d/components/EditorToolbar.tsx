import DoorFrontRoundedIcon from "@mui/icons-material/DoorFrontRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import LinearScaleRoundedIcon from "@mui/icons-material/LinearScaleRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";
import StairsRoundedIcon from "@mui/icons-material/StairsRounded";
import { Box, Divider, ToggleButton, Tooltip } from "@mui/material";
import { useState, type ReactNode } from "react";

import { useCasaTranslation } from "../../../core/i18n";
import type { ProjectEditorTool } from "../state/project-editor-tools";
import { ProjectOpeningAuthoringMenu } from "../tools/opening/ProjectOpeningAuthoringMenu";
import { EditorShortcutsControl } from "./EditorShortcutsControl";

type EditorToolbarProps = {
  readonly activeTool: ProjectEditorTool | null;
  readonly disabled: boolean;
  readonly onToolChange: (tool: ProjectEditorTool | null) => void;
  readonly roomMenuOpen: boolean;
  readonly onRoomToggle: (anchor: HTMLElement) => void;
  readonly stairMenuOpen: boolean;
  readonly onStairToggle: (anchor: HTMLElement) => void;
  readonly shortcutsOpen: boolean;
  readonly onOpenShortcuts: () => void;
  readonly onCloseShortcuts: () => void;
};

const openingToolIds: readonly ProjectEditorTool[] = [
  "door",
  "window",
  "opening"
];

/** Renders compact interaction, build, and document tool groups. */
export function EditorToolbar({
  activeTool,
  disabled,
  onToolChange,
  roomMenuOpen,
  onRoomToggle,
  stairMenuOpen,
  onStairToggle,
  shortcutsOpen,
  onOpenShortcuts,
  onCloseShortcuts
}: EditorToolbarProps) {
  const { t } = useCasaTranslation("project-viewer");
  const [openingAnchor, setOpeningAnchor] = useState<HTMLElement | null>(null);
  const toggleTool = (tool: ProjectEditorTool) =>
    onToolChange(activeTool === tool ? null : tool);
  const openingActive = openingToolIds.includes(activeTool ?? "select");

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
        onClick={() => toggleTool("select")}
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
          onClick={() => toggleTool("draw-wall")}
        />
        <ToolButton
          tool="openings"
          label={t("tools.openings")}
          help={t("tools.help.openings")}
          icon={<DoorFrontRoundedIcon fontSize="small" />}
          endIcon={<ExpandMoreRoundedIcon fontSize="small" />}
          selected={openingActive}
          disabled={disabled}
          expanded={Boolean(openingAnchor)}
          controls={openingAnchor ? "opening-authoring-menu" : undefined}
          onClick={(button) => setOpeningAnchor(button)}
        />
        <ToolButton
          tool="room"
          label={t("tools.room")}
          help={t("tools.help.room")}
          icon={<MeetingRoomRoundedIcon fontSize="small" />}
          endIcon={<ExpandMoreRoundedIcon fontSize="small" />}
          selected={activeTool === "room"}
          disabled={disabled}
          expanded={roomMenuOpen}
          controls={roomMenuOpen ? "room-authoring-menu" : undefined}
          onClick={onRoomToggle}
        />
        <ToolButton
          tool="stair"
          label={t("tools.stair")}
          help={t("tools.help.stair")}
          icon={<StairsRoundedIcon fontSize="small" />}
          endIcon={<ExpandMoreRoundedIcon fontSize="small" />}
          selected={activeTool === "stair"}
          disabled={disabled}
          expanded={stairMenuOpen}
          controls={stairMenuOpen ? "stair-authoring-menu" : undefined}
          onClick={onStairToggle}
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
        onClick={() => toggleTool("measure")}
      />
      <Box className="project-editor-toolbar__spacer" />
      <EditorShortcutsControl
        open={shortcutsOpen}
        onOpen={onOpenShortcuts}
        onClose={onCloseShortcuts}
      />
      <ProjectOpeningAuthoringMenu
        anchorEl={openingAnchor}
        activeTool={activeTool}
        onSelect={(tool) => {
          setOpeningAnchor(null);
          onToolChange(tool);
        }}
        onClose={() => setOpeningAnchor(null)}
      />
    </Box>
  );
}

function ToolButton({
  tool,
  label,
  help,
  icon,
  endIcon,
  selected,
  disabled,
  expanded,
  controls,
  onClick
}: {
  readonly tool: ProjectEditorTool | "openings";
  readonly label: string;
  readonly help: string;
  readonly icon: ReactNode;
  readonly endIcon?: ReactNode;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly expanded?: boolean;
  readonly controls?: string;
  readonly onClick: (button: HTMLElement) => void;
}) {
  return (
    <Tooltip title={help} describeChild>
            <ToggleButton
        value={tool}
        selected={selected}
        disabled={disabled}
        aria-label={label}
        aria-haspopup={
          tool === "openings" || tool === "room" || tool === "stair" ? "menu" : undefined
              }
        aria-expanded={expanded}
        aria-controls={controls}
        onClick={(event) => onClick(event.currentTarget)}
            >
        {icon}
              <span>{label}</span>
        {endIcon}
            </ToggleButton>
            </Tooltip>
          );
}
