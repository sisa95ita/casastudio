import { describe, expect, it } from "vitest";

import { geometryPackageStatus } from "./index";

describe("geometryPackageStatus", () => {
  it("exports package status", () => {
    expect(geometryPackageStatus).toBe("ready");
  });
});
