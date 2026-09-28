import type { DesignRequest } from "@casastudio/ai";
import { describe, expect, it, vi } from "vitest";

import {
  buildOpenAIInteriorDesignInstructions,
  buildOpenAIInteriorDesignPrompt
} from "./openai-prompt-builder";
import {
  OpenAIInteriorDesignProvider,
  type OpenAIResponsesClient
} from "./openai-interior-design.provider";
import { UnconfiguredInteriorDesignProvider } from "../unconfigured-interior-design.provider";

const request = {
  target: {
    kind: "room",
    projectId: "project",
    levelId: "ground",
    roomId: "living"
  },
  instructions: "Make it warm and minimal.",
  context: {
    project: { id: "project", name: "Home", revision: 2 },
    level: { id: "ground", name: "Ground", elevation: 0 },
    room: {
      id: "living",
      name: "Living",
      type: "LIVING_ROOM",
      elevation: 0,
      floorElevation: 0,
      boundary: []
    },
    walls: [],
    stairs: [],
    furniture: [],
    units: { length: "cm", angle: "deg" },
    coordinateSystem: {
      handedness: "right-handed",
      horizontalAxes: "X/Z",
      elevationAxis: "+Y"
    }
  },
  referenceView: {
    image: {
      dataUrl: "data:image/jpeg;base64,cmVm",
      mimeType: "image/jpeg",
      width: 1280,
      height: 720
    },
    camera: {
      projection: "perspective",
      position: { x: 1, y: 2, z: 3 },
      direction: { x: 0, y: 0, z: -1 },
      up: { x: 0, y: 1, z: 0 },
      verticalFovDegrees: 45
    }
  }
} satisfies DesignRequest;

describe("OpenAIInteriorDesignProvider", () => {
  it("uses Responses image generation and normalizes the image artifact", async () => {
    const client: OpenAIResponsesClient = {
      create: vi.fn().mockResolvedValue({
        id: "resp_123",
        output: [
          {
            type: "image_generation_call",
            id: "ig_123",
            status: "completed",
            result: "Z2VuZXJhdGVk"
          }
        ]
      })
    };
    const provider = new OpenAIInteriorDesignProvider(
      {
        reasoningModel: "gpt-5.6-sol",
        imageModel: "gpt-image-2.5-sunburst"
      },
      client
    );

    await expect(provider.generateDesign(request)).resolves.toEqual({
      artifact: {
        kind: "image",
        uri: "data:image/png;base64,Z2VuZXJhdGVk",
        mimeType: "image/png"
      },
      requestId: "resp_123",
      continuation: { previousResponseId: "resp_123" }
    });
    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-sol",
        tools: [
          {
            type: "image_generation",
            model: "gpt-image-2.5-sunburst",
            action: "generate"
          }
        ],
        input: [
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                type: "input_image",
                image_url: request.referenceView.image.dataUrl
              })
            ])
          })
        ]
      })
    );
  });

  it("normalizes provider errors without exposing their raw message", async () => {
    const client: OpenAIResponsesClient = {
      create: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("secret upstream detail"), { status: 429 })
        )
    };
    const provider = new OpenAIInteriorDesignProvider(
      { reasoningModel: "reasoning", imageModel: "image" },
      client
    );

    await expect(provider.generateDesign(request)).rejects.toMatchObject({
      code: "rate_limited",
      message: "The AI provider is rate limited. Try again later."
    });
  });

  it("reports optional provider configuration as a stable failure", async () => {
    await expect(
      new UnconfiguredInteriorDesignProvider().generateDesign(request)
    ).rejects.toMatchObject({
      code: "provider_not_configured",
      message:
        "AI design generation is not configured on this CasaStudio server."
    });
  });
});

describe("OpenAI prompt builder", () => {
  it("keeps architectural truth guardrails deterministic and provider-owned", () => {
    expect(buildOpenAIInteriorDesignInstructions()).toContain(
      "never add, remove, resize, or move structural elements"
    );
    expect(buildOpenAIInteriorDesignPrompt(request)).toContain(
      "Make it warm and minimal"
    );
    expect(buildOpenAIInteriorDesignPrompt(request)).toContain(
      '"horizontalAxes":"X/Z"'
    );
  });
});
