import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

import { createApplicationMetadataDefine } from "./build-metadata.mjs";

/** Creates Web build and test configuration for the active process environment. */
export function createViteConfig(buildVersionOverride?: string): UserConfig {
  return {
    define: createApplicationMetadataDefine(buildVersionOverride),
    envDir: "../..",
    plugins: [react()],
    server: {
      host: "0.0.0.0"
    },
    test: {
      environment: "jsdom",
      fileParallelism: process.env.CI ? false : undefined,
      setupFiles: ["./src/test/test-setup.ts"],
      testTimeout: 15_000,
      env: {
        VITE_API_BASE_URL: "http://localhost:3000",
        VITE_KEYCLOAK_BASE_URL: "http://localhost:8080"
      }
    }
  };
}

export default defineConfig(({ mode }) =>
  createViteConfig(
    mode === "test" ? undefined : process.env.CASASTUDIO_BUILD_VERSION
  )
);
