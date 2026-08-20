import {
  Alert,
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
import { useRef } from "react";

import type { ProjectSummary } from "../api/api-types";
import { useCasaTranslation } from "../i18n";
import { useDeleteProjectMutation } from "../queries/project-mutations";

/** Confirmation boundary for deleting one authoritative Project aggregate. */
export function DeleteProjectDialog({
  project,
  onClose
}: {
  readonly project: ProjectSummary | null;
  readonly onClose: () => void;
}) {
  const { t } = useCasaTranslation("common");
  const mutation = useDeleteProjectMutation();
  const submitting = useRef(false);
  const close = () => {
    if (mutation.isPending) return;
    submitting.current = false;
    mutation.reset();
    onClose();
  };
  const confirm = () => {
    if (!project || mutation.isPending || submitting.current) return;
    submitting.current = true;
    mutation.mutate(project.id, {
      onSuccess: onClose,
      onSettled: () => {
        submitting.current = false;
      }
    });
  };

  return (
    <Dialog
      open={project !== null}
      onClose={close}
      aria-labelledby="delete-project-dialog-title"
      aria-describedby="delete-project-dialog-description"
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle id="delete-project-dialog-title">
        {t("routes.home.delete.title")}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="delete-project-dialog-description">
          {t("routes.home.delete.description", { name: project?.name ?? "" })}
        </DialogContentText>
        {mutation.isError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {t("routes.home.delete.failed")}
          </Alert>
        ) : null}
        {mutation.isPending ? (
          <Stack
            role="status"
            aria-live="polite"
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", mt: 2 }}
          >
            <CircularProgress size={18} />
            <Typography variant="body2">
              {t("routes.home.delete.pending")}
            </Typography>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={close} disabled={mutation.isPending}>
          {t("routes.home.delete.cancel")}
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={confirm}
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? t("routes.home.delete.pending")
            : t("routes.home.delete.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
