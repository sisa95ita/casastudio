import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";

import { useAppShellContent } from "../app-shell/AppShellContext";

/**
 * Stable not-found route rendered inside the shared application shell.
 */
export function NotFoundPage() {
  const shellContent = useMemo(
    () => ({
      title: "Not found",
      breadcrumb: "Routing",
      status: "Route not found"
    }),
    []
  );

  useAppShellContent(shellContent);

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Paper sx={{ border: 1, borderColor: "divider", p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="h1">Route not found</Typography>
          <Typography variant="body2" color="text.secondary">
            CasaStudio does not have a workspace at this path.
          </Typography>
          <Box>
            <Button component={RouterLink} to="/" startIcon={<ArrowBackRoundedIcon />}>
              Back to Home
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
