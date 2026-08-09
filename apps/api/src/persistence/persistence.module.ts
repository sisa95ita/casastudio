import { Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

/**
 * Provides database runtime infrastructure for the Nest API.
 *
 * The module exposes the shared Prisma lifecycle and readiness boundary used
 * by persistence providers without exporting repository implementations
 * directly.
 */
@Module({
  exports: [PrismaService],
  providers: [PrismaService]
})
export class PersistenceModule {}
