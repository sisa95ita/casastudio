import { ToggleButton, ToggleButtonGroup } from "@mui/material";

import { useCasaTranslation } from "../../../../core/i18n";

/** Independent visual representations available for a Project workspace. */
export type ProjectWorkspaceRepresentation = "2d" | "3d";

type WorkspaceRepresentationControlProps = {
  readonly representation: ProjectWorkspaceRepresentation;
  readonly disabled: boolean;
  readonly threeDDisabled: boolean;
  readonly onChange: (
    representation: ProjectWorkspaceRepresentation | null
  ) => void;
};

/** Renders the Project representation choice independently from View/Edit state. */
export function WorkspaceRepresentationControl({
  representation,
  disabled,
  threeDDisabled,
  onChange
}: WorkspaceRepresentationControlProps) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={representation}
      disabled={disabled}
      onChange={(_event, value: ProjectWorkspaceRepresentation | null) =>
        onChange(value)
      }
      aria-label={t("representation.label")}
      className="project-workspace__representation-control"
    >
      <ToggleButton value="2d" aria-label={t("representation.twoD")}>
        2D
      </ToggleButton>
      <ToggleButton
        value="3d"
        disabled={threeDDisabled}
        aria-label={t("representation.threeD")}
      >
        3D
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
