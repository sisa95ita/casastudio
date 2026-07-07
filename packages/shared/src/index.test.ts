import { describe, expect, it } from "vitest";

import { createPackageName } from "./index";

describe("createPackageName", () => {
  it("formats CasaStudio package names", () => {
    expect(createPackageName("shared")).toBe("@casastudio/shared");
  });
});
