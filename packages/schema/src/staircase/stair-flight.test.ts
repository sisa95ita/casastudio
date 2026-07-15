import { describe, expect, it } from "vitest";

import { StairFlightSchema } from "./stair-flight";

const validFlight = {
  id: "short-flight",
  start: { x: 0, z: 225 },
  end: { x: 0, z: 385 },
  width: 62,
  stepCount: 4,
  startElevation: 0,
  endElevation: 110
};

describe("StairFlightSchema", () => {
  it("accepts a valid flight", () => {
    expect(StairFlightSchema.parse(validFlight)).toEqual(validFlight);
  });

  it("rejects a zero-length flight", () => {
    expect(StairFlightSchema.safeParse({ ...validFlight, end: { x: 0, z: 225 } }).success).toBe(false);
  });

  it("rejects zero width", () => {
    expect(StairFlightSchema.safeParse({ ...validFlight, width: 0 }).success).toBe(false);
  });

  it("rejects non-integer stepCount", () => {
    expect(StairFlightSchema.safeParse({ ...validFlight, stepCount: 4.5 }).success).toBe(false);
  });

  it("rejects zero stepCount", () => {
    expect(StairFlightSchema.safeParse({ ...validFlight, stepCount: 0 }).success).toBe(false);
  });

  it("rejects descending elevation", () => {
    expect(StairFlightSchema.safeParse({ ...validFlight, startElevation: 110, endElevation: 0 }).success).toBe(false);
  });

  it("accepts positive ascending elevation", () => {
    expect(StairFlightSchema.safeParse({ ...validFlight, startElevation: 10, endElevation: 120 }).success).toBe(true);
  });
});
