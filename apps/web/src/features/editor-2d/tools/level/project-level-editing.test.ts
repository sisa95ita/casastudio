import { describe, expect, it } from "vitest";

import { createLevelIdentifier } from "./project-level-editing";

describe("Project Level editing", () => {
  it("creates a stable schema-compatible client identifier", () => {
    expect(createLevelIdentifier(() => "123E4567-E89B-12D3-A456-426614174000"))
      .toBe("level-123e4567-e89b-12d3-a456-426614174000");
  });
});
