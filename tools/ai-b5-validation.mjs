import { spawn } from "node:child_process";
import { aiB5Environment } from "./ai-b5-environment.mjs";

// Run repository-standard commands against the dedicated validation database.
const child = spawn("pnpm", process.argv.slice(2), {
  env: aiB5Environment(),
  stdio: "inherit"
});
child.on("exit", (code) => process.exit(code ?? 1));
