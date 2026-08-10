import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { Button, Chip, Stack } from "@mui/material";

import { useCasaTranslation } from "../i18n";
import { useAuth } from "./AuthProvider";

/**
 * Displays the current user and the explicit logout action in the application shell.
 */
export function AuthControls() {
  const { t } = useCasaTranslation("auth");
  const { logout, user } = useAuth();
  const identity = user?.username ?? user?.email ?? t("user.fallback");

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Chip label={identity} size="small" variant="outlined" />
      <Button
        size="small"
        startIcon={<LogoutRoundedIcon />}
        onClick={() => void logout()}
      >
        {t("actions.logout")}
      </Button>
    </Stack>
  );
}
