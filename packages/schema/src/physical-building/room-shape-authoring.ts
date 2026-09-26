import { ProjectSchema, type Project } from "../project/index.js";
import {
  IdentifierSchema,
  type Identifier,
  type Point2D
} from "../primitives/index.js";
import {
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  ValidationErrorCode,
  type ValidationError
} from "../validation/index.js";
import type { Room } from "./room.js";
import { splitWall, type ProjectEditingResult } from "./wall-editing.js";
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
  | {
      readonly kind: "RECTANGLE";
      readonly dimensions: RectangleRoomShapeDimensions;
      readonly rotation?: RoomShapeRotation;
    }
  | {
      readonly kind: "L_SHAPE";
      readonly dimensions: LShapeRoomShapeDimensions;
      readonly rotation?: RoomShapeRotation;
    }
  | {
      readonly kind: "U_SHAPE";
      readonly dimensions: UShapeRoomShapeDimensions;
      readonly rotation?: RoomShapeRotation;
    }
  | {
      readonly kind: "T_SHAPE";
      readonly dimensions: TShapeRoomShapeDimensions;
      readonly rotation?: RoomShapeRotation;
    };

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
  /** Caller-owned identifiers consumed by newly created boundary fragments. */
  readonly wallIds: readonly Identifier[];
  /** Caller-owned identifiers consumed by canonical Wall splits. */
  readonly splitWallIds: readonly Identifier[];
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
  if (!isFinitePoint(origin) || !validateRoomShapeDefinition(shape))
    return undefined;

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
export function validateRoomShapeDefinition(
  shape: RoomShapeDefinition
): boolean {
  if (
    shape.rotation !== undefined &&
    ![0, 90, 180, 270].includes(shape.rotation)
  )
    return false;
  const { width, depth } = shape.dimensions;
  if (!isPositiveFinite(width) || !isPositiveFinite(depth)) return false;
  if (shape.kind === "RECTANGLE") return true;
  if (shape.kind === "L_SHAPE") {
    const { notchWidth, notchDepth } = shape.dimensions;
    return (
      isPositiveFinite(notchWidth) &&
      isPositiveFinite(notchDepth) &&
      notchWidth < width &&
      notchDepth < depth
    );
  }
  if (shape.kind === "U_SHAPE") {
    const { leftWingWidth, rightWingWidth, notchDepth } = shape.dimensions;
    return (
      isPositiveFinite(leftWingWidth) &&
      isPositiveFinite(rightWingWidth) &&
      isPositiveFinite(notchDepth) &&
      leftWingWidth + rightWingWidth < width &&
      notchDepth < depth
    );
  }
  const { stemWidth, stemDepth } = shape.dimensions;
  return (
    isPositiveFinite(stemWidth) &&
    isPositiveFinite(stemDepth) &&
    stemWidth < width &&
    stemDepth < depth
  );
}

