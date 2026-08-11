import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Outlet } from "react-router-dom";

import { useCasaTranslation } from "../i18n";
import { useAuth } from "./AuthProvider";

/**
 * Protects nested application routes and offers explicit login to anonymous users.
 */
export function RequireAuth() {
  const { t } = useCasaTranslation("auth");
  const { authenticated, initialized, login } = useAuth();

  if (!initialized) {
    return null;
  }

  if (authenticated) {
    return <Outlet />;
  }

  return (
    <Box sx={{ display: "grid", minHeight: "100vh", placeItems: "center", p: 2 }}>
      <Paper sx={{ border: 1, borderColor: "divider", maxWidth: 480, p: 3 }}>
        <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
          <LockOutlinedIcon color="primary" />
          <Typography variant="h1">{t("required.heading")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("required.description")}
          </Typography>
          <Button variant="contained" onClick={() => void login()}>
            {t("actions.login")}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
