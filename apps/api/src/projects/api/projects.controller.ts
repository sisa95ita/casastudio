import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse
} from "@nestjs/swagger";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { CurrentPrincipal } from "../../auth/current-principal.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ProblemDetailsDto } from "../../common/problem-details/problem-details.dto";
import { GetProjectService } from "../application/get-project.service";
import {
  BaseImageDto,
  BuildingDto,
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
  WallDto
} from "./project.dto";
import { ProjectIdPipe } from "./project-id.pipe";

/**
 * HTTP controller for authoritative read-only Project endpoints.
 *
 * The controller validates route parameters, receives the sanitized
 * authenticated principal, delegates loading and authorization to the
 * application service, and returns explicit transport DTOs.
 */
@ApiTags("projects")
@ApiBearerAuth("bearer")
@ApiExtraModels(
  ProjectResponseDto,
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
  constructor(@Inject(GetProjectService) private readonly getProjectService: GetProjectService) {}

  @Get(":id")
  @ApiOperation({ summary: "Read the current authoritative Project by domain ID." })
  @ApiParam({
    name: "id",
    required: true,
    description: "CasaStudio Project domain ID. Must be lowercase kebab-case.",
    schema: {
      type: "string",
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      example: "casa-studio-canonical-project"
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
}
