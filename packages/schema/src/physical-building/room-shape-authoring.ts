import { ProjectSchema, type Project } from "../project/index.js";
import { type Identifier, type Point2D } from "../primitives/index.js";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  ValidationErrorCode,
  type ValidationError
} from "../validation/index.js";
import type { Room } from "./room.js";
import type { ProjectEditingResult } from "./wall-editing.js";
import type { Wall } from "./wall.js";

/** Room footprint kinds supported by deterministic shape authoring. */
export type RoomShapeKind = "RECTANGLE" | "L_SHAPE";

/** Quarter-turn orientation used while authoring a Room shape. */
export type RoomShapeRotation = 0 | 90 | 180 | 270;

/** Exact physical dimensions for a rectangular Room footprint. */
export type RectangleRoomShapeDimensions = {
  readonly width: number;
  readonly depth: number;
};

/** Exact physical dimensions for a top-right-notched L-shaped Room footprint. */
export type LShapeRoomShapeDimensions = {
  readonly width: number;
  readonly depth: number;
  readonly notchWidth: number;
  readonly notchDepth: number;
};

/** Parameterized authoring-only definition used to derive a Room footprint. */
export type RoomShapeDefinition =
  | { readonly kind: "RECTANGLE"; readonly dimensions: RectangleRoomShapeDimensions; readonly rotation?: RoomShapeRotation }
  | { readonly kind: "L_SHAPE"; readonly dimensions: LShapeRoomShapeDimensions; readonly rotation?: RoomShapeRotation };

/** Caller-owned canonical metadata and identifiers for one shape commit. */
export type CreateRoomFromShapeInput = {
  readonly levelId: Identifier;
  /**
   * Top-left footprint vertex in screen-reading orientation. In Project XZ
   * coordinates this is the minimum X and maximum Z vertex of the outer box.
   */
  readonly origin: Point2D;
  readonly shape: RoomShapeDefinition;
  readonly room: Omit<Room, "boundary">;
  readonly wallIds: readonly Identifier[];
  readonly wallHeight: number;
  readonly wallThickness: number;
};

/** Returns the exact counter-clockwise footprint vertices for a Room shape. */
export function deriveRoomShapeVertices(
  origin: Point2D,
  shape: RoomShapeDefinition
): readonly Point2D[] | undefined {
  if (!isFinitePoint(origin) || !validateRoomShapeDefinition(shape)) return undefined;

  const { width, depth } = shape.dimensions;
  const local = shape.kind === "RECTANGLE"
    ? [{ x: 0, z: 0 }, { x: 0, z: -depth }, { x: width, z: -depth }, { x: width, z: 0 }]
    : [{ x: 0, z: 0 }, { x: 0, z: -depth }, { x: width, z: -depth }, { x: width, z: -shape.dimensions.notchDepth }, { x: width - shape.dimensions.notchWidth, z: -shape.dimensions.notchDepth }, { x: width - shape.dimensions.notchWidth, z: 0 }];
  const rotation = shape.rotation ?? 0;
  const rotated = local.map((point) => {
    if (rotation === 0) return point;
    if (rotation === 90) return { x: -point.z, z: point.x };
    if (rotation === 180) return { x: -point.x, z: -point.z };
    return { x: point.z, z: -point.x };
  });
  const minX = Math.min(...rotated.map((point) => point.x));
  const maxZ = Math.max(...rotated.map((point) => point.z));
  return rotated.map((point) => ({
    x: origin.x + point.x - minX,
    z: origin.z + point.z - maxZ
  }));
}

/** Validates the finite, non-degenerate physical parameters of a Room shape. */
export function validateRoomShapeDefinition(shape: RoomShapeDefinition): boolean {
  if (shape.rotation !== undefined && ![0, 90, 180, 270].includes(shape.rotation)) return false;
  const { width, depth } = shape.dimensions;
  if (!isPositiveFinite(width) || !isPositiveFinite(depth)) return false;
  if (shape.kind === "RECTANGLE") return true;
  const { notchWidth, notchDepth } = shape.dimensions;
  return isPositiveFinite(notchWidth) &&
    isPositiveFinite(notchDepth) &&
    notchWidth < width &&
    notchDepth < depth;
}

/**
 * Atomically converts one validated Room shape into ordinary canonical Walls
 * and one explicit Room on an empty Level.
 */
export function createRoomFromShape(
  project: Project,
  input: CreateRoomFromShapeInput
): ProjectEditingResult {
  const levelIndex = project.building.levels.findIndex(
    (level) => level.id === input.levelId
  );
  if (levelIndex < 0) {
    return failure({
      code: ValidationErrorCode.LEVEL_NOT_FOUND,
      path: "levelId",
      message: `Level "${input.levelId}" could not be found.`
    });
  }

  const level = project.building.levels[levelIndex]!;
  if (level.walls.length !== 0) {
    return failure({
      code: ValidationErrorCode.STALE_ROOM_TOPOLOGY,
      path: "building.levels.walls",
      message: "Room shapes can be committed only while the target Level remains empty."
    });
  }

  const vertices = deriveRoomShapeVertices(input.origin, input.shape);
  const requiredWallCount = input.shape.kind === "RECTANGLE" ? 4 : 6;
  if (
    !vertices ||
    input.wallIds.length !== requiredWallCount ||
    new Set(input.wallIds).size !== requiredWallCount ||
    !isPositiveFinite(input.wallHeight) ||
    !isPositiveFinite(input.wallThickness)
  ) {
    return failure(invalidShapeError());
  }

  const walls: Wall[] = vertices.map((start, index) => ({
    id: input.wallIds[index]!,
    start,
    end: vertices[(index + 1) % vertices.length]!,
    height: input.wallHeight,
    thickness: input.wallThickness,
    roomIds: [input.room.id],
    openings: []
  }));
  const room: Room = {
    ...input.room,
    boundary: walls.map((wall) => ({
      wallId: wall.id,
      direction: "FORWARD" as const
    }))
  };
  const candidate: Project = {
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels.map((current, index) =>
        index === levelIndex
          ? {
              ...current,
              walls,
              rooms: [...current.rooms, room]
            }
          : current
      )
    }
  };

  return validateCanonicalResult(candidate);
}

function validateCanonicalResult(project: Project): ProjectEditingResult {
  const parsed = ProjectSchema.safeParse(project);
  if (!parsed.success) {
    return failure({
      code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
      path: "project",
      message: "Room shape creation produced a structurally invalid Project."
    });
  }
  for (const validate of [
    validateProjectCrossReferences,
    validateProjectReferenceConsistency,
    validateProjectGeometry
  ]) {
    const result = validate(parsed.data);
    if (!result.valid) return { ok: false, errors: result.errors };
  }
  return { ok: true, project: parsed.data };
}

function invalidShapeError(): ValidationError {
  return {
    code: ValidationErrorCode.INVALID_ROOM_BOUNDARY,
    path: "shape.dimensions",
    message: "Room shape dimensions and Wall parameters must produce a finite, non-degenerate polygon."
  };
}

function failure(error: ValidationError): ProjectEditingResult {
  return { ok: false, errors: [error] };
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isFinitePoint(point: Point2D): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.z);
}
