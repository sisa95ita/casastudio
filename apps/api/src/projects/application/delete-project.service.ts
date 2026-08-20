import { ForbiddenException, Inject, Injectable } from "@nestjs/common";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { ProjectPersistenceError } from "../persistence/project-persistence-error";
import type { ProjectsRepository } from "../persistence/project.repository";
import { PROJECTS_REPOSITORY } from "../persistence/projects-repository.token";
import { ProjectReadAuthorizationPolicy } from "./project-read-authorization.policy";
import {
  ProjectAccessForbiddenError,
  ProjectNotFoundError
} from "./project-read.errors";
import { ProjectWriteFailedError } from "./project-write.errors";

/** Application service for authorized, complete-aggregate Project deletion. */
@Injectable()
export class DeleteProjectService {
  constructor(
    @Inject(PROJECTS_REPOSITORY)
    private readonly projectsRepository: ProjectsRepository,
    @Inject(ProjectReadAuthorizationPolicy)
    private readonly authorizationPolicy: ProjectReadAuthorizationPolicy
  ) {}

  /** Deletes an owned Project or applies the administrator override. */
  async deleteProject(
    projectId: string,
    principal: AuthenticatedPrincipal
  ): Promise<void> {
    if (!this.authorizationPolicy.canUseProjects(principal)) {
      throw new ForbiddenException("A CasaStudio Project role is required.");
    }

    try {
      const result = await this.projectsRepository.deleteProject({
        projectId,
        requiredOwnerSubject: this.authorizationPolicy.isAdministrator(
          principal
        )
          ? undefined
          : principal.subject
      });

      if (result.status === "not-found") {
        throw new ProjectNotFoundError(projectId);
      }
      if (result.status === "forbidden") {
        throw new ProjectAccessForbiddenError(projectId);
      }
    } catch (error) {
      if (error instanceof ProjectPersistenceError) {
        throw new ProjectWriteFailedError(projectId, error);
      }

      throw error;
    }
  }
}
