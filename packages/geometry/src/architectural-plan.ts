import {
  getDoorHingeSide,
  getDoorSwingSide,
  getOpeningInterval,
  type Door,
  type Opening,
  type Point2D,
  type Wall,
  type WallOpening,
  type Window
} from "@casastudio/schema";
import { measureWall } from "./architectural-measurements.js";

/** Result of projecting a world-space point into one Wall's local axis. */
export type WallPointProjection = {
  readonly projected: Point2D;
  readonly t: number;
  readonly unclampedT: number;
  readonly distanceAlongWall: number;
  readonly perpendicularDistance: number;
  readonly clamped: boolean;
};

/** Projects one world point onto a finite Wall segment. */
export function projectPointOntoWall(point: Point2D, wall: Pick<Wall, "start" | "end">): WallPointProjection {
  const deltaX = wall.end.x - wall.start.x;
  const deltaZ = wall.end.z - wall.start.z;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (lengthSquared === 0) throw new Error("Cannot project onto a zero-length Wall.");
  const length = Math.sqrt(lengthSquared);
  const relativeX = point.x - wall.start.x;
  const relativeZ = point.z - wall.start.z;
  const unclampedT = (relativeX * deltaX + relativeZ * deltaZ) / lengthSquared;
  const t = Math.max(0, Math.min(1, unclampedT));
  const projected = { x: wall.start.x + deltaX * t, z: wall.start.z + deltaZ * t };
  return {
    projected,
    t,
    unclampedT,
    distanceAlongWall: t * length,
    perpendicularDistance: (deltaX * relativeZ - deltaZ * relativeX) / length,
    clamped: t !== unclampedT
  };
}

/** Four-point physical strip occupied by one Wall or Wall-body segment. */
export type ArchitecturalWallShape = {
  readonly wallId: Wall["id"];
  readonly startDistance: number;
  readonly endDistance: number;
  readonly points: readonly [Point2D, Point2D, Point2D, Point2D];
};

/** How one derived physical Wall endpoint differs from its ordinary square cap. */
export type ArchitecturalWallEndInterfaceKind = "cap" | "miter" | "bounded";

/** Resolved left/right physical face endpoints at one canonical Wall endpoint. */
export type ArchitecturalWallEndInterface = Readonly<{
  left: Point2D;
  right: Point2D;
  kind: ArchitecturalWallEndInterfaceKind;
}>;

/** Final physical endpoint interfaces for one canonical Wall reference segment. */
export type ArchitecturalWallEndpointInterfaces = Readonly<{
  wallId: Wall["id"];
  start: ArchitecturalWallEndInterface;
  end: ArchitecturalWallEndInterface;
}>;

const WALL_INTERFACE_ANGLE_EPSILON = 1e-9;
const MAX_WALL_MITER_RATIO = 4;
const MAX_WALL_LENGTH_MITER_RATIO = 0.45;

/**
 * Resolves each Wall's physical face endpoints against angularly adjacent Walls.
 * Canonical reference endpoints remain unchanged; consumers extrude these
 * interfaces as part of the owning Wall body rather than as junction geometry.
 */
export function createArchitecturalWallEndpointInterfaces(
  level: Readonly<{ walls: readonly Wall[] }>
): readonly ArchitecturalWallEndpointInterfaces[] {
  const endpointGroups = new Map<string, MutableWallEndpointRay[]>();
  const endpointsByWall = new Map<Wall["id"], {
    start: MutableWallEndpointRay;
    end: MutableWallEndpointRay;
  }>();
  for (const wall of level.walls) {
    const basis = wallBasis(wall);
    const length = measureWall(wall).length;
    const start = createEndpointRay(wall, "start", wall.start, basis.tangent, length);
    const end = createEndpointRay(
      wall,
      "end",
      wall.end,
      { x: -basis.tangent.x, z: -basis.tangent.z },
      length
    );
    endpointsByWall.set(wall.id, { start, end });
    for (const endpoint of [start, end]) {
      const key = `${endpoint.point.x}:${endpoint.point.z}`;
      endpointGroups.set(key, [...(endpointGroups.get(key) ?? []), endpoint]);
    }
  }

  for (const incident of endpointGroups.values()) resolveEndpointNode(incident);
  return Object.freeze(level.walls.map((wall) => {
    const endpoints = endpointsByWall.get(wall.id)!;
    return Object.freeze({
      wallId: wall.id,
      start: freezeCanonicalInterface(endpoints.start),
      end: freezeCanonicalInterface(endpoints.end)
    });
  }));
}

