import type {
  DesignArtifact,
  DesignGenerationTelemetry,
  DesignRequest,
  DesignRefinementRequest,
  DesignProposal
} from "./contracts.js";

/** Server-side transient result. Continuation is excluded from public Proposal contracts. */
export type GeneratedDesignProposal = Omit<DesignProposal, "providerMetadata"> &
  Readonly<{
    providerMetadata?: Readonly<{
      provider: string;
      continuation?: Readonly<Record<string, string>>;
    }>;
  }>;

export type InteriorDesignProviderResult = Readonly<{
  artifact: DesignArtifact;
  continuation?: Readonly<Record<string, string>>;
  telemetry?: Omit<DesignGenerationTelemetry, "provider">;
}>;

/** Provider seam implemented by OpenAI now and other providers later. */
export interface InteriorDesignProvider {
  readonly name: string;
  generateDesign(request: DesignRequest): Promise<InteriorDesignProviderResult>;
  refineDesign(
    request: DesignRefinementRequest
  ): Promise<InteriorDesignProviderResult>;
}
