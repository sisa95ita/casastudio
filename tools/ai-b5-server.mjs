import { createRequire } from "node:module";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aiB5Environment } from "./ai-b5-environment.mjs";

// A separate executable, never a production provider/configuration option.
Object.assign(process.env, aiB5Environment(), {
  API_PORT: "3105",
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
  INTERIOR_DESIGN_PROVIDER
} = require("./dist/ai/interior-design-provider.token.js");
const {
  DESIGN_ARTIFACT_STORE
} = require("./dist/ai/artifacts/design-artifact.store.js");
const {
  FilesystemDesignArtifactStore
} = require("./dist/ai/artifacts/filesystem-design-artifact.store.js");
const { PrismaService } = require("./dist/persistence/prisma.service.js");
const root = await mkdtemp(join(tmpdir(), "casastudio-ai-b5-"));
const store = new FilesystemDesignArtifactStore(root, 20_000_000);
const calls = [];
let complete;
let writes = 0;
const provider = {
  name: "b5-local-fake",
  async refineDesign(input) {
    return this.generateDesign(input);
  },
  async generateDesign(input) {
    if (complete) throw new Error("Unexpected overlapping generation");
    calls.push({
      operation: input.baseProposal ? "refine" : "generate",
      baseProposalId: input.baseProposal?.id,
      target: input.target,
      instructions: input.instructions,
      revision: input.context.project.revision,
      references: input.referenceViews.map(
        ({ kind, target, camera, image }) => ({
          kind,
          target,
          camera,
          width: image.width,
          height: image.height
        })
      )
    });
    await new Promise((resolve) => {
      complete = resolve;
    });
    complete = undefined;
    return {
      artifact: {
        kind: "image",
        mimeType: "image/png",
        width: 1,
        height: 1,
        uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMw69gNAAJxAXoD7wlzAAAAAElFTkSuQmCC"
      },
      telemetry: {
        durationMs: calls.length * 100,
        generatedAt: new Date().toISOString(),
        generationMode: "edit",
        imageModel: `fixture-${calls.length}`,
        image: { width: 1, height: 1, format: "png", quality: "low" }
      }
    };
  }
};
const module = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(INTERIOR_DESIGN_PROVIDER)
  .useValue(provider)
  .overrideProvider(DESIGN_ARTIFACT_STORE)
  .useValue({
    put: async (artifact) => {
      const result = await store.put(artifact);
      writes++;
      return result;
    },
    read: (metadata) => store.read(metadata),
    delete: (key) => store.delete(key)
  })
  .compile();
const app = module.createNestApplication();
configureApiApplication(app, { enableShutdownHooks: false });
const prisma = app.get(PrismaService);
const express = app.getHttpAdapter().getInstance();
// Loopback-only diagnostics/control exist solely in this executable. All product
// requests still use the unmodified controller, JWT guard, and repositories.
express.get("/__ai-b5/state", async (_request, response) => {
  response.json({
    calls,
    writes,
    artifacts: (await readdir(root)).length,
    proposals: await prisma.designProposal.count({
      where: {
        project: {
          domainId: {
            in: [...new Set(calls.map((call) => call.target.projectId))]
          }
        }
      }
    })
  });
});
express.post("/__ai-b5/complete", (_request, response) => {
  if (!complete) return response.status(409).end();
  complete();
  response.status(204).end();
});
await app.listen(3105, "127.0.0.1");
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app.close();
  await rm(root, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
