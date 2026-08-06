import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AuthenticatedPrincipal } from "../../auth/authenticated-principal";
import { AuthorizedProjectLoader } from "../application/authorized-project-loader.service";
import { GeometrySnapshotApiMapper, GeometrySnapshotSerializationInvariantError } from "./geometry-snapshot-api.mapper";
import {
  PROJECT_GEOMETRY_BUILDER,
  type ProjectGeometryBuilder
} from "./project-geometry-builder";
import {
  ProjectGeometryBuildFailedError,
  ProjectGeometryInvalidError,
  ProjectGeometrySerializationFailedError
} from "./project-geometry.errors";
import type { ProjectGeometryResponseDto } from "./dto/project-geometry-response.dto";

/**
 * Application use case for authoritative read-only Project geometry snapshots.
 *
 * The service loads and authorizes the canonical Project once, derives runtime
 * geometry through the Geometry Engine boundary, maps it to explicit transport
 * DTOs, and returns source Project identity and revision from persisted state.
 * It performs no persistence writes, mutation, caching, background work, or
 * controller-specific serialization.
 */
@Injectable()
export class GetProjectGeometryService {
  private readonly logger = new Logger(GetProjectGeometryService.name);

  constructor(
    @Inject(AuthorizedProjectLoader) private readonly authorizedProjectLoader: AuthorizedProjectLoader,
    @Inject(PROJECT_GEOMETRY_BUILDER) private readonly geometryBuilder: ProjectGeometryBuilder,
    @Inject(GeometrySnapshotApiMapper) private readonly geometrySnapshotApiMapper: GeometrySnapshotApiMapper
  ) {}

  /**
   * Returns the derived geometry snapshot for an authorized Project reader.
   *
   * Geometry build diagnostics become `PROJECT_GEOMETRY_INVALID`; unexpected
   * engine exceptions become `PROJECT_GEOMETRY_BUILD_FAILED`; mapper invariant
   * failures become `PROJECT_GEOMETRY_SERIALIZATION_FAILED`.
   */
  async getProjectGeometry(
    projectId: string,
    principal: AuthenticatedPrincipal
  ): Promise<ProjectGeometryResponseDto> {
    const {
      loadedProject: { project },
      authorizedByRole
    } = await this.authorizedProjectLoader.load(projectId, principal);
    const startedAt = performance.now();
    let buildResult;

    try {
      buildResult = this.geometryBuilder.build(project);
    } catch (error) {
      throw new ProjectGeometryBuildFailedError(project.id, error);
    }

    if (!buildResult.ok) {
      throw new ProjectGeometryInvalidError(project.id, buildResult.errors);
    }

    try {
      const response = this.geometrySnapshotApiMapper.toProjectGeometryResponse(project, buildResult.model);
      const geometryBuildDurationMs = performance.now() - startedAt;

      this.logger.debug(
        {
          projectId: project.id,
          sourceRevision: project.revision,
          principalSubject: principal.subject,
          authorizedByRole,
          geometryBuildDurationMs,
          levelCount: response.geometry.levels.length,
          roomCount: response.geometry.levels.reduce((count, level) => count + level.polygons.length, 0),
          wallCount: response.geometry.levels.reduce((count, level) => count + level.boundaryEdges.length, 0)
        },
        "Project geometry build completed"
      );

      return response;
    } catch (error) {
      if (error instanceof GeometrySnapshotSerializationInvariantError) {
        throw new ProjectGeometrySerializationFailedError(project.id, error);
      }

      throw new ProjectGeometrySerializationFailedError(project.id, error);
    }
  }
}