/** Derives the physical strip for an entire Wall. */
export function createArchitecturalWallShape(wall: Wall): ArchitecturalWallShape {
  return createWallSegmentShape(wall, 0, measureWall(wall).length);
}

/** Derives Wall-body strips around all valid Opening intervals. */
export function createArchitecturalWallBodyShapes(wall: Wall): readonly ArchitecturalWallShape[] {
  const length = measureWall(wall).length;
  const intervals = wall.openings.map(getOpeningInterval).sort((a, b) => a.start - b.start);
  const shapes: ArchitecturalWallShape[] = [];
  let cursor = 0;
  for (const interval of intervals) {
    if (interval.start > cursor) shapes.push(createWallSegmentShape(wall, cursor, interval.start));
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < length) shapes.push(createWallSegmentShape(wall, cursor, length));
  return shapes;
}

/** Wall-local span and basis shared by Door and Window plan symbols. */
export type OpeningPlanSpan = {
  readonly openingId: Opening["id"];
  readonly wallId: Wall["id"];
  readonly start: Point2D;
  readonly end: Point2D;
  readonly center: Point2D;
  readonly tangent: Point2D;
  readonly leftNormal: Point2D;
  readonly width: number;
  readonly wallThickness: number;
};

/** Derives an Opening's true-width span in world coordinates. */
export function createOpeningPlanSpan(wall: Wall, opening: Opening): OpeningPlanSpan {
  const basis = wallBasis(wall);
  return {
    openingId: opening.id,
    wallId: wall.id,
    start: wallLocalPoint(wall, opening.offsetFromStart, 0),
    end: wallLocalPoint(wall, opening.offsetFromStart + opening.width, 0),
    center: wallLocalPoint(wall, opening.offsetFromStart + opening.width / 2, 0),
    tangent: basis.tangent,
    leftNormal: basis.normal,
    width: opening.width,
    wallThickness: wall.thickness
  };
}

/** Architectural Door leaf and swing geometry in world coordinates. */
export type DoorPlanGeometry = {
  readonly kind: "DOOR";
  readonly span: OpeningPlanSpan;
  readonly hinge: Point2D;
  readonly closedLeafEnd: Point2D;
  readonly openLeafEnd: Point2D;
  readonly arcStart: Point2D;
  readonly arcEnd: Point2D;
  readonly arcRadius: number;
  readonly arcSweep: 0 | 1;
  readonly jambs: readonly [readonly [Point2D, Point2D], readonly [Point2D, Point2D]];
};

/** Derives Door hinge, leaf, and quarter-circle swing from Wall-relative semantics. */
export function createDoorPlanGeometry(wall: Wall, door: Door): DoorPlanGeometry {
  const span = createOpeningPlanSpan(wall, door);
  const hingeAtStart = getDoorHingeSide(door) === "START";
  const swingSign = getDoorSwingSide(door) === "LEFT" ? 1 : -1;
  const hinge = hingeAtStart ? span.start : span.end;
  const closedLeafEnd = hingeAtStart ? span.end : span.start;
  const openLeafEnd = {
    x: hinge.x + span.leftNormal.x * door.width * swingSign,
    z: hinge.z + span.leftNormal.z * door.width * swingSign
  };
  return {
    kind: "DOOR",
    span,
    hinge,
    closedLeafEnd,
    openLeafEnd,
    arcStart: closedLeafEnd,
    arcEnd: openLeafEnd,
    arcRadius: door.width,
    arcSweep: hingeAtStart === (swingSign > 0) ? 0 : 1,
    jambs: createOpeningJambs(wall, door)
  };
}

/** Architectural Window linework in world coordinates. */
export type WindowPlanGeometry = {
  readonly kind: "WINDOW";
  readonly span: OpeningPlanSpan;
  readonly glazingLines: readonly [readonly [Point2D, Point2D], readonly [Point2D, Point2D]];
  readonly jambs: readonly [readonly [Point2D, Point2D], readonly [Point2D, Point2D]];
};

/** Derives a double-line Window symbol without distorting its vertical properties. */
export function createWindowPlanGeometry(wall: Wall, window: Window): WindowPlanGeometry {
  const span = createOpeningPlanSpan(wall, window);
  const inset = wall.thickness * 0.2;
  return {
    kind: "WINDOW",
    span,
    glazingLines: [
      [wallLocalPoint(wall, window.offsetFromStart, inset), wallLocalPoint(wall, window.offsetFromStart + window.width, inset)],
      [wallLocalPoint(wall, window.offsetFromStart, -inset), wallLocalPoint(wall, window.offsetFromStart + window.width, -inset)]
    ],
    jambs: createOpeningJambs(wall, window)
  };
}

