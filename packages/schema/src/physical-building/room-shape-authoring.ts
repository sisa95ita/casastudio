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
import { createStandaloneRoom } from "./architectural-editing.js";

/** Room footprint kinds supported by deterministic shape authoring. */
export type RoomShapeKind = "RECTANGLE" | "L_SHAPE" | "U_SHAPE" | "T_SHAPE";

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

/** Exact physical dimensions for a top-open U-shaped Room footprint. */
export type UShapeRoomShapeDimensions = {
  readonly width: number;
  readonly depth: number;
  readonly leftWingWidth: number;
  readonly rightWingWidth: number;
  readonly notchDepth: number;
};

/** Exact physical dimensions for a centered T-shaped Room footprint. */
export type TShapeRoomShapeDimensions = {
  readonly width: number;
  readonly depth: number;
  readonly stemWidth: number;
  readonly stemDepth: number;
};

/** Parameterized authoring-only definition used to derive a Room footprint. */
export type RoomShapeDefinition =
  | { readonly kind: "RECTANGLE"; readonly dimensions: RectangleRoomShapeDimensions; readonly rotation?: RoomShapeRotation }
  | { readonly kind: "L_SHAPE"; readonly dimensions: LShapeRoomShapeDimensions; readonly rotation?: RoomShapeRotation }
  | { readonly kind: "U_SHAPE"; readonly dimensions: UShapeRoomShapeDimensions; readonly rotation?: RoomShapeRotation }
  | { readonly kind: "T_SHAPE"; readonly dimensions: TShapeRoomShapeDimensions; readonly rotation?: RoomShapeRotation };

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

/** Input for creating one explicit free-boundary Room footprint from a shape. */
export type CreateFreeBoundaryRoomFromShapeInput = {
  readonly levelId: Identifier;
  readonly origin: Point2D;
  readonly shape: RoomShapeDefinition;
  readonly room: Omit<Room, "boundary">;
};

/** Returns the exact counter-clockwise footprint vertices for a Room shape. */
export function deriveRoomShapeVertices(
  origin: Point2D,
  shape: RoomShapeDefinition
): readonly Point2D[] | undefined {
  if (!isFinitePoint(origin) || !validateRoomShapeDefinition(shape)) return undefined;

  const local = deriveLocalVertices(shape);
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
  if (shape.kind === "L_SHAPE") {
    const { notchWidth, notchDepth } = shape.dimensions;
    return isPositiveFinite(notchWidth) && isPositiveFinite(notchDepth) &&
      notchWidth < width && notchDepth < depth;
  }
  if (shape.kind === "U_SHAPE") {
    const { leftWingWidth, rightWingWidth, notchDepth } = shape.dimensions;
    return isPositiveFinite(leftWingWidth) && isPositiveFinite(rightWingWidth) &&
      isPositiveFinite(notchDepth) && leftWingWidth + rightWingWidth < width &&
      notchDepth < depth;
  }
  const { stemWidth, stemDepth } = shape.dimensions;
  return isPositiveFinite(stemWidth) && isPositiveFinite(stemDepth) &&
    stemWidth < width && stemDepth < depth;
}

/**
 * Atomically converts one validated Room shape into ordinary canonical Walls
 * and one explicit Room, reusing exactly coincident Walls when unambiguous.
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

  const vertices = deriveRoomShapeVertices(input.origin, input.shape);
  const requiredWallCount = vertices?.length ?? 0;
  if (
    !vertices ||
    input.wallIds.length !== requiredWallCount ||
    new Set(input.wallIds).size !== requiredWallCount ||
    !isPositiveFinite(input.wallHeight) ||
    !isPositiveFinite(input.wallThickness)
  ) {
    return failure(invalidShapeError());
  }

  const boundary: Room["boundary"] = [];
  const createdWalls: Wall[] = [];
  const reusedWallIds = new Set<string>();
  for (const [index, start] of vertices.entries()) {
    const end = vertices[(index + 1) % vertices.length]!;
    const coincident = level.walls.filter((wall) =>
      sameSegment(start, end, wall.start, wall.end)
    );
    if (coincident.length > 1) return failure(ambiguousTopologyError());
    const reused = coincident[0];
    if (reused) {
      if (reused.roomIds.length >= 2 || reusedWallIds.has(reused.id)) {
        return failure(ambiguousTopologyError());
      }
      reusedWallIds.add(reused.id);
      boundary.push({
        wallId: reused.id,
        direction: samePoint(start, reused.start) ? "FORWARD" : "REVERSE"
      });
      continue;
    }
    if (level.walls.some((wall) => segmentsConflict(start, end, wall.start, wall.end))) {
      return failure(ambiguousTopologyError());
    }
    const wall: Wall = {
      id: input.wallIds[index]!, start, end,
      height: input.wallHeight, thickness: input.wallThickness,
      roomIds: [input.room.id], openings: []
    };
    createdWalls.push(wall);
    boundary.push({ wallId: wall.id, direction: "FORWARD" });
  }
  const walls = [
    ...level.walls.map((wall) => reusedWallIds.has(wall.id)
      ? { ...wall, roomIds: [...wall.roomIds, input.room.id] }
      : wall),
    ...createdWalls
  ];
  const room: Room = {
    ...input.room,
    boundary
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

/**
 * Atomically creates a Room shape whose directed perimeter contains no Walls.
 *
 * The operation is elevation-neutral: product flows may use it for elevated
 * floor surfaces, while the canonical result remains an ordinary Room. Existing
 * Rooms and every Wall on the Level are preserved exactly.
 */
