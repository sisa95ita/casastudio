import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsObject, IsString, Min, MinLength } from "class-validator";
import {
  BuildingTypeValues,
  OpeningTypeValues,
  ProjectionTypeValues,
  RenderStatusValues,
  RoomTypeValues,
  SUPPORTED_PROJECT_SCHEMA_VERSIONS
} from "@casastudio/schema";

const roomBoundaryDirectionValues = ["FORWARD", "REVERSE"] as const;
const lengthUnitValues = ["cm"] as const;
const angleUnitValues = ["deg"] as const;

/**
 * Two-dimensional point in the Project's local XZ coordinate plane.
 */
export class Point2DDto {
  @ApiProperty({ type: Number })
  readonly x!: number;

  @ApiProperty({ type: Number })
  readonly z!: number;
}

/**
 * Three-dimensional point in the Project's local XYZ coordinate space.
 */
export class Point3DDto {
  @ApiProperty({ type: Number })
  readonly x!: number;

  @ApiProperty({ type: Number })
  readonly y!: number;

  @ApiProperty({ type: Number })
  readonly z!: number;
}

/**
 * Measurement units declared by the canonical Project.
 */
export class ProjectUnitsDto {
  @ApiProperty({ enum: lengthUnitValues, enumName: "ProjectLengthUnit" })
  readonly length!: "cm";

  @ApiProperty({ enum: angleUnitValues, enumName: "ProjectAngleUnit" })
  readonly angle!: "deg";
}

/**
 * Ordered and oriented wall reference in a Room boundary.
 */
export class RoomBoundaryEdgeDto {
  @ApiProperty({ type: String, description: "CasaStudio domain ID of the referenced Wall." })
  readonly wallId!: string;

  @ApiProperty({ enum: roomBoundaryDirectionValues, enumName: "RoomBoundaryDirection" })
  readonly direction!: (typeof roomBoundaryDirectionValues)[number];
}

/**
 * Functional Room owned by a Building Level.
 */
export class RoomDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiProperty({ type: String })
  readonly name!: string;

  @ApiProperty({ enum: RoomTypeValues, enumName: "RoomType" })
  readonly type!: (typeof RoomTypeValues)[number];

  @ApiPropertyOptional({ type: String })
  readonly description?: string;

  @ApiPropertyOptional({ type: Number })
  readonly elevation?: number;

  @ApiProperty({ type: () => [RoomBoundaryEdgeDto] })
  readonly boundary!: readonly RoomBoundaryEdgeDto[];
}

/**
 * Door or window opening owned by a Wall.
 */
export class OpeningDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiPropertyOptional({ type: String })
  readonly name?: string;

  @ApiPropertyOptional({ type: String })
  readonly description?: string;

  @ApiProperty({ enum: OpeningTypeValues, enumName: "OpeningType" })
  readonly type!: (typeof OpeningTypeValues)[number];

  @ApiProperty({ type: Number })
  readonly offsetFromStart!: number;

  @ApiProperty({ type: Number })
  readonly width!: number;

  @ApiProperty({ type: Number })
  readonly height!: number;

  @ApiProperty({ type: Number })
  readonly elevation!: number;

  @ApiPropertyOptional({ type: [String] })
  readonly connectedRoomIds?: readonly string[];
}

/**
 * Physical wall segment in a Level coordinate space.
 */
export class WallDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiPropertyOptional({ type: String })
  readonly name?: string;

  @ApiPropertyOptional({ type: String })
  readonly description?: string;

  @ApiProperty({ type: () => Point2DDto })
  readonly start!: Point2DDto;

  @ApiProperty({ type: () => Point2DDto })
  readonly end!: Point2DDto;

  @ApiProperty({ type: Number })
  readonly height!: number;

  @ApiProperty({ type: Number })
  readonly thickness!: number;

  @ApiProperty({ type: [String] })
  readonly roomIds!: readonly string[];

  @ApiProperty({ type: () => [OpeningDto] })
  readonly openings!: readonly OpeningDto[];
}

/**
 * Measured run within a Staircase.
 */
export class StairFlightDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiPropertyOptional({ type: String })
  readonly name?: string;

  @ApiPropertyOptional({ type: String })
  readonly description?: string;

  @ApiProperty({ type: () => Point2DDto })
  readonly start!: Point2DDto;

  @ApiProperty({ type: () => Point2DDto })
  readonly end!: Point2DDto;

  @ApiProperty({ type: Number })
  readonly width!: number;

  @ApiProperty({ type: Number })
  readonly stepCount!: number;

  @ApiProperty({ type: Number })
  readonly startElevation!: number;

  @ApiProperty({ type: Number })
  readonly endElevation!: number;
}

/**
 * Architectural landing within a Staircase layout.
 */
