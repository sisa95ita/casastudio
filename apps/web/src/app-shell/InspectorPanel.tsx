import { Box, Divider, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

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
 * workspace on narrow screens; this is a deliberate desktop-first assumption
 * for the current foundation, not a full mobile editor strategy.
 */
export function InspectorPanel({ children }: InspectorPanelProps) {
  return (
    <Box
      component="aside"
      aria-label="Inspector"
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
          Inspector
        </Typography>
        <Divider />
        {children ?? (
          <Typography variant="body2" color="text.secondary">
            No route inspector available.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
