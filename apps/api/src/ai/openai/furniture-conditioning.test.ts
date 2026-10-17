import { deriveDesignContext } from "@casastudio/ai";
import {
  createInitialProject,
  ProjectSchema,
  type Project
} from "@casastudio/schema";
import { describe, expect, it, vi } from "vitest";
import { KeycloakRole } from "../../auth/keycloak-role";
import { AuthorizedProjectLoader } from "../../projects/application/authorized-project-loader.service";
import { ProjectReadAuthorizationPolicy } from "../../projects/application/project-read-authorization.policy";
import { GenerateDesignProposalService } from "../application/generate-design-proposal.service";
import {
  fixtureArtifact,
  input,
  jpegArtifact,
  pngBase64,
  webpArtifact
} from "../test/design-fixture";
import { OpenAIInteriorDesignProvider } from "./openai-interior-design.provider";

// Synthetic layout unrelated to the owner's acceptance Project. Nonzero origin,
// three distinct categories/yaws and Room/Level distractors expose spatial loss.
function syntheticProject(): Project {
  const project = createInitialProject({
    projectId: input.referenceViews[0]!.target.projectId,
    buildingId: "conditioning-building",
    levelId: input.levelId,
    name: "Synthetic conditioning",
    createdAt: "2026-10-01T00:00:00.000Z"
  });
  project.revision = 7;
  const level = project.building.levels[0]!;
  const points = [
    { x: -200, z: 500 },
    { x: 400, z: 500 },
    { x: 400, z: 1000 },
    { x: -200, z: 1000 }
  ];
  level.rooms = [
    {
      id: input.roomId,
      name: "Synthetic lounge",
      type: "LIVING_ROOM",
      boundary: points.map((start, index) => ({
        kind: "FREE" as const,
        start,
        end: points[(index + 1) % points.length]!
      }))
    },
    { id: "excluded-room", name: "Other", type: "OTHER", boundary: [] }
  ];
  project.building.levels.push({
    ...level,
    id: "excluded-level",
    elevation: 300,
    rooms: [{ id: "upstairs-room", name: "Upper", type: "OTHER", boundary: [] }]
  });
  project.building.furniture = [
    {
      id: "a",
      roomId: input.roomId,
      definitionId: "generic-sofa",
      position: { x: -80, z: 600 },
      rotation: 90,
      width: 190,
      depth: 85,
      height: 82
    },
    {
      id: "b",
      roomId: input.roomId,
      definitionId: "generic-dining-table",
      position: { x: 100, z: 620 },
      rotation: 0,
      width: 140,
      depth: 80,
      height: 74
    },
    {
      id: "c",
      roomId: input.roomId,
      definitionId: "generic-cabinet",
      position: { x: 260, z: 780 },
      rotation: -30,
      width: 95,
      depth: 42,
      height: 165
    },
    {
      id: "excluded-furniture",
      roomId: "excluded-room",
      definitionId: "generic-chair",
      position: { x: 100, z: 620 },
      rotation: 0,
      width: 45,
      depth: 50,
      height: 85
    },
    {
      id: "upstairs-furniture",
      roomId: "upstairs-room",
      definitionId: "generic-chair",
      position: { x: 100, z: 620 },
      rotation: 0,
      width: 45,
      depth: 50,
      height: 85
    }
  ];
  return project;
}

const configuration = {
  reasoningModel: "mock-orchestrator",
  imageModel: "mock-image",
  imageQuality: "medium" as const,
  imageSize: "1536x1024",
  imageFormat: "png" as const
};

