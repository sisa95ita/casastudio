import { describe, expect, it } from "vitest";

import { aiPackageDescriptor } from "./index";

describe("aiPackageDescriptor", () => {
  it("exports package metadata", () => {
    expect(aiPackageDescriptor.name).toBe("@casastudio/ai");
  });
});
