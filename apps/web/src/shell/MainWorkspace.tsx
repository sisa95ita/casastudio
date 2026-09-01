import { Box } from "@mui/material";
import type { ReactNode } from "react";

/** Props for the shell-owned main workspace region. */
export type MainWorkspaceProps = {
  readonly children: ReactNode;
};

/** Provides the dominant scroll-managed route surface inside the application shell. */
export function MainWorkspace({ children }: MainWorkspaceProps) {
  return (
    <Box component="main" className="main-workspace">
      {children}
    </Box>
  );
}