/** Architectural linework for an unadorned Wall Opening. */
export type WallOpeningPlanGeometry = {
  readonly kind: "OPENING";
  readonly span: OpeningPlanSpan;
  readonly jambs: readonly [readonly [Point2D, Point2D], readonly [Point2D, Point2D]];
};

/** Derives the clean passage span and jambs for a Wall Opening. */
export function createWallOpeningPlanGeometry(
  wall: Wall,
  opening: WallOpening
): WallOpeningPlanGeometry {
  return {
    kind: "OPENING",
    span: createOpeningPlanSpan(wall, opening),
    jambs: createOpeningJambs(wall, opening)
  };
}

function createOpeningJambs(wall: Wall, opening: Opening): DoorPlanGeometry["jambs"] {
  const half = wall.thickness / 2;
  return [
    [wallLocalPoint(wall, opening.offsetFromStart, -half), wallLocalPoint(wall, opening.offsetFromStart, half)],
    [wallLocalPoint(wall, opening.offsetFromStart + opening.width, -half), wallLocalPoint(wall, opening.offsetFromStart + opening.width, half)]
  ];
}

function createWallSegmentShape(wall: Wall, startDistance: number, endDistance: number): ArchitecturalWallShape {
  const half = wall.thickness / 2;
  return {
    wallId: wall.id,
    startDistance,
    endDistance,
    points: [
      wallLocalPoint(wall, startDistance, half),
      wallLocalPoint(wall, startDistance, -half),
      wallLocalPoint(wall, endDistance, -half),
      wallLocalPoint(wall, endDistance, half)
    ]
  };
}

type MutableWallEndpointRay = {
  wall: Wall;
  endpoint: "start" | "end";
  point: Point2D;
  direction: Point2D;
  length: number;
  left: Point2D;
  right: Point2D;
  kind: ArchitecturalWallEndInterfaceKind;
};

function createEndpointRay(
  wall: Wall,
  endpoint: "start" | "end",
  point: Point2D,
  direction: Point2D,
  length: number
): MutableWallEndpointRay {
  const halfThickness = wall.thickness / 2;
  const normal = leftNormal(direction);
  return {
    wall,
    endpoint,
    point,
    direction,
    length,
    left: addPoint(point, scalePoint(normal, halfThickness)),
    right: addPoint(point, scalePoint(normal, -halfThickness)),
    kind: "cap"
  };
}

/** Resolves paired physical faces while leaving exact collinear caps untouched. */
function resolveEndpointNode(incident: readonly MutableWallEndpointRay[]): void {
  if (incident.length < 2) return;
  const ordered = [...incident].sort((left, right) => {
    const angleDifference = directionAngle(left.direction) - directionAngle(right.direction);
    return angleDifference || left.wall.id.localeCompare(right.wall.id) ||
      left.endpoint.localeCompare(right.endpoint);
  });
  const throughRays = incident.length > 2
    ? new Set(incident.filter((candidate, index) =>
        incident.some((other, otherIndex) =>
          index !== otherIndex && areOppositeDirections(candidate.direction, other.direction)
        )
      ))
    : new Set<MutableWallEndpointRay>();
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index]!;
    const next = ordered[(index + 1) % ordered.length]!;
    const currentAngle = directionAngle(current.direction);
    let nextAngle = directionAngle(next.direction);
    if (index === ordered.length - 1) nextAngle += Math.PI * 2;
    const gap = nextAngle - currentAngle;
    if (Math.abs(gap - Math.PI) <= WALL_INTERFACE_ANGLE_EPSILON) continue;
    if (incident.length > 2) {
      if (gap > Math.PI) {
        resolveAdjacentFaces(current, next, gap, true, true);
      } else if (throughRays.size > 0) {
        const currentThrough = throughRays.has(current);
        const nextThrough = throughRays.has(next);
        if (!currentThrough && nextThrough) {
          resolveAdjacentFaces(current, next, gap, true, false);
        } else if (currentThrough && !nextThrough) {
          resolveAdjacentFaces(current, next, gap, false, true);
        }
      }
      continue;
    }
    resolveAdjacentFaces(current, next, gap, true, true);
  }
}

