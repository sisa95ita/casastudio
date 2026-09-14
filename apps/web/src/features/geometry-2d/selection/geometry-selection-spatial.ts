import type { Point2D } from "@casastudio/schema";

import type { ScreenPoint } from "../viewport/viewport-transform-2d";
import type { GeometrySelection } from "./geometry-selection-state";

const EPSILON = 1e-7;

/** Durable plan footprint for one canonical selectable entity. */
export type GeometrySelectionFootprint = {
  readonly selection: GeometrySelection;
  readonly polygons: readonly (readonly Point2D[])[];
};

/** Directional CAD selection rectangle expressed in Project X/Z coordinates. */
export type GeometrySelectionBox = {
  readonly start: Point2D;
  readonly current: Point2D;
  readonly direction: "CONTAINMENT" | "CROSSING";
};

/** Session-local state for deterministic repeated-click hit cycling. */
export type GeometryHitCycleState = {
  readonly point: ScreenPoint;
  readonly candidateKeys: readonly string[];
  readonly index: number;
};

/** Creates direction-sensitive CAD selection-box geometry. */
export function createGeometrySelectionBox(
  start: Point2D,
  current: Point2D,
  leftToRight: boolean
): GeometrySelectionBox {
  return {
    start,
    current,
    direction: leftToRight ? "CONTAINMENT" : "CROSSING"
  };
}

/** Selects canonical footprints using containment or crossing semantics. */
export function selectGeometryFootprintsInBox(
  footprints: readonly GeometrySelectionFootprint[],
  box: GeometrySelectionBox
): readonly GeometrySelection[] {
  const bounds = normalizeBounds(box.start, box.current);
  return footprints
    .filter((footprint) =>
      box.direction === "CONTAINMENT"
        ? footprint.polygons.length > 0 &&
          footprint.polygons.every(
            (polygon) =>
              polygon.length > 0 &&
              polygon.every((point) => pointInBounds(point, bounds))
          )
        : footprint.polygons.some((polygon) =>
            polygonIntersectsBounds(polygon, bounds)
          )
    )
    .map((footprint) => footprint.selection);
}

/** Returns deterministic hit candidates at an exact Project-space point. */
export function getGeometryHitCandidates(
  footprints: readonly GeometrySelectionFootprint[],
  point: Point2D
): readonly GeometrySelection[] {
  return footprints
    .filter((footprint) =>
      footprint.polygons.some((polygon) => polygonContainsPoint(polygon, point))
    )
    .map((footprint) => footprint.selection);
}

/** Advances or resets an overlap cycle and returns the active candidate. */
export function cycleGeometryHitCandidate(
  previous: GeometryHitCycleState | undefined,
  point: ScreenPoint,
  candidates: readonly GeometrySelection[],
  tolerance = 4
): {
  readonly selection?: GeometrySelection;
  readonly state?: GeometryHitCycleState;
} {
  if (candidates.length === 0) return {};
  const candidateKeys = candidates.map(selectionKey);
  const stable =
    previous !== undefined &&
    Math.hypot(point.x - previous.point.x, point.y - previous.point.y) <=
      tolerance &&
    arraysEqual(previous.candidateKeys, candidateKeys);
  const index = stable ? (previous.index + 1) % candidates.length : 0;
  return {
    selection: candidates[index],
    state: { point, candidateKeys, index }
  };
}

/** Product precedence followed by stable identity for overlap cycling and boxes. */
export function sortGeometrySelectionFootprints(
  footprints: readonly GeometrySelectionFootprint[]
): readonly GeometrySelectionFootprint[] {
  return [...footprints].sort((first, second) => {
    const precedence =
      selectionPrecedence(first.selection) -
      selectionPrecedence(second.selection);
    return (
      precedence ||
      selectionKey(first.selection).localeCompare(
        selectionKey(second.selection)
      )
    );
  });
}

