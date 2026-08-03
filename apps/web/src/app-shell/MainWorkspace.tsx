import { Box } from "@mui/material";
import type { ReactNode } from "react";

/**
 * Props for the shell-owned main workspace region.
 */
export type MainWorkspaceProps = {
  readonly children: ReactNode;
};

/**
 * Provides the dominant route content surface inside the application shell.
 *
 * The workspace scrolls internally instead of allowing shell-level page
 * scrolling, matching desktop CAD and IDE tools where the chrome remains fixed
 * while the active surface changes.
 */
export function MainWorkspace({ children }: MainWorkspaceProps) {
  return (
    <Box
      component="main"
      sx={{
        bgcolor: "#e9efed",
        minHeight: 0,
        minWidth: 0,
        overflow: "auto",
        p: { xs: 1.5, md: 2 }
      }}
    >
      {children}
    </Box>
  );
}
