import { resolve } from "node:path";

/** Repository environment files in override-first order for API startup. */
export const apiEnvironmentFilePaths = [
  resolve(__dirname, "../../../..", ".env.local"),
  resolve(__dirname, "../../../..", ".env")
];
