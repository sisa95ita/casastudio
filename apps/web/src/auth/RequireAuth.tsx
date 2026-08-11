import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { useCasaTranslation } from "../i18n";
import { ProductBrand } from "../components/ProductBrand";
import { useAuth } from "./AuthProvider";

/**
 * Protects nested routes and starts one provider-owned login attempt for anonymous users.
 */
export function RequireAuth() {
  const { t } = useCasaTranslation("auth");
  const { authenticated, initialized, login } = useAuth();

  useEffect(() => {
    if (initialized && !authenticated) {
      void login().catch(() => undefined);
    }
  }, [authenticated, initialized, login]);

  if (!initialized) {
    return null;
  }

  if (authenticated) {
    return <Outlet />;
  }

  return (
    <Box className="auth-screen">
      <Stack role="status" spacing={2} sx={{ alignItems: "center" }}>
        <ProductBrand />
        <CircularProgress size={26} thickness={3.5} />
        <Typography variant="body2" color="text.secondary">
          {t("redirecting")}
        </Typography>
      </Stack>
    </Box>
  );
}
