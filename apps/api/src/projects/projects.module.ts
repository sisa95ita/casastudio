import { Module } from "@nestjs/common";

import { PersistenceModule } from "../persistence/persistence.module";
import { PrismaProjectRepository } from "./persistence/prisma-project.repository";
import { PROJECTS_REPOSITORY } from "./persistence/projects-repository.token";

/**
 * Internal Projects feature module for relational Project persistence.
 *
 * The module exports only the repository contract token for later application
 * services. It intentionally registers no controllers, HTTP DTOs, mutation
 * APIs, authorization policies, or Geometry Engine services.
 */
@Module({
  imports: [PersistenceModule],
  providers: [
    PrismaProjectRepository,
    {
      provide: PROJECTS_REPOSITORY,
      useExisting: PrismaProjectRepository
    }
  ],
  exports: [PROJECTS_REPOSITORY]
})
export class ProjectsModule {}