/**
 * Atomically reconciles one Room shape with same-Level canonical Wall topology.
 *
 * Existing collinear Walls are split at Room-edge endpoints when necessary,
 * exact segments and contiguous chains are reused, and uncovered edge ranges
 * become caller-identified Walls. Planning and application are pure; failures
 * never mutate or expose a partially reconciled Project.
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
  if (level.rooms.some((room) => room.id === input.room.id)) {
    return failure(ambiguousTopologyError());
  }

  const derivedVertices = deriveRoomShapeVertices(input.origin, input.shape);
  const vertices = derivedVertices
    ? normalizeRoomShapeVerticesToWalls(derivedVertices, level.walls)
    : undefined;
  const identifiers = [...input.wallIds, ...input.splitWallIds];
  if (
    !vertices ||
    new Set(identifiers).size !== identifiers.length ||
    identifiers.some(
      (identifier) => !IdentifierSchema.safeParse(identifier).success
    ) ||
    !isPositiveFinite(input.wallHeight) ||
    !isPositiveFinite(input.wallThickness)
  ) {
    return failure(invalidShapeError());
  }

  const planResult = planRoomShapeTopology(
    project,
    levelIndex,
    vertices,
    input
  );
  if (!planResult.ok) return planResult.result;
  const { project: reconciledProject, edges } = planResult.plan;
  const reconciledLevel = reconciledProject.building.levels[levelIndex]!;
  const boundary: Room["boundary"] = edges.map((edge) =>
    edge.kind === "REUSE"
      ? { wallId: edge.wallId, direction: edge.direction }
      : { wallId: edge.wall.id, direction: "FORWARD" }
  );
  const createdWalls = edges.flatMap((edge) =>
    edge.kind === "CREATE" ? [edge.wall] : []
  );
  const reusedWallIds = new Set(
    edges.flatMap((edge) => (edge.kind === "REUSE" ? [edge.wallId] : []))
  );
  const walls = [
    ...reconciledLevel.walls.map((wall) =>
      reusedWallIds.has(wall.id)
        ? { ...wall, roomIds: [...wall.roomIds, input.room.id] }
        : wall
    ),
    ...createdWalls
  ];
  const room: Room = {
    ...input.room,
    boundary
  };
  const candidate: Project = {
    ...reconciledProject,
    building: {
      ...reconciledProject.building,
      levels: reconciledProject.building.levels.map((current, index) =>
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

type PlannedBoundaryEdge =
  | {
      readonly kind: "REUSE";
      readonly wallId: Identifier;
      readonly direction: "FORWARD" | "REVERSE";
    }
  | { readonly kind: "CREATE"; readonly wall: Wall };

type RoomShapeTopologyPlan = {
  readonly project: Project;
  readonly edges: readonly PlannedBoundaryEdge[];
};

type PlannedSplit = {
  readonly wallId: Identifier;
  readonly point: Point2D;
  readonly newWallId: Identifier;
};

type CollinearContact = {
  readonly wall: Wall;
  readonly startParameter: number;
  readonly endParameter: number;
  readonly rawStartParameter: number;
  readonly rawEndParameter: number;
  readonly physicalStartParameter: number;
  readonly physicalEndParameter: number;
};

const topologyTolerance = 1e-9;

/**
 * Reuses exact canonical Wall-axis points for sub-tolerance authoring drift.
 *
 * Shape dimensions and a snapped origin can reach the same mathematical point
 * through different floating-point operations. Projecting only within the
 * domain topology tolerance ensures every boundary use shares one exact stored
 * coordinate without importing the editor's screen-space snap tolerance.
 */
function normalizeRoomShapeVerticesToWalls(
  vertices: readonly Point2D[],
  walls: readonly Wall[]
): readonly Point2D[] {
  return vertices.map((vertex) => {
    const candidates = walls.flatMap((wall) => {
      const parameter = segmentParameter(wall.start, wall.end, vertex);
      if (
        parameter === undefined ||
        parameter < -topologyTolerance ||
        parameter > 1 + topologyTolerance
      ) {
        return [];
      }
      const projected = pointAt(
        wall.start,
        wall.end,
        Math.min(1, Math.max(0, parameter))
      );
      const distance = Math.hypot(
        vertex.x - projected.x,
        vertex.z - projected.z
      );
      const wallLength = Math.hypot(
        wall.end.x - wall.start.x,
        wall.end.z - wall.start.z
      );
      return distance <= Math.max(1, wallLength) * topologyTolerance
        ? [{ point: projected, distance, wallId: wall.id }]
        : [];
    });
    const canonical = candidates.sort(
      (first, second) =>
        first.distance - second.distance ||
        first.wallId.localeCompare(second.wallId)
    )[0];
    return canonical?.point ?? vertex;
  });
}

