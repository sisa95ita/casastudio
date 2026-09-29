import {
  DesignGenerationError,
  type DesignRequest,
  type InteriorDesignProvider,
  type InteriorDesignProviderResult
} from "@casastudio/ai";

import {
  buildOpenAIInteriorDesignInstructions,
  buildOpenAIInteriorDesignPrompt
} from "./openai-prompt-builder";

export type OpenAIInteriorDesignConfiguration = Readonly<{
  reasoningModel: string;
  imageModel: string;
}>;

type OpenAIImageGenerationCall = Readonly<{
  type: "image_generation_call";
  id?: string;
  result?: string | null;
  status?: string;
}>;

export type OpenAIResponseLike = Readonly<{
  id?: string;
  output?: readonly Readonly<{ type: string; [key: string]: unknown }>[];
}>;

export interface OpenAIResponsesClient {
  create(input: unknown): Promise<OpenAIResponseLike>;
}

/** Official-SDK-backed adapter. No OpenAI type crosses this file boundary. */
export class OpenAIInteriorDesignProvider implements InteriorDesignProvider {
  readonly name = "openai";

  constructor(
    private readonly configuration: OpenAIInteriorDesignConfiguration,
    private readonly client: OpenAIResponsesClient
  ) {}

  async generateDesign(
    request: DesignRequest
  ): Promise<InteriorDesignProviderResult> {
    let response: OpenAIResponseLike;
    try {
      response = await this.client.create({
        model: this.configuration.reasoningModel,
        instructions: buildOpenAIInteriorDesignInstructions(),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildOpenAIInteriorDesignPrompt(request)
              },
              ...request.referenceViews.map((reference) => ({
                type: "input_image",
                image_url: reference.image.dataUrl,
                detail: "high"
              }))
            ]
          }
        ],
        tools: [
          {
            type: "image_generation",
            model: this.configuration.imageModel,
            action: "generate"
          }
        ]
      });
    } catch (error) {
      throw normalizeOpenAIError(error);
    }

    const imageCall = response.output?.find(
      (item): item is OpenAIImageGenerationCall =>
        item.type === "image_generation_call"
    );
    if (!imageCall) {
      throw new DesignGenerationError(
        "invalid_provider_response",
        "The AI provider returned no generated image."
      );
    }
    if (!imageCall.result) {
      throw new DesignGenerationError(
        "generation_failed",
        "The AI provider did not complete image generation."
      );
    }

    return Object.freeze({
      artifact: Object.freeze({
        kind: "image",
        uri: `data:image/png;base64,${imageCall.result}`,
        mimeType: "image/png"
      }),
      ...(response.id ? { requestId: response.id } : {}),
      ...(response.id
        ? { continuation: Object.freeze({ previousResponseId: response.id }) }
        : {})
    });
  }
}

function normalizeOpenAIError(error: unknown): DesignGenerationError {
  if (error instanceof DesignGenerationError) return error;
  const record =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const status = typeof record.status === "number" ? record.status : undefined;
  const code = typeof record.code === "string" ? record.code : undefined;
  const name = typeof record.name === "string" ? record.name : undefined;

  if (status === 401 || status === 403) {
    return new DesignGenerationError(
      "authentication_failed",
      "The AI provider rejected the server configuration.",
      { cause: error }
    );
  }
  if (status === 429) {
    return new DesignGenerationError(
      "rate_limited",
      "The AI provider is rate limited. Try again later.",
      { cause: error }
    );
  }
  if (
    status === 408 ||
    code === "ETIMEDOUT" ||
    name === "AbortError" ||
    name === "APIConnectionTimeoutError"
  ) {
    return new DesignGenerationError(
      "generation_timeout",
      "The AI image generation timed out.",
      { cause: error }
    );
  }
  if (status !== undefined && status >= 500) {
    return new DesignGenerationError(
      "provider_unavailable",
      "The AI provider is temporarily unavailable.",
      { cause: error }
    );
  }
  if (name === "APIConnectionError") {
    return new DesignGenerationError(
      "provider_unavailable",
      "The AI provider is temporarily unavailable.",
      { cause: error }
    );
  }
  return new DesignGenerationError(
    "generation_failed",
    "The AI provider could not generate the design.",
    { cause: error }
  );
}
