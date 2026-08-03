import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { useCasaTranslation } from "../i18n";

/**
 * Props for the compact application status bar.
 */
export type StatusBarProps = {
  readonly children?: ReactNode;
};

/**
 * Renders glanceable route status while preserving the fixed shell frame.
 */
export function StatusBar({ children }: StatusBarProps) {
  const { t } = useCasaTranslation("common");

  return (
    <Box
      role="status"
      aria-label={t("shell.statusBar.label")}
      sx={{
        alignItems: "center",
        borderTop: 1,
        borderColor: "divider",
        display: "flex",
        minHeight: 28,
        overflow: "hidden",
        px: 1.5
      }}
    >
      {typeof children === "string" || typeof children === "number" ? (
        <Typography variant="caption" color="text.secondary" noWrap>
          {children}
        </Typography>
      ) : (
        children
      )}
    </Box>
  );
}
