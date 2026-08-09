import "dotenv/config";
import { defineConfig } from "prisma/config";

const isGenerateCommand = process.argv.includes("generate");
const databaseUrl =
  process.env.DATABASE_URL ??
  (isGenerateCommand
    ? "postgresql://casastudio:casastudio@localhost:5432/casastudio?schema=public"
    : undefined);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Prisma commands. Set it in an ignored .env file.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl
  },
  migrations: {
    seed: "tsx prisma/seed.ts"
  }
});
