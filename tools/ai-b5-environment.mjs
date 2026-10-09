import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

/** Shared by validation commands only; never imported by the application. */
export function aiB5Environment() {
  if (existsSync(".env")) loadEnvFile(".env");
  const database = new URL(process.env.DATABASE_URL);
  database.pathname = "/casastudio_ai_b5";
  const environment = {
    ...process.env,
    DATABASE_URL: database.href,
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    SWAGGER_ENABLED: "false",
    VITE_API_BASE_URL: "http://localhost:3105"
  };
  delete environment.OPENAI_API_KEY;
  delete environment.AI_PROVIDER;
  return environment;
}