export class StairLandingDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiPropertyOptional({ type: String })
  readonly name?: string;

  @ApiPropertyOptional({ type: String })
  readonly description?: string;

  @ApiProperty({ type: () => Point2DDto })
  readonly position!: Point2DDto;

  @ApiProperty({ type: Number })
  readonly width!: number;

  @ApiProperty({ type: Number })
  readonly depth!: number;

  @ApiProperty({ type: Number })
  readonly elevation!: number;
}

/**
 * Staircase connecting Levels and optionally Rooms.
 */
export class StaircaseDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiPropertyOptional({ type: String })
  readonly name?: string;

  @ApiPropertyOptional({ type: String })
  readonly description?: string;

  @ApiProperty({ type: String })
  readonly fromLevelId!: string;

  @ApiProperty({ type: String })
  readonly toLevelId!: string;

  @ApiPropertyOptional({ type: String })
  readonly fromRoomId?: string;

  @ApiPropertyOptional({ type: String })
  readonly toRoomId?: string;

  @ApiProperty({ type: Number })
  readonly width!: number;

  @ApiProperty({ type: () => [StairFlightDto] })
  readonly flights!: readonly StairFlightDto[];

  @ApiProperty({ type: () => [StairLandingDto] })
  readonly landings!: readonly StairLandingDto[];
}

/**
 * Building level containing Rooms, Walls, and Staircases.
 */
export class LevelDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiProperty({ type: String })
  readonly name!: string;

  @ApiProperty({ type: Number })
  readonly elevation!: number;

  @ApiProperty({ type: () => [RoomDto] })
  readonly rooms!: readonly RoomDto[];

  @ApiProperty({ type: () => [WallDto] })
  readonly walls!: readonly WallDto[];

  @ApiProperty({ type: () => [StaircaseDto] })
  readonly staircases!: readonly StaircaseDto[];
}

/**
 * Physical property aggregate contained by a Project.
 */
export class BuildingDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiProperty({ type: String })
  readonly name!: string;

  @ApiProperty({ enum: BuildingTypeValues, enumName: "BuildingType" })
  readonly type!: (typeof BuildingTypeValues)[number];

  @ApiProperty({ type: () => [LevelDto] })
  readonly levels!: readonly LevelDto[];
}

/**
 * Saved camera perspective used by Project rendering workflows.
 */
export class ViewpointDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiPropertyOptional({ type: String })
  readonly name?: string;

  @ApiPropertyOptional({ type: String })
  readonly description?: string;

  @ApiProperty({ type: String })
  readonly levelId!: string;

  @ApiPropertyOptional({ type: String })
  readonly roomId?: string;

  @ApiProperty({ type: () => Point3DDto })
  readonly cameraPosition!: Point3DDto;

  @ApiProperty({ type: () => Point3DDto })
  readonly cameraTarget!: Point3DDto;

  @ApiProperty({ type: Number })
  readonly fieldOfView!: number;

  @ApiProperty({ enum: ProjectionTypeValues, enumName: "ProjectionType" })
  readonly projection!: (typeof ProjectionTypeValues)[number];
}

/**
 * Visual reference artifact derived from a Viewpoint.
 */
export class BaseImageDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiPropertyOptional({ type: String })
  readonly name?: string;

  @ApiPropertyOptional({ type: String })
  readonly description?: string;

  @ApiProperty({ type: String })
  readonly viewpointId!: string;

  @ApiProperty({ type: String })
  readonly assetRef!: string;

  @ApiProperty({ type: Number })
  readonly projectRevision!: number;

  @ApiProperty({ type: String, format: "date-time" })
  readonly createdAt!: string;

  @ApiPropertyOptional({ type: Number })
  readonly width?: number;

  @ApiPropertyOptional({ type: Number })
  readonly height?: number;
}

/**
 * Provider-independent design intent for render exploration.
 */
export class DesignBriefDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiPropertyOptional({ type: String })
  readonly name?: string;

  @ApiPropertyOptional({ type: String })
  readonly description?: string;

  @ApiProperty({ type: String })
  readonly promptText!: string;

  @ApiPropertyOptional({ type: String })
  readonly style?: string;

  @ApiProperty({ type: [String] })
  readonly constraints!: readonly string[];

  @ApiProperty({ type: [String] })
  readonly palette!: readonly string[];

  @ApiProperty({ type: [String] })
  readonly referenceAssetRefs!: readonly string[];

  @ApiPropertyOptional({ type: String })
  readonly notes?: string;
}

/**
 * AI-assisted design generation request metadata.
 */
