import type {
  DesignProposal,
  DurableDesignProposal,
  DesignProposalHistory
} from "@casastudio/ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCasaStudioApi } from "../../core/api/ApiProvider";

/** One bounded metadata page. No image or provider requests originate here. */
export function useRoomDesignHistory(
  projectId: string,
  levelId: string,
  roomId: string
) {
  const api = useCasaStudioApi();
  const scope = JSON.stringify([projectId, levelId, roomId]);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const [state, setState] = useState<
    DesignProposalHistory & { scope: string; loading: boolean; error: boolean }
  >({ scope, proposals: [], loading: true, error: false });
  const ticket = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const load = useCallback(
    async (cursor?: string) => {
      const epoch = ++ticket.current;
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      setState((value) => ({
        ...(value.scope === scope ? value : { proposals: [] }),
        scope,
        loading: true,
        error: false
      }));
      try {
        const result = await api.listRoomDesigns(
          projectId,
          levelId,
          roomId,
          cursor,
          request.signal
        );
        if (epoch === ticket.current)
          setState({ ...result, scope, loading: false, error: false });
      } catch {
        if (epoch === ticket.current && !request.signal.aborted)
          setState((value) => ({ ...value, loading: false, error: true }));
      }
    },
    [api, scope, projectId, levelId, roomId]
  );
  useEffect(() => {
    void load();
    return () => {
      ++ticket.current;
      controller.current?.abort();
    };
  }, [load]);
  const add = (proposal: DesignProposal) => {
    if (activeScope.current !== scope) return;
    if (
      !("projectRevision" in proposal) ||
      proposal.target.projectId !== projectId ||
      proposal.target.levelId !== levelId ||
      proposal.target.roomId !== roomId
    )
      return;
    // Supersede a list begun before persistence so it cannot hide the new result.
    ++ticket.current;
    controller.current?.abort();
    setState((value) => ({
      scope,
      loading: false,
      error: false,
      proposals: [
        proposal as DurableDesignProposal,
        ...(value.scope === scope
          ? value.proposals.filter((p) => p.id !== proposal.id)
          : [])
      ].slice(0, 20),
      nextCursor: value.scope === scope ? value.nextCursor : undefined
    }));
  };
  const remove = (id: string) => {
    if (activeScope.current !== scope) return;
    ++ticket.current;
    controller.current?.abort();
    setState((value) => ({
      ...value,
      loading: false,
      proposals: value.proposals.filter((p) => p.id !== id)
    }));
  };
  const current =
    state.scope === scope
      ? state
      : { proposals: [], loading: true, error: false, nextCursor: undefined };
  return { ...current, load, add, remove };
}

/** Only the selected image is loaded; at most one object URL is retained. */
export function useDesignArtifact(proposal: DesignProposal | undefined) {
  const api = useCasaStudioApi();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    identity: object;
    uri?: string;
    error?: boolean;
  }>();
  const id = proposal?.id;
  const projectId = proposal?.target.projectId;
  const immediate = proposal?.artifact.uri.startsWith("data:")
    ? proposal.artifact.uri
    : undefined;
  const identity = useMemo(() => ({}), [id, projectId, immediate, attempt]);
  useEffect(() => {
    if (!id || !projectId || immediate) return;
    const controller = new AbortController();
    let url: string | undefined;
    void api
      .getDesignArtifact(projectId, id, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setState({ identity, uri: url });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ identity, error: true });
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [api, id, projectId, immediate, identity]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return {
    uri: immediate ?? (state?.identity === identity ? state.uri : undefined),
    error: state?.identity === identity && state.error,
    retry
  };
}
