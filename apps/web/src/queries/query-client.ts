import { QueryClient } from "@tanstack/react-query";

import {
  ApiAuthenticationUnavailableError,
  ApiRequestError
} from "../api/CasaStudioApiClient";

/** Default staleness window for authoritative read-only API resources. */
export const DEFAULT_SERVER_STATE_STALE_TIME_MS = 30_000;

/** Conservative retry policy shared by Project and Geometry queries. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1 || error instanceof ApiAuthenticationUnavailableError) {
    return false;
  }

  if (error instanceof ApiRequestError) {
    if (error.kind === "problem" || error.kind === "invalid-response") {
      return false;
    }

    if (error.status !== undefined && (error.status < 500 || error.status > 599)) {
      return false;
    }
  }

  return true;
}

/** Creates an application QueryClient with CasaStudio's server-state defaults. */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        staleTime: DEFAULT_SERVER_STATE_STALE_TIME_MS
      }
    }
  });
}

/** Browser application QueryClient shared across the single mounted React root. */
export const appQueryClient = createAppQueryClient();
