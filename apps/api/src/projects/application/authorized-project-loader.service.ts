import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { ProjectPersistenceError, ProjectReconstructionError } from "../persistence/project-persistence-error";
import type { LoadedProject, ProjectsRepository } from "../persistence/project.repository";
import { PROJECTS_REPOSITORY } from "../persistence/projects-repository.token";
import { ProjectReadAuthorizationPolicy } from "./project-read-authorization.policy";
import {
  ProjectAccessForbiddenError,
  ProjectNotFoundError,
  ProjectPersistedStateInvalidError,
  ProjectReadFailedError
} from "./project-read.errors";

/**
 * Authorized Project aggregate returned to application-layer read use cases.
 *
 * The loaded Project is the canonical validated aggregate from persistence.
 * `authorizedByRole` records whether the administrator override granted access
 * and can be logged safely without exposing owner metadata.
 */
export type AuthorizedLoadedProject = {
  readonly loadedProject: LoadedProject;
  readonly authorizedByRole: boolean;
};

/**
 * Shared application loader for read-only Project use cases.
 *
 * The loader performs the read pipeline once: load by domain ID, translate
 * persistence failures, reject missing Projects, and authorize the sanitized
 * principal against persisted owner metadata. It has no controller,
 * DTO, Geometry Engine, or Prisma payload dependency.
 */
@Injectable()
export class AuthorizedProjectLoader {
  private readonly logger = new Logger(AuthorizedProjectLoader.name);

  constructor(
    @Inject(PROJECTS_REPOSITORY) private readonly projectsRepository: ProjectsRepository,
    @Inject(ProjectReadAuthorizationPolicy)
    private readonly authorizationPolicy: ProjectReadAuthorizationPolicy
  ) {}

  /**
   * Loads the canonical Project once and returns it only when the caller may read it.
   *
   * Missing Projects become `PROJECT_NOT_FOUND`, forbidden reads become
   * `PROJECT_ACCESS_FORBIDDEN`, invalid persisted aggregates become
   * `PROJECT_PERSISTED_STATE_INVALID`, and persistence provider failures become
   * `PROJECT_READ_FAILED`.
   */
  async load(projectId: string, principal: AuthenticatedPrincipal): Promise<AuthorizedLoadedProject> {
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

    return {
      loadedProject,
      authorizedByRole
    };
  }

  private async loadProject(projectId: string): Promise<LoadedProject | null> {
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
