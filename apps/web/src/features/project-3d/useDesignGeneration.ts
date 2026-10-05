import type { DesignProposal } from "@casastudio/ai";
import { useCallback, useEffect, useRef, useState } from "react";

type GenerationState =
  | { readonly status: "idle" }
  | { readonly status: "generating"; readonly roomLabel: string };

/** Single-flight UI guard; it does not cancel or retry paid provider work. */
export function useDesignGeneration() {
  const lock = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [state, setState] = useState<GenerationState>({ status: "idle" });
  const run = useCallback(
    async (
      roomLabel: string,
      operation: () => Promise<DesignProposal>
    ): Promise<DesignProposal | undefined> => {
      if (lock.current) return;
      // Synchronous guard also covers duplicate events before React renders.
      lock.current = true;
      setState({ status: "generating", roomLabel });
      try {
        return await operation();
      } finally {
        lock.current = false;
        if (mounted.current) setState({ status: "idle" });
      }
    },
    []
  );
  return { state, run };
}

export type DesignGeneration = ReturnType<typeof useDesignGeneration>;
