import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";

import { useCasaTranslation } from "../../../../core/i18n";
import type { ProjectWorkspaceMode } from "../../../editor-2d/state/project-editor-slice";
import { GeometryShortcutGuide } from "../../../geometry-2d/viewer/GeometryShortcutGuide";

type ProjectHeaderActionsProps = {
  readonly mode: ProjectWorkspaceMode;
  readonly dirty: boolean;
  readonly disabled: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly shortcutsOpen: boolean;
  readonly onOpenShortcuts: () => void;
  readonly onCloseShortcuts: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onDiscard: () => void;
  readonly onSave: () => void;
};

/** Renders history, dirty state, and transactional actions in the Project header. */
export function ProjectHeaderActions({
  mode,
  dirty,
  disabled,
  canUndo,
  canRedo,
  shortcutsOpen,
  onOpenShortcuts,
  onCloseShortcuts,
  onUndo,
  onRedo,
  onDiscard,
  onSave
}: ProjectHeaderActionsProps) {
  const { t } = useCasaTranslation("project-viewer");

  if (mode === "view") {
    return (
      <Chip
        className="project-header-status"
        icon={<CheckCircleRoundedIcon />}
        color="success"
        variant="outlined"
        label={t("workspace.saved")}
      />
    );
  }

  return (
    <Stack direction="row" className="project-header-actions">
      <Box className="project-header-actions__history" role="group" aria-label={t("header.history")}>
        <Tooltip title={t("tools.undo")}>
          <span>
            <IconButton size="small" aria-label={t("tools.undo")} disabled={disabled || !canUndo} onClick={onUndo}>
              <UndoRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("tools.redo")}>
          <span>
            <IconButton size="small" aria-label={t("tools.redo")} disabled={disabled || !canRedo} onClick={onRedo}>
              <RedoRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <ShortcutsHelpControl
        open={shortcutsOpen}
        onOpen={onOpenShortcuts}
        onClose={onCloseShortcuts}
      />
      <Chip
        className="project-header-status"
        icon={<EditRoundedIcon />}
        color={dirty ? "warning" : "default"}
        variant="outlined"
        label={t(dirty ? "workspace.unsaved" : "workspace.clean")}
      />
      {dirty ? (
        <Button color="inherit" disabled={disabled} onClick={onDiscard}>
          {t("persistence.discardAction")}
        </Button>
      ) : null}
      <Button variant="contained" disabled={!dirty || disabled} onClick={onSave}>
        {t("persistence.save")}
      </Button>
    </Stack>
  );
}

type ShortcutsHelpControlProps = {
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
};

function ShortcutsHelpControl({
  open,
  onOpen,
  onClose
}: ShortcutsHelpControlProps) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <>
      <Tooltip title={t("shortcuts.title")}>
        <IconButton
          aria-label={t("shortcuts.title")}
          onClick={onOpen}
          size="small"
        >
          <KeyboardRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog
        open={open}
        onClose={onClose}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
          }
        }}
        aria-labelledby="project-shortcuts-dialog-title"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="project-shortcuts-dialog-title">
          {t("shortcuts.title")}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {t("shortcuts.description")}
            </Typography>
            <GeometryShortcutGuide showTitle={false} includeEditingShortcuts />
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
