// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { createViteConfig } from "../../vite.config";

afterEach(() => vi.unstubAllEnvs());

describe("Web Vitest resource policy", () => {
  it("runs test files serially in CI", () => {
    vi.stubEnv("CI", "true");

    expect(createViteConfig().test?.fileParallelism).toBe(false);
  });

  it("retains Vitest default file parallelism outside CI", () => {
    vi.stubEnv("CI", "");

    expect(createViteConfig().test?.fileParallelism).toBeUndefined();
  });
});
