import { createRequire } from "node:module";
import { aiD1Environment } from "./ai-d1-environment.mjs";

Object.assign(process.env, aiD1Environment(), {
  API_PORT: "3106",
  API_HOST: "127.0.0.1",
  CORS_ALLOWED_ORIGINS: "http://localhost:8081"
});
delete process.env.OPENAI_API_KEY;
delete process.env.AI_PROVIDER;
const require = createRequire(
  new URL("../apps/api/package.json", import.meta.url)
);
require("reflect-metadata");
const { Test } = require("@nestjs/testing");
const { AppModule } = require("./dist/app.module.js");
const {
  configureApiApplication
} = require("./dist/bootstrap/create-api-application.js");
const {
  FURNITURE_EDIT_PROVIDER
} = require("./dist/ai/furniture-edit-provider.token.js");
const {
  INTERIOR_DESIGN_PROVIDER
} = require("./dist/ai/interior-design-provider.token.js");
const calls = [];
let nextResult;
const module = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(FURNITURE_EDIT_PROVIDER)
  .useValue({
    name: "d1-local-fixture",
    async interpretFurnitureEdit(input) {
      calls.push(input);
      if (!nextResult)
        throw new Error("No deterministic fixture was supplied.");
      const result = nextResult;
      nextResult = undefined;
      return result.kind === "ADD_AT_ANCHOR"
        ? {
            kind: "EDIT_PROPOSAL",
            operations: [
              {
                type: "ADD_FURNITURE",
                definitionId: result.definitionId,
                roomId: input.context.placementHint.roomId,
                position: input.context.placementHint.position,
                rotation: 0
              }
            ]
          }
        : result;
    }
  })
  .overrideProvider(INTERIOR_DESIGN_PROVIDER)
  .useValue({
    name: "disabled",
    generateDesign: async () => {
      throw new Error("Image generation is disabled in AI-D1 validation.");
    },
    refineDesign: async () => {
      throw new Error("Image generation is disabled in AI-D1 validation.");
    }
  })
  .compile();
const app = module.createNestApplication();
configureApiApplication(app, { enableShutdownHooks: false });
const express = app.getHttpAdapter().getInstance();
// Loopback diagnostics exist only in this test executable, never the production module.
express.get("/__ai-d1/state", (_request, response) => response.json({ calls }));
express.post("/__ai-d1/result", (request, response) => {
  nextResult = request.body;
  response.status(204).end();
});
await app.listen(3106, "127.0.0.1");
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app.close();
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
