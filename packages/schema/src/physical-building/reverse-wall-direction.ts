import type { Identifier } from "../primitives";
import { ProjectSchema, type Project } from "../project";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  ValidationErrorCode,
  type ValidationError
} from "../validation";
import type { Opening } from "./opening";
import type { RoomBoundaryDirection } from "./room";
import type { Wall } from "./wall";

/**
 * Result returned by the pure reverse-wall-direction domain operation.
 *
 * Expected failures, including a missing target Wall or invalid post-operation
 * Project state, are returned as validation errors. A successful result exposes
 * the newly parsed canonical Project; the input Project is never mutated.
 */
export type ReverseWallDirectionResult =
  | {
      ok: true;
      project: Project;
    }
  | {
      ok: false;
      errors: readonly ValidationError[];
    };

const invertBoundaryDirection = (direction: RoomBoundaryDirection): RoomBoundaryDirection =>
  direction === "FORWARD" ? "REVERSE" : "FORWARD";

const getWallLength = (wall: Wall): number => {
  const deltaX = wall.end.x - wall.start.x;
  const deltaZ = wall.end.z - wall.start.z;

  return Math.hypot(deltaX, deltaZ);
};

const createWallNotFoundError = (wallId: Identifier): ValidationError => ({
  code: ValidationErrorCode.WALL_NOT_FOUND,
  path: "building.levels[].walls[].id",
  message: `Wall "${wallId}" could not be found.`
});

const createDuplicateWallIdError = (wallId: Identifier, paths: readonly string[]): ValidationError => ({
  code: ValidationErrorCode.DUPLICATE_WALL_ID,
  path: "building.levels[].walls[].id",
  message: `Wall "${wallId}" appears ${paths.length} times at ${paths.join(", ")}.`
});

const findWallIdPaths = (project: Project, wallId: Identifier): string[] => {
  const paths: string[] = [];

  project.building.levels.forEach((level, levelIndex) => {
    level.walls.forEach((wall, wallIndex) => {
      if (wall.id === wallId) {
        paths.push(`building.levels[${levelIndex}].walls[${wallIndex}].id`);
      }
    });
  });

  return paths;
};

const validateCanonicalPostState = (project: Project): ReverseWallDirectionResult => {
  const parseResult = ProjectSchema.safeParse(project);

  if (!parseResult.success) {
    return {
      ok: false,
      errors: [
        {
          code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
          path: "project",
          message: "Reverse wall direction produced a structurally invalid Project."
        }
      ]
    };
  }

  const validators = [
    validateProjectCrossReferences,
    validateProjectReferenceConsistency,
    validateProjectGeometry
  ];

  for (const validate of validators) {
    const result = validate(parseResult.data);

    if (!result.valid) {
      return {
        ok: false,
        errors: result.errors
      };
    }
  }

  return {
    ok: true,
    project: parseResult.data
  };
};

const transformOpeningForWallReversal = (opening: Opening, wallLength: number): Opening => ({
  ...opening,
  offsetFromStart: wallLength - opening.offsetFromStart - opening.width
});

const transformWallRelativeDataForReversal = (wall: Wall): Wall => {
  const wallLength = getWallLength(wall);

  return {
    ...wall,
    openings: wall.openings.map((opening) => transformOpeningForWallReversal(opening, wallLength))
  };
};

/**
 * Reverses one Wall's canonical internal direction while preserving project meaning.
 *
 * The physical segment remains the same: `start` and `end` are swapped, every
 * referencing Room boundary edge has its traversal direction inverted, and each
 * Opening offset is remapped as `wallLength - offsetFromStart - width` so the
 * Opening keeps the same world-space location. The operation performs targeted
 * structural copying after locating exactly one target Wall, validates the
 * complete post-state with the existing schema, cross-reference,
 * reference-consistency, and geometry validators, and returns errors instead of
 * throwing for expected domain failures.
 */
export const reverseWallDirection = (
  project: Project,
  wallId: Identifier
): ReverseWallDirectionResult => {
  const wallIdPaths = findWallIdPaths(project, wallId);

  if (wallIdPaths.length === 0) {
    return {
      ok: false,
      errors: [createWallNotFoundError(wallId)]
    };
  }

  if (wallIdPaths.length > 1) {
    return {
      ok: false,
      errors: [createDuplicateWallIdError(wallId, wallIdPaths)]
    };
  }

  const transformedProject: Project = {
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels.map((level) => ({
        ...level,
        rooms: level.rooms.map((room) => ({
          ...room,
          boundary: room.boundary.map((boundaryEdge) =>
            boundaryEdge.wallId === wallId
              ? {
                  ...boundaryEdge,
                  direction: invertBoundaryDirection(boundaryEdge.direction)
                }
              : boundaryEdge
          )
        })),
        walls: level.walls.map((wall) => {
          if (wall.id !== wallId) {
            return wall;
          }

          const transformedWall = transformWallRelativeDataForReversal(wall);

          return {
            ...transformedWall,
            start: wall.end,
            end: wall.start
          };
        })
      }))
    }
  };

  return validateCanonicalPostState(transformedProject);
};
