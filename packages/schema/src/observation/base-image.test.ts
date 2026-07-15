import { describe, expect, it } from "vitest";

import { BaseImageSchema } from "./base-image";

const validBaseImage = {
  id: "base-image-living-tv-001",
  viewpointId: "living-tv-view",
  assetRef: "assets/base-images/living-tv-001.png",
  projectRevision: 3,
  createdAt: "2026-07-11T16:00:00+02:00"
};

describe("BaseImageSchema", () => {
  it("accepts a valid BaseImage", () => {
    expect(BaseImageSchema.parse(validBaseImage)).toEqual(validBaseImage);
  });

  it("accepts optional width and height", () => {
    expect(BaseImageSchema.parse({ ...validBaseImage, width: 1024, height: 768 }).height).toBe(768);
  });

  it("rejects empty assetRef", () => {
    expect(BaseImageSchema.safeParse({ ...validBaseImage, assetRef: "" }).success).toBe(false);
  });

  it("rejects zero projectRevision", () => {
    expect(BaseImageSchema.safeParse({ ...validBaseImage, projectRevision: 0 }).success).toBe(false);
  });

  it("rejects non-integer projectRevision", () => {
    expect(BaseImageSchema.safeParse({ ...validBaseImage, projectRevision: 3.5 }).success).toBe(false);
  });

  it("rejects zero width", () => {
    expect(BaseImageSchema.safeParse({ ...validBaseImage, width: 0 }).success).toBe(false);
  });

  it("rejects zero height", () => {
    expect(BaseImageSchema.safeParse({ ...validBaseImage, height: 0 }).success).toBe(false);
  });

  it("rejects invalid ISO 8601 createdAt", () => {
    expect(BaseImageSchema.safeParse({ ...validBaseImage, createdAt: "not-a-date" }).success).toBe(false);
  });

  it("rejects undocumented fields", () => {
    expect(BaseImageSchema.safeParse({ ...validBaseImage, storageBucket: "base-images" }).success).toBe(false);
  });
});
