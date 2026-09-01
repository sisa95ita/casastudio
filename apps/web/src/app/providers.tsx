import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { Provider as ReduxProvider } from "react-redux";

import { ApiProvider } from "../core/api/ApiProvider";
import type { CasaStudioApiClient } from "../core/api/CasaStudioApiClient";
import type { AuthClient } from "../core/auth/auth-client";
import { AuthProvider } from "../core/auth/AuthProvider";
import {
  createKeycloakAuthClient,
  readKeycloakAuthConfiguration
} from "../core/auth/keycloak-auth-client";
import { casaStudioTheme } from "../core/theme/casaStudioTheme";
import { appQueryClient, createAppQueryClient } from "./query-client";
import { appStore, createAppStore, type AppStore } from "./store/store";

/** Dependencies accepted by the application provider composition root. */
export type AppProviderProps = {
  readonly authClient?: AuthClient;
  readonly apiClient?: CasaStudioApiClient;
  readonly queryClient?: QueryClient;
  readonly store?: AppStore;
};

type AppProvidersProps = AppProviderProps & {
  readonly isolated: boolean;
  readonly children: ReactNode;
};

/** Lazily created browser authentication client shared across React renders. */
let defaultAuthClient: AuthClient | undefined;

/** Provides the application theme, local state, server state, authentication, and API. */
export function AppProviders({
  isolated,
  authClient,
  apiClient,
  queryClient,
  store,
  children
}: AppProvidersProps) {
  const activeAuthClient = authClient ?? getDefaultAuthClient();
  const activeQueryClient = queryClient ?? (isolated ? createAppQueryClient() : appQueryClient);
  const activeStore = store ?? (isolated ? createAppStore() : appStore);

  return (
    <ThemeProvider theme={casaStudioTheme}>
      <CssBaseline />
      <ReduxProvider store={activeStore}>
        <QueryClientProvider client={activeQueryClient}>
          <AuthProvider client={activeAuthClient}>
            <ApiProvider client={apiClient}>{children}</ApiProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ReduxProvider>
    </ThemeProvider>
  );
}

/** Returns the single browser authentication client used by the production app. */
export function getDefaultAuthClient(): AuthClient {
  defaultAuthClient ??= createKeycloakAuthClient(
    readKeycloakAuthConfiguration(import.meta.env)
  );
  return defaultAuthClient;
}
