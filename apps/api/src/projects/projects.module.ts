import { Module } from "@nestjs/common";

import { PersistenceModule } from "../persistence/persistence.module";
import { ProjectApiMapper } from "./api/project-api.mapper";
import { ProjectIdPipe } from "./api/project-id.pipe";
import { ProjectsController } from "./api/projects.controller";
import { AuthorizedProjectLoader } from "./application/authorized-project-loader.service";
import { GetProjectService } from "./application/get-project.service";
import { ProjectReadAuthorizationPolicy } from "./application/project-read-authorization.policy";
import { GeometrySnapshotApiMapper } from "./geometry-api/geometry-snapshot-api.mapper";
import { GetProjectGeometryService } from "./geometry-api/get-project-geometry.service";
import {
  GeometryEngineProjectGeometryBuilder,
  PROJECT_GEOMETRY_BUILDER
} from "./geometry-api/project-geometry-builder";
import { ProjectsGeometryController } from "./geometry-api/projects-geometry.controller";
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
  controllers: [ProjectsController, ProjectsGeometryController],
  imports: [PersistenceModule],
  providers: [
    AuthorizedProjectLoader,
    GetProjectService,
    GetProjectGeometryService,
    ProjectApiMapper,
    GeometrySnapshotApiMapper,
    ProjectIdPipe,
    ProjectReadAuthorizationPolicy,
    GeometryEngineProjectGeometryBuilder,
    PrismaProjectRepository,
    {
      provide: PROJECT_GEOMETRY_BUILDER,
      useExisting: GeometryEngineProjectGeometryBuilder
    },
    {
      provide: PROJECTS_REPOSITORY,
      useExisting: PrismaProjectRepository
    }
  ],
  exports: [PROJECTS_REPOSITORY]
})
export class ProjectsModule {}
