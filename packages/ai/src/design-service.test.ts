import { describe, expect, it, vi } from "vitest";

import {
  DesignGenerationError,
  InteriorDesignService,
  type DesignRequest,
  type InteriorDesignProvider
} from "./index.js";

const request = {
  target: { kind: "room", projectId: "p", levelId: "l", roomId: "r" },
  instructions: "Warm minimal design",
  context: {},
  referenceViews: [
    {
      kind: "room-axonometric",
      target: { kind: "room", projectId: "p", levelId: "l", roomId: "r" },
      image: {
        dataUrl: "data:image/png;base64,cG5n",
        mimeType: "image/png",
        width: 1,
        height: 1
      },
      camera: {
        projection: "perspective",
        position: { x: 0, y: 1, z: 2 },
        direction: { x: 0, y: 0, z: -1 },
        up: { x: 0, y: 1, z: 0 }
      }
    }
  ]
} as unknown as DesignRequest;

describe("InteriorDesignService", () => {
  it("normalizes a provider result into a transient proposal", async () => {
    const provider: InteriorDesignProvider = {
      name: "fake",
      generateDesign: vi.fn().mockResolvedValue({
        artifact: {
          kind: "image",
          uri: "data:image/png;base64,b3V0",
          mimeType: "image/png"
        },
        requestId: "provider-request"
      })
    };
    const service = new InteriorDesignService(provider, {
      createId: () => "proposal-1",
      now: () => new Date("2026-09-28T10:00:00.000Z")
    });

    await expect(service.generate(request)).resolves.toMatchObject({
      id: "proposal-1",
      status: "succeeded",
      providerMetadata: { provider: "fake", requestId: "provider-request" }
    });
  });

  it("rejects a missing visual reference before calling the provider", async () => {
    const provider: InteriorDesignProvider = {
      name: "fake",
      generateDesign: vi.fn()
    };
    const service = new InteriorDesignService(provider, {
      createId: () => "unused",
      now: () => new Date()
    });
    const missing = {
      ...request,
      referenceViews: [
        {
          ...request.referenceViews[0]!,
          image: { ...request.referenceViews[0]!.image, dataUrl: "" }
        }
      ]
    };

    await expect(service.generate(missing)).rejects.toBeInstanceOf(
      DesignGenerationError
    );
    expect(provider.generateDesign).not.toHaveBeenCalled();
  });
});
