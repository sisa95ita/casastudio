import {
  DesignGenerationError,
  type DesignRequest,
  type DesignRefinementRequest,
  type InteriorDesignProvider,
  type InteriorDesignProviderResult
} from "@casastudio/ai";

import { normalizeOpenAIError } from "./openai-error";
export { normalizeOpenAIError } from "./openai-error";

import {
  buildOpenAIInteriorDesignInstructions,
  buildOpenAIInteriorDesignPrompt,
  describeOpenAIReferenceRole,
  buildOpenAIRefinementInstructions,
  buildOpenAIRefinementPrompt,
  describeOpenAIRefinementReference
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
  action?: "edit" | "generate" | "auto" | null;
  output_format?: "png" | "jpeg" | "webp" | null;
  quality?: string | null;
  size?: string | null;
}>;

export type OpenAIResponseLike = Readonly<{
  _request_id?: string | null;
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
    return this.edit(request);
  }

  async refineDesign(
    request: DesignRefinementRequest
  ): Promise<InteriorDesignProviderResult> {
    if (
      request.baseProposal.target.projectId !== request.target.projectId ||
      request.baseProposal.target.levelId !== request.target.levelId ||
      request.baseProposal.target.roomId !== request.target.roomId ||
      request.baseProposal.projectRevision !==
        request.context.project.revision ||
      !request.baseProposal.artifact.uri.startsWith(
        `data:${request.baseProposal.artifact.mimeType};base64,`
      ) ||
      !request.baseProposal.artifact.uri.split(",")[1]
    ) {
      throw new DesignGenerationError(
        "missing_reference",
        "Refinement requires a matching current persisted base Proposal image."
      );
    }
    return this.edit(request, request);
  }

  private async edit(
    request: DesignRequest,
    refinement?: DesignRefinementRequest
  ): Promise<InteriorDesignProviderResult> {
    let response: OpenAIResponseLike;
    const startedAt = this.clock.monotonicNow();
    try {
      const references = orderedReferences(request, Boolean(refinement));
      response = await this.client.create({
        model: this.configuration.reasoningModel,
        instructions: refinement
          ? buildOpenAIRefinementInstructions()
          : buildOpenAIInteriorDesignInstructions(),
        // Explicit local artifact replay is the continuation strategy. Provider IDs,
        // including expired ones, cannot affect availability or cause a second call.
        ...(refinement ? { store: false } : {}),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: refinement
                  ? buildOpenAIRefinementPrompt(refinement)
                  : buildOpenAIInteriorDesignPrompt(request)
              },
              ...(refinement
                ? [
                    {
                      type: "input_text",
                      text: "REFERENCE 1 — PREVIOUS PROPOSAL — PRIMARY BASE IMAGE TO EDIT. Current visual design state, not canonical geometry."
                    },
                    {
                      type: "input_image",
                      image_url: refinement.baseProposal.artifact.uri,
                      detail: "high"
                    }
                  ]
                : []),
              ...references.flatMap((reference) => [
                {
                  type: "input_text",
                  text: refinement
                    ? describeOpenAIRefinementReference(reference.kind)
                    : describeOpenAIReferenceRole(reference.kind)
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
            action: "edit",
            partial_images: 0,
            quality: this.configuration.imageQuality,
            size: this.configuration.imageSize,
            output_format: this.configuration.imageFormat
          }
        ],
        tool_choice: { type: "image_generation" },
        max_tool_calls: 1,
        parallel_tool_calls: false
      });
    } catch (error) {
      throw normalizeOpenAIError(error, this.clock.now());
    }

    const imageCalls = response.output?.filter(
      (item): item is OpenAIImageGenerationCall =>
        item.type === "image_generation_call"
    );
    if (imageCalls?.length !== 1) {
      throw new DesignGenerationError(
        "invalid_provider_response",
        "The AI provider must return exactly one edited image."
      );
    }
    const imageCall = imageCalls[0]!;
    if (refinement && imageCall.action === "generate") {
      throw new DesignGenerationError(
        "invalid_provider_response",
        "The AI provider returned a new generation instead of editing the saved design."
      );
    }
    if (
      !imageCall.result ||
      (imageCall.status && imageCall.status !== "completed")
    ) {
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
        generationMode: "edit",
        durationMs: Math.max(
          0,
          Math.round(this.clock.monotonicNow() - startedAt)
        ),
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

function orderedReferences(request: DesignRequest, refine = false) {
  // Edit mode must never silently substitute another view for the base image.
  const required = ["room-interior-a", "room-axonometric", "room-interior-b"];
  if (
    required.some(
      (kind) =>
        request.referenceViews.filter((view) => view.kind === kind).length !== 1
    ) ||
    request.referenceViews.some(
      (view) =>
        !view.image.dataUrl.startsWith(`data:${view.image.mimeType};base64,`) ||
        !view.image.dataUrl.split(",")[1] ||
        view.target.projectId !== request.target.projectId ||
        view.target.levelId !== request.target.levelId ||
        view.target.roomId !== request.target.roomId
    )
  ) {
    throw new DesignGenerationError(
      "missing_reference",
      "Room editing requires Interior A as the base image and valid matching architectural references."
    );
  }
  const priority = new Map([
    ["room-interior-a", refine ? 1 : 0],
    ["room-axonometric", refine ? 0 : 1],
    ["room-interior-b", 2],
    ["current-user-view", 3]
  ]);
  return [...request.referenceViews].sort(
    (left, right) =>
      (priority.get(left.kind) ?? Number.MAX_SAFE_INTEGER) -
      (priority.get(right.kind) ?? Number.MAX_SAFE_INTEGER)
  );
}

function parseImageSize(size: string): {
  readonly width?: number;
  readonly height?: number;
} {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return {};
  return { width: Number(match[1]), height: Number(match[2]) };
}

function normalizeUsage(usage: OpenAIResponseLike["usage"]):
  | {
      readonly usage: NonNullable<
        InteriorDesignProviderResult["telemetry"]
      >["usage"];
    }
  | Record<string, never> {
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
            cacheWriteInputTokens: usage.input_tokens_details.cache_write_tokens
          }
        : {}),
      ...(usage.output_tokens_details?.reasoning_tokens !== undefined
        ? { reasoningTokens: usage.output_tokens_details.reasoning_tokens }
        : {})
    })
  };
}
