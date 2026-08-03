import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Box, Button, Divider, Paper, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";

import { useAppShellContent } from "../app-shell/AppShellContext";

/**
 * Minimal CasaStudio foundation home route.
 *
 * The page avoids fake project data and keeps the first screen purposeful:
 * identify the product foundation and link directly to the only current
 * technical workspace.
 */
export function HomePage() {
  const shellContent = useMemo(
    () => ({
      title: "Home",
      breadcrumb: "Foundation",
      inspector: (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Current foundation</Typography>
          <Divider />
          <Typography variant="body2" color="text.secondary">
            React Router, MUI shell, and the read-only geometry runtime viewer are the active
            frontend milestones.
          </Typography>
        </Stack>
      ),
      status: "CasaStudio foundation ready"
    }),
    []
  );

  useAppShellContent(shellContent);

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Paper
        sx={{
          border: 1,
          borderColor: "divider",
          p: 2
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Technical application foundation
            </Typography>
            <Typography variant="h1">CasaStudio</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              A focused foundation for browser-based interior geometry, spatial previews, and
              future design tooling.
            </Typography>
          </Box>

          <Divider />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: "flex-start" }}>
            <Button
              component={RouterLink}
              to="/geometry-playground"
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
            >
              Open Geometry Playground
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
