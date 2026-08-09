import { Box, Divider, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { useCasaTranslation } from "../i18n";

/**
 * Props for the right-side route inspector.
 */
export type InspectorPanelProps = {
  readonly children?: ReactNode;
};

/**
 * Renders the bounded route-specific inspector panel.
 *
 * The panel is hidden below the medium breakpoint to preserve the usable SVG
 * workspace on narrow screens. It is a desktop inspector surface, not a mobile
 * editing surface.
 */
export function InspectorPanel({ children }: InspectorPanelProps) {
  const { t } = useCasaTranslation("common");

  return (
    <Box
      component="aside"
      aria-label={t("shell.inspector.label")}
      sx={{
        bgcolor: "background.paper",
        borderLeft: 1,
        borderColor: "divider",
        display: { xs: "none", md: "block" },
        minHeight: 0,
        overflow: "auto",
        width: { md: 300, lg: 320 }
      }}
    >
      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        <Typography variant="overline" color="text.secondary">
          {t("shell.inspector.label")}
        </Typography>
        <Divider />
        {children ?? (
          <Typography variant="body2" color="text.secondary">
            {t("shell.inspector.empty")}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