function planRoomShapeTopology(
  project: Project,
  levelIndex: number,
  vertices: readonly Point2D[],
  input: CreateRoomFromShapeInput
):
  | { readonly ok: true; readonly plan: RoomShapeTopologyPlan }
  | { readonly ok: false; readonly result: ProjectEditingResult } {
  const level = project.building.levels[levelIndex]!;
  const splitPointsByWall = new Map<Identifier, Point2D[]>();

  for (const wall of level.walls) {
    for (const [edgeIndex, start] of vertices.entries()) {
      const end = vertices[(edgeIndex + 1) % vertices.length]!;
      if (!hasPositiveCollinearOverlap(start, end, wall)) continue;
      for (const point of [start, end]) {
        if (!pointStrictlyInsideWall(point, wall)) continue;
        const points = splitPointsByWall.get(wall.id) ?? [];
        if (!points.some((candidate) => samePoint(candidate, point))) {
          points.push(point);
          splitPointsByWall.set(wall.id, points);
        }
      }
    }
  }

  const splitCount = [...splitPointsByWall.values()].reduce(
    (total, points) => total + points.length,
    0
  );
  if (input.splitWallIds.length < splitCount) {
    return { ok: false, result: failure(invalidShapeError()) };
  }

  let splitIdIndex = 0;
  const splits: PlannedSplit[] = [];
  for (const wall of level.walls) {
    const points = splitPointsByWall.get(wall.id) ?? [];
    const ordered = points
      .map((point) => ({ point, parameter: wallParameter(wall, point)! }))
      .sort((first, second) => second.parameter - first.parameter);
    for (const split of ordered) {
      splits.push({
        wallId: wall.id,
        point: split.point,
        newWallId: input.splitWallIds[splitIdIndex++]!
      });
    }
  }

  let reconciledProject = project;
  for (const split of splits) {
    const result = splitWall(reconciledProject, {
      levelId: input.levelId,
      wallId: split.wallId,
      splitPoint: split.point,
      newWallId: split.newWallId
    });
    if (!result.ok) return { ok: false, result };
    reconciledProject = result.project;
  }

  const reconciledLevel = reconciledProject.building.levels[levelIndex]!;
  const plannedEdges: PlannedBoundaryEdge[] = [];
  const reusedWallIds = new Set<Identifier>();
  let wallIdIndex = 0;

  for (const [edgeIndex, start] of vertices.entries()) {
    const end = vertices[(edgeIndex + 1) % vertices.length]!;
    const contacts = findCollinearContacts(start, end, reconciledLevel.walls);
    const canonicalJunctions = contacts.flatMap((contact) => [
      contact.wall.start,
      contact.wall.end
    ]);
    let cursor = 0;

    for (const contact of contacts) {
      if (
        contact.startParameter < cursor - topologyTolerance ||
        contact.rawStartParameter < -topologyTolerance ||
        contact.rawEndParameter > 1 + topologyTolerance
      ) {
        return { ok: false, result: failure(ambiguousTopologyError()) };
      }
      if (contact.startParameter > cursor + topologyTolerance) {
        const wallId = input.wallIds[wallIdIndex++];
        if (!wallId) return { ok: false, result: failure(invalidShapeError()) };
        plannedEdges.push({
          kind: "CREATE",
          wall: createPlannedWall(
            wallId,
            pointAt(start, end, cursor),
            pointAt(start, end, contact.startParameter),
            input
          )
        });
      }
      if (
        contact.wall.roomIds.length >= 2 ||
        reusedWallIds.has(contact.wall.id)
      ) {
        return { ok: false, result: failure(ambiguousTopologyError()) };
      }
      reusedWallIds.add(contact.wall.id);
      plannedEdges.push({
        kind: "REUSE",
        wallId: contact.wall.id,
        direction:
          contact.physicalStartParameter < contact.physicalEndParameter
            ? "FORWARD"
            : "REVERSE"
      });
      cursor = contact.endParameter;
    }

    if (cursor < 1 - topologyTolerance) {
      const wallId = input.wallIds[wallIdIndex++];
      if (!wallId) return { ok: false, result: failure(invalidShapeError()) };
      plannedEdges.push({
        kind: "CREATE",
        wall: createPlannedWall(wallId, pointAt(start, end, cursor), end, input)
      });
    }

    if (
      reconciledLevel.walls.some(
        (wall) =>
          !isCollinear(start, end, wall.start, wall.end) &&
          segmentsConflict(start, end, wall.start, wall.end, canonicalJunctions)
      )
    ) {
      return { ok: false, result: failure(ambiguousTopologyError()) };
    }
  }

  return {
    ok: true,
    plan: { project: reconciledProject, edges: plannedEdges }
  };
}

