import type { DesignProposal, DurableDesignProposal } from "@casastudio/ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCasaStudioApi } from "../../core/api/ApiProvider";

/** Metadata only. Parent links, never timestamps, define paths and alternatives. */
export function useProposalLineage(
  proposal: DesignProposal | undefined,
  open: boolean,
  scope: object
) {
  const api = useCasaStudioApi();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    scope: object;
    nodes: readonly DurableDesignProposal[];
    known: readonly string[];
    loading: boolean;
    error: boolean;
  }>({ scope, nodes: [], known: [], loading: false, error: false });
  const ticket = useRef(0);
  const id = proposal?.id;
  const projectId = proposal?.target.projectId;
  const durable = proposal && "projectRevision" in proposal;
  const known = state.scope === scope && !!id && state.known.includes(id);
  useEffect(() => {
    if (!open || !id || !projectId || !durable || known) return;
    const epoch = ++ticket.current;
    const controller = new AbortController();
    setState((v) => ({
      ...(v.scope === scope ? v : { nodes: [], known: [] }),
      scope,
      loading: true,
      error: false
    }));
    void (async () => {
      try {
        let after = 0;
        const nodes: DurableDesignProposal[] = [];
        do {
          const page = await api.getDesignConversation(
            projectId,
            id,
            after,
            controller.signal
          );
          if (!page) break;
          if (!nodes.length) nodes.push(page.rootProposal);
          nodes.push(...page.iterations);
          if (page.nextAfterTurn === undefined) break;
          if (page.nextAfterTurn <= after)
            throw new Error("Invalid lineage cursor");
          after = page.nextAfterTurn;
        } while (!controller.signal.aborted);
        if (controller.signal.aborted || ticket.current !== epoch) return;
        setState((v) => ({
          scope,
          nodes: [
            ...(v.scope === scope
              ? v.nodes.filter((n) => !nodes.some((p) => p.id === n.id))
              : []),
            ...nodes
          ],
          known: [
            ...new Set([
              ...(v.scope === scope ? v.known : []),
              id,
              ...nodes.map((n) => n.id)
            ])
          ],
          loading: false,
          error: false
        }));
      } catch {
        if (!controller.signal.aborted && ticket.current === epoch)
          setState((v) => ({ ...v, loading: false, error: true }));
      }
    })();
    return () => {
      controller.abort();
      ++ticket.current;
    };
  }, [api, id, projectId, durable, open, scope, known, version]);
  const refresh = useCallback(() => {
    ++ticket.current;
    setState((v) => ({ ...v, known: [], nodes: [], error: false }));
    setVersion((v) => v + 1);
  }, []);
  const nodes = state.scope === scope ? state.nodes : [];
  const path: DurableDesignProposal[] = [];
  let node =
    nodes.find((n) => n.id === id) ??
    (durable ? (proposal as DurableDesignProposal) : undefined);
  const visited = new Set<string>();
  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    path.unshift(node);
    node = nodes.find((n) => n.id === node?.lineage?.parentProposalId);
  }
  return {
    nodes,
    path,
    children: nodes.filter((n) => n.lineage?.parentProposalId === id),
    loading: open && !!durable && ((!known && !state.error) || state.loading),
    error: state.scope === scope && state.error,
    refresh
  };
}
export type ProposalLineage = ReturnType<typeof useProposalLineage>;
