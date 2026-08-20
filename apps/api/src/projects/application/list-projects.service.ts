import { ForbiddenException, Inject, Injectable } from "@nestjs/common";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import type { ProjectListResponseDto } from "../api/project.dto";
import { ProjectPersistenceError } from "../persistence/project-persistence-error";
import type { ProjectsRepository } from "../persistence/project.repository";
import { PROJECTS_REPOSITORY } from "../persistence/projects-repository.token";
import { ProjectApiMapper } from "../api/project-api.mapper";
import { ProjectReadFailedError } from "./project-read.errors";
import { ProjectReadAuthorizationPolicy } from "./project-read-authorization.policy";

/** Lists Projects visible under the established owner/admin authorization rules. */
@Injectable()
export class ListProjectsService {
  constructor(
    @Inject(PROJECTS_REPOSITORY) private readonly projectsRepository: ProjectsRepository,
    @Inject(ProjectReadAuthorizationPolicy)
    private readonly authorizationPolicy: ProjectReadAuthorizationPolicy,
    @Inject(ProjectApiMapper) private readonly apiMapper: ProjectApiMapper
  ) {}

  /** Returns owner-scoped summaries for users and all summaries for administrators. */
  async listProjects(principal: AuthenticatedPrincipal): Promise<ProjectListResponseDto> {
    if (!this.authorizationPolicy.canUseProjects(principal)) {
      throw new ForbiddenException("A CasaStudio Project role is required.");
    }

    try {
      const ownerSubject = this.authorizationPolicy.isAdministrator(principal)
        ? undefined
        : principal.subject;
      const summaries = await this.projectsRepository.listProjectSummaries(ownerSubject);

      return this.apiMapper.toProjectListResponse(summaries, principal.subject);
    } catch (error) {
      if (error instanceof ProjectPersistenceError) {
        throw new ProjectReadFailedError("project-list", error);
      }

      throw error;
    }
  }
}
