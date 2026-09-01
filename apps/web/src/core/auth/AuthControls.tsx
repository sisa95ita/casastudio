import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import { Box, Button, Typography } from "@mui/material";

import { useCasaTranslation } from "../i18n";
import { useAuth } from "./AuthProvider";

/** Displays the current identity and accessible logout controls. */
export function AuthControls() {
  const { t } = useCasaTranslation("auth");
  const { logout, user } = useAuth();
  const identity = user?.username ?? user?.email ?? t("user.fallback");

  return (
    <Box className="auth-controls">
      <Box className="auth-controls__identity">
        <PersonOutlineRoundedIcon fontSize="small" />
        <Typography variant="caption" noWrap>
          {identity}
        </Typography>
      </Box>
      <Button className="auth-controls__button" size="small" startIcon={<LogoutRoundedIcon />} onClick={() => void logout()} aria-label={t("actions.logout")}>
        <Box component="span" className="auth-controls__label">{t("actions.logout")}</Box>
      </Button>
    </Box>
  );
}
