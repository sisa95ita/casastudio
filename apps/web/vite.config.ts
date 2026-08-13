import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: "../..",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/test-setup.ts"],
    testTimeout: 15_000,
    env: {
      VITE_API_BASE_URL: "http://localhost:3000",
      VITE_KEYCLOAK_BASE_URL: "http://localhost:8080",
    },
  },
});
