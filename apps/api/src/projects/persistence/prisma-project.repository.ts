import { Inject, Injectable } from "@nestjs/common";
import type { Project } from "@casastudio/schema";

import { PrismaService } from "../../persistence/prisma.service";
import { ProjectAggregateMapper } from "./project-aggregate.mapper";
import { projectPersistenceInclude } from "./project-persistence-aggregate";
import { ProjectPersistenceError, ProjectReconstructionError } from "./project-persistence-error";
import { ProjectPersistenceWriter } from "./project-persistence-writer";
import type {
  LoadedProject,
  ProjectSummary,
  ReplaceProjectInput,
  ReplaceProjectResult,
  ProjectsRepository
} from "./project.repository";

type LockedProjectRow = {
  readonly id: string;
  readonly revision: number;
  readonly ownerSubject: string;
  readonly domainCreatedAt: string;
};

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
  private readonly writer = new ProjectPersistenceWriter();

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

      return aggregate ? this.toLoadedProject(aggregate) : null;
    } catch (error) {
      if (error instanceof ProjectPersistenceError || error instanceof ProjectReconstructionError) {
        throw error;
      }

      throw new ProjectPersistenceError(`Failed to load project "${projectId}".`, { cause: error });
    }
  }

  /**
   * Lists lightweight Project summaries, optionally restricted to one owner.
   */
  async listProjectSummaries(ownerSubject?: string): Promise<readonly ProjectSummary[]> {
    try {
      const projects = await this.prismaService.project.findMany({
        where: ownerSubject ? { ownerSubject } : undefined,
        select: {
          domainId: true,
          name: true,
          revision: true,
          domainUpdatedAt: true
        },
        orderBy: [{ updatedAt: "desc" }, { domainId: "asc" }]
      });

      return projects.map((project) => ({
        id: project.domainId,
        name: project.name,
        revision: project.revision,
        updatedAt: project.domainUpdatedAt
      }));
    } catch (error) {
      throw new ProjectPersistenceError("Failed to list Projects.", { cause: error });
    }
  }

  /**
   * Persists a new normalized Project owned by the supplied Keycloak subject.
   */
  async createProject(project: Project, ownerSubject: string): Promise<LoadedProject> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        await this.writer.createProjectInTransaction(tx, project, {
          ownerSubject,
          createdBySubject: ownerSubject,
          updatedBySubject: ownerSubject
        });
        const aggregate = await tx.project.findUniqueOrThrow({
          where: { domainId: project.id },
          include: projectPersistenceInclude
        });

        return this.toLoadedProject(aggregate);
      });
    } catch (error) {
      if (error instanceof ProjectPersistenceError || error instanceof ProjectReconstructionError) {
        throw error;
      }

      throw new ProjectPersistenceError(`Failed to create project "${project.id}".`, { cause: error });
    }
  }

  /**
   * Atomically compares revision, replaces normalized state, and increments once.
   *
   * PostgreSQL's row lock serializes writers on the stable persistence root.
   * A waiting writer re-reads the committed revision before it can mutate any
   * subordinate row, so two writers with one base revision cannot both commit.
   */
  async replaceProject(input: ReplaceProjectInput): Promise<ReplaceProjectResult> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<readonly LockedProjectRow[]>`
          SELECT "id", "revision", "ownerSubject", "domainCreatedAt"
          FROM "Project"
          WHERE "domainId" = ${input.projectId}
          FOR UPDATE
        `;
        const current = rows[0];

        if (!current) {
          return { status: "not-found" };
        }

        if (input.requiredOwnerSubject && current.ownerSubject !== input.requiredOwnerSubject) {
          return { status: "forbidden" };
        }

        if (current.revision !== input.baseRevision) {
          return {
            status: "revision-conflict",
            currentRevision: current.revision
          };
        }

        const authoritativeProject: Project = {
          ...input.project,
          id: input.projectId,
          revision: current.revision + 1,
          createdAt: current.domainCreatedAt,
          updatedAt: new Date().toISOString()
        };

        await this.writer.replaceProjectStateInTransaction(
          tx,
          current.id,
          authoritativeProject,
          input.actorSubject
        );
        const aggregate = await tx.project.findUniqueOrThrow({
          where: { id: current.id },
          include: projectPersistenceInclude
        });

        return {
          status: "updated",
          loadedProject: this.toLoadedProject(aggregate)
        };
      });
    } catch (error) {
      if (error instanceof ProjectPersistenceError || error instanceof ProjectReconstructionError) {
        throw error;
      }

      throw new ProjectPersistenceError(`Failed to replace project "${input.projectId}".`, { cause: error });
    }
  }

  private toLoadedProject(
    aggregate: Parameters<ProjectAggregateMapper["toProject"]>[0]
  ): LoadedProject {
    return {
      project: this.mapper.toProject(aggregate),
      metadata: {
        ownerSubject: aggregate.ownerSubject,
        createdBySubject: aggregate.createdBySubject,
        updatedBySubject: aggregate.updatedBySubject,
        createdAt: aggregate.createdAt,
        updatedAt: aggregate.updatedAt
      }
    };
  }
}
