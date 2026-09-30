import type { DesignReferenceViewKind, DesignRequest } from "@casastudio/ai";
import { describe, expect, it, vi } from "vitest";

import { UnconfiguredInteriorDesignProvider } from "../unconfigured-interior-design.provider";
import {
  buildOpenAIInteriorDesignInstructions,
  buildOpenAIInteriorDesignPrompt
} from "./openai-prompt-builder";
import {
  OpenAIInteriorDesignProvider,
  type OpenAIResponsesClient
} from "./openai-interior-design.provider";

const target = {
  kind: "room" as const,
  projectId: "project-secret-id",
  levelId: "ground",
  roomId: "living"
};

function reference(kind: DesignReferenceViewKind, marker: string) {
  return {
    kind,
    target,
    image: {
      dataUrl: `data:image/jpeg;base64,${marker}`,
      mimeType: "image/jpeg" as const,
      width: 960,
      height: 720
    },
    camera: {
      projection: "perspective" as const,
      position: { x: 2, y: 1.5, z: 2 },
      direction: { x: -1, y: 0, z: -1 },
      up: { x: 0, y: 1, z: 0 },
      verticalFovDegrees: 58
    }
  };
}

const request = {
  target,
  instructions: "Make it warm and minimal.",
  context: {
    project: { id: "project-secret-id", name: "Home", revision: 2 },
    level: { id: "ground", name: "Ground", elevation: 0 },
    room: {
      id: "living",
      name: "Living",
      type: "LIVING_ROOM",
      elevation: 0,
      floorElevation: 0,
      area: 120000,
      boundary: [
        {
          kind: "wall",
          wallId: "north",
          start: { x: 0, z: 0 },
          end: { x: 400, z: 0 }
        }
      ],
      extents: {
        minX: 0,
        minZ: 0,
        maxX: 400,
        maxZ: 300,
        width: 400,
        depth: 300
      }
    },
    walls: [
      {
        id: "north",
        name: "North wall",
        start: { x: 0, z: 0 },
        end: { x: 400, z: 0 },
        height: 270,
        thickness: 20,
        openings: [
          {
            id: "window-1",
            type: "window",
            offsetFromWallStart: 100,
            width: 120,
            height: 120,
            sillElevation: 90
          }
        ]
      }
    ],
    stairs: [],
    furniture: [],
    units: { length: "cm", angle: "deg" },
    coordinateSystem: {
      handedness: "right-handed",
      horizontalAxes: "X/Z",
      elevationAxis: "+Y"
    }
  },
  referenceViews: [
    reference("room-axonometric", "YXhv"),
    reference("room-interior-b", "aW50LWI="),
    reference("room-interior-a", "aW50LWE=")
  ]
} satisfies DesignRequest;

const configuration = {
  reasoningModel: "gpt-5.6-sol",
  imageModel: "gpt-image-2.5-flare",
  imageQuality: "medium" as const,
  imageSize: "1536x1024",
  imageFormat: "png" as const
};

