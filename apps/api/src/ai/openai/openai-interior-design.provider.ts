import {
  DesignGenerationError,
  type DesignRequest,
  type InteriorDesignProvider,
  type InteriorDesignProviderResult
} from "@casastudio/ai";

import {
  buildOpenAIInteriorDesignInstructions,
  buildOpenAIInteriorDesignPrompt,
  describeOpenAIReferenceRole
} from "./openai-prompt-builder";

export type OpenAIInteriorDesignConfiguration = Readonly<{
  reasoningModel: string;
  imageModel: string;
  imageQuality: "low" | "medium" | "high" | "xhigh" | "max" | "auto";
  imageSize: string;
  imageFormat: "png" | "jpeg" | "webp";
}>;

export type OpenAIInteriorDesignClock = Readonly<{
  monotonicNow: () => number;
  now: () => Date;
}>;

type OpenAIImageGenerationCall = Readonly<{
  type: "image_generation_call";
  id?: string;
  result?: string | null;
  status?: string;
  output_format?: "png" | "jpeg" | "webp" | null;
  quality?: string | null;
  size?: string | null;
}>;

export type OpenAIResponseLike = Readonly<{
  model?: string;
  output?: readonly Readonly<{ type: string; [key: string]: unknown }>[];
  usage?: Readonly<{
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    input_tokens_details?: Readonly<{
      cached_tokens?: number;
      cache_write_tokens?: number;
    }>;
    output_tokens_details?: Readonly<{ reasoning_tokens?: number }>;
  }>;
}>;

export interface OpenAIResponsesClient {
  create(input: unknown): Promise<OpenAIResponseLike>;
}

/** Official-SDK-backed adapter. No OpenAI type crosses this file boundary. */
export class OpenAIInteriorDesignProvider implements InteriorDesignProvider {
  readonly name = "openai";

  constructor(
    private readonly configuration: OpenAIInteriorDesignConfiguration,
    private readonly client: OpenAIResponsesClient,
    private readonly clock: OpenAIInteriorDesignClock = {
      monotonicNow: () => performance.now(),
      now: () => new Date()
    }
  ) {}

  async generateDesign(
    request: DesignRequest
  ): Promise<InteriorDesignProviderResult> {
    let response: OpenAIResponseLike;
    const startedAt = this.clock.monotonicNow();
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
              ...orderedReferences(request).flatMap((reference) => [
                {
                  type: "input_text",
                  text: describeOpenAIReferenceRole(reference.kind)
                },
                {
                  type: "input_image",
                  image_url: reference.image.dataUrl,
                  detail: "high"
                }
              ])
            ]
          }
        ],
        tools: [
          {
            type: "image_generation",
            model: this.configuration.imageModel,
            action: "generate",
            quality: this.configuration.imageQuality,
            size: this.configuration.imageSize,
            output_format: this.configuration.imageFormat
          }
        ],
        tool_choice: { type: "image_generation" }
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

    const completedAt = this.clock.now();
    const format = imageCall.output_format ?? this.configuration.imageFormat;
    const dimensions = parseImageSize(
      imageCall.size ?? this.configuration.imageSize
    );
    return Object.freeze({
      artifact: Object.freeze({
        kind: "image",
        uri: `data:image/${format};base64,${imageCall.result}`,
        mimeType: `image/${format}`,
        ...dimensions
      }),
      telemetry: Object.freeze({
        orchestrationModel:
          typeof response.model === "string"
            ? response.model
            : this.configuration.reasoningModel,
        imageModel: this.configuration.imageModel,
        durationMs: Math.max(0, Math.round(this.clock.monotonicNow() - startedAt)),
        generatedAt: completedAt.toISOString(),
        image: Object.freeze({
          ...dimensions,
          format,
          quality: imageCall.quality ?? this.configuration.imageQuality
        }),
        ...normalizeUsage(response.usage)
      })
    });
  }
}

function orderedReferences(request: DesignRequest) {
  const priority = new Map([
    ["room-interior-a", 0],
    ["room-axonometric", 1],
    ["room-interior-b", 2],
    ["current-user-view", 3]
  ]);
  return [...request.referenceViews].sort(
    (left, right) =>
      (priority.get(left.kind) ?? Number.MAX_SAFE_INTEGER) -
      (priority.get(right.kind) ?? Number.MAX_SAFE_INTEGER)
  );
}

function parseImageSize(
  size: string
): { readonly width?: number; readonly height?: number } {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return {};
  return { width: Number(match[1]), height: Number(match[2]) };
}

function normalizeUsage(
  usage: OpenAIResponseLike["usage"]
): { readonly usage: NonNullable<InteriorDesignProviderResult["telemetry"]>["usage"] } | Record<string, never> {
  if (!usage) return {};
  return {
    usage: Object.freeze({
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      totalTokens: usage.total_tokens,
      ...(usage.input_tokens_details?.cached_tokens !== undefined
        ? { cachedInputTokens: usage.input_tokens_details.cached_tokens }
        : {}),
      ...(usage.input_tokens_details?.cache_write_tokens !== undefined
        ? {
            cacheWriteInputTokens:
              usage.input_tokens_details.cache_write_tokens
          }
        : {}),
      ...(usage.output_tokens_details?.reasoning_tokens !== undefined
        ? { reasoningTokens: usage.output_tokens_details.reasoning_tokens }
        : {})
    })
  };
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

  if (
    status === 404 ||
    code === "model_not_found" ||
    code === "model_access_denied"
  ) {
    return new DesignGenerationError(
      "model_access_failed",
      "The configured AI model is unavailable to this server.",
      { cause: error }
    );
  }

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
