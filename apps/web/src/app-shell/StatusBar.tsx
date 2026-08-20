import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { applicationMetadata } from "../application-metadata";
import { useCasaTranslation } from "../i18n";

/** Props for the compact workspace status strip. */
export type StatusBarProps = {
  readonly children?: ReactNode;
};

/** Renders route status and workspace readiness in a persistent strip. */
export function StatusBar({ children }: StatusBarProps) {
  const { t } = useCasaTranslation("common");

  return (
    <Box role="status" aria-label={t("shell.statusBar.label")} className="workspace-status">
      <Box className="workspace-status__context">
        <CheckCircleRoundedIcon className="workspace-status__icon" />
        {typeof children === "string" || typeof children === "number" ? (
          <Typography variant="caption" color="text.secondary" noWrap>
            {children}
          </Typography>
        ) : (
          children
        )}
      </Box>
      <Typography
        className="workspace-status__version"
        variant="caption"
        color="text.disabled"
        noWrap
      >
        v{applicationMetadata.version}
      </Typography>
    </Box>
  );
}