/** Resolves one angular boundary, optionally retaining a through-Wall square cap. */
function resolveAdjacentFaces(
  current: MutableWallEndpointRay,
  next: MutableWallEndpointRay,
  gap: number,
  updateCurrentLeft: boolean,
  updateNextRight: boolean
): void {
  const currentAngle = directionAngle(current.direction);
  const intersection = intersectLines(
      current.left,
      current.direction,
      next.right,
      next.direction
  );
  const maximumDistance = Math.min(
    Math.max(current.wall.thickness, next.wall.thickness) / 2 * MAX_WALL_MITER_RATIO,
    current.length * MAX_WALL_LENGTH_MITER_RATIO,
    next.length * MAX_WALL_LENGTH_MITER_RATIO
  );
  const intersectionDistance = intersection
    ? Math.hypot(
        intersection.x - current.point.x,
        intersection.z - current.point.z
      )
    : Number.POSITIVE_INFINITY;
  const bounded =
    !intersection ||
    !Number.isFinite(intersectionDistance) ||
    intersectionDistance > maximumDistance;
  const sharedPoint = bounded
    ? addPoint(
        current.point,
        scalePoint(
          {
            x: Math.cos(currentAngle + gap / 2),
            z: Math.sin(currentAngle + gap / 2)
          },
          maximumDistance
        )
      )
    : intersection;
  if (updateCurrentLeft) {
    current.left = sharedPoint;
    current.kind = mergeInterfaceKind(current.kind, bounded ? "bounded" : "miter");
  }
  if (updateNextRight) {
    next.right = sharedPoint;
    next.kind = mergeInterfaceKind(next.kind, bounded ? "bounded" : "miter");
  }
}

function areOppositeDirections(first: Point2D, second: Point2D): boolean {
  const cross = first.x * second.z - first.z * second.x;
  const dot = first.x * second.x + first.z * second.z;
  return Math.abs(cross) <= WALL_INTERFACE_ANGLE_EPSILON && dot < 0;
}

function freezeCanonicalInterface(
  endpoint: MutableWallEndpointRay
): ArchitecturalWallEndInterface {
  const left = endpoint.endpoint === "start" ? endpoint.left : endpoint.right;
  const right = endpoint.endpoint === "start" ? endpoint.right : endpoint.left;
  return Object.freeze({
    left: Object.freeze({ ...left }),
    right: Object.freeze({ ...right }),
    kind: endpoint.kind
  });
}

function mergeInterfaceKind(
  current: ArchitecturalWallEndInterfaceKind,
  next: ArchitecturalWallEndInterfaceKind
): ArchitecturalWallEndInterfaceKind {
  if (current === "bounded" || next === "bounded") return "bounded";
  if (current === "miter" || next === "miter") return "miter";
  return "cap";
}

function directionAngle(direction: Point2D): number {
  const angle = Math.atan2(direction.z, direction.x);
  return angle < 0 ? angle + Math.PI * 2 : angle;
}

function leftNormal(direction: Point2D): Point2D {
  return { x: -direction.z, z: direction.x };
}

function scalePoint(point: Point2D, scale: number): Point2D {
  return { x: point.x * scale, z: point.z * scale };
}

function addPoint(left: Point2D, right: Point2D): Point2D {
  return { x: left.x + right.x, z: left.z + right.z };
}

function intersectLines(
  firstPoint: Point2D,
  firstDirection: Point2D,
  secondPoint: Point2D,
  secondDirection: Point2D
): Point2D | undefined {
  const denominator =
    firstDirection.x * secondDirection.z -
    firstDirection.z * secondDirection.x;
  if (Math.abs(denominator) <= WALL_INTERFACE_ANGLE_EPSILON) return undefined;
  const offset = {
    x: secondPoint.x - firstPoint.x,
    z: secondPoint.z - firstPoint.z
  };
  const alongFirst =
    (offset.x * secondDirection.z - offset.z * secondDirection.x) /
    denominator;
  return {
    x: firstPoint.x + firstDirection.x * alongFirst,
    z: firstPoint.z + firstDirection.z * alongFirst
  };
}

function wallLocalPoint(wall: Pick<Wall, "start" | "end">, along: number, perpendicular: number): Point2D {
  const basis = wallBasis(wall);
  return {
    x: wall.start.x + basis.tangent.x * along + basis.normal.x * perpendicular,
    z: wall.start.z + basis.tangent.z * along + basis.normal.z * perpendicular
  };
}

function wallBasis(wall: Pick<Wall, "start" | "end">) {
  const length = measureWall(wall).length;
  if (length === 0) throw new Error("Cannot derive architectural geometry for a zero-length Wall.");
  const tangent = { x: (wall.end.x - wall.start.x) / length, z: (wall.end.z - wall.start.z) / length };
  return { tangent, normal: { x: -tangent.z, z: tangent.x } };
}
