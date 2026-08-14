import {
  IdentifierSchema,
  ValidationErrorCode,
  type Project,
  type ProjectEditingResult,
  type Wall
} from "@casastudio/schema";

import type { WorldPointXZ } from "../geometry-playground/viewport-transform-2d";

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
