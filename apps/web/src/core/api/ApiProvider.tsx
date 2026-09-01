import { createContext, type ReactNode, useContext, useMemo } from "react";

import { useAuth } from "../auth/AuthProvider";
import { readApiConfiguration } from "./api-configuration";
import { CasaStudioApiClient } from "./CasaStudioApiClient";

/** Props for wiring the authenticated frontend API boundary. */
export type ApiProviderProps = {
  readonly children: ReactNode;
  readonly client?: CasaStudioApiClient;
};

const ApiClientContext = createContext<CasaStudioApiClient | undefined>(undefined);

/** Provides one authenticated API client to feature query hooks. */
export function ApiProvider({ children, client }: ApiProviderProps) {
  const { getAccessToken } = useAuth();
  const activeClient = useMemo(
    () =>
      client ??
      new CasaStudioApiClient({
        baseUrl: readApiConfiguration(import.meta.env).baseUrl,
        getAccessToken
      }),
    [client, getAccessToken]
  );

  return <ApiClientContext.Provider value={activeClient}>{children}</ApiClientContext.Provider>;
}

/** Returns the authenticated CasaStudio API client for feature hooks. */
export function useCasaStudioApi(): CasaStudioApiClient {
  const client = useContext(ApiClientContext);

  if (!client) {
    throw new Error("useCasaStudioApi must be used within ApiProvider.");
  }

  return client;
}
