import { describe, expect, it } from "vitest";

import { CommonMetadataSchema } from "./metadata";

describe("CommonMetadataSchema", () => {
  it("accepts an identifier with optional name and description", () => {
    expect(
      CommonMetadataSchema.parse({
        id: "living-room",
        name: "Living Room",
        description: "Main living space"
      })
    ).toEqual({
      id: "living-room",
      name: "Living Room",
      description: "Main living space"
    });
  });

  it("requires a valid identifier", () => {
    expect(CommonMetadataSchema.safeParse({ id: "Living Room" }).success).toBe(false);
  });
});
