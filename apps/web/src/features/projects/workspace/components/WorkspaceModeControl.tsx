import EditRoundedIcon from "@mui/icons-material/EditRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";

import { useCasaTranslation } from "../../../../core/i18n";
import type { ProjectWorkspaceMode } from "../../../editor-2d/state/project-editor-slice";

type WorkspaceModeControlProps = {
  readonly mode: ProjectWorkspaceMode;
  readonly disabled: boolean;
  readonly editDisabled: boolean;
  readonly onChange: (mode: ProjectWorkspaceMode | null) => void;
};

/** Renders the View/Edit control independently from representation choices. */
export function WorkspaceModeControl({
  mode,
  disabled,
  editDisabled,
  onChange
}: WorkspaceModeControlProps) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={mode}
      disabled={disabled}
      onChange={(_event, value: ProjectWorkspaceMode | null) => onChange(value)}
      aria-label={t("workspace.modeLabel")}
      className="project-workspace__mode-control"
    >
      <ToggleButton value="view" aria-label={t("workspace.view")}>
        <VisibilityOutlinedIcon fontSize="small" />
        {t("workspace.view")}
      </ToggleButton>
      <ToggleButton
        value="edit"
        disabled={editDisabled}
        aria-label={t("workspace.edit")}
      >
        <EditRoundedIcon fontSize="small" />
        {t("workspace.edit")}
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
