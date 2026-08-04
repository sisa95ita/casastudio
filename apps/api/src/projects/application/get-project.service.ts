import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { ProjectApiMapper } from "../api/project-api.mapper";
import { ProjectPersistenceError, ProjectReconstructionError } from "../persistence/project-persistence-error";
import type { ProjectsRepository } from "../persistence/project.repository";
import { PROJECTS_REPOSITORY } from "../persistence/projects-repository.token";
import { ProjectReadAuthorizationPolicy } from "./project-read-authorization.policy";
import {
  ProjectAccessForbiddenError,
  ProjectNotFoundError,
  ProjectPersistedStateInvalidError,
  ProjectReadFailedError
} from "./project-read.errors";
import type { ProjectResponseDto } from "../api/project.dto";

/**
 * Application use case for authoritative Project reads.
 *
 * The service loads the current validated Project by domain ID, authorizes the
 * caller against persisted ownership metadata, applies the administrator
 * override, and maps the canonical aggregate into backend-owned transport DTOs.
 */
@Injectable()
export class GetProjectService {
  private readonly logger = new Logger(GetProjectService.name);

  constructor(
    @Inject(PROJECTS_REPOSITORY) private readonly projectsRepository: ProjectsRepository,
    @Inject(ProjectReadAuthorizationPolicy)
    private readonly authorizationPolicy: ProjectReadAuthorizationPolicy,
    @Inject(ProjectApiMapper) private readonly projectApiMapper: ProjectApiMapper
  ) {}

  /**
   * Returns the public Project read response for an authorized principal.
   *
   * Missing Projects become `PROJECT_NOT_FOUND`, forbidden reads become
   * `PROJECT_ACCESS_FORBIDDEN`, invalid persisted aggregates become
   * `PROJECT_PERSISTED_STATE_INVALID`, and database failures become
   * `PROJECT_READ_FAILED`.
   */
  async getProject(projectId: string, principal: AuthenticatedPrincipal): Promise<ProjectResponseDto> {
    const loadedProject = await this.loadProject(projectId);

    if (!loadedProject) {
      throw new ProjectNotFoundError(projectId);
    }

    const authorizedByRole = this.authorizationPolicy.isAdministrator(principal);

    if (!this.authorizationPolicy.canReadProject(principal, loadedProject.metadata)) {
      this.logger.warn(
        {
          projectId,
          principalSubject: principal.subject,
          authorizedByRole: false
        },
        "Project read forbidden"
      );
      throw new ProjectAccessForbiddenError(projectId);
    }

    this.logger.debug(
      {
        projectId,
        principalSubject: principal.subject,
        authorizedByRole
      },
      "Project read authorized"
    );

    return this.projectApiMapper.toProjectResponse(loadedProject.project);
  }

  private async loadProject(projectId: string) {
    try {
      return await this.projectsRepository.findLoadedByDomainId(projectId);
    } catch (error) {
      if (error instanceof ProjectReconstructionError) {
        throw new ProjectPersistedStateInvalidError(projectId, error);
      }

      if (error instanceof ProjectPersistenceError) {
        throw new ProjectReadFailedError(projectId, error);
      }

      throw new ProjectReadFailedError(projectId, error);
    }
  }
}