function createPlannedWall(
  id: Identifier,
  start: Point2D,
  end: Point2D,
  input: CreateRoomFromShapeInput
): Wall {
  return {
    id,
    start,
    end,
    height: input.wallHeight,
    thickness: input.wallThickness,
    roomIds: [input.room.id],
    openings: []
  };
}

function findCollinearContacts(
  start: Point2D,
  end: Point2D,
  walls: readonly Wall[]
): readonly CollinearContact[] {
  return walls
    .flatMap((wall) => {
      if (!hasPositiveCollinearOverlap(start, end, wall)) return [];
      const first = segmentParameter(start, end, wall.start)!;
      const second = segmentParameter(start, end, wall.end)!;
      const rawStartParameter = Math.min(first, second);
      const rawEndParameter = Math.max(first, second);
      return [
        {
          wall,
          rawStartParameter,
          rawEndParameter,
          physicalStartParameter: first,
          physicalEndParameter: second,
          startParameter: Math.max(0, rawStartParameter),
          endParameter: Math.min(1, rawEndParameter)
        }
      ];
    })
    .sort(
      (first, second) =>
        first.startParameter - second.startParameter ||
        first.wall.id.localeCompare(second.wall.id)
    );
}

function hasPositiveCollinearOverlap(
  start: Point2D,
  end: Point2D,
  wall: Wall
): boolean {
  if (!isCollinear(start, end, wall.start, wall.end)) return false;
  const first = segmentParameter(start, end, wall.start)!;
  const second = segmentParameter(start, end, wall.end)!;
  return (
    Math.min(1, Math.max(first, second)) -
      Math.max(0, Math.min(first, second)) >
    topologyTolerance
  );
}

function isCollinear(
  start: Point2D,
  end: Point2D,
  first: Point2D,
  second: Point2D
): boolean {
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  if (length === 0) return false;
  const distance = (point: Point2D) =>
    Math.abs(
      (end.x - start.x) * (point.z - start.z) -
        (end.z - start.z) * (point.x - start.x)
    ) / length;
  const tolerance = Math.max(1, length) * topologyTolerance;
  return distance(first) <= tolerance && distance(second) <= tolerance;
}

function pointStrictlyInsideWall(point: Point2D, wall: Wall): boolean {
  const parameter = wallParameter(wall, point);
  return (
    parameter !== undefined &&
    parameter > topologyTolerance &&
    parameter < 1 - topologyTolerance
  );
}

function wallParameter(wall: Wall, point: Point2D): number | undefined {
  if (!isCollinear(wall.start, wall.end, point, point)) return undefined;
  return segmentParameter(wall.start, wall.end, point);
}

function segmentParameter(
  start: Point2D,
  end: Point2D,
  point: Point2D
): number | undefined {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (lengthSquared === 0) return undefined;
  return (
    ((point.x - start.x) * deltaX + (point.z - start.z) * deltaZ) /
    lengthSquared
  );
}

