import {
  IdentifierSchema,
  ValidationErrorCode,
  type Project,
  type ProjectEditingResult,
  type Wall
} from "@casastudio/schema";

import type { WorldPointXZ } from "../geometry-playground/viewport-transform-2d";

/** Topological state controlling one selected Wall endpoint handle. */
export type WallEndpointEditingState = {
  readonly topology: "standalone" | "shared-junction";
  readonly draggable: boolean;
};

/** Per-endpoint movement availability for one selected canonical Wall. */
export type WallEndpointEditingAvailability = {
  readonly roomReferenced: boolean;
  readonly start: WallEndpointEditingState;
  readonly end: WallEndpointEditingState;
};

/** Canonical defaults for a newly drafted standalone Wall in Project length units. */
export const newWallDefaults = Object.freeze({
  height: 300,
  thickness: 20
});

/** Creates a collision-resistant Wall identifier accepted by the schema. */
export function createWallIdentifier(
  randomUuid: () => string = () => crypto.randomUUID()
): string {
  return IdentifierSchema.parse(`wall-${randomUuid().toLowerCase()}`);
}

/** Creates the minimal valid standalone Wall used by the Draw Wall tool. */
export function createDraftWall(
  start: WorldPointXZ,
  end: WorldPointXZ,
  id = createWallIdentifier()
): Wall {
  return {
    id,
    start: copyPoint(start),
    end: copyPoint(end),
    height: newWallDefaults.height,
    thickness: newWallDefaults.thickness,
    roomIds: [],
    openings: []
  };
}

/** Translation keys for expected local Wall editing failures. */
export type WallEditingErrorKey =
  | "errors.wall.zeroLength"
  | "errors.wall.referenced"
  | "errors.wall.notFound"
  | "errors.wall.invalidHeight"
  | "errors.wall.invalidThickness"
  | "errors.wall.splitOpening"
  | "errors.wall.splitInvalid"
  | "errors.wall.invalid";

/** Maps typed domain failures to stable, user-facing translation keys. */
export function getWallEditingErrorKey(
  result: Extract<ProjectEditingResult, { readonly ok: false }>
): WallEditingErrorKey {
  const codes = result.errors.map((error) => error.code);

  if (codes.includes(ValidationErrorCode.WALL_ZERO_LENGTH)) {
    return "errors.wall.zeroLength";
  }
  if (codes.includes(ValidationErrorCode.WALL_IS_REFERENCED)) {
    return "errors.wall.referenced";
  }
  if (codes.includes(ValidationErrorCode.INVALID_WALL_HEIGHT)) {
    return "errors.wall.invalidHeight";
  }
  if (codes.includes(ValidationErrorCode.INVALID_WALL_THICKNESS)) {
    return "errors.wall.invalidThickness";
  }
  if (codes.includes(ValidationErrorCode.WALL_SPLIT_INTERSECTS_OPENING)) {
    return "errors.wall.splitOpening";
  }
  if (
    codes.includes(ValidationErrorCode.WALL_SPLIT_POINT_NOT_ON_WALL) ||
    codes.includes(ValidationErrorCode.WALL_SPLIT_AT_ENDPOINT)
  ) {
    return "errors.wall.splitInvalid";
  }
  if (
    codes.includes(ValidationErrorCode.WALL_NOT_FOUND) ||
    codes.includes(ValidationErrorCode.LEVEL_NOT_FOUND)
  ) {
    return "errors.wall.notFound";
  }

  return "errors.wall.invalid";
}

/** Returns whether canonical Room references prevent independent endpoint movement. */
export function isWallReferencedByRoom(
  project: Project | null,
  levelId: string | null,
  wallId: string | undefined
): boolean {
  if (!project || !levelId || !wallId) return false;
  const level = project.building.levels.find(
    (candidate) => candidate.id === levelId
  );
  const wall = level?.walls.find((candidate) => candidate.id === wallId);
  return Boolean(
    wall &&
    (wall.roomIds.length > 0 ||
      level?.rooms.some((room) =>
        room.boundary.some((edge) => edge.wallId === wallId)
      ))
  );
}

