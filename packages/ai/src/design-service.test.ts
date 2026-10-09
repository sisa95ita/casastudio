import { describe, expect, it, vi } from "vitest";

import {
  DesignGenerationError,
  InteriorDesignService,
  type DesignRefinementRequest,
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
    },
    {
      kind: "room-interior-a",
      target: { kind: "room", projectId: "p", levelId: "l", roomId: "r" },
      image: {
        dataUrl: "data:image/png;base64,YQ==",
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
    },
    {
      kind: "room-interior-b",
      target: { kind: "room", projectId: "p", levelId: "l", roomId: "r" },
      image: {
        dataUrl: "data:image/png;base64,Yg==",
        mimeType: "image/png",
        width: 1,
        height: 1
      },
      camera: {
        projection: "perspective",
        position: { x: 1, y: 1, z: 2 },
        direction: { x: -1, y: 0, z: -1 },
        up: { x: 0, y: 1, z: 0 }
      }
    }
  ]
} as unknown as DesignRequest;

describe("InteriorDesignService", () => {
  function refinement(): DesignRefinementRequest {
    return {
      ...request,
      context: {
        project: { id: "p", revision: 2 },
        level: { id: "l" },
        room: { id: "r" }
      } as DesignRequest["context"],
      preservation: "preserve-unrequested-design",
      baseProposal: {
        id: "base",
        target: request.target,
        projectRevision: 2,
        artifact: {
          kind: "image",
          mimeType: "image/png",
          uri: "data:image/png;base64,YmFzZQ=="
        }
      }
    };
  }

  it("uses a distinct refinement operation exactly once without initial generation", async () => {
    const input = refinement();
    const provider: InteriorDesignProvider = {
      name: "fake",
      generateDesign: vi.fn(),
      refineDesign: vi
        .fn()
        .mockResolvedValue({ artifact: input.baseProposal.artifact })
    };
    const service = new InteriorDesignService(provider, {
      createId: () => "child",
      now: () => new Date()
    });
    expect((await service.refine(input)).id).toBe("child");
    expect(provider.refineDesign).toHaveBeenCalledExactlyOnceWith(input);
    expect(provider.generateDesign).not.toHaveBeenCalled();
  });

  it("rejects stale and cross-scope base/context combinations before any provider operation", async () => {
    const input = refinement();
    const provider: InteriorDesignProvider = {
      name: "fake",
      generateDesign: vi.fn(),
      refineDesign: vi.fn()
    };
    const service = new InteriorDesignService(provider, {
      createId: () => "unused",
      now: () => new Date()
    });
    await expect(
      service.refine({
        ...input,
        baseProposal: { ...input.baseProposal, projectRevision: 1 }
      })
    ).rejects.toMatchObject({ code: "stale_context" });
    for (const key of ["projectId", "levelId", "roomId"] as const) {
      await expect(
        service.refine({
          ...input,
          baseProposal: {
            ...input.baseProposal,
            target: { ...input.target, [key]: "wrong" }
          }
        })
      ).rejects.toMatchObject({ code: "unsupported_target" });
    }
    await expect(
      service.refine({
        ...input,
        context: {
          ...input.context,
          room: { ...input.context.room, id: "wrong" }
        }
      })
    ).rejects.toMatchObject({ code: "unsupported_target" });
    await expect(
      service.refine({
        ...input,
        baseProposal: {
          ...input.baseProposal,
          artifact: { ...input.baseProposal.artifact, uri: "" }
        }
      })
    ).rejects.toMatchObject({ code: "missing_reference" });
    expect(provider.refineDesign).not.toHaveBeenCalled();
    expect(provider.generateDesign).not.toHaveBeenCalled();
  });

  it("normalizes a provider result into a transient proposal", async () => {
    const provider: InteriorDesignProvider = {
      name: "fake",
      refineDesign: vi.fn(),
      generateDesign: vi.fn().mockResolvedValue({
        artifact: {
          kind: "image",
          uri: "data:image/png;base64,b3V0",
          mimeType: "image/png"
        },
        telemetry: {
          orchestrationModel: "reasoning",
          imageModel: "image",
          generationMode: "edit",
          durationMs: 1200,
          generatedAt: "2026-09-28T10:00:00.000Z",
          image: { width: 1536, height: 1024, format: "png" }
        }
      })
    };
    const service = new InteriorDesignService(provider, {
      createId: () => "proposal-1",
      now: () => new Date("2026-09-28T10:00:00.000Z")
    });

    await expect(service.generate(request)).resolves.toMatchObject({
      id: "proposal-1",
      status: "succeeded",
      providerMetadata: { provider: "fake" },
      telemetry: {
        provider: "fake",
        orchestrationModel: "reasoning",
        generationMode: "edit",
        durationMs: 1200
      }
    });
  });

  it("requires exactly one of each automatic Room reference", async () => {
    const provider: InteriorDesignProvider = {
      name: "fake",
      refineDesign: vi.fn(),
      generateDesign: vi.fn()
    };
    const service = new InteriorDesignService(provider, {
      createId: () => "unused",
      now: () => new Date()
    });

    await expect(
      service.generate({
        ...request,
        referenceViews: request.referenceViews.slice(0, 2)
      })
    ).rejects.toMatchObject({ code: "missing_reference" });
    expect(provider.generateDesign).not.toHaveBeenCalled();
  });

  it("rejects a missing visual reference before calling the provider", async () => {
    const provider: InteriorDesignProvider = {
      name: "fake",
      refineDesign: vi.fn(),
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
