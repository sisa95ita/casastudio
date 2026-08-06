import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

const lengthUnitValues = ["cm"] as const;
const angleUnitValues = ["deg"] as const;
const boundaryEdgeUseDirectionValues = ["FORWARD", "REVERSE"] as const;
const loopKindValues = ["OUTER", "INNER"] as const;
const polygonWindingValues = ["CLOCKWISE", "COUNTER_CLOCKWISE", "DEGENERATE"] as const;

/**
 * Two-dimensional point in the Project's local XZ coordinate plane.
 *
 * Coordinates are emitted in the source Project length unit without rounding
 * or unit conversion. Non-finite numeric values are rejected before transport.
 */
export class GeometryPoint2DDto {
  @ApiProperty({ type: Number })
  readonly x!: number;

  @ApiProperty({ type: Number })
  readonly z!: number;
}

/**
 * Length and angle units that apply to the derived geometry snapshot.
 *
 * The API preserves source Project units and does not silently convert
 * coordinates, wall dimensions, polygon areas, or elevations.
 */
export class GeometryUnitsDto {
  @ApiProperty({ enum: lengthUnitValues, enumName: "GeometryLengthUnit" })
  readonly length!: (typeof lengthUnitValues)[number];

  @ApiProperty({ enum: angleUnitValues, enumName: "GeometryAngleUnit" })
  readonly angle!: (typeof angleUnitValues)[number];
}

/**
 * Immutable XZ bounds derived by the Geometry Engine for a room polygon.
 *
 * Bounds use source Project length units and cover only level-local XZ plan
 * coordinates; elevation and wall height are represented separately.
 */
export class GeometryBoundsDto {
  @ApiProperty({ type: Number })
  readonly minX!: number;

  @ApiProperty({ type: Number })
  readonly minZ!: number;

  @ApiProperty({ type: Number })
  readonly maxX!: number;

  @ApiProperty({ type: Number })
  readonly maxZ!: number;
}

/**
 * Deduplicated runtime vertex within a single source Level.
 *
 * `incidentBoundaryEdgeIds` is sorted lexically because incident adjacency is a
 * set-like relationship, while `x` and `z` preserve exact Geometry Engine
 * numeric output in Project length units.
 */
export class GeometryVertexDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiProperty({ type: Number })
  readonly x!: number;

  @ApiProperty({ type: Number })
  readonly z!: number;

  @ApiProperty({ type: [String] })
  readonly incidentBoundaryEdgeIds!: readonly string[];
}

/**
 * Physical wall-like runtime boundary edge derived from one source Wall.
 *
 * The edge preserves the source Wall's canonical start-to-end direction.
 * Room-specific traversal direction is represented by `GeometryBoundaryEdgeUseDto`.
 */
export class GeometryBoundaryEdgeDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiProperty({ type: String })
  readonly sourceWallId!: string;

  @ApiProperty({ type: String })
  readonly startVertexId!: string;

  @ApiProperty({ type: String })
  readonly endVertexId!: string;

  @ApiProperty({ type: () => GeometryPoint2DDto })
  readonly start!: GeometryPoint2DDto;

  @ApiProperty({ type: () => GeometryPoint2DDto })
  readonly end!: GeometryPoint2DDto;

  @ApiProperty({ type: Number })
  readonly thickness!: number;

  @ApiProperty({ type: Number })
  readonly height!: number;
}

/**
 * Ordered loop-relative traversal of a physical boundary edge.
 *
 * The array order of edge uses preserves the Geometry Engine's explicit
 * sequence. For room outer loops this mirrors canonical Room boundary order.
 */
export class GeometryBoundaryEdgeUseDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiProperty({ type: String })
  readonly boundaryEdgeId!: string;

  @ApiProperty({ type: String })
  readonly sourceWallId!: string;

  @ApiProperty({ enum: boundaryEdgeUseDirectionValues, enumName: "GeometryBoundaryEdgeUseDirection" })
  readonly direction!: (typeof boundaryEdgeUseDirectionValues)[number];

  @ApiProperty({ type: Number })
  readonly index!: number;

  @ApiProperty({ type: String })
  readonly loopId!: string;

  @ApiProperty({ type: String })
  readonly startVertexId!: string;

  @ApiProperty({ type: String })
  readonly endVertexId!: string;

  @ApiProperty({ type: () => GeometryPoint2DDto })
  readonly start!: GeometryPoint2DDto;

  @ApiProperty({ type: () => GeometryPoint2DDto })
  readonly end!: GeometryPoint2DDto;
}

/**
 * Closed ordered boundary traversal owned by one polygon.
 *
 * Identifier arrays preserve semantic loop order. The loop DTO uses IDs rather
 * than nested object references so the transport graph cannot contain cycles.
 */
