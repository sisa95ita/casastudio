import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { aiD1Environment } from "./ai-d1-environment.mjs";

const environment = aiD1Environment();
const prepare = process.argv[2] === "--prepare";
if (prepare) {
  const require = createRequire(
    new URL("../apps/api/package.json", import.meta.url)
  );
  const { Client } = require("pg");
  const database = new URL(environment.DATABASE_URL);
  database.pathname = "/postgres";
  const client = new Client({ connectionString: database.href });
  try {
    await client.connect();
    const found = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      ["casastudio_ai_d1_validation"]
    );
    if (!found.rowCount)
      await client.query('CREATE DATABASE "casastudio_ai_d1_validation"');
  } catch (error) {
    console.error(
      `Could not prepare the isolated AI-D1 database (${error.code ?? "connection failure"}).`
    );
    process.exitCode = 1;
  } finally {
    await client.end();
  }
  if (process.exitCode) process.exit(process.exitCode);
}
const child = spawn(
  "pnpm",
  prepare ? ["db:migrate:deploy"] : process.argv.slice(2),
  { env: environment, stdio: "inherit" }
);
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", () => process.exit(1));
