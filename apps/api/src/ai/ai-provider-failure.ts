import { DesignGenerationError, type DesignFailureCode } from "@casastudio/ai";

export type AiFailureStage =
  | "request_construction"
  | "provider_request"
  | "response_decoding"
  | "provider_result_validation";

/** Only allowlisted, content-free diagnostics may cross into application logging. */
export type AiProviderDiagnostics = Readonly<{
  errorClass: string;
  upstreamStatus?: number;
  providerCode?: string;
  providerType?: string;
  providerParam?: string;
  providerRequestId?: string;
  unsupportedSchemaKeyword?: string;
  safeMessage: string;
}>;

export class AiProviderFailure extends DesignGenerationError {
  constructor(
    code: DesignFailureCode,
    message: string,
    readonly stage: AiFailureStage,
    readonly diagnostics: AiProviderDiagnostics,
    options?: ErrorOptions
  ) {
    super(code, message, options);
    this.name = "AiProviderFailure";
  }
}