describe("canonical Furniture at the final mocked Responses boundary", () => {
  it.each([
    "Use soft green upholstery and warm lighting.",
    "Move only the dining table nearer the cabinet."
  ])(
    "reloads and preserves canonical facts with direction: %s",
    async (instructions) => {
      const project = syntheticProject();
      expect(ProjectSchema.parse(project)).toEqual(project);
      const before = structuredClone(project);
      const principal = {
        subject: "synthetic-owner",
        roles: [KeycloakRole.User]
      };
      const repository = {
        findLoadedByDomainId: vi.fn().mockResolvedValue({
          project,
          metadata: { ownerSubject: principal.subject }
        })
      };
      const loader = new AuthorizedProjectLoader(
        repository as never,
        new ProjectReadAuthorizationPolicy()
      );
      const create = vi.fn().mockResolvedValue({
        output: [
          {
            type: "image_generation_call",
            result: pngBase64,
            action: "edit"
          }
        ]
      });
      const persist = vi.fn(async (proposal) => proposal);
      const service = new GenerateDesignProposalService(
        loader,
        new OpenAIInteriorDesignProvider(configuration, { create }),
        { persist } as never
      );
      const artifacts = [fixtureArtifact, jpegArtifact, webpArtifact];
      const referenceViews = input.referenceViews.map((view, index) => ({
        ...view,
        image: {
          ...view.image,
          dataUrl: artifacts[index]!.uri,
          mimeType: artifacts[index]!.mimeType
        }
      }));
      await service.generate(
        project.id,
        { ...input, instructions, referenceViews },
        principal
      );
      expect(repository.findLoadedByDomainId).toHaveBeenCalledExactlyOnceWith(
        project.id
      );
      expect(create).toHaveBeenCalledTimes(1);
      const sent = create.mock.calls[0]![0];
      expect(sent).toMatchObject({
        model: configuration.reasoningModel,
        tools: [
          {
            type: "image_generation",
            model: configuration.imageModel,
            action: "edit",
            partial_images: 0,
            quality: "medium",
            size: "1536x1024",
            output_format: "png"
          }
        ],
        tool_choice: { type: "image_generation" },
        max_tool_calls: 1,
        parallel_tool_calls: false
      });
      const context = deriveDesignContext(
        project,
        input.referenceViews[0]!.target
      );
      expect(context.furniture.map((item) => item.id)).toEqual(["a", "b", "c"]);
      for (const item of context.furniture) {
        const canonical = project.building.furniture.find(
          (candidate) => candidate.id === item.id
        )!;
        expect(item).toMatchObject({
          definitionId: canonical.definitionId,
          position: canonical.position,
          rotationDegrees: canonical.rotation,
          width: canonical.width,
          depth: canonical.depth,
          height: canonical.height,
          roomLocalPosition: {
            x: canonical.position.x + 200,
            z: canonical.position.z - 500
          }
        });
      }
      const content = sent.input[0].content;
      const prompt = content[0].text;
      for (const fact of [
        "translation only, axes unchanged",
        "+90 turns width toward -Z and depth toward +X",
        "B1 (free): (0, 0) to (600, 0)",
        "definition generic-sofa, category SOFA; center (120, 100); rotation 90 deg; footprint width 190 × depth 85, height 82 cm",
        "definition generic-dining-table, category TABLE; center (300, 120); rotation 0 deg; footprint width 140 × depth 80, height 74 cm",
        "definition generic-cabinet, category CABINET; center (460, 280); rotation -30 deg; footprint width 95 × depth 42, height 165 cm",
        "Nearest boundary B1: center-to-segment distance 100 cm; width axis perpendicular",
        "Nearest boundary B2: center-to-segment distance 140 cm; width axis oblique",
        "F1 / F2: centers separated by 181.11 cm; width axes perpendicular",
        "LOCAL SPATIAL CONTEXT",
        "USER DESIGN DIRECTION",
        instructions,
        "canonical Furniture layout is still preserved by default"
      ])
        expect(prompt).toContain(fact);
      expect(prompt).not.toContain("category CHAIR");
      for (const contract of [
        "LEVEL 1 — ARCHITECTURE",
        "LEVEL 2 — CANONICAL FURNITURE LAYOUT",
        "canonical position",
        "orientation/rotation",
        "approximate footprint/dimensions",
        "LEVEL 3 — VISUAL DESIGN",
        "do not authorize rearrangement",
        "may override only the requested items/relationships visually"
      ])
        expect(sent.instructions).toContain(contract);
      expect(
        content
          .filter((part: { type: string }) => part.type === "input_image")
          .map((part: { image_url: string; detail: string }) => ({
            image_url: part.image_url,
            detail: part.detail
          }))
      ).toEqual(
        [referenceViews[1]!, referenceViews[0]!, referenceViews[2]!].map(
          (view) => ({ image_url: view.image.dataUrl, detail: "high" })
        )
      );
      expect(content[1].text).toContain("INTERIOR A — BASE IMAGE TO EDIT");
      expect(content[3].text).toContain(
        "AXONOMETRIC — STRUCTURAL / LAYOUT EVIDENCE ONLY"
      );
      expect(content[5].text).toContain(
        "INTERIOR B — COMPLEMENTARY ARCHITECTURE / FURNITURE EVIDENCE ONLY"
      );
      expect(persist).toHaveBeenCalledWith(
        expect.anything(),
        7,
        instructions,
        context,
        referenceViews
      );
      expect(project).toEqual(before);
    }
  );

  it("does not reach OpenAI for another owner", async () => {
    const project = syntheticProject();
    const loader = new AuthorizedProjectLoader(
      {
        findLoadedByDomainId: vi.fn().mockResolvedValue({
          project,
          metadata: { ownerSubject: "another-owner" }
        })
      } as never,
      new ProjectReadAuthorizationPolicy()
    );
    const create = vi.fn();
    const persist = vi.fn();
    const service = new GenerateDesignProposalService(
      loader,
      new OpenAIInteriorDesignProvider(configuration, { create }),
      { persist } as never
    );
    await expect(
      service.generate(project.id, input, {
        subject: "synthetic-owner",
        roles: [KeycloakRole.User]
      })
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});
