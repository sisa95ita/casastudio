import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  UseGuards
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse
} from "@nestjs/swagger";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { CurrentPrincipal } from "../../auth/current-principal.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ProblemDetailsDto } from "../../common/problem-details/problem-details.dto";
import { CreateProjectService } from "../application/create-project.service";
import { DeleteProjectService } from "../application/delete-project.service";
import { GetProjectService } from "../application/get-project.service";
import { ListProjectsService } from "../application/list-projects.service";
import { ReplaceProjectService } from "../application/replace-project.service";
import {
  BaseImageDto,
  BuildingDto,
  CreateProjectRequestDto,
  DesignBriefDto,
  LevelDto,
  OpeningDto,
  Point2DDto,
  Point3DDto,
  ProjectDto,
  ProjectResponseDto,
  ProjectUnitsDto,
  RenderRequestDto,
  RenderResultDto,
  RoomBoundaryEdgeDto,
  RoomDto,
  StaircaseDto,
  StairFlightDto,
  StairLandingDto,
  ViewpointDto,
  WallDto,
  ProjectListResponseDto,
  ProjectSummaryDto,
  ReplaceProjectRequestDto
} from "./project.dto";
import { ProjectIdPipe } from "./project-id.pipe";

/**
 * HTTP controller for authoritative Project lifecycle and read endpoints.
 *
 * The controller validates route parameters, receives the sanitized
 * authenticated principal, delegates loading and authorization to the
 * application service, and returns explicit transport DTOs.
 */
@ApiTags("projects")
@ApiBearerAuth("bearer")
@ApiExtraModels(
  ProjectResponseDto,
  ProjectListResponseDto,
  ProjectSummaryDto,
  CreateProjectRequestDto,
  ReplaceProjectRequestDto,
  ProjectDto,
  ProjectUnitsDto,
  BuildingDto,
  LevelDto,
  RoomDto,
  RoomBoundaryEdgeDto,
  WallDto,
  OpeningDto,
  StaircaseDto,
  StairFlightDto,
  StairLandingDto,
  ViewpointDto,
  Point2DDto,
  Point3DDto,
  BaseImageDto,
  DesignBriefDto,
  RenderRequestDto,
  RenderResultDto,
  ProblemDetailsDto
)
@Controller({
  path: "projects",
  version: "1"
})
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    @Inject(GetProjectService) private readonly getProjectService: GetProjectService,
    @Inject(ListProjectsService) private readonly listProjectsService: ListProjectsService,
    @Inject(CreateProjectService) private readonly createProjectService: CreateProjectService,
    @Inject(DeleteProjectService) private readonly deleteProjectService: DeleteProjectService,
    @Inject(ReplaceProjectService) private readonly replaceProjectService: ReplaceProjectService
  ) {}

  @Get()
  @ApiOperation({ summary: "List Projects visible to the authenticated principal." })
  @ApiOkResponse({ type: ProjectListResponseDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiInternalServerErrorResponse({ type: ProblemDetailsDto })
  async listProjects(
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ): Promise<ProjectListResponseDto> {
    return this.listProjectsService.listProjects(principal);
  }

  @Post()
  @ApiOperation({ summary: "Create a canonical editable Project owned by the caller." })
  @ApiCreatedResponse({ type: ProjectResponseDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiUnprocessableEntityResponse({ type: ProblemDetailsDto })
  @ApiInternalServerErrorResponse({ type: ProblemDetailsDto })
  async createProject(
    @Body() request: CreateProjectRequestDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ): Promise<ProjectResponseDto> {
    return this.createProjectService.createProject(request.name, principal);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Read the current authoritative Project by domain ID."
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "CasaStudio Project domain ID. Must be lowercase kebab-case.",
    schema: {
      type: "string",
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      example: "demo-project"
    }
  })
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiInternalServerErrorResponse({ type: ProblemDetailsDto })
  async getProject(
    @Param("id", ProjectIdPipe) projectId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ): Promise<ProjectResponseDto> {
    return this.getProjectService.getProject(projectId, principal);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a complete authoritative Project." })
  @ApiParam({
    name: "id",
    required: true,
    description: "CasaStudio Project domain ID. Must be lowercase kebab-case.",
    schema: {
      type: "string",
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      example: "demo-project"
    }
  })
  @ApiNoContentResponse({ description: "The Project was deleted." })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiInternalServerErrorResponse({ type: ProblemDetailsDto })
  async deleteProject(
    @Param("id", ProjectIdPipe) projectId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ): Promise<void> {
    await this.deleteProjectService.deleteProject(projectId, principal);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace the complete authoritative Project state." })
  @ApiParam({
    name: "id",
    required: true,
    description: "CasaStudio Project domain ID. Must be lowercase kebab-case.",
    schema: {
      type: "string",
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      example: "demo-project"
    }
  })
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiConflictResponse({ type: ProblemDetailsDto })
  @ApiUnprocessableEntityResponse({ type: ProblemDetailsDto })
  @ApiInternalServerErrorResponse({ type: ProblemDetailsDto })
  async replaceProject(
    @Param("id", ProjectIdPipe) projectId: string,
    @Body() request: ReplaceProjectRequestDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ): Promise<ProjectResponseDto> {
    return this.replaceProjectService.replaceProject(
      projectId,
      request.baseRevision,
      request.project,
      principal
    );
  }
}
