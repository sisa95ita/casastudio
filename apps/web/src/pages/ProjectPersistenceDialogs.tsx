import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography
} from "@mui/material";

import { useCasaTranslation } from "../i18n";

/** Mutually exclusive decision dialog shown around a local editing session. */
export type ProjectPersistenceDialog =
  "none" | "discard" | "leave" | "conflict" | "reload-conflict";

/** Callbacks and state required by the Project persistence decision dialogs. */
export type ProjectPersistenceDialogsProps = {
  readonly dialog: ProjectPersistenceDialog;
  readonly saving: boolean;
  readonly onKeepEditing: () => void;
  readonly onConfirmDiscard: () => void;
  readonly onSave: () => void;
  readonly onReloadLatest: () => void;
  readonly onCancelReload: () => void;
  readonly onConfirmReload: () => void;
};

/** Renders the explicit save, discard, navigation, and conflict decisions. */
export function ProjectPersistenceDialogs({
  dialog,
  saving,
  onKeepEditing,
  onConfirmDiscard,
  onSave,
  onReloadLatest,
  onCancelReload,
  onConfirmReload
}: ProjectPersistenceDialogsProps) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <>
      <Dialog
        open={saving}
        aria-labelledby="project-saving-dialog-title"
        aria-describedby="project-saving-dialog-description"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="project-saving-dialog-title">
          {t("persistence.saving.title")}
        </DialogTitle>
        <DialogContent>
          <Stack
            id="project-saving-dialog-description"
            role="status"
            aria-live="polite"
            spacing={2}
            sx={{ alignItems: "center", py: 2 }}
          >
            <CircularProgress
              size={32}
              aria-label={t("persistence.saving.progressLabel")}
            />
            <Typography color="text.secondary">
              {t("persistence.saving.detail")}
            </Typography>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!saving && dialog === "discard"}
        onClose={onKeepEditing}
        aria-labelledby="project-discard-dialog-title"
        aria-describedby="project-discard-dialog-description"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="project-discard-dialog-title">
          {t("persistence.discard.title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="project-discard-dialog-description">
            {t("persistence.discard.detail")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={onKeepEditing}>
            {t("persistence.keepEditing")}
          </Button>
          <Button color="error" onClick={onConfirmDiscard}>
            {t("persistence.discard.confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!saving && dialog === "leave"}
        onClose={onKeepEditing}
        aria-labelledby="project-leave-dialog-title"
        aria-describedby="project-leave-dialog-description"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="project-leave-dialog-title">
          {t("persistence.leave.title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="project-leave-dialog-description">
            {t("persistence.leave.detail")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={onKeepEditing}>
            {t("persistence.keepEditing")}
          </Button>
          <Button color="error" onClick={onConfirmDiscard}>
            {t("persistence.discard.confirm")}
          </Button>
          <Button variant="contained" onClick={onSave}>
            {t("persistence.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!saving && dialog === "conflict"}
        onClose={onKeepEditing}
        aria-labelledby="project-conflict-dialog-title"
        aria-describedby="project-conflict-dialog-description"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="project-conflict-dialog-title">
          {t("persistence.conflict.title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="project-conflict-dialog-description">
            {t("persistence.conflict.detail")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={onKeepEditing}>
            {t("persistence.conflict.keepLocalDraft")}
          </Button>
          <Button onClick={onReloadLatest}>
            {t("persistence.conflict.reloadLatest")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!saving && dialog === "reload-conflict"}
        onClose={onCancelReload}
        aria-labelledby="project-reload-dialog-title"
        aria-describedby="project-reload-dialog-description"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="project-reload-dialog-title">
          {t("persistence.conflict.confirmTitle")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="project-reload-dialog-description">
            {t("persistence.conflict.confirmDetail")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={onCancelReload}>
            {t("persistence.cancel")}
          </Button>
          <Button color="error" onClick={onConfirmReload}>
            {t("persistence.conflict.confirmReload")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
