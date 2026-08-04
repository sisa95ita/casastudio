import { Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

/**
 * Provides database runtime infrastructure for the Nest API.
 *
 * Phase 1A exposes only Prisma lifecycle and readiness services; normalized
 * project repositories and relational domain tables are intentionally deferred
 * to Phase 1B.
 */
@Module({
  exports: [PrismaService],
  providers: [PrismaService]
})
export class PersistenceModule {}
