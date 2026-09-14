import { ProjectSchema, type Project } from "../project/index.js";
import type { Identifier, Point2D } from "../primitives/index.js";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectIdentifierUniqueness,
  validateProjectReferenceConsistency,
  ValidationErrorCode,
  type ValidationError
} from "../validation/index.js";
import { isFreeRoomBoundaryEdge } from "./room.js";
import type { ProjectEditingResult } from "./wall-editing.js";

const EPSILON = 1e-7;

/** Canonical entity roots translated together by one plan-space delta. */
export type TranslatePlanEntitiesInput = {
  readonly levelId: Identifier;
  readonly delta: Point2D;
  readonly wallIds?: readonly Identifier[];
  readonly openingIds?: readonly Identifier[];
  readonly roomIds?: readonly Identifier[];
  readonly staircaseIds?: readonly Identifier[];
  readonly furnitureIds?: readonly Identifier[];
};

/**
 * Rigidly translates a validated set of canonical plan entities atomically.
 *
 * Selected Walls must form a closed junction set, so shared endpoints are
 * never detached from unselected Walls. Wall-owned Openings follow their Wall
 * without changing offset or orientation. Only fully free-boundary Rooms are
 * independently translatable; their owned Furniture moves as a dependency.
 */
export function translatePlanEntities(
  project: Project,
  input: TranslatePlanEntitiesInput
): ProjectEditingResult {
  if (!Number.isFinite(input.delta.x) || !Number.isFinite(input.delta.z)) {
    return failure("delta", "Translation delta must be finite.");
  }
  const levelIndex = project.building.levels.findIndex(
    (level) => level.id === input.levelId
  );
  const level = project.building.levels[levelIndex];
  if (!level)
    return failure(
      "levelId",
      `Level "${input.levelId}" could not be found.`,
      ValidationErrorCode.LEVEL_NOT_FOUND
    );

  const wallIds = new Set(input.wallIds ?? []);
  const openingIds = new Set(input.openingIds ?? []);
  const roomIds = new Set(input.roomIds ?? []);
  const staircaseIds = new Set(input.staircaseIds ?? []);
  const furnitureIds = new Set(input.furnitureIds ?? []);
  if (
    wallIds.size +
      openingIds.size +
      roomIds.size +
      staircaseIds.size +
      furnitureIds.size ===
    0
  ) {
    return failure(
      "selection",
      "Translation requires at least one canonical entity."
    );
  }

  for (const wallId of wallIds) {
    if (!level.walls.some((wall) => wall.id === wallId))
      return failure(
        "wallIds",
        `Wall "${wallId}" could not be found.`,
        ValidationErrorCode.WALL_NOT_FOUND
      );
  }
  for (const wall of level.walls.filter((candidate) =>
    wallIds.has(candidate.id)
  )) {
    for (const endpoint of [wall.start, wall.end]) {
      const incident = level.walls.filter(
        (candidate) =>
          samePoint(candidate.start, endpoint) ||
          samePoint(candidate.end, endpoint)
      );
      if (incident.some((candidate) => !wallIds.has(candidate.id))) {
        return failure(
          "wallIds",
          `Wall "${wall.id}" shares a junction with an unselected Wall; rigid translation would detach topology.`
        );
      }
    }
  }

  for (const roomId of roomIds) {
    const room = level.rooms.find((candidate) => candidate.id === roomId);
    if (!room)
      return failure(
        "roomIds",
        `Room "${roomId}" could not be found.`,
        ValidationErrorCode.ROOM_NOT_FOUND
      );
    if (!room.boundary.every(isFreeRoomBoundaryEdge)) {
      return failure(
        "roomIds",
        `Room "${roomId}" is Wall-bounded and cannot be translated independently.`
      );
    }
    const externallyReferenced =
      project.viewpoints.some((viewpoint) => viewpoint.roomId === roomId) ||
      project.building.levels.some((candidate) =>
        candidate.staircases.some(
          (staircase) =>
            staircase.fromRoomId === roomId || staircase.toRoomId === roomId
        )
      ) ||
      level.walls.some((wall) =>
        wall.openings.some(
          (opening) =>
            opening.type === "DOOR" &&
            opening.connectedRoomIds?.includes(roomId)
        )
      );
    if (externallyReferenced) {
      return failure(
        "roomIds",
        `Room "${roomId}" has architectural references that cannot be translated implicitly.`
      );
    }
    for (const item of project.building.furniture) {
      if (item.roomId === roomId) furnitureIds.add(item.id);
    }
  }

  for (const staircaseId of staircaseIds) {
    if (!level.staircases.some((staircase) => staircase.id === staircaseId)) {
      return failure(
        "staircaseIds",
        `Staircase "${staircaseId}" could not be found.`
      );
    }
  }
  for (const furnitureId of furnitureIds) {
    if (!project.building.furniture.some((item) => item.id === furnitureId)) {
      return failure(
        "furnitureIds",
        `Furniture "${furnitureId}" could not be found.`,
        ValidationErrorCode.FURNITURE_NOT_FOUND
      );
    }
  }

  const translatedWalls = level.walls.map((wall) => {
    if (wallIds.has(wall.id)) {
      return {
        ...wall,
        start: add(wall.start, input.delta),
        end: add(wall.end, input.delta)
      };
    }
    let changed = false;
    const openings = wall.openings.map((opening) => {
      if (!openingIds.has(opening.id)) return opening;
      changed = true;
      const length = Math.hypot(
        wall.end.x - wall.start.x,
        wall.end.z - wall.start.z
      );
      const direction = {
        x: (wall.end.x - wall.start.x) / length,
        z: (wall.end.z - wall.start.z) / length
      };
      const along = input.delta.x * direction.x + input.delta.z * direction.z;
      const perpendicular =
        input.delta.x * -direction.z + input.delta.z * direction.x;
      if (Math.abs(perpendicular) > EPSILON) return undefined;
      const offsetFromStart = opening.offsetFromStart + along;
      if (
        offsetFromStart < -EPSILON ||
        offsetFromStart + opening.width > length + EPSILON
      )
        return undefined;
      return { ...opening, offsetFromStart };
    });
    if (openings.some((opening) => opening === undefined)) return undefined;
    return changed ? { ...wall, openings } : wall;
  });
  if (translatedWalls.some((wall) => wall === undefined)) {
    return failure(
      "openingIds",
      "Opening translation must remain parallel to and within its owning Wall."
    );
  }
  const knownOpeningIds = new Set(
    level.walls.flatMap((wall) => wall.openings.map((opening) => opening.id))
  );
  if ([...openingIds].some((id) => !knownOpeningIds.has(id))) {
    return failure(
      "openingIds",
      "One or more selected Openings could not be found."
    );
  }

  const translatedRooms = level.rooms.map((room) =>
    roomIds.has(room.id)
      ? {
          ...room,
          boundary: room.boundary.map((edge) =>
            isFreeRoomBoundaryEdge(edge)
              ? {
                  ...edge,
                  start: add(edge.start, input.delta),
                  end: add(edge.end, input.delta)
                }
              : edge
          )
        }
      : room
  );
  const translatedStaircases = level.staircases.map((staircase) =>
    staircaseIds.has(staircase.id)
      ? {
          ...staircase,
          flights: staircase.flights.map((flight) => ({
            ...flight,
            start: add(flight.start, input.delta),
            end: add(flight.end, input.delta)
          })),
          landings: staircase.landings.map((landing) => ({
            ...landing,
            position: add(landing.position, input.delta)
          }))
        }
      : staircase
  );

  const candidate: Project = {
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels.map((candidateLevel, index) =>
        index === levelIndex
          ? {
              ...candidateLevel,
              walls: translatedWalls as typeof level.walls,
              rooms: translatedRooms,
              staircases: translatedStaircases
            }
          : candidateLevel
      ),
      furniture: project.building.furniture.map((item) =>
        furnitureIds.has(item.id)
          ? { ...item, position: add(item.position, input.delta) }
          : item
      )
    }
  };
  return validateCandidate(candidate);
}

function validateCandidate(candidate: Project): ProjectEditingResult {
  const parsed = ProjectSchema.safeParse(candidate);
  if (!parsed.success)
    return failure(
      "project",
      "Translation produced invalid Project structure."
    );
  for (const validate of [
    validateProjectIdentifierUniqueness,
    validateProjectCrossReferences,
    validateProjectReferenceConsistency,
    validateProjectGeometry
  ]) {
    const result = validate(parsed.data);
    if (!result.valid) return { ok: false, errors: result.errors };
  }
  return { ok: true, project: parsed.data };
}

const add = (point: Point2D, delta: Point2D): Point2D => ({
  x: point.x + delta.x,
  z: point.z + delta.z
});

const samePoint = (first: Point2D, second: Point2D): boolean =>
  Math.abs(first.x - second.x) <= EPSILON &&
  Math.abs(first.z - second.z) <= EPSILON;

function failure(
  path: string,
  message: string,
  code = ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED
): ProjectEditingResult {
  const error: ValidationError = { code, path, message };
  return { ok: false, errors: [error] };
}
