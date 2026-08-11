import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { useCasaTranslation } from "../i18n";

/** Props for the route-specific inspector surface. */
export type InspectorPanelProps = {
  readonly children?: ReactNode;
  readonly compact?: boolean;
  readonly onClose?: () => void;
};

/** Renders the grouped route inspector for persistent and drawer placements. */
export function InspectorPanel({ children, compact = false, onClose }: InspectorPanelProps) {
  const { t } = useCasaTranslation("common");

  return (
    <Box component="aside" aria-label={t("shell.inspector.label")} className={compact ? "inspector-panel inspector-panel--drawer" : "inspector-panel"}>
      <Box className="inspector-panel__header">
        <Box>
          <Typography variant="overline" color="primary.dark">
            {t("shell.inspector.eyebrow")}
          </Typography>
          <Typography component="h2" variant="h3">
            {t("shell.inspector.label")}
          </Typography>
        </Box>
        {onClose ? (
          <IconButton aria-label={t("shell.inspector.close")} onClick={onClose}>
            <CloseRoundedIcon />
          </IconButton>
        ) : null}
      </Box>
      <Stack className="inspector-panel__content" spacing={2.25}>
        {children ?? (
          <Typography variant="body2" color="text.secondary">
            {t("shell.inspector.empty")}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
