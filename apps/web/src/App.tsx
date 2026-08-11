import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { Provider as ReduxProvider } from "react-redux";
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./app-shell/AppShell";
import { ApiProvider } from "./api/ApiProvider";
import type { CasaStudioApiClient } from "./api/CasaStudioApiClient";
import type { AuthClient } from "./auth/auth-client";
import { AuthProvider } from "./auth/AuthProvider";
import {
  createKeycloakAuthClient,
  readKeycloakAuthConfiguration
} from "./auth/keycloak-auth-client";
import { RequireAuth } from "./auth/RequireAuth";
import { GeometryPlaygroundPage } from "./geometry-playground/GeometryPlaygroundPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PublicLandingPage } from "./pages/PublicLandingPage";
import { ProjectViewerPage } from "./pages/ProjectViewerPage";
import { appQueryClient, createAppQueryClient } from "./queries/query-client";
import { appStore, createAppStore, type AppStore } from "./state/store";
import "./styles.css";
import { casaStudioTheme } from "./theme/casaStudioTheme";

/**
 * Props for bootstrapping the CasaStudio web application.
 */
export type AppProps = {
  readonly initialEntries?: readonly string[];
  readonly authClient?: AuthClient;
  readonly apiClient?: CasaStudioApiClient;
  readonly queryClient?: QueryClient;
  readonly store?: AppStore;
};

/** Lazily created browser authentication client shared across React renders. */
let defaultAuthClient: AuthClient | undefined;

/**
 * Renders the themed React Router application.
 *
 * BrowserRouter is used in production, while tests can pass `initialEntries`
 * to exercise the same nested route tree with MemoryRouter.
 */
export function App({ initialEntries, authClient, apiClient, queryClient, store }: AppProps) {
  const routes = <AppRoutes />;
  const activeAuthClient = authClient ?? getDefaultAuthClient();
  const activeQueryClient = queryClient ?? (initialEntries ? createAppQueryClient() : appQueryClient);
  const activeStore = store ?? (initialEntries ? createAppStore() : appStore);

  return (
    <ThemeProvider theme={casaStudioTheme}>
      <CssBaseline />
      <ReduxProvider store={activeStore}>
        <QueryClientProvider client={activeQueryClient}>
          <AuthProvider client={activeAuthClient}>
            <ApiProvider client={apiClient}>
              {initialEntries ? (
                <MemoryRouter initialEntries={[...initialEntries]}>{routes}</MemoryRouter>
              ) : (
                <BrowserRouter>{routes}</BrowserRouter>
              )}
            </ApiProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ReduxProvider>
    </ThemeProvider>
  );
}

/**
 * Returns the single browser authentication client used by the production app.
 */
export function getDefaultAuthClient(): AuthClient {
  defaultAuthClient ??= createKeycloakAuthClient(
    readKeycloakAuthConfiguration(import.meta.env)
  );
  return defaultAuthClient;
}

/**
 * Declarative nested route tree for the CasaStudio SPA.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicLandingPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="geometry-playground" element={<GeometryPlaygroundPage />} />
          <Route path="projects/:projectId" element={<ProjectViewerPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