function selectionPrecedence(selection: GeometrySelection): number {
  switch (selection.kind) {
    case "DOOR":
    case "WINDOW":
    case "OPENING":
      return 0;
    case "FURNITURE":
      return 1;
    case "STAIRCASE":
    case "STAIR_FLIGHT":
    case "STAIR_LANDING":
      return 2;
    case "WALL":
    case "BOUNDARY_EDGE":
      return 3;
    case "POLYGON":
      return 4;
    case "VERTEX":
      return 5;
  }
}

const selectionKey = (selection: GeometrySelection): string =>
  `${selection.kind}:${selection.geometryId}`;

const arraysEqual = (
  first: readonly string[],
  second: readonly string[]
): boolean =>
  first.length === second.length &&
  first.every((value, index) => value === second[index]);

type Bounds = {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
};

const normalizeBounds = (first: Point2D, second: Point2D): Bounds => ({
  minX: Math.min(first.x, second.x),
  maxX: Math.max(first.x, second.x),
  minZ: Math.min(first.z, second.z),
  maxZ: Math.max(first.z, second.z)
});

const pointInBounds = (point: Point2D, bounds: Bounds): boolean =>
  point.x >= bounds.minX - EPSILON &&
  point.x <= bounds.maxX + EPSILON &&
  point.z >= bounds.minZ - EPSILON &&
  point.z <= bounds.maxZ + EPSILON;

function polygonIntersectsBounds(
  polygon: readonly Point2D[],
  bounds: Bounds
): boolean {
  if (polygon.length === 0) return false;
  if (polygon.some((point) => pointInBounds(point, bounds))) return true;
  const corners = [
    { x: bounds.minX, z: bounds.minZ },
    { x: bounds.maxX, z: bounds.minZ },
    { x: bounds.maxX, z: bounds.maxZ },
    { x: bounds.minX, z: bounds.maxZ }
  ];
  if (corners.some((corner) => polygonContainsPoint(polygon, corner)))
    return true;
  const rectangleEdges = corners.map(
    (start, index) => [start, corners[(index + 1) % corners.length]!] as const
  );
  return polygon.some((start, index) => {
    const end = polygon[(index + 1) % polygon.length]!;
    return rectangleEdges.some(([rectStart, rectEnd]) =>
      segmentsIntersect(start, end, rectStart, rectEnd)
    );
  });
}

function polygonContainsPoint(
  polygon: readonly Point2D[],
  point: Point2D
): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const a = polygon[previous]!;
    const b = polygon[index]!;
    if (pointOnSegment(point, a, b)) return true;
    if (
      a.z > point.z !== b.z > point.z &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  return inside;
}

function pointOnSegment(point: Point2D, start: Point2D, end: Point2D): boolean {
  const cross =
    (point.x - start.x) * (end.z - start.z) -
    (point.z - start.z) * (end.x - start.x);
  return (
    Math.abs(cross) <=
      EPSILON * Math.max(1, Math.hypot(end.x - start.x, end.z - start.z)) &&
    point.x >= Math.min(start.x, end.x) - EPSILON &&
    point.x <= Math.max(start.x, end.x) + EPSILON &&
    point.z >= Math.min(start.z, end.z) - EPSILON &&
    point.z <= Math.max(start.z, end.z) + EPSILON
  );
}

function segmentsIntersect(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D
): boolean {
  const orientation = (p: Point2D, q: Point2D, r: Point2D) =>
    (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (
    ((abC > EPSILON && abD < -EPSILON) || (abC < -EPSILON && abD > EPSILON)) &&
    ((cdA > EPSILON && cdB < -EPSILON) || (cdA < -EPSILON && cdB > EPSILON))
  )
    return true;
  return (
    (Math.abs(abC) <= EPSILON && pointOnSegment(c, a, b)) ||
    (Math.abs(abD) <= EPSILON && pointOnSegment(d, a, b)) ||
    (Math.abs(cdA) <= EPSILON && pointOnSegment(a, c, d)) ||
    (Math.abs(cdB) <= EPSILON && pointOnSegment(b, c, d))
  );
}
