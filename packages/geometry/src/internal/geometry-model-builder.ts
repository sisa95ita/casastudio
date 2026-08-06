import type { Level, Project, Wall } from "@casastudio/schema";

import { GeometryBuildErrorCode, type GeometryBuildError } from "../geometry-build-error.js";
import type { GeometryBuildResult } from "../geometry-build-result.js";
import {
  BoundaryEdge,
  BoundaryEdgeUse,
  GeometryModel,
  LevelGeometry,
  Loop,
  Polygon,
  Vertex
} from "../model/index.js";
import { calculatePolygonMetrics } from "../model/polygon-metrics.js";
import { coordinateKey, runtimeId } from "./runtime-id.js";

type MutableVertexEntry = {
  readonly vertex: Vertex;
  readonly incidentEdges: BoundaryEdge[];
};

/**
 * Mutable internal builder for one complete `GeometryModel`.
 *
 * The builder may use registries and mutable arrays while deriving topology,
 * but it returns only immutable public runtime objects. Expected source-model
 * problems are accumulated as geometry build errors and returned in the public
 * result union.
 */
export class GeometryModelBuilder {
  private readonly errors: GeometryBuildError[] = [];

  /**
   * Creates a model builder for one canonical source Project.
   */
  constructor(private readonly project: Project) {}

  /**
   * Builds immutable runtime geometry or returns collected build diagnostics.
   */
  build(): GeometryBuildResult {
    const levels = this.project.building.levels.map((level, levelIndex) =>
      this.buildLevelGeometry(level, levelIndex)
    );

    if (this.errors.length > 0) {
      return {
        ok: false,
        errors: Object.freeze([...this.errors])
      };
    }

    return {
      ok: true,
      model: new GeometryModel(
        runtimeId.model(this.project),
        this.project.id,
        this.project.revision,
        levels.filter((level): level is LevelGeometry => level !== undefined)
      )
    };
  }

  private buildLevelGeometry(level: Level, levelIndex: number): LevelGeometry | undefined {
    const vertexEntriesByCoordinate = new Map<string, MutableVertexEntry>();
    const boundaryEdgesByWallId = new Map<string, BoundaryEdge>();
    const boundaryEdgeUses: BoundaryEdgeUse[] = [];
    const loops: Loop[] = [];
    const polygons: Polygon[] = [];
    const wallsById = new Map(level.walls.map((wall) => [wall.id, wall]));
    const wallIndexesById = new Map(level.walls.map((wall, wallIndex) => [wall.id, wallIndex]));

    const getOrCreateVertex = (x: number, z: number): MutableVertexEntry => {
      const key = coordinateKey(x, z);
      const existingVertex = vertexEntriesByCoordinate.get(key);

      if (existingVertex) {
        return existingVertex;
      }

      const incidentEdges: BoundaryEdge[] = [];
      const entry: MutableVertexEntry = {
        vertex: new Vertex(runtimeId.vertex(level, x, z), x, z, () => incidentEdges),
        incidentEdges
      };

      vertexEntriesByCoordinate.set(key, entry);
      return entry;
    };

    const getOrCreateBoundaryEdge = (wall: Wall): BoundaryEdge => {
      const existingEdge = boundaryEdgesByWallId.get(wall.id);

      if (existingEdge) {
        return existingEdge;
      }

      const startVertexEntry = getOrCreateVertex(wall.start.x, wall.start.z);
      const endVertexEntry = getOrCreateVertex(wall.end.x, wall.end.z);
      const edge = new BoundaryEdge(
        runtimeId.boundaryEdge(wall),
        wall.id,
        startVertexEntry.vertex,
        endVertexEntry.vertex,
        wall.thickness,
        wall.height
      );

      boundaryEdgesByWallId.set(wall.id, edge);
      startVertexEntry.incidentEdges.push(edge);
      endVertexEntry.incidentEdges.push(edge);
      return edge;
    };

    level.rooms.forEach((room, roomIndex) => {
      if (room.boundary.length === 0) {
        return;
      }

      if (room.boundary.length < 3) {
        this.addError({
          code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
          message: `Room "${room.id}" boundary must contain at least three edges to build geometry.`,
          path: `building.levels[${levelIndex}].rooms[${roomIndex}].boundary`,
          sourceId: room.id
        });
        return;
      }

      const roomEdgeUses: BoundaryEdgeUse[] = [];
      const loopCell: { value?: Loop } = {};
      const polygonCell: { value?: Polygon } = {};
      let hasRoomError = false;

      room.boundary.forEach((boundaryEntry, boundaryIndex) => {
        const wall = wallsById.get(boundaryEntry.wallId);

        if (!wall) {
          this.addError({
            code: GeometryBuildErrorCode.MISSING_SOURCE_ENTITY,
            message: `Room "${room.id}" boundary references missing wall "${boundaryEntry.wallId}".`,
            path: `building.levels[${levelIndex}].rooms[${roomIndex}].boundary[${boundaryIndex}].wallId`,
            sourceId: boundaryEntry.wallId
          });
          hasRoomError = true;
          return;
        }

        if (wall.start.x === wall.end.x && wall.start.z === wall.end.z) {
          this.addError({
            code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
            message: `Wall "${wall.id}" cannot produce a boundary edge because its endpoints are identical.`,
            path: `building.levels[${levelIndex}].rooms[${roomIndex}].boundary[${boundaryIndex}].wallId`,
            sourceId: wall.id
          });
          hasRoomError = true;
          return;
        }

        roomEdgeUses.push(
          new BoundaryEdgeUse(
            runtimeId.boundaryEdgeUse(room, boundaryIndex),
            getOrCreateBoundaryEdge(wall),
            boundaryEntry.direction,
            boundaryIndex,
            () => this.requireBuilt(loopCell.value, "BoundaryEdgeUse.loop")
          )
        );
      });

      if (hasRoomError) {
        return;
      }

      const discontinuityIndex = this.findDiscontinuityIndex(roomEdgeUses);

      if (discontinuityIndex !== undefined) {
        this.addError({
          code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
          message: `Room "${room.id}" boundary does not form a continuous closed loop.`,
          path: `building.levels[${levelIndex}].rooms[${roomIndex}].boundary[${discontinuityIndex}]`,
          sourceId: room.id
        });
        return;
      }

      const metrics = calculatePolygonMetrics(roomEdgeUses.map((edgeUse) => edgeUse.startVertex));

      if (metrics.centroid === undefined || metrics.winding === "DEGENERATE") {
        this.addError({
          code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
          message: `Room "${room.id}" boundary produces a zero-area polygon.`,
          path: `building.levels[${levelIndex}].rooms[${roomIndex}].boundary`,
          sourceId: room.id
        });
        return;
      }

      loopCell.value = new Loop(runtimeId.outerLoop(room), "OUTER", roomEdgeUses, () =>
        this.requireBuilt(polygonCell.value, "Loop.polygon")
      );
      polygonCell.value = new Polygon(runtimeId.polygon(room), room.id, loopCell.value, [], {
        ...metrics,
        centroid: metrics.centroid
      });

      boundaryEdgeUses.push(...roomEdgeUses);
      loops.push(loopCell.value);
      polygons.push(polygonCell.value);
    });

    this.validateBoundaryEdgeUseCounts(boundaryEdgeUses, wallIndexesById, levelIndex);

    if (this.errors.length > 0) {
      return undefined;
    }

    return new LevelGeometry(
      runtimeId.level(level),
      level.id,
      level.elevation,
      [...vertexEntriesByCoordinate.values()].map((entry) => entry.vertex),
      [...boundaryEdgesByWallId.values()],
      boundaryEdgeUses,
      loops,
      polygons
    );
  }

