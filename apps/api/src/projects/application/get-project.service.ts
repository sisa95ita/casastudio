import { Inject, Injectable } from "@nestjs/common";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { ProjectApiMapper } from "../api/project-api.mapper";
import { AuthorizedProjectLoader } from "./authorized-project-loader.service";
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
  constructor(
    @Inject(AuthorizedProjectLoader) private readonly authorizedProjectLoader: AuthorizedProjectLoader,
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
    const { loadedProject } = await this.authorizedProjectLoader.load(projectId, principal);

    return this.projectApiMapper.toProjectResponse(loadedProject.project);
  }
}
