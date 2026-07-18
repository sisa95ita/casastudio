import { describe, expect, it } from "vitest";

import { ProjectSchema } from "./project";

const validBuilding = {
  id: "main-building",
  name: "Main Building",
  type: "HOUSE",
  levels: []
};

const validViewpoint = {
  id: "living-tv-view",
  levelId: "ground-level",
  cameraPosition: { x: 250, y: 165, z: 320 },
  cameraTarget: { x: 250, y: 120, z: 120 },
  fieldOfView: 60,
  projection: "PERSPECTIVE"
};

const validBaseImage = {
  id: "base-image-living-tv-001",
  viewpointId: "living-tv-view",
  assetRef: "assets/base-images/living-tv-001.png",
  projectRevision: 1,
  createdAt: "2026-07-11T16:00:00+02:00"
};

const validDesignBrief = {
  id: "warm-industrial-living",
  promptText: "Design a warm industrial living room.",
  constraints: [],
  palette: [],
  referenceAssetRefs: []
};

const validRenderRequest = {
  id: "render-request-001",
  viewpointId: "living-tv-view",
  baseImageId: "base-image-living-tv-001",
  designBriefId: "warm-industrial-living",
  status: "PENDING",
  createdAt: "2026-07-11T16:05:00+02:00"
};

const validRenderResult = {
  id: "render-result-001",
  renderRequestId: "render-request-001",
  status: "SUCCEEDED",
  createdAt: "2026-07-11T16:05:45+02:00",
  assetRef: "assets/renders/render-result-001.png"
};

const validMinimalProject = {
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
  building: validBuilding,
  viewpoints: [],
  baseImages: [],
  designBriefs: [],
  renderRequests: [],
  renderResults: []
};

const validProjectWithCollections = {
  ...validMinimalProject,
  viewpoints: [validViewpoint],
  baseImages: [validBaseImage],
  designBriefs: [validDesignBrief],
  renderRequests: [validRenderRequest],
  renderResults: [validRenderResult]
};

describe("ProjectSchema", () => {
  it("accepts a valid minimal Project", () => {
    expect(ProjectSchema.parse(validMinimalProject)).toEqual(validMinimalProject);
  });

  it("accepts empty Project-level collections", () => {
    const project = {
      ...validProjectWithCollections,
      viewpoints: [],
      baseImages: [],
      designBriefs: [],
      renderRequests: [],
      renderResults: []
    };

    expect(ProjectSchema.parse(project)).toEqual(project);
  });

  it("rejects invalid units", () => {
    expect(ProjectSchema.safeParse({ ...validMinimalProject, units: { length: "m", angle: "deg" } }).success).toBe(
      false
    );
  });

  it("rejects invalid Building", () => {
    expect(
      ProjectSchema.safeParse({ ...validMinimalProject, building: { ...validBuilding, type: "WAREHOUSE" } }).success
    ).toBe(false);
  });

  it("rejects invalid Viewpoint", () => {
    expect(
      ProjectSchema.safeParse({
        ...validProjectWithCollections,
        viewpoints: [{ ...validViewpoint, cameraTarget: validViewpoint.cameraPosition }]
      }).success
    ).toBe(false);
  });

  it("rejects invalid BaseImage", () => {
    expect(
      ProjectSchema.safeParse({ ...validProjectWithCollections, baseImages: [{ ...validBaseImage, assetRef: "" }] })
        .success
    ).toBe(false);
  });

  it("rejects invalid DesignBrief", () => {
    expect(
      ProjectSchema.safeParse({ ...validProjectWithCollections, designBriefs: [{ ...validDesignBrief, promptText: "" }] })
        .success
    ).toBe(false);
  });

  it("rejects invalid RenderRequest", () => {
    expect(
      ProjectSchema.safeParse({
        ...validProjectWithCollections,
        renderRequests: [{ ...validRenderRequest, status: "RUNNING" }]
      }).success
    ).toBe(false);
  });

  it("rejects invalid RenderResult", () => {
    expect(
      ProjectSchema.safeParse({
        ...validProjectWithCollections,
        renderResults: [{ ...validRenderResult, assetRef: undefined }]
      }).success
    ).toBe(false);
  });

  it("rejects undocumented properties", () => {
    expect(ProjectSchema.safeParse({ ...validMinimalProject, settings: {} }).success).toBe(false);
  });
});
