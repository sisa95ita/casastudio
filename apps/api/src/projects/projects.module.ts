import { Module } from "@nestjs/common";

import { PersistenceModule } from "../persistence/persistence.module";
import { ProjectApiMapper } from "./api/project-api.mapper";
import { ProjectIdPipe } from "./api/project-id.pipe";
import { ProjectsController } from "./api/projects.controller";
import { GetProjectService } from "./application/get-project.service";
import { ProjectReadAuthorizationPolicy } from "./application/project-read-authorization.policy";
import { PrismaProjectRepository } from "./persistence/prisma-project.repository";
import { PROJECTS_REPOSITORY } from "./persistence/projects-repository.token";

/**
 * Projects feature module for authoritative Project reads.
 *
 * The module keeps normalized persistence behind the repository token, exposes
 * a read-only HTTP controller, and intentionally avoids mutation APIs,
 * Geometry Engine dependencies, frontend integration, and generated clients.
 */
@Module({
  controllers: [ProjectsController],
  imports: [PersistenceModule],
  providers: [
    GetProjectService,
    ProjectApiMapper,
    ProjectIdPipe,
    ProjectReadAuthorizationPolicy,
    PrismaProjectRepository,
    {
      provide: PROJECTS_REPOSITORY,
      useExisting: PrismaProjectRepository
    }
  ],
  exports: [PROJECTS_REPOSITORY]
})
export class ProjectsModule {}
