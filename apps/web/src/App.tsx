import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { Provider as ReduxProvider } from "react-redux";
import { lazy, Suspense, useMemo } from "react";
import {
  createBrowserRouter,
  createMemoryRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  RouterProvider,
  Routes
} from "react-router-dom";

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
import { NotFoundPage } from "./pages/NotFoundPage";
import { useCasaTranslation } from "./i18n";
import { appQueryClient, createAppQueryClient } from "./queries/query-client";
import { appStore, createAppStore, type AppStore } from "./state/store";
import "./styles.css";
import { casaStudioTheme } from "./theme/casaStudioTheme";

/** Lazily loaded public route that owns the product imagery bundle. */
const PublicLandingPage = lazy(() =>
  import("./pages/PublicLandingPage").then((module) => ({ default: module.PublicLandingPage }))
);
/** Lazily loaded authenticated Projects entry route. */
const HomePage = lazy(() =>
  import("./pages/HomePage").then((module) => ({ default: module.HomePage }))
);
/** Lazily loaded authoritative Project Viewer route. */
const ProjectViewerPage = lazy(() =>
  import("./pages/ProjectViewerPage").then((module) => ({ default: module.ProjectViewerPage }))
);
/** Lazily loaded technical geometry route kept outside primary navigation. */
const GeometryPlaygroundPage = lazy(() =>
  import("./geometry-playground/GeometryPlaygroundPage").then((module) => ({
    default: module.GeometryPlaygroundPage
  }))
);

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
 * A browser data router is used in production, while tests can pass
 * `initialEntries` to exercise the same route tree with a memory data router.
 */
export function App({ initialEntries, authClient, apiClient, queryClient, store }: AppProps) {
  const activeAuthClient = authClient ?? getDefaultAuthClient();
  const activeQueryClient = queryClient ?? (initialEntries ? createAppQueryClient() : appQueryClient);
  const activeStore = store ?? (initialEntries ? createAppStore() : appStore);
  const router = useMemo(() => createAppRouter(initialEntries), [initialEntries]);

  return (
    <ThemeProvider theme={casaStudioTheme}>
      <CssBaseline />
      <ReduxProvider store={activeStore}>
        <QueryClientProvider client={activeQueryClient}>
          <AuthProvider client={activeAuthClient}>
            <ApiProvider client={apiClient}>
              <Suspense fallback={<RouteLoadingStatus />}>
                <RouterProvider router={router} />
              </Suspense>
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
      {createAppRouteElements()}
    </Routes>
  );
}

/** Creates a data router so Project editing can use supported navigation blockers. */
export function createAppRouter(initialEntries?: readonly string[]) {
  const routes = createRoutesFromElements(createAppRouteElements());

  return initialEntries
    ? createMemoryRouter(routes, { initialEntries: [...initialEntries] })
    : createBrowserRouter(routes);
}

function createAppRouteElements() {
  return (
    <>
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
    </>
  );
}

/** Renders a localized route-chunk loading state. */
function RouteLoadingStatus() {
  const { t } = useCasaTranslation("common");

  return <div role="status" className="route-loading-status">{t("shell.loadingPage")}</div>;
}
