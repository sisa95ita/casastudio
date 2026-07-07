import { describe, expect, it } from "vitest";

import { WorkspacePackageSchema } from "./index";

describe("WorkspacePackageSchema", () => {
  it("validates package metadata", () => {
    expect(WorkspacePackageSchema.parse({ name: "@casastudio/schema" })).toEqual({
      name: "@casastudio/schema"
    });
  });
});