export function createFreeBoundaryRoomFromShape(
  project: Project,
  input: CreateFreeBoundaryRoomFromShapeInput
): ProjectEditingResult {
  const vertices = deriveRoomShapeVertices(input.origin, input.shape);
  if (!vertices) return failure(invalidShapeError());
  return createStandaloneRoom(project, {
    levelId: input.levelId,
    room: {
      ...input.room,
      boundary: vertices.map((start, index) => ({
        kind: "FREE" as const,
        start,
        end: vertices[(index + 1) % vertices.length]!
      }))
    }
  });
}

function deriveLocalVertices(shape: RoomShapeDefinition): readonly Point2D[] {
  const { width, depth } = shape.dimensions;
  if (shape.kind === "RECTANGLE") {
    return [{ x: 0, z: 0 }, { x: 0, z: -depth }, { x: width, z: -depth }, { x: width, z: 0 }];
  }
  if (shape.kind === "L_SHAPE") {
    const { notchWidth, notchDepth } = shape.dimensions;
    return [{ x: 0, z: 0 }, { x: 0, z: -depth }, { x: width, z: -depth },
      { x: width, z: -notchDepth }, { x: width - notchWidth, z: -notchDepth },
      { x: width - notchWidth, z: 0 }];
  }
  if (shape.kind === "U_SHAPE") {
    const { leftWingWidth, rightWingWidth, notchDepth } = shape.dimensions;
    return [{ x: 0, z: 0 }, { x: 0, z: -depth }, { x: width, z: -depth },
      { x: width, z: 0 }, { x: width - rightWingWidth, z: 0 },
      { x: width - rightWingWidth, z: -notchDepth },
      { x: leftWingWidth, z: -notchDepth }, { x: leftWingWidth, z: 0 }];
  }
  const { stemWidth, stemDepth } = shape.dimensions;
  const stemLeft = (width - stemWidth) / 2;
  const stemRight = stemLeft + stemWidth;
  const barDepth = depth - stemDepth;
  return [{ x: 0, z: 0 }, { x: 0, z: -barDepth },
    { x: stemLeft, z: -barDepth }, { x: stemLeft, z: -depth },
    { x: stemRight, z: -depth }, { x: stemRight, z: -barDepth },
    { x: width, z: -barDepth }, { x: width, z: 0 }];
}

function ambiguousTopologyError(): ValidationError {
  return {
    code: ValidationErrorCode.STALE_ROOM_TOPOLOGY,
    path: "building.levels.walls",
    message: "The Room footprint intersects existing Wall topology ambiguously."
  };
}

function samePoint(first: Point2D, second: Point2D): boolean {
  return Math.abs(first.x - second.x) <= 1e-7 && Math.abs(first.z - second.z) <= 1e-7;
}

function sameSegment(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  return (samePoint(a, c) && samePoint(b, d)) || (samePoint(a, d) && samePoint(b, c));
}

function segmentsConflict(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  if (sameSegment(a, b, c, d)) return false;
  const cross = (p: Point2D, q: Point2D, r: Point2D) =>
    (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const onSegment = (p: Point2D, q: Point2D, r: Point2D) =>
    Math.abs(cross(p, q, r)) <= 1e-7 &&
    r.x >= Math.min(p.x, q.x) - 1e-7 && r.x <= Math.max(p.x, q.x) + 1e-7 &&
    r.z >= Math.min(p.z, q.z) - 1e-7 && r.z <= Math.max(p.z, q.z) + 1e-7;
  const c1 = cross(a, b, c);
  const c2 = cross(a, b, d);
  const c3 = cross(c, d, a);
  const c4 = cross(c, d, b);
  const intersects = (c1 > 1e-7 && c2 < -1e-7 || c1 < -1e-7 && c2 > 1e-7) &&
    (c3 > 1e-7 && c4 < -1e-7 || c3 < -1e-7 && c4 > 1e-7) ||
    onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
  if (!intersects) return false;
  const sharedEndpoint = [a, b].some((first) => [c, d].some((second) => samePoint(first, second)));
  return !sharedEndpoint;
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
