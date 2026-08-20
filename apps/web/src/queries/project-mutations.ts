import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Project } from "@casastudio/schema";
import { useCasaStudioApi } from "../api/ApiProvider";
import { geometryKeys } from "./geometry-queries";
import { projectKeys } from "./project-queries";

/** Stable input captured when a complete Project save begins. */
export type ReplaceProjectMutationInput = {
  readonly projectId: string;
  readonly baseRevision: number;
  readonly project: Project;
};

/** Persists a complete local Project draft through the replacement boundary. */
export function useReplaceProjectMutation() {
  const api = useCasaStudioApi();

  return useMutation({
    mutationFn: (input: ReplaceProjectMutationInput) =>
      api.replaceProject(input.projectId, {
        baseRevision: input.baseRevision,
        project: input.project
      }),
    retry: false
  });
}

/** Creates a Project and refreshes only the authenticated Project list cache. */
export function useCreateProjectMutation() {
  const api = useCasaStudioApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createProject({ name }),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: projectKeys.list() }),
    retry: false
  });
}

/** Deletes a Project and refreshes only its authoritative server-state scope. */
export function useDeleteProjectMutation() {
  const api = useCasaStudioApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: async (_result, projectId) => {
      queryClient.removeQueries({
        queryKey: projectKeys.detail(projectId),
        exact: true
      });
      queryClient.removeQueries({
        queryKey: geometryKeys.detail(projectId),
        exact: true
      });
      await queryClient.invalidateQueries({ queryKey: projectKeys.list() });
    },
    retry: false
  });
}
