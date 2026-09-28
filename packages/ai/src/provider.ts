import type { DesignArtifact, DesignRequest } from "./contracts.js";

export type InteriorDesignProviderResult = Readonly<{
  artifact: DesignArtifact;
  requestId?: string;
  continuation?: Readonly<Record<string, string>>;
}>;

/** Provider seam implemented by OpenAI now and other providers later. */
export interface InteriorDesignProvider {
  readonly name: string;
  generateDesign(request: DesignRequest): Promise<InteriorDesignProviderResult>;
}
