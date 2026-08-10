import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { useCasaTranslation } from "../i18n";

/**
 * Minimal public CasaStudio entry route that does not initiate authentication.
 */
export function PublicLandingPage() {
  const { t } = useCasaTranslation("auth");

  return (
    <Box sx={{ display: "grid", minHeight: "100vh", placeItems: "center", p: 2 }}>
      <Paper sx={{ border: 1, borderColor: "divider", maxWidth: 640, p: 3 }}>
        <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
          <Typography variant="overline" color="text.secondary">
            {t("public.eyebrow")}
          </Typography>
          <Typography variant="h1">{t("public.heading")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("public.description")}
          </Typography>
          <Button
            component={RouterLink}
            to="/app"
            variant="contained"
            endIcon={<ArrowForwardRoundedIcon />}
          >
            {t("public.openApplication")}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
