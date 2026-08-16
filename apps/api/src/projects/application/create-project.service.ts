import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable
} from "@nestjs/common";
import {
  createInitialProject,
  normalizeProjectName,
  prepareProjectName,
  PROJECT_NAME_MAX_LENGTH
} from "@casastudio/schema";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import type { ProjectResponseDto } from "../api/project.dto";
import { ProjectApiMapper } from "../api/project-api.mapper";
import {
  ProjectNameConflictPersistenceError,
  ProjectPersistenceError
} from "../persistence/project-persistence-error";
import type { ProjectsRepository } from "../persistence/project.repository";
import { PROJECTS_REPOSITORY } from "../persistence/projects-repository.token";
import { ProjectAuthoritativeValidator } from "./project-authoritative-validator.service";
import { ProjectReadAuthorizationPolicy } from "./project-read-authorization.policy";
import {
  ProjectNameConflictError,
  ProjectWriteFailedError
} from "./project-write.errors";

/** Creates canonical, immediately editable Projects for authenticated principals. */
@Injectable()
export class CreateProjectService {
  constructor(
    @Inject(PROJECTS_REPOSITORY)
    private readonly projectsRepository: ProjectsRepository,
    @Inject(ProjectReadAuthorizationPolicy)
    private readonly authorizationPolicy: ProjectReadAuthorizationPolicy,
    @Inject(ProjectAuthoritativeValidator)
    private readonly authoritativeValidator: ProjectAuthoritativeValidator,
    @Inject(ProjectApiMapper) private readonly apiMapper: ProjectApiMapper
  ) {}

  /** Creates a revision-one Project owned by the authenticated principal. */
  async createProject(
    name: string,
    principal: AuthenticatedPrincipal
  ): Promise<ProjectResponseDto> {
    const preparedName =
      typeof name === "string" ? prepareProjectName(name) : "";
    if (
      preparedName.length === 0 ||
      preparedName.length > PROJECT_NAME_MAX_LENGTH
    ) {
      throw new BadRequestException(
        `Project name must contain 1 to ${PROJECT_NAME_MAX_LENGTH} characters.`
      );
    }

    if (!this.authorizationPolicy.canUseProjects(principal)) {
      throw new ForbiddenException("A CasaStudio Project role is required.");
    }

    try {
      if (
        await this.projectsRepository.projectNameExists(
          principal.subject,
          normalizeProjectName(preparedName)
        )
      ) {
        throw new ProjectNameConflictError();
      }
    } catch (error) {
      if (error instanceof ProjectNameConflictError) throw error;
      if (error instanceof ProjectPersistenceError) {
        throw new ProjectWriteFailedError("new-project", error);
      }
      throw error;
    }

    const project = this.authoritativeValidator.validate(
      createInitialProject({
        projectId: createDomainId("project"),
        buildingId: createDomainId("building"),
        levelId: createDomainId("ground-floor"),
        name: preparedName,
        createdAt: new Date().toISOString()
      })
    );

    try {
      const loadedProject = await this.projectsRepository.createProject(
        project,
        principal.subject
      );

      return this.apiMapper.toProjectResponse(loadedProject.project);
    } catch (error) {
      if (error instanceof ProjectNameConflictPersistenceError) {
        throw new ProjectNameConflictError();
      }
      if (error instanceof ProjectPersistenceError) {
        throw new ProjectWriteFailedError(project.id, error);
      }

      throw error;
    }
  }
}

function createDomainId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
