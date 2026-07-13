import { describe, expect, it } from "vitest";

import { Point2DSchema, Point3DSchema } from "./points";

describe("Point2DSchema", () => {
  it("accepts XZ coordinates", () => {
    expect(Point2DSchema.parse({ x: 0, z: 488 })).toEqual({ x: 0, z: 488 });
  });

  it("rejects missing Z coordinates", () => {
    expect(Point2DSchema.safeParse({ x: 0 }).success).toBe(false);
  });
});

describe("Point3DSchema", () => {
  it("accepts XYZ coordinates", () => {
    expect(Point3DSchema.parse({ x: 250, y: 165, z: 320 })).toEqual({ x: 250, y: 165, z: 320 });
  });

  it("rejects non-finite coordinates", () => {
    expect(Point3DSchema.safeParse({ x: 0, y: Infinity, z: 0 }).success).toBe(false);
  });
});
