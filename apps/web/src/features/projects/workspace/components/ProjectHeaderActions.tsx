import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import { Box, Button, Chip, IconButton, Stack, Tooltip } from "@mui/material";

import { useCasaTranslation } from "../../../../core/i18n";

/** Renders the contextual action that enters the 2D editing workspace. */
export function ProjectViewEditAction({
  fromThreeD,
  disabled,
  onEdit
}: {
  readonly fromThreeD: boolean;
  readonly disabled: boolean;
  readonly onEdit: () => void;
}) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <Button
      variant="contained"
      size="small"
      startIcon={<EditRoundedIcon />}
      disabled={disabled}
      onClick={onEdit}
    >
      {t(fromThreeD ? "workspace.editIn2D" : "workspace.editPlan")}
    </Button>
  );
}

/** Renders history, persistence, and guarded exit actions for a 2D edit session. */
export function ProjectEditHeaderActions({
  dirty,
  disabled,
  canUndo,
  canRedo,
  onBack,
  onUndo,
  onRedo,
  onDiscard,
  onSave
}: {
  readonly dirty: boolean;
  readonly disabled: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onBack: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onDiscard: () => void;
  readonly onSave: () => void;
}) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <Stack direction="row" className="project-header-actions">
      <Button
        color="inherit"
        size="small"
        startIcon={<ArrowBackRoundedIcon />}
        disabled={disabled}
        onClick={onBack}
      >
        {t("workspace.backToProject")}
      </Button>
      <Box
        className="project-header-actions__history"
        role="group"
        aria-label={t("header.history")}
      >
        <Tooltip title={t("tools.undo")}>
          <span>
            <IconButton
              size="small"
              aria-label={t("tools.undo")}
              disabled={disabled || !canUndo}
              onClick={onUndo}
            >
              <UndoRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("tools.redo")}>
          <span>
            <IconButton
              size="small"
              aria-label={t("tools.redo")}
              disabled={disabled || !canRedo}
              onClick={onRedo}
            >
              <RedoRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Chip
        className="project-header-status"
        icon={<EditRoundedIcon />}
        color={dirty ? "warning" : "default"}
        variant="outlined"
        label={t(
          disabled
            ? "workspace.saving"
            : dirty
              ? "workspace.unsaved"
              : "workspace.clean"
        )}
      />
      {dirty ? (
        <Button color="inherit" disabled={disabled} onClick={onDiscard}>
          {t("persistence.discardAction")}
        </Button>
      ) : null}
      <Button
        variant="contained"
        disabled={!dirty || disabled}
        onClick={onSave}
      >
        {t("persistence.save")}
      </Button>
    </Stack>
  );
}
