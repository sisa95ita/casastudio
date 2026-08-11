import { Box, Chip, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { useCasaTranslation } from "../i18n";

/**
 * Props for the compact CasaStudio application header.
 */
export type AppHeaderProps = {
  readonly title: string;
  readonly breadcrumb?: string;
  readonly accessory?: ReactNode;
};

/**
 * Renders the top application header shared by nested routes.
 *
 * The header is intentionally short so it identifies the product and current
 * route without stealing vertical space from the design workspace.
 */
export function AppHeader({ title, breadcrumb, accessory }: AppHeaderProps) {
  const { t } = useCasaTranslation("common");

  return (
    <Box
      component="header"
      sx={{
        alignItems: "center",
        bgcolor: "#fbfcfb",
        borderBottom: 1,
        borderColor: "divider",
        display: "flex",
        gap: 2,
        minHeight: 52,
        px: 2
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "baseline", minWidth: 0 }}>
        <Typography variant="subtitle1" component="div" sx={{ fontWeight: 800 }}>
          {t("brand.name")}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {breadcrumb ? `${breadcrumb} / ${title}` : title}
        </Typography>
      </Stack>

      <Box sx={{ flex: 1 }} />

      {accessory ? accessory : <Chip label={t("shell.workspace")} variant="outlined" />}
    </Box>
  );
}
