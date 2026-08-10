import { CssBaseline, ThemeProvider } from "@mui/material";
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./app-shell/AppShell";
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
import "./styles.css";
import { casaStudioTheme } from "./theme/casaStudioTheme";

/**
 * Props for bootstrapping the CasaStudio web application.
 */
export type AppProps = {
  readonly initialEntries?: readonly string[];
  readonly authClient?: AuthClient;
};

/** Lazily created browser authentication client shared across React renders. */
let defaultAuthClient: AuthClient | undefined;

/**
 * Renders the themed React Router application.
 *
 * BrowserRouter is used in production, while tests can pass `initialEntries`
 * to exercise the same nested route tree with MemoryRouter.
 */
export function App({ initialEntries, authClient }: AppProps) {
  const routes = <AppRoutes />;
  const activeAuthClient = authClient ?? getDefaultAuthClient();

  return (
    <ThemeProvider theme={casaStudioTheme}>
      <CssBaseline />
      <AuthProvider client={activeAuthClient}>
        {initialEntries ? (
          <MemoryRouter initialEntries={[...initialEntries]}>{routes}</MemoryRouter>
        ) : (
          <BrowserRouter>{routes}</BrowserRouter>
        )}
      </AuthProvider>
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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
