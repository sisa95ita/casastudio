import { useQuery } from "@tanstack/react-query";

import type { CasaStudioApiClient } from "../api/CasaStudioApiClient";
import { useCasaStudioApi } from "../api/ApiProvider";

/** Stable key factory for authoritative geometry snapshot server state. */
export const geometryKeys = {
  all: ["project-geometry"] as const,
  detail: (projectId: string) => ["project-geometry", "detail", projectId] as const
};

/** Creates the reusable query definition for one Project geometry snapshot. */
export function projectGeometryQueryOptions(api: CasaStudioApiClient, projectId: string) {
  return {
    queryKey: geometryKeys.detail(projectId),
    queryFn: ({ signal }: { readonly signal: AbortSignal }) =>
      api.getProjectGeometry(projectId, signal)
  };
}

/** Reads an authoritative geometry snapshot with route-safe identity and cancellation. */
export function useProjectGeometryQuery(projectId: string) {
  const api = useCasaStudioApi();

  return useQuery({
    ...projectGeometryQueryOptions(api, projectId),
    enabled: projectId.length > 0
  });
}
