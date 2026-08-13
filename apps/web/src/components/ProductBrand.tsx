import CottageRoundedIcon from "@mui/icons-material/CottageRounded";
import { Box, Typography } from "@mui/material";
import type { ComponentProps } from "react";

import { useCasaTranslation } from "../i18n";

/** Props for the reusable CasaStudio product signature. */
export type ProductBrandProps = {
  readonly compact?: boolean;
  readonly color?: ComponentProps<typeof Typography>["color"];
};

/** Renders the CasaStudio architectural mark and wordmark. */
export function ProductBrand({ compact = false, color = "text.primary" }: ProductBrandProps) {
  const { t } = useCasaTranslation("common");

  return (
    <Box className="product-brand" data-compact={compact ? "true" : "false"}>
      <Box className="product-brand__mark" aria-hidden="true">
        <CottageRoundedIcon />
      </Box>
      <Typography className="product-brand__name" color={color} component="span">
        {t("brand.name")}
      </Typography>
    </Box>
  );
}
