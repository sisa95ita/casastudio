import "dotenv/config";

import { readFileSync } from "node:fs";

import { ProjectSchema } from "@casastudio/schema";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { seedCanonicalDemoProject } from "../src/projects/persistence/demo-project-seed";

const canonicalProjectUrl = new URL("../../../packages/schema/examples/project.json", import.meta.url);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the CasaStudio database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl
  })
});

async function main(): Promise<void> {
  const project = ProjectSchema.parse(JSON.parse(readFileSync(canonicalProjectUrl, "utf8")));
  const result = await seedCanonicalDemoProject(prisma, project);

  console.log(
    `Seeded CasaStudio demo project ${result.projectId} at revision ${result.revision} for owner subject ${result.ownerSubject}.`
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
  await prisma.$disconnect();
  });
