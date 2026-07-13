import { describe, expect, it } from "vitest";

import { UnitsSchema } from "./units";

describe("UnitsSchema", () => {
  it("accepts the documented MVP units", () => {
    expect(UnitsSchema.parse({ length: "cm", angle: "deg" })).toEqual({ length: "cm", angle: "deg" });
  });

  it("rejects unsupported length units", () => {
    expect(UnitsSchema.safeParse({ length: "m", angle: "deg" }).success).toBe(false);
  });
});
