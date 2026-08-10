import { useQuery } from "@tanstack/react-query";

import type { CasaStudioApiClient } from "../api/CasaStudioApiClient";
import { useCasaStudioApi } from "../api/ApiProvider";

/** Stable key factory for authoritative Project server state. */
export const projectKeys = {
  all: ["projects"] as const,
  detail: (projectId: string) => ["projects", "detail", projectId] as const
};

/** Creates the reusable query definition for one authoritative Project. */
export function projectQueryOptions(api: CasaStudioApiClient, projectId: string) {
  return {
    queryKey: projectKeys.detail(projectId),
    queryFn: ({ signal }: { readonly signal: AbortSignal }) => api.getProject(projectId, signal)
  };
}

/** Reads an authoritative Project using route-safe query identity and cancellation. */
export function useProjectQuery(projectId: string) {
  const api = useCasaStudioApi();

  return useQuery({
    ...projectQueryOptions(api, projectId),
    enabled: projectId.length > 0
  });
}
