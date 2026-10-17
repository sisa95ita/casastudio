import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

/** Zero-cost validation only. Runtime application code never imports this file. */
export function aiD1Environment() {
  if (existsSync(".env")) loadEnvFile(".env");
  const database = new URL(process.env.DATABASE_URL);
  database.pathname = "/casastudio_ai_d1_validation";
  const environment = {
    ...process.env,
    DATABASE_URL: database.href,
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    SWAGGER_ENABLED: "false",
    VITE_API_BASE_URL: "http://localhost:3106"
  };
  delete environment.OPENAI_API_KEY;
  delete environment.AI_PROVIDER;
  return environment;
}
