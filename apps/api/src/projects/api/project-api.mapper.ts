import { Injectable } from "@nestjs/common";
import type {
  BaseImage,
  Building,
  DesignBrief,
  Level,
  Opening,
  Point2D,
  Point3D,
  Project,
  RenderRequest,
  RenderResult,
  Room,
  RoomBoundaryEdge,
  Staircase,
  StairFlight,
  StairLanding,
  Viewpoint,
  Wall
} from "@casastudio/schema";

import type {
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
import type { ProjectSummary } from "../persistence/project.repository";
import type { ProjectListResponseDto } from "./project.dto";

/**
 * Maps canonical Project aggregates to backend-owned HTTP response DTOs.
 *
 * The mapper has no Prisma, Nest request, Geometry Engine, or persistence
 * dependencies. Every response is a fresh object graph and preserves canonical
 * array ordering, domain IDs, timestamps, units, enums, and revision values.
 */
@Injectable()
export class ProjectApiMapper {
  /** Builds the discovery response without reconstructing full aggregates. */
  toProjectListResponse(summaries: readonly ProjectSummary[]): ProjectListResponseDto {
    return {
      projects: summaries.map((summary) => ({ ...summary }))
    };
  }

  /**
   * Builds the authoritative read response envelope for a canonical Project.
   */
  toProjectResponse(project: Project): ProjectResponseDto {
    return {
      project: this.toProjectDto(project),
      sourceRevision: project.revision
    };
  }

  private toProjectDto(project: Project): ProjectDto {
    return {
      id: project.id,
      name: project.name,
      schemaVersion: project.schemaVersion,
      revision: project.revision,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      units: this.toUnitsDto(project.units),
      building: this.toBuildingDto(project.building),
      viewpoints: project.viewpoints.map((viewpoint) => this.toViewpointDto(viewpoint)),
      baseImages: project.baseImages.map((baseImage) => this.toBaseImageDto(baseImage)),
      designBriefs: project.designBriefs.map((designBrief) => this.toDesignBriefDto(designBrief)),
      renderRequests: project.renderRequests.map((renderRequest) => this.toRenderRequestDto(renderRequest)),
      renderResults: project.renderResults.map((renderResult) => this.toRenderResultDto(renderResult))
    };
  }

  private toUnitsDto(units: Project["units"]): ProjectUnitsDto {
    return {
      length: units.length,
      angle: units.angle
    };
  }

  private toBuildingDto(building: Building): BuildingDto {
    return {
      id: building.id,
      name: building.name,
      type: building.type,
      levels: building.levels.map((level) => this.toLevelDto(level))
    };
  }

  private toLevelDto(level: Level): LevelDto {
    return {
      id: level.id,
      name: level.name,
      elevation: level.elevation,
      rooms: level.rooms.map((room) => this.toRoomDto(room)),
      walls: level.walls.map((wall) => this.toWallDto(wall)),
      staircases: level.staircases.map((staircase) => this.toStaircaseDto(staircase))
    };
  }

  private toRoomDto(room: Room): RoomDto {
    return {
      id: room.id,
      name: room.name,
      type: room.type,
      description: room.description,
      elevation: room.elevation,
      boundary: room.boundary.map((edge) => this.toRoomBoundaryEdgeDto(edge))
    };
  }

  private toRoomBoundaryEdgeDto(edge: RoomBoundaryEdge): RoomBoundaryEdgeDto {
    return {
      wallId: edge.wallId,
      direction: edge.direction
    };
  }

  private toWallDto(wall: Wall): WallDto {
    return {
      id: wall.id,
      name: wall.name,
      description: wall.description,
      start: this.toPoint2DDto(wall.start),
      end: this.toPoint2DDto(wall.end),
      height: wall.height,
      thickness: wall.thickness,
      roomIds: [...wall.roomIds],
      openings: wall.openings.map((opening) => this.toOpeningDto(opening))
    };
  }

  private toOpeningDto(opening: Opening): OpeningDto {
    const commonOpening = {
      id: opening.id,
      name: opening.name,
      description: opening.description,
      type: opening.type,
      offsetFromStart: opening.offsetFromStart,
      width: opening.width,
      height: opening.height,
      elevation: opening.elevation
    };

    if (opening.type === "DOOR") {
      return {
        ...commonOpening,
        connectedRoomIds: opening.connectedRoomIds ? [...opening.connectedRoomIds] : undefined
      };
    }

    return commonOpening;
  }

  private toStaircaseDto(staircase: Staircase): StaircaseDto {
    return {
      id: staircase.id,
      name: staircase.name,
      description: staircase.description,
      fromLevelId: staircase.fromLevelId,
      toLevelId: staircase.toLevelId,
      fromRoomId: staircase.fromRoomId,
      toRoomId: staircase.toRoomId,
      width: staircase.width,
      flights: staircase.flights.map((flight) => this.toStairFlightDto(flight)),
      landings: staircase.landings.map((landing) => this.toStairLandingDto(landing))
    };
  }

  private toStairFlightDto(flight: StairFlight): StairFlightDto {
    return {
      id: flight.id,
      name: flight.name,
      description: flight.description,
      start: this.toPoint2DDto(flight.start),
      end: this.toPoint2DDto(flight.end),
      width: flight.width,
      stepCount: flight.stepCount,
      startElevation: flight.startElevation,
      endElevation: flight.endElevation
    };
  }

  private toStairLandingDto(landing: StairLanding): StairLandingDto {
    return {
      id: landing.id,
      name: landing.name,
      description: landing.description,
      position: this.toPoint2DDto(landing.position),
      width: landing.width,
      depth: landing.depth,
      elevation: landing.elevation
    };
  }

  private toViewpointDto(viewpoint: Viewpoint): ViewpointDto {
    return {
      id: viewpoint.id,
      name: viewpoint.name,
      description: viewpoint.description,
      levelId: viewpoint.levelId,
      roomId: viewpoint.roomId,
      cameraPosition: this.toPoint3DDto(viewpoint.cameraPosition),
      cameraTarget: this.toPoint3DDto(viewpoint.cameraTarget),
      fieldOfView: viewpoint.fieldOfView,
      projection: viewpoint.projection
    };
  }

  private toBaseImageDto(baseImage: BaseImage): BaseImageDto {
    return {
      id: baseImage.id,
      name: baseImage.name,
      description: baseImage.description,
      viewpointId: baseImage.viewpointId,
      assetRef: baseImage.assetRef,
      projectRevision: baseImage.projectRevision,
      createdAt: baseImage.createdAt,
      width: baseImage.width,
      height: baseImage.height
    };
  }

  private toDesignBriefDto(designBrief: DesignBrief): DesignBriefDto {
    return {
      id: designBrief.id,
      name: designBrief.name,
      description: designBrief.description,
      promptText: designBrief.promptText,
      style: designBrief.style,
      constraints: [...designBrief.constraints],
      palette: [...designBrief.palette],
      referenceAssetRefs: [...designBrief.referenceAssetRefs],
      notes: designBrief.notes
    };
  }

  private toRenderRequestDto(renderRequest: RenderRequest): RenderRequestDto {
    return {
      id: renderRequest.id,
      name: renderRequest.name,
      description: renderRequest.description,
      viewpointId: renderRequest.viewpointId,
      baseImageId: renderRequest.baseImageId,
      designBriefId: renderRequest.designBriefId,
      status: renderRequest.status,
      requestedProviderId: renderRequest.requestedProviderId,
      requestedModelId: renderRequest.requestedModelId,
      requestedResultCount: renderRequest.requestedResultCount,
      createdAt: renderRequest.createdAt,
      startedAt: renderRequest.startedAt,
      completedAt: renderRequest.completedAt,
      error: renderRequest.error
    };
  }

  private toRenderResultDto(renderResult: RenderResult): RenderResultDto {
    return {
      id: renderResult.id,
      name: renderResult.name,
      description: renderResult.description,
      renderRequestId: renderResult.renderRequestId,
      status: renderResult.status,
      createdAt: renderResult.createdAt,
      assetRef: renderResult.assetRef,
      providerId: renderResult.providerId,
      modelId: renderResult.modelId,
      notes: renderResult.notes,
      favorite: renderResult.favorite,
      error: renderResult.error,
      width: renderResult.width,
      height: renderResult.height
    };
  }

  private toPoint2DDto(point: Point2D): Point2DDto {
    return {
      x: point.x,
      z: point.z
    };
  }

  private toPoint3DDto(point: Point3D): Point3DDto {
    return {
      x: point.x,
      y: point.y,
      z: point.z
    };
  }
}
