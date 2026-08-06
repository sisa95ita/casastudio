import { Injectable } from "@nestjs/common";
import type {
  BoundaryEdge,
  BoundaryEdgeUse,
  GeometryModel,
  LevelGeometry,
  Loop,
  Polygon,
  Vertex
} from "@casastudio/geometry";
import type { Project } from "@casastudio/schema";

import type {
  GeometryBoundaryEdgeDto,
  GeometryBoundaryEdgeUseDto,
  GeometryBoundsDto,
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

/**
 * Internal mapper invariant raised before an unsafe snapshot can be returned.
 *
 * Application services translate this error to the stable
 * `PROJECT_GEOMETRY_SERIALIZATION_FAILED` Problem Details code. The message is
 * intentionally precise for logs and tests, but never exposed to clients.
 */
export class GeometrySnapshotSerializationInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeometrySnapshotSerializationInvariantError";
  }
}

/**
 * Maps immutable Geometry Engine runtime models to backend-owned DTO graphs.
 *
 * The mapper creates fresh plain objects, preserves engine-provided semantic
 * ordering, converts set-like adjacency views to sorted arrays, rejects
 * non-finite numeric values, and never serializes runtime class instances,
 * Maps, Sets, private fields, methods, or circular references.
 */
@Injectable()
export class GeometrySnapshotApiMapper {
  /**
   * Builds the authoritative Project geometry response envelope.
   *
   * Source identity and revision are copied from the canonical Project loaded
   * for this request, and must match the Geometry Engine model traceability
   * fields. Numeric values remain in source Project units.
   */
  toProjectGeometryResponse(project: Project, model: GeometryModel): ProjectGeometryResponseDto {
    this.assertSourceInvariant(project, model);

    return {
      sourceProjectId: project.id,
      sourceRevision: project.revision,
      geometry: this.toGeometrySnapshot(project, model)
    };
  }

  private toGeometrySnapshot(project: Project, model: GeometryModel): GeometrySnapshotDto {
    return {
      id: model.id,
      units: this.toUnits(project.units),
      levels: model.levels.map((level) => this.toLevel(level))
    };
  }

  private toUnits(units: Project["units"]): GeometryUnitsDto {
    return {
      length: units.length,
      angle: units.angle
    };
  }

  private toLevel(level: LevelGeometry): GeometryLevelDto {
    return {
      id: level.id,
      sourceLevelId: level.sourceLevelId,
      elevation: this.finite(level.elevation, `${level.id}.elevation`),
      vertices: level.vertices.map((vertex) => this.toVertex(vertex)),
      boundaryEdges: level.boundaryEdges.map((edge) => this.toBoundaryEdge(edge)),
      boundaryEdgeUses: level.boundaryEdgeUses.map((edgeUse) => this.toBoundaryEdgeUse(edgeUse)),
      loops: level.loops.map((loop) => this.toLoop(loop)),
      polygons: level.polygons.map((polygon) => this.toPolygon(polygon))
    };
  }

  private toVertex(vertex: Vertex): GeometryVertexDto {
    return {
      id: vertex.id,
      x: this.finite(vertex.x, `${vertex.id}.x`),
      z: this.finite(vertex.z, `${vertex.id}.z`),
      incidentBoundaryEdgeIds: vertex.incidentEdges.map((edge) => edge.id).sort((left, right) => left.localeCompare(right))
    };
  }

  private toBoundaryEdge(edge: BoundaryEdge): GeometryBoundaryEdgeDto {
    return {
      id: edge.id,
      sourceWallId: edge.sourceWallId,
      startVertexId: edge.startVertex.id,
      endVertexId: edge.endVertex.id,
      start: this.toPoint(edge.startVertex, `${edge.id}.start`),
      end: this.toPoint(edge.endVertex, `${edge.id}.end`),
      thickness: this.finite(edge.thickness, `${edge.id}.thickness`),
      height: this.finite(edge.height, `${edge.id}.height`)
    };
  }

