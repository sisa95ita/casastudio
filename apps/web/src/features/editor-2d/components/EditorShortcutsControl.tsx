import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";

import { useCasaTranslation } from "../../../core/i18n";
import { GeometryShortcutGuide } from "../../geometry-2d/viewer/GeometryShortcutGuide";

/** Keeps editor keyboard help discoverable beside the tools it describes. */
export function EditorShortcutsControl({
  open,
  onOpen,
  onClose
}: {
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
}) {
  const { t } = useCasaTranslation("project-viewer");

  return (
    <>
      <Tooltip title={t("shortcuts.title")}>
        <IconButton
          className="project-editor-toolbar__shortcuts"
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
          if (event.key === "Escape") event.stopPropagation();
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
