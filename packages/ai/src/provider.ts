import type {
  DesignArtifact,
  DesignGenerationTelemetry,
  DesignRequest
} from "./contracts.js";

export type InteriorDesignProviderResult = Readonly<{
  artifact: DesignArtifact;
  continuation?: Readonly<Record<string, string>>;
  telemetry?: Omit<DesignGenerationTelemetry, "provider">;
}>;

/** Provider seam implemented by OpenAI now and other providers later. */
export interface InteriorDesignProvider {
  readonly name: string;
  generateDesign(request: DesignRequest): Promise<InteriorDesignProviderResult>;
}
