import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import type { AppConfiguration } from "../config/app-configuration";

type MigrationCountResult = {
  readonly count: bigint;
};

/**
 * Prisma client lifecycle boundary for CasaStudio persistence.
 *
 * Runtime modules depend on this service for database access, while generated
 * Prisma artifacts and SQL migration history remain owned by Prisma tooling.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ConfigService) configService: ConfigService<AppConfiguration, true>) {
    const adapter = new PrismaPg({
      connectionString: configService.get("databaseUrl", { infer: true })
    });

    super({
      adapter
    });
  }

  /**
   * Opens the database connection when Nest starts the API process.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * Closes database connections during Nest shutdown hooks.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Checks PostgreSQL connectivity and migration metadata readiness.
   *
   * The API stays unready until `prisma migrate deploy` has created the
   * migration history table, which keeps schema ownership in the migration
   * service rather than normal request handling.
   */
  async verifyReady(): Promise<void> {
    await this.$queryRaw`SELECT 1`;

    const migrationCounts = await this.$queryRawUnsafe<readonly MigrationCountResult[]>(
      'SELECT COUNT(*)::bigint AS "count" FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'
    );
    const completedMigrations = migrationCounts[0]?.count ?? 0n;

    if (completedMigrations < 1n) {
      throw new Error("Prisma migrations have not been applied");
    }
  }
}
