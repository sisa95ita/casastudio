import { describe, expect, it } from "vitest";

import type { Project } from "../project";
import { validateProjectRenderability } from "./renderability";
import { ValidationErrorCode } from "./validation-error-code";

const createRenderableProject = (): Project => ({
  id: "casa-simone",
  name: "Casa Simone",
  schemaVersion: "1.0.0",
  revision: 1,
  createdAt: "2026-07-11T15:30:00+02:00",
  updatedAt: "2026-07-11T15:30:00+02:00",
  units: {
    length: "cm",
    angle: "deg"
  },
  building: {
    id: "main-building",
    name: "Main Building",
    type: "HOUSE",
    levels: []
  },
  viewpoints: [
    {
      id: "living-tv-view",
      levelId: "ground-level",
      cameraPosition: { x: 250, y: 165, z: 320 },
      cameraTarget: { x: 250, y: 120, z: 120 },
      fieldOfView: 60,
      projection: "PERSPECTIVE"
    }
  ],
  baseImages: [
    {
      id: "base-image-living-tv-001",
      viewpointId: "living-tv-view",
      assetRef: "assets/base-images/living-tv-001.png",
      projectRevision: 1,
      createdAt: "2026-07-11T16:00:00+02:00"
    }
  ],
  designBriefs: [
    {
      id: "warm-industrial-living",
      promptText: "Design a warm industrial living room.",
      constraints: [],
      palette: [],
      referenceAssetRefs: []
    }
  ],
  renderRequests: [
    {
      id: "render-request-001",
      viewpointId: "living-tv-view",
      baseImageId: "base-image-living-tv-001",
      designBriefId: "warm-industrial-living",
      status: "PENDING",
      createdAt: "2026-07-11T16:05:00+02:00"
    }
  ],
  renderResults: []
});

const getFirst = <Item>(items: Item[], label: string): Item => {
  const item = items.at(0);

  if (!item) {
    throw new Error(`Test fixture is missing ${label}.`);
  }

  return item;
};

describe("validateProjectRenderability", () => {
  it("returns valid true for a renderable Project", () => {
    const result = validateProjectRenderability(createRenderableProject());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("reports a Project without viewpoints", () => {
    const project = createRenderableProject();
    project.viewpoints = [];

    const result = validateProjectRenderability(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map((error) => error.code)).toEqual([
      ValidationErrorCode.PROJECT_HAS_NO_VIEWPOINTS,
      ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE
    ]);
    expect(result.errors.map((error) => error.path)).toEqual(["viewpoints", "renderRequests[0].viewpointId"]);
  });

  it("reports a viewpoint without a base image", () => {
    const project = createRenderableProject();
    const viewpoint = getFirst(project.viewpoints, "viewpoint");
    const baseImage = getFirst(project.baseImages, "baseImage");

    baseImage.viewpointId = "other-viewpoint";

    const result = validateProjectRenderability(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.VIEWPOINT_HAS_NO_BASE_IMAGE,
        path: "viewpoints[0]"
      }
    ]);
    expect(result.errors[0]?.message).toContain(viewpoint.id);
  });

  it("reports a Project without design briefs", () => {
    const project = createRenderableProject();
    project.designBriefs = [];

    const result = validateProjectRenderability(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map((error) => error.code)).toEqual([
      ValidationErrorCode.PROJECT_HAS_NO_DESIGN_BRIEFS,
      ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE
    ]);
    expect(result.errors.map((error) => error.path)).toEqual(["designBriefs", "renderRequests[0].designBriefId"]);
  });

  it("reports a Project without render requests", () => {
    const project = createRenderableProject();
    project.renderRequests = [];

    const result = validateProjectRenderability(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.PROJECT_HAS_NO_RENDER_REQUESTS,
        path: "renderRequests"
      }
    ]);
  });

  it("reports a render request referencing a missing viewpoint", () => {
    const project = createRenderableProject();
    const renderRequest = getFirst(project.renderRequests, "renderRequest");

    renderRequest.viewpointId = "missing-viewpoint";

    const result = validateProjectRenderability(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE,
        path: "renderRequests[0].viewpointId"
      }
    ]);
  });

  it("reports a render request referencing a missing base image", () => {
    const project = createRenderableProject();
    const renderRequest = getFirst(project.renderRequests, "renderRequest");

    renderRequest.baseImageId = "missing-base-image";

    const result = validateProjectRenderability(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE,
        path: "renderRequests[0].baseImageId"
      }
    ]);
  });

  it("reports a render request referencing a missing design brief", () => {
    const project = createRenderableProject();
    const renderRequest = getFirst(project.renderRequests, "renderRequest");

    renderRequest.designBriefId = "missing-design-brief";

    const result = validateProjectRenderability(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors).toMatchObject([
      {
        code: ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE,
        path: "renderRequests[0].designBriefId"
      }
    ]);
  });

  it("collects multiple simultaneous renderability errors", () => {
    const project = createRenderableProject();
    const renderRequest = getFirst(project.renderRequests, "renderRequest");

    project.viewpoints = [];
    project.designBriefs = [];
    project.renderRequests.push({
      ...renderRequest,
      id: "render-request-002",
      viewpointId: "missing-viewpoint",
      baseImageId: "missing-base-image",
      designBriefId: "missing-design-brief"
    });

    const result = validateProjectRenderability(project);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(7);
    expect(result.errors.map((error) => error.code)).toEqual([
      ValidationErrorCode.PROJECT_HAS_NO_VIEWPOINTS,
      ValidationErrorCode.PROJECT_HAS_NO_DESIGN_BRIEFS,
      ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE,
      ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE,
      ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE,
      ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE,
      ValidationErrorCode.RENDER_REQUEST_NOT_RENDERABLE
    ]);
    expect(result.errors.map((error) => error.path)).toEqual([
      "viewpoints",
      "designBriefs",
      "renderRequests[0].viewpointId",
      "renderRequests[0].designBriefId",
      "renderRequests[1].viewpointId",
      "renderRequests[1].baseImageId",
      "renderRequests[1].designBriefId"
    ]);
  });
});
