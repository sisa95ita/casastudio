import {
  convertPhysicalLength,
  formatArchitecturalLength,
  type Level,
  type Point2D,
  type Room,
  type Units,
  type Wall
} from "@casastudio/schema";

import {
  deriveRoomBoundaryPoints,
  measurePlan,
  pointDistance
} from "./architectural-measurements.js";

/** Supported denominators for architectural document scales. */
export type ArchitecturalScaleDenominator = 20 | 50 | 75 | 100;

/** Initial document scales offered by the plan presentation. */
export const architecturalScaleDenominators: readonly ArchitecturalScaleDenominator[] =
  Object.freeze([20, 50, 75, 100]);

/** One physical line segment used by dimension presentation geometry. */
export type DimensionLineSegment = {
  readonly start: Point2D;
  readonly end: Point2D;
};

/** Direction metadata for a linear dimension in the Project XZ plane. */
export type LinearDimensionDirection = {
  readonly orientation: "horizontal" | "vertical" | "angled";
  readonly angleRadians: number;
  readonly tangent: Point2D;
  readonly normal: Point2D;
};

/** Derived Project-space geometry and physical value for one linear dimension. */
export type LinearDimension = {
  readonly kind: "linear";
  readonly sourceStart: Point2D;
  readonly sourceEnd: Point2D;
  readonly extensionLines: readonly [DimensionLineSegment, DimensionLineSegment];
  readonly dimensionLine: DimensionLineSegment;
  readonly markers: readonly [DimensionLineSegment, DimensionLineSegment];
  readonly labelAnchor: Point2D;
  readonly physicalValue: number;
  readonly formattedValue: string;
  readonly direction: LinearDimensionDirection;
};

/** Options controlling dimension layout in physical Project coordinates. */
export type CreateLinearDimensionOptions = {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly offset: number;
  readonly units: Pick<Units, "length">;
  readonly extensionGap?: number;
  readonly extensionOvershoot?: number;
  readonly markerSize?: number;
};

/** Automatic overall and chained exterior dimensions for a Level. */
export type ExteriorLevelDimensions = {
  readonly overallHorizontal?: LinearDimension;
  readonly overallVertical?: LinearDimension;
  readonly horizontalChain: readonly LinearDimension[];
  readonly verticalChain: readonly LinearDimension[];
};

/** Converts a paper-space distance into the active Project length unit. */
export function documentDistanceToProjectUnits(
  paperCentimeters: number,
  denominator: ArchitecturalScaleDenominator,
  projectLengthUnit: Units["length"]
): number {
  return convertPhysicalLength(paperCentimeters * denominator, "cm", projectLengthUnit);
}

/** Creates a non-persistent linear dimension entirely in Project coordinates. */
export function createLinearDimension(
  options: CreateLinearDimensionOptions
): LinearDimension | undefined {
  const physicalValue = pointDistance(options.start, options.end);
  if (!(physicalValue > 0) || !Number.isFinite(physicalValue)) return undefined;
  const tangent = {
    x: (options.end.x - options.start.x) / physicalValue,
    z: (options.end.z - options.start.z) / physicalValue
  };
  const normal = { x: -tangent.z, z: tangent.x };
  const offsetPoint = (point: Point2D, distance: number): Point2D => ({
    x: point.x + normal.x * distance,
    z: point.z + normal.z * distance
  });
  const extensionGap = Math.max(0, options.extensionGap ?? 0);
  const extensionOvershoot = Math.max(0, options.extensionOvershoot ?? 0);
  const markerSize = Math.max(0, options.markerSize ?? physicalValue * 0.02);
  const dimensionStart = offsetPoint(options.start, options.offset);
  const dimensionEnd = offsetPoint(options.end, options.offset);
  const extensionDirection = Math.sign(options.offset) || 1;
  const extensionStartDistance = extensionGap * extensionDirection;
  const extensionEndDistance = options.offset + extensionOvershoot * extensionDirection;
  const markerDelta = {
    x: (tangent.x + normal.x) * markerSize / 2,
    z: (tangent.z + normal.z) * markerSize / 2
  };
  const marker = (point: Point2D): DimensionLineSegment => ({
    start: { x: point.x - markerDelta.x, z: point.z - markerDelta.z },
    end: { x: point.x + markerDelta.x, z: point.z + markerDelta.z }
  });
  const epsilon = 1e-9;
  const orientation = Math.abs(tangent.z) <= epsilon
    ? "horizontal"
    : Math.abs(tangent.x) <= epsilon
      ? "vertical"
      : "angled";
  return Object.freeze({
    kind: "linear",
    sourceStart: { ...options.start },
    sourceEnd: { ...options.end },
    extensionLines: Object.freeze([
      { start: offsetPoint(options.start, extensionStartDistance), end: offsetPoint(options.start, extensionEndDistance) },
      { start: offsetPoint(options.end, extensionStartDistance), end: offsetPoint(options.end, extensionEndDistance) }
    ] as const),
    dimensionLine: { start: dimensionStart, end: dimensionEnd },
    markers: Object.freeze([marker(dimensionStart), marker(dimensionEnd)] as const),
    labelAnchor: {
      x: (dimensionStart.x + dimensionEnd.x) / 2,
      z: (dimensionStart.z + dimensionEnd.z) / 2
    },
    physicalValue,
    formattedValue: formatArchitecturalLength(physicalValue, options.units.length),
    direction: Object.freeze({
      orientation,
      angleRadians: Math.atan2(tangent.z, tangent.x),
      tangent,
      normal
    })
  });
}

