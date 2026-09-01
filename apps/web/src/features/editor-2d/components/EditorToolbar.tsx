import DoorFrontRoundedIcon from "@mui/icons-material/DoorFrontRounded";
import LinearScaleRoundedIcon from "@mui/icons-material/LinearScaleRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import type { ReactNode } from "react";

import { useCasaTranslation } from "../../../core/i18n";
import {
  projectEditorTools,
  type ProjectEditorTool
} from "../state/project-editor-tools";

type EditorToolbarProps = {
  readonly activeTool: ProjectEditorTool | null;
  readonly disabled: boolean;
  readonly onToolChange: (tool: ProjectEditorTool | null) => void;
  readonly roomMenuOpen: boolean;
  readonly onRoomToggle: (anchor: HTMLElement) => void;
};

/** Renders the mutually exclusive architectural authoring tools. */
export function EditorToolbar({
  activeTool,
  disabled,
  onToolChange,
  roomMenuOpen,
  onRoomToggle
}: EditorToolbarProps) {
  const { t } = useCasaTranslation("project-viewer");
  const icons = {
    select: <NearMeRoundedIcon fontSize="small" />,
    "draw-wall": <LinearScaleRoundedIcon fontSize="small" />,
    door: <DoorFrontRoundedIcon fontSize="small" />,
    window: <WindowRoundedIcon fontSize="small" />,
    opening: <DoorFrontRoundedIcon fontSize="small" />,
    room: <MeetingRoomRoundedIcon fontSize="small" />,
    measure: <StraightenRoundedIcon fontSize="small" />
  } satisfies Record<ProjectEditorTool, ReactNode>;

  return (
    <Box
      className="project-editor-toolbar"
      role="toolbar"
      aria-label={t("tools.label")}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={activeTool}
        onChange={(event, value: ProjectEditorTool | null) => {
          const button = (event.target as HTMLElement).closest("button");
          if (button?.getAttribute("value") === "room") {
            onRoomToggle(button);
            return;
          }
          onToolChange(value);
        }}
      >
        {projectEditorTools.map((tool) => {
          const label = t(`tools.${tool.id}`);
          const tooltip = t(`tools.help.${tool.id}`);
          const button = (
            <ToggleButton
              value={tool.id}
              disabled={disabled || !tool.enabled}
              selected={activeTool === tool.id}
              aria-label={
                tool.enabled ? label : t("tools.comingSoon", { tool: label })
              }
              aria-haspopup={tool.id === "room" ? "menu" : undefined}
              aria-expanded={tool.id === "room" ? roomMenuOpen : undefined}
              aria-controls={tool.id === "room" && roomMenuOpen
                ? "room-authoring-menu"
                : undefined}
            >
              {icons[tool.id]}
              <span>{label}</span>
            </ToggleButton>
          );

          return tool.enabled ? (
            <Tooltip key={tool.id} title={tooltip} describeChild>
              {button}
            </Tooltip>
          ) : (
            <Tooltip key={tool.id} title={tooltip}>
              <span>{button}</span>
            </Tooltip>
          );
        })}
      </ToggleButtonGroup>
    </Box>
  );
}
