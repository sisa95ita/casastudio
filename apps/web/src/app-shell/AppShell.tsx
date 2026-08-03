import { Box } from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";

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

/**
 * Reusable CasaStudio desktop application shell.
 *
 * The shell owns viewport filling, fixed chrome, navigation, inspector, and
 * status regions. Nested routes only register small route-specific slots so
 * this foundation remains compact and avoids prematurely modelling future CAD
 * editor concepts such as selection, docking, persistence, or commands.
 */
export function AppShell() {
  const [content, setContent] = useState<AppShellContent>(defaultAppShellContent);
  const resetContent = useCallback(() => setContent(defaultAppShellContent), []);
  const contextValue = useMemo(
    () => ({
      setContent,
      resetContent
    }),
    [resetContent]
  );

  return (
    <AppShellContentContext.Provider value={contextValue}>
      <Box
        sx={{
          bgcolor: "background.default",
          color: "text.primary",
          display: "grid",
          gridTemplateRows: "52px minmax(0, 1fr) 28px",
          height: "100vh",
          minWidth: 0,
          overflow: "hidden"
        }}
      >
        <AppHeader
          title={content.title}
          breadcrumb={content.breadcrumb}
          accessory={content.headerAccessory}
        />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "58px minmax(0, 1fr)",
              sm: "68px minmax(0, 1fr)",
              md: "68px minmax(0, 1fr) 300px",
              lg: "68px minmax(0, 1fr) 320px"
            },
            minHeight: 0,
            minWidth: 0
          }}
        >
          <NavigationRail />
          <MainWorkspace>
            <Outlet />
          </MainWorkspace>
          <InspectorPanel>{content.inspector}</InspectorPanel>
        </Box>

        <StatusBar>{content.status}</StatusBar>
      </Box>
    </AppShellContentContext.Provider>
  );
}
