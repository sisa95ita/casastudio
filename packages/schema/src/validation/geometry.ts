import type { Point2D } from "../primitives";
import type { Project } from "../project";
import { ValidationErrorCode } from "./validation-error-code";
import type { ValidationError, ValidationResult } from "./validation-result";

const pushError = (
  errors: ValidationError[],
  code: ValidationErrorCode,
  path: string,
  message: string
) => {
  errors.push({ code, path, message });
};

const getLength = (start: Point2D, end: Point2D): number => {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;

  return Math.hypot(deltaX, deltaZ);
};

const hasSamePoint = (first: Point2D, second: Point2D): boolean => first.x === second.x && first.z === second.z;

const getWallGeometryKey = (start: Point2D, end: Point2D): string =>
  `${start.x}:${start.z}->${end.x}:${end.z}`;

/**
 * Validates first-layer geometric/topological invariants for an already parsed
 * Project.
 *
 * Run this validator after `ProjectSchema`,
 * `validateProjectCrossReferences`, `validateProjectReferenceConsistency`, and
 * `validateProjectRenderability`. It assumes `ProjectSchema` parsing has
 * already succeeded and therefore focuses on local geometric consistency in the
 * physical building model: wall segment length, opening placement within a
 * wall, stair flight length and elevation direction, stair landing dimensions,
 * and exact duplicate wall geometry within a Level.
 *
 * This is the first Geometry Validation phase and is intentionally limited to
 * local geometric/topological invariants. It does not perform room polygon
 * reconstruction, room perimeter validation, wall connectivity graphs, shared
 * wall topology validation, polygon area computation, computational geometry,
 * or staircase continuity validation.
 */
export const validateProjectGeometry = (project: Project): ValidationResult => {
  const errors: ValidationError[] = [];

  project.building.levels.forEach((level, levelIndex) => {
    const wallGeometryToIndex = new Map<string, number>();

    level.walls.forEach((wall, wallIndex) => {
      const wallPath = `building.levels[${levelIndex}].walls[${wallIndex}]`;
      const wallLength = getLength(wall.start, wall.end);

      if (wallLength === 0) {
        pushError(
          errors,
          ValidationErrorCode.WALL_ZERO_LENGTH,
          `${wallPath}.end`,
          `Wall "${wall.id}" must have distinct start and end coordinates.`
        );
      }

      wall.openings.forEach((opening, openingIndex) => {
        if (wallLength === 0) {
          return;
        }

        if (opening.offsetFromStart < 0 || opening.offsetFromStart + opening.width > wallLength) {
          pushError(
            errors,
            ValidationErrorCode.OPENING_OUTSIDE_WALL,
            `${wallPath}.openings[${openingIndex}]`,
            `Opening "${opening.id}" must fit completely inside wall "${wall.id}".`
          );
        }
      });

      const geometryKey = getWallGeometryKey(wall.start, wall.end);
      const duplicateWallIndex = wallGeometryToIndex.get(geometryKey);

      if (duplicateWallIndex === undefined) {
        wallGeometryToIndex.set(geometryKey, wallIndex);
      } else {
        pushError(
          errors,
          ValidationErrorCode.DUPLICATE_WALL_GEOMETRY,
          wallPath,
          `Wall "${wall.id}" duplicates the start and end coordinates of wall "${level.walls[duplicateWallIndex]?.id}" in level "${level.id}".`
        );
      }
    });

    level.staircases.forEach((staircase, staircaseIndex) => {
      const staircasePath = `building.levels[${levelIndex}].staircases[${staircaseIndex}]`;

      staircase.flights.forEach((flight, flightIndex) => {
        const flightPath = `${staircasePath}.flights[${flightIndex}]`;

        if (hasSamePoint(flight.start, flight.end)) {
          pushError(
            errors,
            ValidationErrorCode.STAIR_FLIGHT_ZERO_LENGTH,
            `${flightPath}.end`,
            `Stair flight "${flight.id}" must have distinct start and end coordinates.`
          );
        }

        if (flight.endElevation <= flight.startElevation) {
          pushError(
            errors,
            ValidationErrorCode.STAIR_FLIGHT_NOT_ASCENDING,
            `${flightPath}.endElevation`,
            `Stair flight "${flight.id}" must end above its start elevation.`
          );
        }
      });

      staircase.landings.forEach((landing, landingIndex) => {
        const landingPath = `${staircasePath}.landings[${landingIndex}]`;

        if (landing.width <= 0) {
          pushError(
            errors,
            ValidationErrorCode.STAIR_LANDING_NON_POSITIVE_WIDTH,
            `${landingPath}.width`,
            `Stair landing "${landing.id}" width must be greater than zero.`
          );
        }

        if (landing.depth <= 0) {
          pushError(
            errors,
            ValidationErrorCode.STAIR_LANDING_NON_POSITIVE_DEPTH,
            `${landingPath}.depth`,
            `Stair landing "${landing.id}" depth must be greater than zero.`
          );
        }
      });
    });
  });

  return {
    valid: errors.length === 0,
    errors
  };
};
