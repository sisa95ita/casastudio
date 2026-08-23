import {
  getDoorHingeSide,
  getDoorSwingSide,
  getOpeningInterval,
  type Door,
  type Opening,
  type Point2D,
  type Wall,
  type Window
} from "@casastudio/schema";

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

/** Derives the physical strip for an entire Wall. */
export function createArchitecturalWallShape(wall: Wall): ArchitecturalWallShape {
  return createWallSegmentShape(wall, 0, wallLength(wall));
}

/** Derives Wall-body strips around all valid Opening intervals. */
export function createArchitecturalWallBodyShapes(wall: Wall): readonly ArchitecturalWallShape[] {
  const length = wallLength(wall);
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

function wallLocalPoint(wall: Pick<Wall, "start" | "end">, along: number, perpendicular: number): Point2D {
  const basis = wallBasis(wall);
  return {
    x: wall.start.x + basis.tangent.x * along + basis.normal.x * perpendicular,
    z: wall.start.z + basis.tangent.z * along + basis.normal.z * perpendicular
  };
}

function wallBasis(wall: Pick<Wall, "start" | "end">) {
  const length = wallLength(wall);
  if (length === 0) throw new Error("Cannot derive architectural geometry for a zero-length Wall.");
  const tangent = { x: (wall.end.x - wall.start.x) / length, z: (wall.end.z - wall.start.z) / length };
  return { tangent, normal: { x: -tangent.z, z: tangent.x } };
}

function wallLength(wall: Pick<Wall, "start" | "end">): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
}
