import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../persistence/prisma.service";
import { ProjectAggregateMapper } from "./project-aggregate.mapper";
import { projectPersistenceInclude } from "./project-persistence-aggregate";
import { ProjectPersistenceError, ProjectReconstructionError } from "./project-persistence-error";
import type { LoadedProject, ProjectsRepository } from "./project.repository";
import type { Project } from "@casastudio/schema";

/**
 * Prisma-backed implementation of the internal Project repository.
 *
 * Reads use the Project domain ID at the boundary, load the normalized
 * persistence aggregate with deterministic relation ordering, and delegate all
 * reconstruction and validation to ProjectAggregateMapper.
 */
@Injectable()
export class PrismaProjectRepository implements ProjectsRepository {
  private readonly mapper = new ProjectAggregateMapper();

  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  /**
   * Loads a validated canonical Project by its CasaStudio domain identifier.
   */
  async findByDomainId(projectId: string): Promise<Project | null> {
    const loadedProject = await this.findLoadedByDomainId(projectId);

    return loadedProject?.project ?? null;
  }

  /**
   * Loads a validated Project together with internal authorization metadata.
   */
  async findLoadedByDomainId(projectId: string): Promise<LoadedProject | null> {
    try {
      const aggregate = await this.prismaService.project.findUnique({
        where: {
          domainId: projectId
        },
        include: projectPersistenceInclude
      });

      return aggregate
        ? {
            project: this.mapper.toProject(aggregate),
            metadata: {
              ownerSubject: aggregate.ownerSubject,
              createdBySubject: aggregate.createdBySubject,
              updatedBySubject: aggregate.updatedBySubject,
              createdAt: aggregate.createdAt,
              updatedAt: aggregate.updatedAt
            }
          }
        : null;
    } catch (error) {
      if (error instanceof ProjectPersistenceError || error instanceof ProjectReconstructionError) {
        throw error;
      }

      throw new ProjectPersistenceError(`Failed to load project "${projectId}".`, { cause: error });
    }
  }
}
