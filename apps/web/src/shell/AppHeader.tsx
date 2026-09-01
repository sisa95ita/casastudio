import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { ProductBrand } from "../shared/components/ProductBrand";
import { useCasaTranslation } from "../core/i18n";

/** Props for the CasaStudio workspace header. */
export type AppHeaderProps = {
  readonly title: string;
  readonly breadcrumb?: string;
  readonly contextAccessory?: ReactNode;
  readonly center?: ReactNode;
  readonly accessory?: ReactNode;
  readonly inspectorAvailable?: boolean;
  readonly onOpenInspector?: () => void;
};

/** Renders persistent product, project, mode, and account context. */
export function AppHeader({
  title,
  breadcrumb,
  contextAccessory,
  center,
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

      {contextAccessory ? (
        <Box className="workspace-header__context-accessory">{contextAccessory}</Box>
      ) : null}

      <Box className="workspace-header__spacer" />

      {center ? <Box className="workspace-header__center">{center}</Box> : null}

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