  private findDiscontinuityIndex(edgeUses: readonly BoundaryEdgeUse[]): number | undefined {
    const discontinuityIndex = edgeUses.findIndex((edgeUse, index) => {
      const nextEdgeUse = edgeUses[(index + 1) % edgeUses.length];

      return nextEdgeUse === undefined || edgeUse.endVertex !== nextEdgeUse.startVertex;
    });

    return discontinuityIndex === -1 ? undefined : discontinuityIndex;
  }

  private addError(error: GeometryBuildError): void {
    this.errors.push(error);
  }

  /**
   * Defends the initial manifold runtime topology invariant.
   *
   * A physical boundary edge may be used by one exterior room or by two rooms
   * sharing that wall. More than two `BoundaryEdgeUse` instances for the same
   * source wall would require an adjacency/topology design that this phase
   * intentionally does not introduce.
   */
  private validateBoundaryEdgeUseCounts(
    boundaryEdgeUses: readonly BoundaryEdgeUse[],
    wallIndexesById: ReadonlyMap<string, number>,
    levelIndex: number
  ): void {
    const useCountsByWallId = new Map<string, number>();

    boundaryEdgeUses.forEach((edgeUse) => {
      const sourceWallId = edgeUse.boundaryEdge.sourceWallId;
      useCountsByWallId.set(sourceWallId, (useCountsByWallId.get(sourceWallId) ?? 0) + 1);
    });

    useCountsByWallId.forEach((useCount, sourceWallId) => {
      if (useCount <= 2) {
        return;
      }

      const wallIndex = wallIndexesById.get(sourceWallId);
      this.addError({
        code: GeometryBuildErrorCode.NON_MANIFOLD_BOUNDARY_EDGE,
        message: `Boundary edge "${sourceWallId}" is used by ${useCount} room boundaries, but at most 2 are supported.`,
        path:
          wallIndex === undefined
            ? `building.levels[${levelIndex}].walls`
            : `building.levels[${levelIndex}].walls[${wallIndex}]`,
        sourceId: sourceWallId
      });
    });
  }

  private requireBuilt<Value>(value: Value | undefined, name: string): Value {
    if (value === undefined) {
      throw new Error(`Geometry build invariant violated: ${name} was read before finalization.`);
    }

    return value;
  }
}
