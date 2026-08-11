import "dotenv/config";

import { readFileSync } from "node:fs";

import { ProjectSchema } from "@casastudio/schema";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  createDemoProject,
  seedDemoProject
} from "../src/projects/persistence/demo-project-seed";

const projectFixtureUrl = new URL("../../../packages/schema/examples/project.json", import.meta.url);
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
  const projectFixture = ProjectSchema.parse(JSON.parse(readFileSync(projectFixtureUrl, "utf8")));
  const result = await seedDemoProject(prisma, createDemoProject(projectFixture));

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
