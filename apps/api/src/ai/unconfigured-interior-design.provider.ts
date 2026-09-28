import {
  DesignGenerationError,
  type InteriorDesignProvider,
  type InteriorDesignProviderResult
} from "@casastudio/ai";

/** Keeps the rest of CasaStudio operational when optional AI is unavailable. */
export class UnconfiguredInteriorDesignProvider implements InteriorDesignProvider {
  readonly name = "unconfigured";

  async generateDesign(): Promise<InteriorDesignProviderResult> {
    throw new DesignGenerationError(
      "provider_not_configured",
      "AI design generation is not configured on this CasaStudio server."
    );
  }
}