export class GeometryLoopDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiProperty({ enum: loopKindValues, enumName: "GeometryLoopKind" })
  readonly kind!: (typeof loopKindValues)[number];

  @ApiProperty({ type: String })
  readonly polygonId!: string;

  @ApiProperty({ type: [String] })
  readonly boundaryEdgeUseIds!: readonly string[];

  @ApiProperty({ type: [String] })
  readonly boundaryEdgeIds!: readonly string[];

  @ApiProperty({ type: [String] })
  readonly vertexIds!: readonly string[];
}

/**
 * Engine-derived polygon measurements for one source Room boundary.
 *
 * Area values use square source Project length units. `signedArea` preserves
 * traversal orientation, while `area` is the absolute planar area.
 */
export class GeometryPolygonMetricsDto {
  @ApiProperty({ type: Number })
  readonly signedArea!: number;

  @ApiProperty({ type: Number })
  readonly area!: number;

  @ApiProperty({ enum: polygonWindingValues, enumName: "GeometryPolygonWinding" })
  readonly winding!: (typeof polygonWindingValues)[number];

  @ApiProperty({ type: () => GeometryBoundsDto })
  readonly bounds!: GeometryBoundsDto;

  @ApiProperty({ type: () => GeometryPoint2DDto })
  readonly centroid!: GeometryPoint2DDto;
}

/**
 * Room-derived runtime polygon.
 *
 * Polygon IDs are runtime geometry IDs, while `sourceRoomId` preserves the
 * canonical Project domain ID that produced the polygon. Boundary, loop, and
 * vertex identifier arrays preserve Geometry Engine traversal order.
 */
export class GeometryPolygonDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiProperty({ type: String })
  readonly sourceRoomId!: string;

  @ApiProperty({ type: String })
  readonly outerLoopId!: string;

  @ApiProperty({ type: [String] })
  readonly innerLoopIds!: readonly string[];

  @ApiProperty({ type: [String] })
  readonly loopIds!: readonly string[];

  @ApiProperty({ type: [String] })
  readonly boundaryEdgeUseIds!: readonly string[];

  @ApiProperty({ type: [String] })
  readonly boundaryEdgeIds!: readonly string[];

  @ApiProperty({ type: [String] })
  readonly vertexIds!: readonly string[];

  @ApiProperty({ type: () => GeometryPolygonMetricsDto })
  readonly metrics!: GeometryPolygonMetricsDto;
}

/**
 * Runtime geometry derived for one source Level.
 *
 * Top-level arrays preserve the Geometry Engine's deterministic order. Loop
 * and polygon subarrays preserve semantic boundary traversal order.
 */
export class GeometryLevelDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiProperty({ type: String })
  readonly sourceLevelId!: string;

  @ApiProperty({ type: Number })
  readonly elevation!: number;

  @ApiProperty({ type: () => [GeometryVertexDto] })
  readonly vertices!: readonly GeometryVertexDto[];

  @ApiProperty({ type: () => [GeometryBoundaryEdgeDto] })
  readonly boundaryEdges!: readonly GeometryBoundaryEdgeDto[];

  @ApiProperty({ type: () => [GeometryBoundaryEdgeUseDto] })
  readonly boundaryEdgeUses!: readonly GeometryBoundaryEdgeUseDto[];

  @ApiProperty({ type: () => [GeometryLoopDto] })
  readonly loops!: readonly GeometryLoopDto[];

  @ApiProperty({ type: () => [GeometryPolygonDto] })
  readonly polygons!: readonly GeometryPolygonDto[];
}

/**
 * Backend-owned transport snapshot of the current Geometry Engine output.
 *
 * The snapshot contains plain DTO objects only: no Prisma records, Maps, Sets,
 * runtime class instances, methods, circular references, or owner metadata.
 */
export class GeometrySnapshotDto {
  @ApiProperty({ type: String })
  readonly id!: string;

  @ApiProperty({ type: () => GeometryUnitsDto })
  readonly units!: GeometryUnitsDto;

  @ApiProperty({ type: () => [GeometryLevelDto] })
  readonly levels!: readonly GeometryLevelDto[];
}

/**
 * Authoritative geometry response envelope for a Project revision.
 *
 * `sourceProjectId` and `sourceRevision` are copied from the canonical
 * persisted Project loaded for this request. The nested geometry snapshot
 * contains only derived geometry and unit metadata needed to interpret numbers.
 */
export class ProjectGeometryResponseDto {
  @ApiProperty({ type: String })
  readonly sourceProjectId!: string;

  @ApiProperty({ type: Number })
  readonly sourceRevision!: number;

  @ApiProperty({ type: () => GeometrySnapshotDto })
  readonly geometry!: GeometrySnapshotDto;
}

/**
 * Safe diagnostic item for geometry build failures.
 *
 * This DTO is not used for successful snapshots, but is registered in OpenAPI
 * so diagnostic responses can reuse the same public vocabulary.
 */
export class GeometryDiagnosticDto {
  @ApiProperty({ type: String })
  readonly code!: string;

  @ApiPropertyOptional({ type: String })
  readonly path?: string;

  @ApiPropertyOptional({ type: String })
  readonly sourceId?: string;
}