  private toBoundaryEdgeUse(edgeUse: BoundaryEdgeUse): GeometryBoundaryEdgeUseDto {
    return {
      id: edgeUse.id,
      boundaryEdgeId: edgeUse.boundaryEdge.id,
      sourceWallId: edgeUse.boundaryEdge.sourceWallId,
      direction: edgeUse.direction,
      index: this.finite(edgeUse.index, `${edgeUse.id}.index`),
      loopId: edgeUse.loop.id,
      startVertexId: edgeUse.startVertex.id,
      endVertexId: edgeUse.endVertex.id,
      start: this.toPoint(edgeUse.startVertex, `${edgeUse.id}.start`),
      end: this.toPoint(edgeUse.endVertex, `${edgeUse.id}.end`)
    };
  }

  private toLoop(loop: Loop): GeometryLoopDto {
    return {
      id: loop.id,
      kind: loop.kind,
      polygonId: loop.polygon.id,
      boundaryEdgeUseIds: loop.edgeUses.map((edgeUse) => edgeUse.id),
      boundaryEdgeIds: loop.edgeUses.map((edgeUse) => edgeUse.boundaryEdge.id),
      vertexIds: loop.vertices.map((vertex) => vertex.id)
    };
  }

  private toPolygon(polygon: Polygon): GeometryPolygonDto {
    return {
      id: polygon.id,
      sourceRoomId: polygon.sourceRoomId,
      outerLoopId: polygon.outerLoop.id,
      innerLoopIds: polygon.innerLoops.map((loop) => loop.id),
      loopIds: polygon.loops.map((loop) => loop.id),
      boundaryEdgeUseIds: polygon.edgeUses.map((edgeUse) => edgeUse.id),
      boundaryEdgeIds: polygon.boundaryEdges.map((edge) => edge.id),
      vertexIds: polygon.vertices.map((vertex) => vertex.id),
      metrics: this.toPolygonMetrics(polygon)
    };
  }

  private toPolygonMetrics(polygon: Polygon): GeometryPolygonMetricsDto {
    return {
      signedArea: this.finite(polygon.signedArea, `${polygon.id}.signedArea`),
      area: this.finite(polygon.area, `${polygon.id}.area`),
      winding: polygon.winding,
      bounds: this.toBounds(polygon.bounds, `${polygon.id}.bounds`),
      centroid: this.toPoint(polygon.centroid, `${polygon.id}.centroid`)
    };
  }

  private toBounds(bounds: GeometryBoundsDto, path: string): GeometryBoundsDto {
    return {
      minX: this.finite(bounds.minX, `${path}.minX`),
      minZ: this.finite(bounds.minZ, `${path}.minZ`),
      maxX: this.finite(bounds.maxX, `${path}.maxX`),
      maxZ: this.finite(bounds.maxZ, `${path}.maxZ`)
    };
  }

  private toPoint(point: GeometryPoint2DDto, path: string): GeometryPoint2DDto {
    return {
      x: this.finite(point.x, `${path}.x`),
      z: this.finite(point.z, `${path}.z`)
    };
  }

  private assertSourceInvariant(project: Project, model: GeometryModel): void {
    if (project.id !== model.sourceProjectId) {
      throw new GeometrySnapshotSerializationInvariantError(
        `Geometry model sourceProjectId "${model.sourceProjectId}" does not match Project "${project.id}".`
      );
    }

    if (project.revision !== model.sourceRevision) {
      throw new GeometrySnapshotSerializationInvariantError(
        `Geometry model sourceRevision ${model.sourceRevision} does not match Project revision ${project.revision}.`
      );
    }
  }

  private finite(value: number, path: string): number {
    if (!Number.isFinite(value)) {
      throw new GeometrySnapshotSerializationInvariantError(
        `Geometry snapshot numeric value at "${path}" must be finite.`
      );
    }

    return value;
  }
}