function pointAt(start: Point2D, end: Point2D, parameter: number): Point2D {
  if (parameter <= topologyTolerance) return start;
  if (parameter >= 1 - topologyTolerance) return end;
  return {
    x: start.x + (end.x - start.x) * parameter,
    z: start.z + (end.z - start.z) * parameter
  };
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
    return [
      { x: 0, z: 0 },
      { x: 0, z: -depth },
      { x: width, z: -depth },
      { x: width, z: 0 }
    ];
  }
  if (shape.kind === "L_SHAPE") {
    const { notchWidth, notchDepth } = shape.dimensions;
    return [
      { x: 0, z: 0 },
      { x: 0, z: -depth },
      { x: width, z: -depth },
      { x: width, z: -notchDepth },
      { x: width - notchWidth, z: -notchDepth },
      { x: width - notchWidth, z: 0 }
    ];
  }
  if (shape.kind === "U_SHAPE") {
    const { leftWingWidth, rightWingWidth, notchDepth } = shape.dimensions;
    return [
      { x: 0, z: 0 },
      { x: 0, z: -depth },
      { x: width, z: -depth },
      { x: width, z: 0 },
      { x: width - rightWingWidth, z: 0 },
      { x: width - rightWingWidth, z: -notchDepth },
      { x: leftWingWidth, z: -notchDepth },
      { x: leftWingWidth, z: 0 }
    ];
  }
  const { stemWidth, stemDepth } = shape.dimensions;
  const stemLeft = (width - stemWidth) / 2;
  const stemRight = stemLeft + stemWidth;
  const barDepth = depth - stemDepth;
  return [
    { x: 0, z: 0 },
    { x: 0, z: -barDepth },
    { x: stemLeft, z: -barDepth },
    { x: stemLeft, z: -depth },
    { x: stemRight, z: -depth },
    { x: stemRight, z: -barDepth },
    { x: width, z: -barDepth },
    { x: width, z: 0 }
  ];
}

function ambiguousTopologyError(): ValidationError {
  return {
    code: ValidationErrorCode.STALE_ROOM_TOPOLOGY,
    path: "building.levels.walls",
    message: "The Room footprint intersects existing Wall topology ambiguously."
  };
}

function samePoint(first: Point2D, second: Point2D): boolean {
  return (
    Math.hypot(first.x - second.x, first.z - second.z) <= topologyTolerance
  );
}

function sameSegment(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  return (
    (samePoint(a, c) && samePoint(b, d)) || (samePoint(a, d) && samePoint(b, c))
  );
}

function segmentsConflict(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D,
  canonicalJunctions: readonly Point2D[] = []
): boolean {
  if (sameSegment(a, b, c, d)) return false;
  const cross = (p: Point2D, q: Point2D, r: Point2D) =>
    (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const crossTolerance = (p: Point2D, q: Point2D, r: Point2D) =>
    Math.max(
      1,
      Math.hypot(q.x - p.x, q.z - p.z),
      Math.hypot(r.x - p.x, r.z - p.z)
    ) **
      2 *
    topologyTolerance;
  const sign = (value: number, tolerance: number) =>
    value > tolerance ? 1 : value < -tolerance ? -1 : 0;
  const onSegment = (p: Point2D, q: Point2D, r: Point2D) => {
    const parameter = segmentParameter(p, q, r);
    return (
      parameter !== undefined &&
      isCollinear(p, q, r, r) &&
      parameter >= -topologyTolerance &&
      parameter <= 1 + topologyTolerance
    );
  };
  const c1 = cross(a, b, c);
  const c2 = cross(a, b, d);
  const c3 = cross(c, d, a);
  const c4 = cross(c, d, b);
  const s1 = sign(c1, crossTolerance(a, b, c));
  const s2 = sign(c2, crossTolerance(a, b, d));
  const s3 = sign(c3, crossTolerance(c, d, a));
  const s4 = sign(c4, crossTolerance(c, d, b));
  const intersects =
    (s1 !== 0 && s2 !== 0 && s1 !== s2 && s3 !== 0 && s4 !== 0 && s3 !== s4) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b);
  if (!intersects) return false;
  const sharedEndpoint = [a, b].some((first) =>
    [c, d].some((second) => samePoint(first, second))
  );
  if (sharedEndpoint) return false;
  const canonicalEndpointTouch = [c, d].some(
    (endpoint) =>
      onSegment(a, b, endpoint) &&
      canonicalJunctions.some((junction) => samePoint(endpoint, junction))
  );
  return !canonicalEndpointTouch;
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
    message:
      "Room shape dimensions and Wall parameters must produce a finite, non-degenerate polygon."
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
