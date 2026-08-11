import { defineConfig } from "vitest/config";

/** Vitest limits sized for Nest integration tests under workspace-level concurrency. */
export default defineConfig({
  test: {
    testTimeout: 15_000
  }
});
