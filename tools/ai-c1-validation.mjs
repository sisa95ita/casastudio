import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

// Dedicated validation database; never forward paid-provider configuration.
if (existsSync(".env")) loadEnvFile(".env");
const database = new URL(process.env.DATABASE_URL);
database.pathname = "/casastudio_ai_c1_validation";
const environment = {
  ...process.env,
  DATABASE_URL: database.href,
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  SWAGGER_ENABLED: "false"
};
delete environment.OPENAI_API_KEY;
delete environment.AI_PROVIDER;
const child = spawn("pnpm", process.argv.slice(2), {
  env: environment,
  stdio: "inherit"
});
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", () => process.exit(1));
