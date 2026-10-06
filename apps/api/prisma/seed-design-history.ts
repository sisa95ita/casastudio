import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { config } from "dotenv";
import { ConfigService } from "@nestjs/config";
import { createValidatedConfiguration } from "../src/config/app-configuration";
import { apiEnvironmentFilePaths } from "../src/config/environment-files";
import { PrismaService } from "../src/persistence/prisma.service";
import { FilesystemDesignArtifactStore } from "../src/ai/artifacts/filesystem-design-artifact.store";
import { PrismaDesignProposalsRepository } from "../src/ai/persistence/prisma-design-proposal.repository";
import { PersistDesignProposalService } from "../src/ai/application/persist-design-proposal.service";

/** Explicit development fixture utility. It imports/calls no AI provider. */
async function seed() {
  config({ path: [...apiEnvironmentFilePaths], quiet: true });
  const configuration = createValidatedConfiguration(process.env);
  if (configuration.nodeEnv === "production")
    throw new Error("Design fixtures are development/test only.");
  const [projectId, levelId, roomId] = process.argv.slice(2);
  if (!projectId || !levelId || !roomId)
    throw new Error(
      "Usage: pnpm db:seed:design-history <project-id> <level-id> <room-id>"
    );
  const prisma = new PrismaService(new ConfigService(configuration));
  try {
    const project = await prisma.project.findUniqueOrThrow({
      where: { domainId: projectId },
      select: {
        revision: true,
        levels: {
          where: { domainId: levelId },
          select: {
            rooms: { where: { domainId: roomId }, select: { domainId: true } }
          }
        }
      }
    });
    if (!project.levels[0]?.rooms.length)
      throw new Error("Select an existing Room in the target Project/Level.");
    const options = configuration.ai.artifacts;
    const persistence = new PersistDesignProposalService(
      new FilesystemDesignArtifactStore(options.directory, options.maxBytes),
      new PrismaDesignProposalsRepository(prisma)
    );
    for (const historical of [false, true]) {
      const createdAt = new Date(
        Date.now() - (historical ? 60_000 : 0)
      ).toISOString();
      const saved = await persistence.persist(
        {
          id: `design-${randomUUID()}`,
          status: "succeeded",
          target: { kind: "room", projectId, levelId, roomId },
          createdAt,
          artifact: {
            kind: "image",
            mimeType: "image/png",
            width: 640,
            height: 480,
            uri: `data:image/png;base64,${localFixturePng(historical).toString("base64")}`
          },
          providerMetadata: { provider: "local-fixture" },
          telemetry: {
            provider: "local-fixture",
            durationMs: 0,
            generatedAt: createdAt,
            image: {
              format: "png",
              width: 640,
              height: 480,
              quality: "local-fixture"
            }
          }
        },
        Math.max(0, project.revision - (historical ? 1 : 0)),
        historical
          ? "Local fixture — historical revision"
          : "Local fixture — current revision",
        { fixture: "ai-b4-v1", projectId, levelId, roomId },
        []
      );
      console.log(
        `Created local fixture ${saved.id} at Project revision ${saved.projectRevision}.`
      );
    }
    console.log(
      "Two deterministic fixtures saved. Zero provider calls. Project revision unchanged."
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Simple local geometric pattern, not a generated design or quality baseline.
function localFixturePng(historical: boolean): Buffer {
  const width = 640,
    height = 480;
  const rows = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; ++y)
    for (let x = 0; x < width; ++x) {
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      const alternating = (Math.floor(x / 80) + Math.floor(y / 80)) % 2;
      rows[offset] = historical ? 150 : 50;
      rows[offset + 1] = alternating ? 160 : 110;
      rows[offset + 2] = historical ? 70 : 170;
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
function chunk(kind: string, bytes: Buffer): Buffer {
  const content = Buffer.concat([Buffer.from(kind), bytes]);
  const result = Buffer.alloc(bytes.length + 12);
  result.writeUInt32BE(bytes.length);
  content.copy(result, 4);
  let crc = 0xffffffff;
  for (const byte of content) {
    crc ^= byte;
    for (let i = 0; i < 8; ++i) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}

seed().catch(() => {
  console.error(
    "Fixture seeding failed. Verify development configuration and Project/Level/Room IDs."
  );
  process.exitCode = 1;
});
