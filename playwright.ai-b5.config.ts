import { defineConfig, devices } from "@playwright/test";
import { aiB5Environment } from "./tools/ai-b5-environment.mjs";

const environment = aiB5Environment();
Object.assign(process.env, environment);
delete process.env.OPENAI_API_KEY;
delete process.env.AI_PROVIDER;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "ai-b5-workflow.spec.ts",
  outputDir: "test-results/ai-b5",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/ai-b5" }]
  ],
  use: {
    baseURL: "http://localhost:8081",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "pnpm api:build && node tools/ai-b5-server.mjs",
      url: "http://localhost:3105/api/v1/health/live",
      reuseExistingServer: false,
      timeout: 120_000,
      env: environment
    },
    {
      command: "pnpm --filter @casastudio/web dev --port 8081 --strictPort",
      url: "http://localhost:8081",
      reuseExistingServer: false,
      timeout: 120_000,
      env: environment
    }
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
