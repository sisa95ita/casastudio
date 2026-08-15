import { useMutation } from "@tanstack/react-query";

import type { Project } from "@casastudio/schema";
import { useCasaStudioApi } from "../api/ApiProvider";

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
