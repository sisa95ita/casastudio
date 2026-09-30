import type { InteriorDesignProvider } from "@casastudio/ai";
import { createInitialProject } from "@casastudio/schema";
import { describe, expect, it, vi } from "vitest";

import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import { UnconfiguredInteriorDesignProvider } from "../unconfigured-interior-design.provider";
import { GenerateDesignProposalService } from "./generate-design-proposal.service";

const project = (() => {
  const initial = createInitialProject({
    projectId: "design-project",
    buildingId: "building",
    levelId: "ground",
    name: "Home",
    createdAt: "2026-09-28T10:00:00.000Z"
  });
  return {
    ...initial,
    building: {
      ...initial.building,
      levels: [
        {
          ...initial.building.levels[0]!,
          rooms: [
            {
              id: "living",
              name: "Living room",
              type: "LIVING_ROOM" as const,
              boundary: []
            }
          ]
        }
      ]
    }
  };
})();

const input = {
  levelId: "ground",
  roomId: "living",
  instructions: "Warm minimal design",
  referenceViews: [
    {
      kind: "room-axonometric" as const,
      target: {
        kind: "room" as const,
        projectId: "design-project",
        levelId: "ground",
        roomId: "living"
      },
      image: {
        dataUrl: "data:image/jpeg;base64,cmVm",
        mimeType: "image/jpeg" as const,
        width: 1280,
        height: 720
      },
      camera: {
        projection: "perspective" as const,
        position: { x: 1, y: 2, z: 3 },
        direction: { x: 0, y: 0, z: -1 },
        up: { x: 0, y: 1, z: 0 },
        verticalFovDegrees: 45
      }
    },
    {
      kind: "room-interior-a" as const,
      target: {
        kind: "room" as const,
        projectId: "design-project",
        levelId: "ground",
        roomId: "living"
      },
      image: {
        dataUrl: "data:image/jpeg;base64,aW50LWE=",
        mimeType: "image/jpeg" as const,
        width: 960,
        height: 720
      },
      camera: {
        projection: "perspective" as const,
        position: { x: 2, y: 2, z: 3 },
        direction: { x: -1, y: 0, z: -1 },
        up: { x: 0, y: 1, z: 0 },
        verticalFovDegrees: 45
      }
    },
    {
      kind: "room-interior-b" as const,
      target: {
        kind: "room" as const,
        projectId: "design-project",
        levelId: "ground",
        roomId: "living"
      },
      image: {
        dataUrl: "data:image/jpeg;base64,aW50LWI=",
        mimeType: "image/jpeg" as const,
        width: 960,
        height: 720
      },
      camera: {
        projection: "perspective" as const,
        position: { x: -2, y: 2, z: -3 },
        direction: { x: 1, y: 0, z: 1 },
        up: { x: 0, y: 1, z: 0 },
        verticalFovDegrees: 45
      }
    }
  ]
};

const principal = { subject: "owner", roles: [] };

function createLoader() {
  return {
    load: vi.fn().mockResolvedValue({
      loadedProject: { project },
      authorizedByRole: false
    })
  };
}

describe("GenerateDesignProposalService", () => {
  it("re-derives canonical context and leaves the loaded Project unchanged", async () => {
    const before = structuredClone(project);
    const provider: InteriorDesignProvider = {
      name: "fake",
      generateDesign: vi.fn().mockResolvedValue({
        artifact: {
          kind: "image",
          uri: "data:image/png;base64,b3V0",
          mimeType: "image/png"
        }
      })
    };
    const service = new GenerateDesignProposalService(
      createLoader() as never,
      provider
    );

    await expect(
      service.generate("design-project", input, principal as never)
    ).resolves.toMatchObject({
      status: "succeeded",
      target: { roomId: "living" },
      providerMetadata: { provider: "fake" }
    });
    expect(provider.generateDesign).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          project: expect.objectContaining({ id: "design-project" }),
          room: expect.objectContaining({ id: "living" })
        })
      })
    );
    expect(project).toEqual(before);
  });

  it("maps absent optional provider configuration to safe Problem Details", async () => {
    const service = new GenerateDesignProposalService(
      createLoader() as never,
      new UnconfiguredInteriorDesignProvider()
    );

    await expect(
      service.generate("design-project", input, principal as never)
    ).rejects.toMatchObject({
      status: 503,
      code: ApiErrorCode.AiProviderNotConfigured,
      detail:
        "AI design generation is not configured on this CasaStudio server."
    });
  });
});
