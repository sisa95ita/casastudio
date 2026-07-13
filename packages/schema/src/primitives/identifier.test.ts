import { describe, expect, it } from "vitest";

import { IdentifierSchema } from "./identifier";

describe("IdentifierSchema", () => {
  it("accepts lowercase kebab-case identifiers", () => {
    expect(IdentifierSchema.parse("living-wall-tv")).toBe("living-wall-tv");
  });

  it("rejects empty identifiers", () => {
    expect(IdentifierSchema.safeParse("").success).toBe(false);
  });

  it("rejects identifiers outside the MVP kebab-case convention", () => {
    expect(IdentifierSchema.safeParse("Living Wall").success).toBe(false);
  });
});
