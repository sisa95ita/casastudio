import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { AiModule } from "./ai.module";
import { INTERIOR_DESIGN_PROVIDER } from "./interior-design-provider.token";
import { OpenAIInteriorDesignProvider } from "./openai/openai-interior-design.provider";
import { UnconfiguredInteriorDesignProvider } from "./unconfigured-interior-design.provider";

const sdk = vi.hoisted(() => ({ constructor: vi.fn(), create: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { create: sdk.create };
    constructor(options: unknown) {
      sdk.constructor(options);
    }
  }
}));

describe("AI provider factory budget policy", () => {
  it("disables SDK retries for paid image editing and permits configuration without a live key", async () => {
    const module = await Test.createTestingModule({
      providers: [
        ...Reflect.getMetadata("providers", AiModule).filter(
          (provider: { provide?: unknown }) =>
            provider.provide === INTERIOR_DESIGN_PROVIDER
        ),
        {
          provide: ConfigService,
          useValue: {
            get: () => ({
              provider: "openai",
              openai: {
                apiKey: "mock-key-not-live",
                reasoningModel: "gpt-5.6-sol",
                imageModel: "gpt-image-2.5-sunburst",
                imageQuality: "medium",
                imageSize: "1536x1024",
                imageFormat: "png"
              }
            })
          }
        }
      ]
    }).compile();
    expect(module.get(INTERIOR_DESIGN_PROVIDER)).toBeInstanceOf(
      OpenAIInteriorDesignProvider
    );
    expect(sdk.constructor).toHaveBeenCalledWith({
      apiKey: "mock-key-not-live",
      timeout: 180_000,
      maxRetries: 0
    });
    expect(sdk.create).not.toHaveBeenCalled();
    await module.close();
  });

  it("does not construct the SDK when no API key is configured", async () => {
    sdk.constructor.mockClear();
    const module = await Test.createTestingModule({
      providers: [
        ...Reflect.getMetadata("providers", AiModule).filter(
          (provider: { provide?: unknown }) =>
            provider.provide === INTERIOR_DESIGN_PROVIDER
        ),
        {
          provide: ConfigService,
          useValue: { get: () => ({ provider: "openai", openai: {} }) }
        }
      ]
    }).compile();
    expect(module.get(INTERIOR_DESIGN_PROVIDER)).toBeInstanceOf(
      UnconfiguredInteriorDesignProvider
    );
    expect(sdk.constructor).not.toHaveBeenCalled();
    expect(sdk.create).not.toHaveBeenCalled();
    await module.close();
  });
});
