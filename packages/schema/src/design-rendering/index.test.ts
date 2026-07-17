import { describe, expect, it } from "vitest";

import {
  DesignBriefSchema,
  RenderRequestSchema,
  RenderResultSchema,
  type DesignBrief,
  type RenderRequest,
  type RenderResult
} from "./index";

describe("design-rendering barrel exports", () => {
  it("exports design rendering schemas and inferred types", () => {
    const designBrief: DesignBrief = {
      id: "warm-industrial-living",
      promptText: "Design a warm industrial living room.",
      constraints: [],
      palette: [],
      referenceAssetRefs: []
    };
    const renderRequest: RenderRequest = {
      id: "render-request-001",
      viewpointId: "living-tv-view",
      baseImageId: "base-image-living-tv-001",
      designBriefId: "warm-industrial-living",
      status: "PENDING",
      createdAt: "2026-07-11T16:05:00+02:00"
    };
    const renderResult: RenderResult = {
      id: "render-result-001",
      renderRequestId: "render-request-001",
      status: "SUCCEEDED",
      createdAt: "2026-07-11T16:05:45+02:00",
      assetRef: "assets/renders/render-result-001.png"
    };

    expect(DesignBriefSchema.parse(designBrief)).toEqual(designBrief);
    expect(RenderRequestSchema.parse(renderRequest)).toEqual(renderRequest);
    expect(RenderResultSchema.parse(renderResult)).toEqual(renderResult);
  });
});