/** Creates a selected-Wall dimension using the Wall's full physical segment. */
export function createWallDimension(
  wall: Pick<Wall, "start" | "end">,
  units: Pick<Units, "length">,
  denominator: ArchitecturalScaleDenominator,
  offsetSign: 1 | -1 = 1
): LinearDimension | undefined {
  const layoutUnit = documentDistanceToProjectUnits(0.18, denominator, units.length);
  return createLinearDimension({
    start: wall.start,
    end: wall.end,
    offset: layoutUnit * offsetSign,
    extensionGap: layoutUnit * 0.12,
    extensionOvershoot: layoutUnit * 0.12,
    markerSize: layoutUnit * 0.28,
    units
  });
}

/**
 * Creates width and depth dimensions only for a four-sided orthogonal Room.
 * Irregular and angled Rooms intentionally return no invented linear extents.
 */
export function createOrthogonalRoomDimensions(
  level: Pick<Level, "walls">,
  room: Pick<Room, "boundary">,
  units: Pick<Units, "length">,
  denominator: ArchitecturalScaleDenominator
): readonly LinearDimension[] {
  const points = deriveRoomBoundaryPoints(level, room);
  if (!points || points.length !== 4) return [];
  const axisAligned = points.every((point, index) => {
    const next = points[(index + 1) % points.length];
    return next ? point.x === next.x || point.z === next.z : false;
  });
  const xs = uniqueSorted(points.map((point) => point.x));
  const zs = uniqueSorted(points.map((point) => point.z));
  if (!axisAligned || xs.length !== 2 || zs.length !== 2) return [];
  const [minX, maxX] = xs;
  const [minZ, maxZ] = zs;
  if (minX === undefined || maxX === undefined || minZ === undefined || maxZ === undefined) return [];
  const inset = documentDistanceToProjectUnits(0.1, denominator, units.length);
  const markerSize = documentDistanceToProjectUnits(0.035, denominator, units.length);
  return [
    createLinearDimension({
      start: { x: minX, z: minZ },
      end: { x: maxX, z: minZ },
      offset: inset,
      markerSize,
      units
    }),
    createLinearDimension({
      start: { x: minX, z: minZ },
      end: { x: minX, z: maxZ },
      offset: -inset,
      markerSize,
      units
    })
  ].flatMap((dimension) => dimension ? [dimension] : []);
}

/** Derives restrained overall and exterior-coordinate chain dimensions. */
export function createExteriorLevelDimensions(
  level: Pick<Level, "walls">,
  units: Pick<Units, "length">,
  denominator: ArchitecturalScaleDenominator
): ExteriorLevelDimensions {
  const plan = measurePlan(level);
  if (!plan) return Object.freeze({ horizontalChain: [], verticalChain: [] });
  const overallOffset = documentDistanceToProjectUnits(0.2, denominator, units.length);
  const chainOffset = documentDistanceToProjectUnits(0.11, denominator, units.length);
  const layout = documentDistanceToProjectUnits(0.025, denominator, units.length);
  const create = (start: Point2D, end: Point2D, offset: number) => createLinearDimension({
    start,
    end,
    offset,
    extensionGap: layout,
    extensionOvershoot: layout,
    markerSize: layout * 1.8,
    units
  });
  const overallHorizontal = plan.width > 0
    ? create({ x: plan.minX, z: plan.minZ }, { x: plan.maxX, z: plan.minZ }, -overallOffset)
    : undefined;
  const overallVertical = plan.depth > 0
    ? create({ x: plan.minX, z: plan.minZ }, { x: plan.minX, z: plan.maxZ }, overallOffset)
    : undefined;
  const horizontalReferences = uniqueSorted(level.walls.flatMap((wall) =>
    [wall.start, wall.end]
      .filter((point) => point.z === plan.minZ || point.z === plan.maxZ)
      .map((point) => point.x)
  ));
  const verticalReferences = uniqueSorted(level.walls.flatMap((wall) =>
    [wall.start, wall.end]
      .filter((point) => point.x === plan.minX || point.x === plan.maxX)
      .map((point) => point.z)
  ));
  return Object.freeze({
    overallHorizontal,
    overallVertical,
    horizontalChain: Object.freeze(createChain(horizontalReferences, (value) => ({ x: value, z: plan.minZ }), -chainOffset, create)),
    verticalChain: Object.freeze(createChain(verticalReferences, (value) => ({ x: plan.minX, z: value }), chainOffset, create))
  });
}

function uniqueSorted(values: readonly number[]): readonly number[] {
  return [...new Set(values)].sort((first, second) => first - second);
}

function createChain(
  values: readonly number[],
  pointForValue: (value: number) => Point2D,
  offset: number,
  create: (start: Point2D, end: Point2D, offset: number) => LinearDimension | undefined
): LinearDimension[] {
  if (values.length <= 2) return [];
  return values.slice(0, -1).flatMap((value, index) => {
    const next = values[index + 1];
    if (next === undefined) return [];
    const dimension = create(pointForValue(value), pointForValue(next), offset);
    return dimension ? [dimension] : [];
  });
}
