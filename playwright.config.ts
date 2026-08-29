import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

const webBaseUrl =
  process.env.CASASTUDIO_E2E_WEB_URL ?? "http://localhost:5173";
const apiHealthUrl =
  process.env.CASASTUDIO_E2E_API_HEALTH_URL ??
  "http://localhost:3000/api/v1/health/live";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }]
  ],
  use: {
    baseURL: webBaseUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "pnpm api:dev",
      url: apiHealthUrl,
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: "pnpm web:dev",
      url: webBaseUrl,
      reuseExistingServer: true,
      timeout: 120_000
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