/**
 * Resolves whether each canonical Wall endpoint is standalone or shared.
 *
 * Room-referenced Walls remain locked as before. Otherwise an endpoint is
 * draggable only when exactly one Wall endpoint on the Level has its exact
 * canonical coordinates.
 */
export function getWallEndpointEditingAvailability(
  project: Project | null,
  levelId: string | null,
  wallId: string | undefined
): WallEndpointEditingAvailability | undefined {
  if (!project || !levelId || !wallId) return undefined;
  const level = project.building.levels.find(
    (candidate) => candidate.id === levelId
  );
  const wall = level?.walls.find((candidate) => candidate.id === wallId);
  if (!level || !wall) return undefined;
  const roomReferenced = isWallReferencedByRoom(project, levelId, wallId);

  const endpointState = (
    point: Wall["start"]
  ): WallEndpointEditingState => {
    const incidentEndpointCount = level.walls.reduce(
      (count, candidate) =>
        count +
        Number(hasSameCanonicalPoint(candidate.start, point)) +
        Number(hasSameCanonicalPoint(candidate.end, point)),
      0
    );
    const topology =
      incidentEndpointCount > 1 ? "shared-junction" : "standalone";
    return {
      topology,
      draggable: !roomReferenced && topology === "standalone"
    };
  };

  return {
    roomReferenced,
    start: endpointState(wall.start),
    end: endpointState(wall.end)
  };
}

/**
 * Returns whether one committed Wall completes a canonical Wall graph cycle.
 *
 * The committed Wall is excluded and exact endpoint identity is used to find
 * an existing path between its endpoints. This interaction query does not
 * infer or create Room entities.
 */
export function doesWallCloseCycle(
  project: Project,
  levelId: string,
  committedWallId: string
): boolean {
  const level = project.building.levels.find(
    (candidate) => candidate.id === levelId
  );
  const committedWall = level?.walls.find(
    (candidate) => candidate.id === committedWallId
  );
  if (!level || !committedWall) return false;

  const startKey = getCanonicalPointKey(committedWall.start);
  const endKey = getCanonicalPointKey(committedWall.end);
  if (startKey === endKey) return false;
  const adjacency = new Map<string, Set<string>>();
  for (const wall of level.walls) {
    if (wall.id === committedWallId) continue;
    const wallStartKey = getCanonicalPointKey(wall.start);
    const wallEndKey = getCanonicalPointKey(wall.end);
    addAdjacentPoint(adjacency, wallStartKey, wallEndKey);
    addAdjacentPoint(adjacency, wallEndKey, wallStartKey);
  }

  const pending = [startKey];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const point = pending.pop();
    if (!point || visited.has(point)) continue;
    if (point === endKey) return true;
    visited.add(point);
    pending.push(...(adjacency.get(point) ?? []));
  }
  return false;
}

/** Resolves one Wall in the active local draft by stable domain identity. */
export function findProjectWall(
  project: Project | null,
  levelId: string | null,
  wallId: string | undefined
): Wall | undefined {
  if (!project || !levelId || !wallId) {
    return undefined;
  }

  return project.building.levels
    .find((level) => level.id === levelId)
    ?.walls.find((wall) => wall.id === wallId);
}

const copyPoint = (point: WorldPointXZ) => ({
  x: point.x,
  z: point.z
});

/** Compares canonical endpoint coordinates without a visual tolerance. */
const hasSameCanonicalPoint = (
  first: Wall["start"],
  second: Wall["start"]
): boolean => first.x === second.x && first.z === second.z;

/** Produces an exact map key for one canonical endpoint. */
const getCanonicalPointKey = (point: Wall["start"]): string =>
  `${point.x}:${point.z}`;

/** Adds one directed adjacency entry for canonical cycle traversal. */
const addAdjacentPoint = (
  adjacency: Map<string, Set<string>>,
  from: string,
  to: string
): void => {
  const adjacent = adjacency.get(from) ?? new Set<string>();
  adjacent.add(to);
  adjacency.set(from, adjacent);
};
