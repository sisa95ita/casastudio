import { Suspense, useMemo } from "react";
import { RouterProvider } from "react-router-dom";

import { useCasaTranslation } from "../core/i18n";
import "../styles.css";
import { AppProviders, type AppProviderProps } from "./providers";
import { createAppRouter } from "./router";

/** Props for bootstrapping the CasaStudio web application. */
export type AppProps = AppProviderProps & {
  readonly initialEntries?: readonly string[];
};

/**
 * Renders the themed React Router application.
 *
 * A browser data router is used in production, while tests can pass
 * `initialEntries` to exercise the same route tree with a memory data router.
 */
export function App({ initialEntries, authClient, apiClient, queryClient, store }: AppProps) {
  const router = useMemo(() => createAppRouter(initialEntries), [initialEntries]);

  return (
    <AppProviders
      isolated={initialEntries !== undefined}
      authClient={authClient}
      apiClient={apiClient}
      queryClient={queryClient}
      store={store}
    >
      <Suspense fallback={<RouteLoadingStatus />}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  );
}

/** Renders a localized route-chunk loading state. */
function RouteLoadingStatus() {
  const { t } = useCasaTranslation("common");

  return <div role="status" className="route-loading-status">{t("shell.loadingPage")}</div>;
}

export { AppRoutes, createAppRouter } from "./router";
export { getDefaultAuthClient } from "./providers";
