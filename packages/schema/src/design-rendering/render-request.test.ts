import { describe, expect, it } from "vitest";

import { RenderRequestSchema } from "./render-request";

const validPendingRequest = {
  id: "render-request-001",
  viewpointId: "living-tv-view",
  baseImageId: "base-image-living-tv-001",
  designBriefId: "warm-industrial-living",
  status: "PENDING",
  createdAt: "2026-07-11T16:05:00+02:00"
};

const startedAt = "2026-07-11T16:05:03+02:00";
const completedAt = "2026-07-11T16:05:45+02:00";

describe("RenderRequestSchema", () => {
  it("accepts a valid PENDING request", () => {
    expect(RenderRequestSchema.parse(validPendingRequest)).toEqual(validPendingRequest);
  });

  it("accepts a valid RUNNING request", () => {
    const request = { ...validPendingRequest, status: "RUNNING", startedAt };

    expect(RenderRequestSchema.parse(request)).toEqual(request);
  });

  it("accepts a valid SUCCEEDED request", () => {
    const request = { ...validPendingRequest, status: "SUCCEEDED", startedAt, completedAt };

    expect(RenderRequestSchema.parse(request)).toEqual(request);
  });

  it("accepts a valid FAILED request", () => {
    const request = { ...validPendingRequest, status: "FAILED", startedAt, completedAt, error: "Provider error." };

    expect(RenderRequestSchema.parse(request)).toEqual(request);
  });

  it("accepts a valid CANCELLED request", () => {
    const request = { ...validPendingRequest, status: "CANCELLED", completedAt };

    expect(RenderRequestSchema.parse(request)).toEqual(request);
  });

  it("rejects RUNNING request without startedAt", () => {
    expect(RenderRequestSchema.safeParse({ ...validPendingRequest, status: "RUNNING" }).success).toBe(false);
  });

  it("rejects SUCCEEDED request without completedAt", () => {
    expect(RenderRequestSchema.safeParse({ ...validPendingRequest, status: "SUCCEEDED", startedAt }).success).toBe(
      false
    );
  });

  it("rejects SUCCEEDED request with error", () => {
    expect(
      RenderRequestSchema.safeParse({
        ...validPendingRequest,
        status: "SUCCEEDED",
        startedAt,
        completedAt,
        error: "Unexpected error."
      }).success
    ).toBe(false);
  });

  it("rejects FAILED request without error", () => {
    expect(
      RenderRequestSchema.safeParse({ ...validPendingRequest, status: "FAILED", startedAt, completedAt }).success
    ).toBe(false);
  });

  it("rejects PENDING request with completedAt", () => {
    expect(RenderRequestSchema.safeParse({ ...validPendingRequest, completedAt }).success).toBe(false);
  });

  it("rejects completedAt earlier than createdAt", () => {
    expect(
      RenderRequestSchema.safeParse({
        ...validPendingRequest,
        status: "CANCELLED",
        completedAt: "2026-07-11T16:04:59+02:00"
      }).success
    ).toBe(false);
  });

  it("rejects startedAt earlier than createdAt", () => {
    expect(
      RenderRequestSchema.safeParse({
        ...validPendingRequest,
        status: "RUNNING",
        startedAt: "2026-07-11T16:04:59+02:00"
      }).success
    ).toBe(false);
  });

  it("rejects completedAt earlier than startedAt", () => {
    expect(
      RenderRequestSchema.safeParse({
        ...validPendingRequest,
        status: "SUCCEEDED",
        startedAt: "2026-07-11T16:05:45+02:00",
        completedAt: "2026-07-11T16:05:03+02:00"
      }).success
    ).toBe(false);
  });

  it("rejects zero requestedResultCount", () => {
    expect(RenderRequestSchema.safeParse({ ...validPendingRequest, requestedResultCount: 0 }).success).toBe(false);
  });

  it("rejects undocumented fields", () => {
    expect(RenderRequestSchema.safeParse({ ...validPendingRequest, retryCount: 1 }).success).toBe(false);
  });
});
