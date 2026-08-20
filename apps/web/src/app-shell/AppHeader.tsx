import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { ProductBrand } from "../components/ProductBrand";
import { useCasaTranslation } from "../i18n";

/** Props for the CasaStudio workspace header. */
export type AppHeaderProps = {
  readonly title: string;
  readonly breadcrumb?: string;
  readonly accessory?: ReactNode;
  readonly inspectorAvailable?: boolean;
  readonly onOpenInspector?: () => void;
};

/** Renders persistent product, project, mode, and account context. */
export function AppHeader({
  title,
  breadcrumb,
  accessory,
  inspectorAvailable = false,
  onOpenInspector
}: AppHeaderProps) {
  const { t } = useCasaTranslation("common");

  return (
    <Box component="header" className="workspace-header">
      <Box component={RouterLink} to="/app" className="workspace-header__brand" aria-label={t("shell.goToProjects")}>
        <ProductBrand compact />
      </Box>

      <Box className="workspace-header__context">
        <Typography variant="caption" color="text.secondary" noWrap>
          {breadcrumb}
        </Typography>
        <Typography variant="subtitle1" component="div" noWrap>
          {title}
        </Typography>
      </Box>

      <Box className="workspace-mode" aria-label={t("shell.mode.label")}>
        <Chip label={t("shell.mode.twoD")} color="primary" />
      </Box>

      <Box className="workspace-header__spacer" />

      {inspectorAvailable ? (
        <Tooltip title={t("shell.inspector.open")}>
          <IconButton
            className="workspace-header__inspector-button"
            aria-label={t("shell.inspector.open")}
            onClick={onOpenInspector}
          >
            <TuneRoundedIcon />
          </IconButton>
        </Tooltip>
      ) : null}

      {accessory ? <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>{accessory}</Stack> : null}
    </Box>
  );
}
