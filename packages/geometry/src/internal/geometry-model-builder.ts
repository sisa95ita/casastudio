import {
  isWallRoomBoundaryEdge,
  type Level,
  type Project,
  type Staircase,
  type Wall
} from "@casastudio/schema";

import {
  GeometryBuildErrorCode,
  type GeometryBuildError
} from "../geometry-build-error.js";
import type { GeometryBuildResult } from "../geometry-build-result.js";
import {
  BoundaryEdge,
  BoundaryEdgeUse,
  GeometryModel,
  LevelGeometry,
  Loop,
  Polygon,
  StairFlightGeometry,
  StairGeometry,
  StairLandingGeometry,
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
    const staircases = this.project.building.levels.flatMap((level, levelIndex) =>
      level.staircases.map((staircase, staircaseIndex) =>
        this.buildStairGeometry(staircase, level, levelIndex, staircaseIndex)
      )
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
        levels.filter((level): level is LevelGeometry => level !== undefined),
        staircases.filter((staircase): staircase is StairGeometry => staircase !== undefined)
      )
    };
  }

  private buildLevelGeometry(
    level: Level,
    levelIndex: number
  ): LevelGeometry | undefined {
    const vertexEntriesByCoordinate = new Map<string, MutableVertexEntry>();
    const boundaryEdgesById = new Map<string, BoundaryEdge>();
    const boundaryEdgeUses: BoundaryEdgeUse[] = [];
    const loops: Loop[] = [];
    const polygons: Polygon[] = [];
    const wallsById = new Map(level.walls.map((wall) => [wall.id, wall]));
    const wallIndexesById = new Map(
      level.walls.map((wall, wallIndex) => [wall.id, wallIndex])
    );

    const getOrCreateVertex = (x: number, z: number): MutableVertexEntry => {
      const key = coordinateKey(x, z);
      const existingVertex = vertexEntriesByCoordinate.get(key);

      if (existingVertex) {
        return existingVertex;
      }

      const incidentEdges: BoundaryEdge[] = [];
      const entry: MutableVertexEntry = {
        vertex: new Vertex(
          runtimeId.vertex(level, x, z),
          x,
          z,
          () => incidentEdges
        ),
        incidentEdges
      };

      vertexEntriesByCoordinate.set(key, entry);
      return entry;
    };

    const getOrCreateBoundaryEdge = (wall: Wall): BoundaryEdge => {
      const existingEdge = boundaryEdgesById.get(runtimeId.boundaryEdge(wall));

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

      boundaryEdgesById.set(edge.id, edge);
      startVertexEntry.incidentEdges.push(edge);
      endVertexEntry.incidentEdges.push(edge);
      return edge;
    };

    // Physical Walls remain visible and selectable even when no Room boundary
    // references them yet, as is normal during local drafting.
    level.walls.forEach(getOrCreateBoundaryEdge);

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
      const floorElevation = level.elevation + (room.elevation ?? 0);

      if (!Number.isFinite(floorElevation)) {
        this.addError({
          code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
          message: `Room "${room.id}" global floor elevation must be finite.`,
          path: `building.levels[${levelIndex}].rooms[${roomIndex}].elevation`,
          sourceId: room.id
        });
        return;
      }

      room.boundary.forEach((boundaryEntry, boundaryIndex) => {
        if (!isWallRoomBoundaryEdge(boundaryEntry)) {
          const startVertexEntry = getOrCreateVertex(boundaryEntry.start.x, boundaryEntry.start.z);
          const endVertexEntry = getOrCreateVertex(boundaryEntry.end.x, boundaryEntry.end.z);
          const edge = new BoundaryEdge(
            runtimeId.freeBoundaryEdge(room, boundaryIndex),
            undefined,
            startVertexEntry.vertex,
            endVertexEntry.vertex,
            0,
            0,
            "FREE"
          );
          boundaryEdgesById.set(edge.id, edge);
          startVertexEntry.incidentEdges.push(edge);
          endVertexEntry.incidentEdges.push(edge);
          roomEdgeUses.push(new BoundaryEdgeUse(
            runtimeId.boundaryEdgeUse(room, boundaryIndex),
            edge,
            "FORWARD",
            boundaryIndex,
            () => this.requireBuilt(loopCell.value, "BoundaryEdgeUse.loop")
          ));
          return;
        }
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

      const metrics = calculatePolygonMetrics(
        roomEdgeUses.map((edgeUse) => edgeUse.startVertex)
      );

      if (metrics.centroid === undefined || metrics.winding === "DEGENERATE") {
        this.addError({
          code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
          message: `Room "${room.id}" boundary produces a zero-area polygon.`,
          path: `building.levels[${levelIndex}].rooms[${roomIndex}].boundary`,
          sourceId: room.id
        });
        return;
      }

      loopCell.value = new Loop(
        runtimeId.outerLoop(room),
        "OUTER",
        roomEdgeUses,
        () => this.requireBuilt(polygonCell.value, "Loop.polygon")
      );
      polygonCell.value = new Polygon(
        runtimeId.polygon(room),
        room.id,
        floorElevation,
        loopCell.value,
        [],
        {
          ...metrics,
          centroid: metrics.centroid
        }
      );

      boundaryEdgeUses.push(...roomEdgeUses);
      loops.push(loopCell.value);
      polygons.push(polygonCell.value);
    });

    this.validateBoundaryEdgeUseCounts(
      boundaryEdgeUses,
      wallIndexesById,
      levelIndex
    );

    if (this.errors.length > 0) {
      return undefined;
    }

    return new LevelGeometry(
      runtimeId.level(level),
      level.id,
      level.elevation,
      [...vertexEntriesByCoordinate.values()].map((entry) => entry.vertex),
      [...boundaryEdgesById.values()],
      boundaryEdgeUses,
      loops,
      polygons
    );
  }

  private buildStairGeometry(
    staircase: Staircase,
    owningLevel: Level,
    levelIndex: number,
    staircaseIndex: number
  ): StairGeometry | undefined {
    const staircasePath = `building.levels[${levelIndex}].staircases[${staircaseIndex}]`;
    const levelsById = new Map(this.project.building.levels.map((level) => [level.id, level]));
    const fromLevel = levelsById.get(staircase.fromLevelId);
    const toLevel = levelsById.get(staircase.toLevelId);
    let hasError = false;

    if (!fromLevel) {
      this.addError({
        code: GeometryBuildErrorCode.MISSING_SOURCE_ENTITY,
        message: `Staircase "${staircase.id}" references missing from Level "${staircase.fromLevelId}".`,
        path: `${staircasePath}.fromLevelId`,
        sourceId: staircase.fromLevelId
      });
      hasError = true;
    }

    if (!toLevel) {
      this.addError({
        code: GeometryBuildErrorCode.MISSING_SOURCE_ENTITY,
        message: `Staircase "${staircase.id}" references missing to Level "${staircase.toLevelId}".`,
        path: `${staircasePath}.toLevelId`,
        sourceId: staircase.toLevelId
      });
      hasError = true;
    }

    const fromRoom = staircase.fromRoomId
      ? fromLevel?.rooms.find((room) => room.id === staircase.fromRoomId)
      : undefined;
    const toRoom = staircase.toRoomId
      ? toLevel?.rooms.find((room) => room.id === staircase.toRoomId)
      : undefined;

    if (staircase.fromRoomId && !fromRoom) {
      this.addError({
        code: GeometryBuildErrorCode.MISSING_SOURCE_ENTITY,
        message: `Staircase "${staircase.id}" references from Room "${staircase.fromRoomId}" outside its from Level.`,
        path: `${staircasePath}.fromRoomId`,
        sourceId: staircase.fromRoomId
      });
      hasError = true;
    }

    if (staircase.toRoomId && !toRoom) {
      this.addError({
        code: GeometryBuildErrorCode.MISSING_SOURCE_ENTITY,
        message: `Staircase "${staircase.id}" references to Room "${staircase.toRoomId}" outside its to Level.`,
        path: `${staircasePath}.toRoomId`,
        sourceId: staircase.toRoomId
      });
      hasError = true;
    }

    const flights = staircase.flights.map((flight, flightIndex) => {
      const flightPath = `${staircasePath}.flights[${flightIndex}]`;
      const length = Math.hypot(flight.end.x - flight.start.x, flight.end.z - flight.start.z);
      const numericValues = [
        flight.start.x,
        flight.start.z,
        flight.end.x,
        flight.end.z,
        flight.width,
        flight.stepCount,
        flight.startElevation,
        flight.endElevation,
        length
      ];

      if (!numericValues.every(Number.isFinite) || length <= 0 || flight.width <= 0 ||
        !Number.isInteger(flight.stepCount) || flight.stepCount <= 0 ||
        flight.endElevation <= flight.startElevation) {
        this.addError({
          code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
          message: `Stair flight "${flight.id}" contains invalid dimensions, coordinates, step count, or elevation range.`,
          path: flightPath,
          sourceId: flight.id
        });
        hasError = true;
      }

      return new StairFlightGeometry(
        runtimeId.stairFlight(flight),
        flight.id,
        flight.start,
        flight.end,
        flight.width,
        flight.stepCount,
        flight.startElevation,
        flight.endElevation
      );
    });
    const landings = staircase.landings.map((landing, landingIndex) => {
      const numericValues = [
        landing.position.x,
        landing.position.z,
        landing.width,
        landing.depth,
        landing.elevation
      ];

      if (!numericValues.every(Number.isFinite) || landing.width <= 0 || landing.depth <= 0) {
        this.addError({
          code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
          message: `Stair landing "${landing.id}" contains invalid position, dimensions, or elevation.`,
          path: `${staircasePath}.landings[${landingIndex}]`,
          sourceId: landing.id
        });
        hasError = true;
      }

      return new StairLandingGeometry(
        runtimeId.stairLanding(landing),
        landing.id,
        landing.position,
        landing.width,
        landing.depth,
        landing.elevation
      );
    });

    if (staircase.flights.length > 0 && fromLevel && toLevel &&
      (!staircase.fromRoomId || fromRoom) && (!staircase.toRoomId || toRoom)) {
      const expectedStartElevation = fromLevel.elevation + (fromRoom?.elevation ?? 0);
      const expectedEndElevation = toLevel.elevation + (toRoom?.elevation ?? 0);
      const firstFlight = staircase.flights[0]!;
      const lastFlight = staircase.flights.at(-1)!;

      if (!Number.isFinite(expectedStartElevation) || firstFlight.startElevation !== expectedStartElevation) {
        this.addError({
          code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
          message: `Staircase "${staircase.id}" first flight must start at source floor elevation ${expectedStartElevation}.`,
          path: `${staircasePath}.flights[0].startElevation`,
          sourceId: firstFlight.id
        });
        hasError = true;
      }

      if (!Number.isFinite(expectedEndElevation) || lastFlight.endElevation !== expectedEndElevation) {
        this.addError({
          code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
          message: `Staircase "${staircase.id}" last flight must end at destination floor elevation ${expectedEndElevation}.`,
          path: `${staircasePath}.flights[${staircase.flights.length - 1}].endElevation`,
          sourceId: lastFlight.id
        });
        hasError = true;
      }

      staircase.flights.slice(1).forEach((flight, flightIndex) => {
        const previousFlight = staircase.flights[flightIndex]!;
        if (flight.startElevation !== previousFlight.endElevation) {
          this.addError({
            code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
            message: `Stair flight "${flight.id}" must start at the previous flight end elevation ${previousFlight.endElevation}.`,
            path: `${staircasePath}.flights[${flightIndex + 1}].startElevation`,
            sourceId: flight.id
          });
          hasError = true;
        }
      });
    }

    if (!Number.isFinite(staircase.width) || staircase.width <= 0) {
      this.addError({
        code: GeometryBuildErrorCode.INVALID_PROJECT_GEOMETRY,
        message: `Staircase "${staircase.id}" width must be finite and greater than zero.`,
        path: `${staircasePath}.width`,
        sourceId: staircase.id
      });
      hasError = true;
    }

    if (hasError) {
      return undefined;
    }

    return new StairGeometry(
      runtimeId.stair(staircase),
      staircase.id,
      owningLevel.id,
      staircase.fromLevelId,
      staircase.toLevelId,
      staircase.fromRoomId,
      staircase.toRoomId,
      staircase.width,
      flights,
      landings
    );
  }

  private findDiscontinuityIndex(
    edgeUses: readonly BoundaryEdgeUse[]
  ): number | undefined {
    const discontinuityIndex = edgeUses.findIndex((edgeUse, index) => {
      const nextEdgeUse = edgeUses[(index + 1) % edgeUses.length];

      return (
        nextEdgeUse === undefined ||
        edgeUse.endVertex !== nextEdgeUse.startVertex
      );
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
   * source wall is rejected as non-manifold input.
   */
  private validateBoundaryEdgeUseCounts(
    boundaryEdgeUses: readonly BoundaryEdgeUse[],
    wallIndexesById: ReadonlyMap<string, number>,
    levelIndex: number
  ): void {
    const useCountsByWallAndElevation = new Map<string, number>();

    boundaryEdgeUses.forEach((edgeUse) => {
      const sourceWallId = edgeUse.boundaryEdge.sourceWallId;
      if (!sourceWallId) return;
      const key = `${sourceWallId}:${edgeUse.loop.polygon.floorElevation}`;
      useCountsByWallAndElevation.set(
        key,
        (useCountsByWallAndElevation.get(key) ?? 0) + 1
      );
    });

    useCountsByWallAndElevation.forEach((useCount, key) => {
      if (useCount <= 2) {
        return;
      }

      const separatorIndex = key.lastIndexOf(":");
      const sourceWallId = key.slice(0, separatorIndex);

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
      throw new Error(
        `Geometry build invariant violated: ${name} was read before finalization.`
      );
    }

    return value;
  }
}