export class RenderRequestDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiPropertyOptional({ type: String })
  readonly name?: string;

  @ApiPropertyOptional({ type: String })
  readonly description?: string;

  @ApiProperty({ type: String })
  readonly viewpointId!: string;

  @ApiProperty({ type: String })
  readonly baseImageId!: string;

  @ApiProperty({ type: String })
  readonly designBriefId!: string;

  @ApiProperty({ enum: RenderStatusValues, enumName: "RenderStatus" })
  readonly status!: (typeof RenderStatusValues)[number];

  @ApiPropertyOptional({ type: String })
  readonly requestedProviderId?: string;

  @ApiPropertyOptional({ type: String })
  readonly requestedModelId?: string;

  @ApiPropertyOptional({ type: Number })
  readonly requestedResultCount?: number;

  @ApiProperty({ type: String, format: "date-time" })
  readonly createdAt!: string;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  readonly startedAt?: string;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  readonly completedAt?: string;

  @ApiPropertyOptional({ type: String })
  readonly error?: string;
}

/**
 * AI-assisted design generation result metadata.
 */
export class RenderResultDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiPropertyOptional({ type: String })
  readonly name?: string;

  @ApiPropertyOptional({ type: String })
  readonly description?: string;

  @ApiProperty({ type: String })
  readonly renderRequestId!: string;

  @ApiProperty({ enum: RenderStatusValues, enumName: "RenderStatus" })
  readonly status!: (typeof RenderStatusValues)[number];

  @ApiProperty({ type: String, format: "date-time" })
  readonly createdAt!: string;

  @ApiPropertyOptional({ type: String })
  readonly assetRef?: string;

  @ApiPropertyOptional({ type: String })
  readonly providerId?: string;

  @ApiPropertyOptional({ type: String })
  readonly modelId?: string;

  @ApiPropertyOptional({ type: String })
  readonly notes?: string;

  @ApiPropertyOptional({ type: Boolean })
  readonly favorite?: boolean;

  @ApiPropertyOptional({ type: String })
  readonly error?: string;

  @ApiPropertyOptional({ type: Number })
  readonly width?: number;

  @ApiPropertyOptional({ type: Number })
  readonly height?: number;
}

/**
 * Explicit transport representation of the canonical CasaStudio Project.
 */
export class ProjectDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiProperty({ type: String })
  readonly name!: string;

  @ApiProperty({ enum: SUPPORTED_PROJECT_SCHEMA_VERSIONS, enumName: "ProjectSchemaVersion" })
  readonly schemaVersion!: (typeof SUPPORTED_PROJECT_SCHEMA_VERSIONS)[number];

  @ApiProperty({ type: Number })
  readonly revision!: number;

  @ApiProperty({ type: String, format: "date-time" })
  readonly createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  readonly updatedAt!: string;

  @ApiProperty({ type: () => ProjectUnitsDto })
  readonly units!: ProjectUnitsDto;

  @ApiProperty({ type: () => BuildingDto })
  readonly building!: BuildingDto;

  @ApiProperty({ type: () => [ViewpointDto] })
  readonly viewpoints!: readonly ViewpointDto[];

  @ApiProperty({ type: () => [BaseImageDto] })
  readonly baseImages!: readonly BaseImageDto[];

  @ApiProperty({ type: () => [DesignBriefDto] })
  readonly designBriefs!: readonly DesignBriefDto[];

  @ApiProperty({ type: () => [RenderRequestDto] })
  readonly renderRequests!: readonly RenderRequestDto[];

  @ApiProperty({ type: () => [RenderResultDto] })
  readonly renderResults!: readonly RenderResultDto[];
}

/**
 * Authoritative read response envelope for a Project.
 */
export class ProjectResponseDto {
  @ApiProperty({ type: () => ProjectDto })
  readonly project!: ProjectDto;

  @ApiProperty({ type: Number, description: "Authoritative persisted Project revision used as the response source." })
  readonly sourceRevision!: number;
}

/** Lightweight Project representation used for discovery and navigation. */
export class ProjectSummaryDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiProperty({ type: String })
  readonly name!: string;

  @ApiProperty({ type: Number })
  readonly revision!: number;

  @ApiProperty({ type: String, format: "date-time" })
  readonly updatedAt!: string;
}

/** Authenticated Project discovery response. */
export class ProjectListResponseDto {
  @ApiProperty({ type: () => [ProjectSummaryDto] })
  readonly projects!: readonly ProjectSummaryDto[];
}

/** Intent-focused request for creating an editable Project. */
export class CreateProjectRequestDto {
  @ApiProperty({ type: String, example: "My apartment" })
  @IsString()
  @MinLength(1)
  readonly name!: string;
}

/** Complete aggregate replacement request based on an authoritative revision. */
export class ReplaceProjectRequestDto {
  @ApiProperty({ type: Number, minimum: 1 })
  @IsInt()
  @Min(1)
  readonly baseRevision!: number;

  @ApiProperty({ type: () => ProjectDto })
  @IsObject()
  readonly project!: ProjectDto;
}
