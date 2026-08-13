import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import type { ProjectResponseDto } from "../api/project.dto";
import { ProjectApiMapper } from "../api/project-api.mapper";
import { ProjectPersistenceError } from "../persistence/project-persistence-error";
import type { ProjectsRepository } from "../persistence/project.repository";
import { PROJECTS_REPOSITORY } from "../persistence/projects-repository.token";
import { AuthorizedProjectLoader } from "./authorized-project-loader.service";
import { ProjectAuthoritativeValidator } from "./project-authoritative-validator.service";
import { ProjectReadAuthorizationPolicy } from "./project-read-authorization.policy";
import { ProjectAccessForbiddenError, ProjectNotFoundError } from "./project-read.errors";
import {
  ProjectAggregateIdMismatchError,
  ProjectRevisionConflictError,
  ProjectServerFieldsInvalidError,
  ProjectWriteFailedError
} from "./project-write.errors";

/** Application service for explicit complete-Project saves. */
@Injectable()
export class ReplaceProjectService {
  constructor(
    @Inject(PROJECTS_REPOSITORY) private readonly projectsRepository: ProjectsRepository,
    @Inject(AuthorizedProjectLoader) private readonly authorizedProjectLoader: AuthorizedProjectLoader,
    @Inject(ProjectReadAuthorizationPolicy)
    private readonly authorizationPolicy: ProjectReadAuthorizationPolicy,
    @Inject(ProjectAuthoritativeValidator)
    private readonly authoritativeValidator: ProjectAuthoritativeValidator,
    @Inject(ProjectApiMapper) private readonly apiMapper: ProjectApiMapper
  ) {}

  /**
   * Replaces authoritative state when identity, server fields, and base revision match.
   */
  async replaceProject(
    projectId: string,
    baseRevision: number,
    proposedProject: unknown,
    principal: AuthenticatedPrincipal
  ): Promise<ProjectResponseDto> {
    if (!Number.isInteger(baseRevision) || baseRevision < 1) {
      throw new BadRequestException("baseRevision must be a positive integer.");
    }

    const { loadedProject } = await this.authorizedProjectLoader.load(projectId, principal);
    const currentProject = loadedProject.project;

    if (baseRevision !== currentProject.revision) {
      throw new ProjectRevisionConflictError(projectId, baseRevision, currentProject.revision);
    }

    const proposedRecord = isRecord(proposedProject) ? proposedProject : undefined;
    const bodyProjectId = proposedRecord?.id;
    if (typeof bodyProjectId === "string" && bodyProjectId !== projectId) {
      throw new ProjectAggregateIdMismatchError(projectId, bodyProjectId);
    }

    const serverFieldErrors = [];
    if (proposedRecord?.revision !== baseRevision) {
      serverFieldErrors.push({
        path: "project.revision",
        message: "Project revision must equal baseRevision."
      });
    }
    if (proposedRecord?.createdAt !== currentProject.createdAt) {
      serverFieldErrors.push({
        path: "project.createdAt",
        message: "Project creation time must match the authoritative Project."
      });
    }
    if (proposedRecord?.updatedAt !== currentProject.updatedAt) {
      serverFieldErrors.push({
        path: "project.updatedAt",
        message: "Project update time must match the authoritative editing base."
      });
    }
    if (serverFieldErrors.length > 0) {
      throw new ProjectServerFieldsInvalidError(serverFieldErrors);
    }

    const canonicalProject = this.authoritativeValidator.validate(proposedProject);

    try {
      const result = await this.projectsRepository.replaceProject({
        projectId,
        baseRevision,
        project: canonicalProject,
        actorSubject: principal.subject,
        requiredOwnerSubject: this.authorizationPolicy.isAdministrator(principal)
          ? undefined
          : principal.subject
      });

      if (result.status === "not-found") {
        throw new ProjectNotFoundError(projectId);
      }
      if (result.status === "forbidden") {
        throw new ProjectAccessForbiddenError(projectId);
      }
      if (result.status === "revision-conflict") {
        throw new ProjectRevisionConflictError(projectId, baseRevision, result.currentRevision);
      }

      return this.apiMapper.toProjectResponse(result.loadedProject.project);
    } catch (error) {
      if (error instanceof ProjectPersistenceError) {
        throw new ProjectWriteFailedError(projectId, error);
      }

      throw error;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
