import { Stack, Typography } from "@mui/material";

import { useCasaTranslation } from "../i18n";
import { geometryViewerShortcuts } from "./geometry-viewer-shortcuts";

/**
 * Displays the active technical viewer shortcuts in the inspector.
 *
 * This guide is intentionally read-only documentation for keyboard navigation;
 * it does not imply editor commands, persistence, or domain mutation support.
 */
export function GeometryShortcutGuide() {
  const { t } = useCasaTranslation("geometry-playground");

  return (
    <Stack component="section" spacing={1} aria-labelledby="geometry-shortcuts-heading">
      <Typography variant="subtitle2" component="h2" id="geometry-shortcuts-heading">
        {t("shortcuts.title")}
      </Typography>
      <Stack component="dl" spacing={0.75} sx={{ m: 0 }}>
        {geometryViewerShortcuts.map((shortcut) => (
          <Stack
            className="geometry-summary-item"
            direction="row"
            key={shortcut.action}
            spacing={1.5}
            sx={{ justifyContent: "space-between" }}
          >
            <Typography component="dt" variant="caption" color="text.secondary">
              {t(shortcut.translationKey)}
            </Typography>
            <Typography component="dd" variant="caption" sx={{ fontWeight: 800, m: 0 }}>
              {shortcut.key}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
