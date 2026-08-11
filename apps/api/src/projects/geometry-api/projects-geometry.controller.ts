import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { CurrentPrincipal } from "../../auth/current-principal.decorator";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ProblemDetailsDto } from "../../common/problem-details/problem-details.dto";
import { ProjectIdPipe } from "../api/project-id.pipe";
import {
  GeometryBoundsDto,
  GeometryBoundaryEdgeDto,
  GeometryBoundaryEdgeUseDto,
  GeometryDiagnosticDto,
  GeometryLevelDto,
  GeometryLoopDto,
  GeometryPoint2DDto,
  GeometryPolygonDto,
  GeometryPolygonMetricsDto,
  GeometrySnapshotDto,
  GeometryUnitsDto,
  GeometryVertexDto,
  ProjectGeometryResponseDto
} from "./dto/project-geometry-response.dto";
import { GetProjectGeometryService } from "./get-project-geometry.service";

/**
 * HTTP controller for authoritative read-only Project geometry snapshots.
 *
 * The controller validates route IDs, receives sanitized authenticated
 * principals, delegates loading/authorization/building to the application
 * service, and returns only explicit backend-owned DTOs.
 */
@ApiTags("projects")
@ApiBearerAuth("bearer")
@ApiExtraModels(
  ProjectGeometryResponseDto,
  GeometrySnapshotDto,
  GeometryUnitsDto,
  GeometryLevelDto,
  GeometryVertexDto,
  GeometryBoundaryEdgeDto,
  GeometryBoundaryEdgeUseDto,
  GeometryLoopDto,
  GeometryPolygonDto,
  GeometryPolygonMetricsDto,
  GeometryPoint2DDto,
  GeometryBoundsDto,
  GeometryDiagnosticDto,
  ProblemDetailsDto
)
@Controller({
  path: "projects",
  version: "1"
})
@UseGuards(JwtAuthGuard)
export class ProjectsGeometryController {
  constructor(@Inject(GetProjectGeometryService) private readonly getProjectGeometryService: GetProjectGeometryService) {}

  @Get(":id/geometry")
  @ApiOperation({ summary: "Read the authoritative Geometry Engine snapshot for a Project revision." })
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
  @ApiOkResponse({ type: ProjectGeometryResponseDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnauthorizedResponse({ type: ProblemDetailsDto })
  @ApiForbiddenResponse({ type: ProblemDetailsDto })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiInternalServerErrorResponse({ type: ProblemDetailsDto })
  async getProjectGeometry(
    @Param("id", ProjectIdPipe) projectId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal
  ): Promise<ProjectGeometryResponseDto> {
    return this.getProjectGeometryService.getProjectGeometry(projectId, principal);
  }
}
