import type { QueryClient } from "@tanstack/react-query";
import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { useBlocker } from "react-router-dom";

import type { AppDispatch } from "../../../../app/store/store";
import type { CasaStudioApiClient } from "../../../../core/api/CasaStudioApiClient";
import { ProjectReplacementResponseError } from "../../../../core/api/CasaStudioApiClient";
import {
  editingSessionEnded,
  type ProjectEditorState,
  type ProjectWorkspaceMode
} from "../../../editor-2d/state/project-editor-slice";
import { geometrySelectionReset } from "../../../editor-2d/state/viewer-slice";
import {
  geometryKeys,
  projectGeometryQueryOptions
} from "../../data/geometry-queries";
import type { useReplaceProjectMutation } from "../../data/project-mutations";
import {
  projectKeys,
  projectQueryOptions
} from "../../data/project-queries";
import type { ProjectPersistenceDialog } from "../components/ProjectPersistenceDialogs";
import { getConsistencyFailure } from "./project-consistency";
import {
  classifySaveFeedback,
  isProjectRevisionConflict,
  type SaveFeedback
} from "./project-errors";

type RefreshFailure = "save" | "reload-latest";

type UseProjectPersistenceOptions = {
  readonly api: CasaStudioApiClient;
  readonly projectId: string;
  readonly queryClient: QueryClient;
  readonly dispatch: AppDispatch;
  readonly blocker: ReturnType<typeof useBlocker>;
  readonly editor: ProjectEditorState;
  readonly replaceProjectMutation: ReturnType<typeof useReplaceProjectMutation>;
  readonly saveInteractionBlocked: boolean;
  readonly workspaceMode: ProjectWorkspaceMode;
  readonly refreshFailure: RefreshFailure | undefined;
  readonly refreshingAuthoritativeState: boolean;
  readonly setPersistenceDialog: Dispatch<SetStateAction<ProjectPersistenceDialog>>;
  readonly setRefreshingAuthoritativeState: Dispatch<SetStateAction<boolean>>;
  readonly setRefreshFailure: Dispatch<SetStateAction<RefreshFailure | undefined>>;
  readonly setSaveFeedback: Dispatch<SetStateAction<SaveFeedback | undefined>>;
};

/** Provides the Project save, discard, conflict, and authoritative refresh callbacks. */
export function useProjectPersistence({
  api,
  projectId,
  queryClient,
  dispatch,
  blocker,
  editor,
  replaceProjectMutation,
  saveInteractionBlocked,
  workspaceMode,
  refreshFailure,
  refreshingAuthoritativeState,
  setPersistenceDialog,
  setRefreshingAuthoritativeState,
  setRefreshFailure,
  setSaveFeedback
}: UseProjectPersistenceOptions) {
  const refreshAuthoritativeState = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
        exact: true,
        refetchType: "none"
      }),
      queryClient.invalidateQueries({
        queryKey: geometryKeys.detail(projectId),
        exact: true,
        refetchType: "none"
      })
    ]);

    const refreshResults = await Promise.allSettled([
      queryClient.fetchQuery(projectQueryOptions(api, projectId)),
      queryClient.fetchQuery(projectGeometryQueryOptions(api, projectId))
    ]);
    const failedRefresh = refreshResults.find(
      (result) => result.status === "rejected"
    );
    if (failedRefresh?.status === "rejected") {
      throw failedRefresh.reason;
    }
    const [projectResult, geometryResult] = refreshResults;
    if (
      projectResult?.status !== "fulfilled" ||
      geometryResult?.status !== "fulfilled"
    ) {
      throw new Error("Authoritative refresh completed without both resources.");
    }
    const nextProject = projectResult.value;
    const nextGeometry = geometryResult.value;
    if (getConsistencyFailure(nextProject, nextGeometry)) {
      throw new Error(
        "Authoritative Project and Geometry responses are not coherent."
      );
    }
  }, [api, projectId, queryClient]);

  const finishAuthoritativeTransition = useCallback(
    async (kind: RefreshFailure, resumeNavigation: boolean) => {
      dispatch(editingSessionEnded(projectId));
      dispatch(geometrySelectionReset());
      setPersistenceDialog("none");
      setRefreshingAuthoritativeState(true);

      try {
        await refreshAuthoritativeState();
        setRefreshFailure(undefined);
        if (resumeNavigation && blocker.state === "blocked") {
          blocker.proceed();
        }
      } catch {
        setRefreshFailure(kind);
      } finally {
        setRefreshingAuthoritativeState(false);
      }
    },
    [blocker, dispatch, projectId, refreshAuthoritativeState]
  );

  const handleSave = useCallback(async () => {
    if (
      saveInteractionBlocked ||
      workspaceMode !== "edit" ||
      !editor.dirty ||
      !editor.draft ||
      editor.baseRevision === null
    ) {
      return;
    }

    const input = {
      projectId,
      baseRevision: editor.baseRevision,
      project: structuredClone(editor.draft)
    };
    const resumeNavigation = blocker.state === "blocked";
    setPersistenceDialog("none");
    setSaveFeedback(undefined);

    try {
      await replaceProjectMutation.mutateAsync(input);
    } catch (error) {
      if (error instanceof ProjectReplacementResponseError) {
        await finishAuthoritativeTransition("save", resumeNavigation);
        return;
      }

      if (resumeNavigation && blocker.state === "blocked") {
        blocker.reset();
      }
      if (isProjectRevisionConflict(error)) {
        setPersistenceDialog("conflict");
      } else {
        setSaveFeedback(classifySaveFeedback(error));
      }
      return;
    }

    await finishAuthoritativeTransition("save", resumeNavigation);
  }, [
    blocker,
    editor.baseRevision,
    editor.dirty,
    editor.draft,
    finishAuthoritativeTransition,
    projectId,
    replaceProjectMutation,
    saveInteractionBlocked,
    workspaceMode
  ]);

  const handleKeepEditing = useCallback(() => {
    if (blocker.state === "blocked") {
      blocker.reset();
    }
    setPersistenceDialog("none");
  }, [blocker]);

  const handleConfirmDiscard = useCallback(() => {
    const resumeNavigation = blocker.state === "blocked";
    dispatch(editingSessionEnded(projectId));
    dispatch(geometrySelectionReset());
    setPersistenceDialog("none");
    if (resumeNavigation) {
      blocker.proceed();
    }
  }, [blocker, dispatch, projectId]);

  const handleConfirmReloadLatest = useCallback(async () => {
    await finishAuthoritativeTransition("reload-latest", false);
  }, [finishAuthoritativeTransition]);

  const handleRetryAuthoritativeRefresh = useCallback(async () => {
    const failedTransition = refreshFailure;
    if (!failedTransition || refreshingAuthoritativeState) return;
    setRefreshingAuthoritativeState(true);
    try {
      await refreshAuthoritativeState();
      setRefreshFailure(undefined);
      if (failedTransition === "save" && blocker.state === "blocked") {
        blocker.proceed();
      }
    } catch {
      setRefreshFailure(failedTransition);
    } finally {
      setRefreshingAuthoritativeState(false);
    }
  }, [
    blocker,
    refreshAuthoritativeState,
    refreshFailure,
    refreshingAuthoritativeState
  ]);

  return {
    handleSave,
    handleKeepEditing,
    handleConfirmDiscard,
    handleConfirmReloadLatest,
    handleRetryAuthoritativeRefresh
  };
}