describe("OpenAIInteriorDesignProvider", () => {
  it("labels all references by role, prioritizes interior A, and uses configured output settings", async () => {
    const client: OpenAIResponsesClient = {
      create: vi.fn().mockResolvedValue({
        model: "gpt-5.6-sol-2026-09-15",
        output: [
          {
            type: "image_generation_call",
            status: "completed",
            result: "Z2VuZXJhdGVk",
            output_format: "png",
            quality: "medium",
            size: "1536x1024"
          }
        ],
        usage: {
          input_tokens: 700,
          output_tokens: 1600,
          total_tokens: 2300,
          input_tokens_details: {
            cached_tokens: 100,
            cache_write_tokens: 25
          },
          output_tokens_details: { reasoning_tokens: 80 }
        }
      })
    };
    const monotonicNow = vi
      .fn<() => number>()
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(2_234.4);
    const provider = new OpenAIInteriorDesignProvider(configuration, client, {
      monotonicNow,
      now: () => new Date("2026-09-30T10:15:00.000Z")
    });

    await expect(provider.generateDesign(request)).resolves.toEqual({
      artifact: {
        kind: "image",
        uri: "data:image/png;base64,Z2VuZXJhdGVk",
        mimeType: "image/png",
        width: 1536,
        height: 1024
      },
      telemetry: {
        orchestrationModel: "gpt-5.6-sol-2026-09-15",
        imageModel: "gpt-image-2.5-flare",
        durationMs: 1234,
        generatedAt: "2026-09-30T10:15:00.000Z",
        image: {
          width: 1536,
          height: 1024,
          format: "png",
          quality: "medium"
        },
        usage: {
          inputTokens: 700,
          outputTokens: 1600,
          totalTokens: 2300,
          cachedInputTokens: 100,
          cacheWriteInputTokens: 25,
          reasoningTokens: 80
        }
      }
    });

    const sent = vi.mocked(client.create).mock.calls[0]![0] as {
      instructions: string;
      input: readonly { content: readonly Record<string, unknown>[] }[];
      tools: readonly Record<string, unknown>[];
      tool_choice: unknown;
    };
    expect(sent.tools).toEqual([
      {
        type: "image_generation",
        model: "gpt-image-2.5-flare",
        action: "generate",
        quality: "medium",
        size: "1536x1024",
        output_format: "png"
      }
    ]);
    expect(sent.tool_choice).toEqual({ type: "image_generation" });
    const content = sent.input[0]!.content;
    const labels = content
      .filter((item) => item.type === "input_text")
      .map((item) => item.text);
    const images = content
      .filter((item) => item.type === "input_image")
      .map((item) => item.image_url);
    expect(labels).toEqual([
      expect.stringContaining("CASASTUDIO STRUCTURED ROOM CONTEXT"),
      expect.stringContaining("PRIMARY OUTPUT VIEW"),
      expect.stringContaining("STRUCTURAL/LAYOUT REFERENCE"),
      expect.stringContaining("SUPPORTING GEOMETRY")
    ]);
    expect(images).toEqual([
      request.referenceViews[2]!.image.dataUrl,
      request.referenceViews[0]!.image.dataUrl,
      request.referenceViews[1]!.image.dataUrl
    ]);
    expect(sent.instructions).toContain("All supplied reference images describe the SAME selected Room");
  });

  it("omits usage and estimated cost when the provider does not report enough data", async () => {
    const provider = new OpenAIInteriorDesignProvider(
      configuration,
      {
        create: vi.fn().mockResolvedValue({
          output: [
            { type: "image_generation_call", result: "aW1hZ2U=" }
          ]
        })
      },
      {
        monotonicNow: vi
          .fn<() => number>()
          .mockReturnValueOnce(10)
          .mockReturnValueOnce(20),
        now: () => new Date("2026-09-30T10:15:00.000Z")
      }
    );

    const result = await provider.generateDesign(request);
    expect(result.telemetry?.usage).toBeUndefined();
    expect(result.telemetry?.estimatedCost).toBeUndefined();
  });

  it("normalizes provider and model-access errors without exposing raw messages", async () => {
    const rateLimited = new OpenAIInteriorDesignProvider(configuration, {
      create: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("secret upstream detail"), { status: 429 })
        )
    });
    await expect(rateLimited.generateDesign(request)).rejects.toMatchObject({
      code: "rate_limited",
      message: "The AI provider is rate limited. Try again later."
    });

    const missingModel = new OpenAIInteriorDesignProvider(configuration, {
      create: vi.fn().mockRejectedValue({ status: 404, message: "model secret" })
    });
    await expect(missingModel.generateDesign(request)).rejects.toMatchObject({
      code: "model_access_failed",
      message: "The configured AI model is unavailable to this server."
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
  it("keeps architecture authoritative and user direction in a separate section", () => {
    const instructions = buildOpenAIInteriorDesignInstructions();
    const prompt = buildOpenAIInteriorDesignPrompt(request);

    for (const concept of [
      "Walls",
      "Doors",
      "Windows",
      "Wall Openings",
      "Stairs",
      "not ARCHITECTURAL REDESIGN"
    ]) {
      expect(instructions).toContain(concept);
    }
    expect(prompt).toContain("USER DESIGN DIRECTION\n\nMake it warm and minimal.");
    expect(instructions).not.toContain("Make it warm and minimal.");
  });

  it("describes useful Room facts without dumping IDs or arbitrary Project JSON", () => {
    const prompt = buildOpenAIInteriorDesignPrompt(request);

    expect(prompt).toContain("Approximate plan extents: 400 × 300 cm");
    expect(prompt).toContain("1 Windows");
    expect(prompt).toContain("window 120w × 120h");
    expect(prompt).not.toContain("project-secret-id");
    expect(prompt).not.toContain('"coordinateSystem"');
    expect(prompt).not.toContain(JSON.stringify(request.context));
  });
});
