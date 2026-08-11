import { Box, Drawer, Stack } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { AuthControls } from "../auth/AuthControls";
import { useCasaTranslation } from "../i18n";
import { AppHeader } from "./AppHeader";
import {
  AppShellContentContext,
  defaultAppShellContent,
  type AppShellContent
} from "./AppShellContext";
import { InspectorPanel } from "./InspectorPanel";
import { MainWorkspace } from "./MainWorkspace";
import { NavigationRail } from "./NavigationRail";
import { StatusBar } from "./StatusBar";

/** Renders the responsive authenticated CasaStudio product shell. */
export function AppShell() {
  const { t } = useCasaTranslation("common");
  const location = useLocation();
  const localizedDefaultContent = useMemo(
    () => ({
      title: t("shell.defaultTitle"),
      breadcrumb: t("shell.defaultBreadcrumb"),
      status: t("shell.defaultStatus")
    }),
    [t]
  );
  const [content, setContent] = useState<AppShellContent>(defaultAppShellContent);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const resetContent = useCallback(() => setContent(localizedDefaultContent), [localizedDefaultContent]);
  const contextValue = useMemo(
    () => ({ setContent, resetContent }),
    [resetContent]
  );

  useEffect(() => {
    setInspectorOpen(false);
  }, [location.pathname]);

  return (
    <AppShellContentContext.Provider value={contextValue}>
      <Box className="app-shell">
        <AppHeader
          title={content.title || localizedDefaultContent.title}
          breadcrumb={content.breadcrumb ?? localizedDefaultContent.breadcrumb}
          inspectorAvailable={Boolean(content.inspector)}
          onOpenInspector={() => setInspectorOpen(true)}
          accessory={
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              {content.headerAccessory}
              <AuthControls />
            </Stack>
          }
        />

        <Box className="app-shell__layout">
          <NavigationRail />
          <MainWorkspace>
            <Outlet />
          </MainWorkspace>
          <InspectorPanel>{content.inspector}</InspectorPanel>
        </Box>

        <StatusBar>{content.status ?? localizedDefaultContent.status}</StatusBar>
      </Box>

      <Drawer
        anchor="right"
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        className="inspector-drawer"
        ModalProps={{ keepMounted: true }}
      >
        <InspectorPanel compact onClose={() => setInspectorOpen(false)}>
          {content.inspector}
        </InspectorPanel>
      </Drawer>
    </AppShellContentContext.Provider>
  );
}
