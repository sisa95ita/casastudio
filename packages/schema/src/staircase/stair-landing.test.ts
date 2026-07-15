import { describe, expect, it } from "vitest";

import { StairLandingSchema } from "./stair-landing";

const validLanding = {
  id: "stair-landing-1",
  position: { x: 0, z: 353 },
  width: 62,
  depth: 32,
  elevation: 110
};

describe("StairLandingSchema", () => {
  it("accepts a valid landing", () => {
    expect(StairLandingSchema.parse(validLanding)).toEqual(validLanding);
  });

  it("rejects zero width", () => {
    expect(StairLandingSchema.safeParse({ ...validLanding, width: 0 }).success).toBe(false);
  });

  it("rejects zero depth", () => {
    expect(StairLandingSchema.safeParse({ ...validLanding, depth: 0 }).success).toBe(false);
  });

  it("validates finite elevation", () => {
    expect(StairLandingSchema.safeParse({ ...validLanding, elevation: Number.POSITIVE_INFINITY }).success).toBe(false);
  });
});
