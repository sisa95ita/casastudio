import { Alert, Snackbar } from "@mui/material";

import type { EditingErrorKey } from "../../../editor-2d/hooks/useEditorSelectionActions";
import type { SaveFeedback } from "../persistence/project-errors";
import {
  ProjectPersistenceDialogs,
  type ProjectPersistenceDialog
} from "./ProjectPersistenceDialogs";

type Translate = (key: string) => string;

type ProjectWorkspaceFeedbackProps = {
  readonly dialog: ProjectPersistenceDialog;
  readonly saving: boolean;
  readonly editingError?: EditingErrorKey;
  readonly saveFeedback?: SaveFeedback;
  readonly onDismissEditingError: () => void;
  readonly onDismissSaveFeedback: () => void;
  readonly onKeepEditing: () => void;
  readonly onConfirmDiscard: () => void;
  readonly onSave: () => void;
  readonly onReloadLatest: () => void;
  readonly onCancelReload: () => void;
  readonly onConfirmReload: () => void;
  readonly t: Translate;
};

/** Renders persistence dialogs and transient workspace error feedback. */
export function ProjectWorkspaceFeedback({
  dialog,
  saving,
  editingError,
  saveFeedback,
  onDismissEditingError,
  onDismissSaveFeedback,
  onKeepEditing,
  onConfirmDiscard,
  onSave,
  onReloadLatest,
  onCancelReload,
  onConfirmReload,
  t
}: ProjectWorkspaceFeedbackProps) {
  return (
    <>
      <ProjectPersistenceDialogs
        dialog={dialog}
        saving={saving}
        onKeepEditing={onKeepEditing}
        onConfirmDiscard={onConfirmDiscard}
        onSave={onSave}
        onReloadLatest={onReloadLatest}
        onCancelReload={onCancelReload}
        onConfirmReload={onConfirmReload}
      />
      <Snackbar
        open={Boolean(editingError)}
        autoHideDuration={5000}
        onClose={onDismissEditingError}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={onDismissEditingError}
        >
          {editingError ? t(editingError) : ""}
        </Alert>
      </Snackbar>
      <Snackbar
        open={Boolean(saveFeedback)}
        autoHideDuration={7000}
        onClose={onDismissSaveFeedback}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={onDismissSaveFeedback}
        >
          {saveFeedback ? t(`persistence.feedback.${saveFeedback}`) : ""}
        </Alert>
      </Snackbar>
    </>
  );
}
