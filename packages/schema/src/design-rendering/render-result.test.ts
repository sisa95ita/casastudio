import { describe, expect, it } from "vitest";

import { RenderResultSchema } from "./render-result";

const validSucceededResult = {
  id: "render-result-001",
  renderRequestId: "render-request-001",
  status: "SUCCEEDED",
  createdAt: "2026-07-11T16:05:45+02:00",
  assetRef: "assets/renders/render-result-001.png"
};

describe("RenderResultSchema", () => {
  it("accepts a valid SUCCEEDED result with assetRef", () => {
    expect(RenderResultSchema.parse(validSucceededResult)).toEqual(validSucceededResult);
  });

  it("accepts a valid FAILED result without assetRef", () => {
    const result = {
      id: "render-result-002",
      renderRequestId: "render-request-001",
      status: "FAILED",
      createdAt: "2026-07-11T16:05:45+02:00",
      error: "Provider error."
    };

    expect(RenderResultSchema.parse(result)).toEqual(result);
  });

  it("accepts a valid CANCELLED result without assetRef", () => {
    const result = {
      id: "render-result-003",
      renderRequestId: "render-request-001",
      status: "CANCELLED",
      createdAt: "2026-07-11T16:05:45+02:00"
    };

    expect(RenderResultSchema.parse(result)).toEqual(result);
  });

  it("rejects SUCCEEDED result without assetRef", () => {
    const result = {
      id: "render-result-004",
      renderRequestId: "render-request-001",
      status: "SUCCEEDED",
      createdAt: "2026-07-11T16:05:45+02:00"
    };

    expect(RenderResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects SUCCEEDED result with error", () => {
    expect(RenderResultSchema.safeParse({ ...validSucceededResult, error: "Unexpected error." }).success).toBe(false);
  });

  it("rejects FAILED result without error", () => {
    expect(
      RenderResultSchema.safeParse({
        id: "render-result-004",
        renderRequestId: "render-request-001",
        status: "FAILED",
        createdAt: "2026-07-11T16:05:45+02:00"
      }).success
    ).toBe(false);
  });

  it("rejects PENDING result with assetRef", () => {
    expect(RenderResultSchema.safeParse({ ...validSucceededResult, status: "PENDING" }).success).toBe(false);
  });

  it("rejects RUNNING result with assetRef", () => {
    expect(RenderResultSchema.safeParse({ ...validSucceededResult, status: "RUNNING" }).success).toBe(false);
  });

  it("accepts optional provider/model metadata", () => {
    const result = { ...validSucceededResult, providerId: "openai", modelId: "image-model-id" };

    expect(RenderResultSchema.parse(result)).toEqual(result);
  });

  it("accepts optional pixel width and height", () => {
    const result = { ...validSucceededResult, width: 1024, height: 768 };

    expect(RenderResultSchema.parse(result)).toEqual(result);
  });

  it("rejects zero width", () => {
    expect(RenderResultSchema.safeParse({ ...validSucceededResult, width: 0 }).success).toBe(false);
  });

  it("rejects zero height", () => {
    expect(RenderResultSchema.safeParse({ ...validSucceededResult, height: 0 }).success).toBe(false);
  });

  it("rejects undocumented fields", () => {
    expect(RenderResultSchema.safeParse({ ...validSucceededResult, providerPayload: {} }).success).toBe(false);
  });
});
