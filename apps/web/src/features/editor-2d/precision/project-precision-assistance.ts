import {
  isFreeRoomBoundaryEdge,
  resolveFurnitureRoom,
  type FurnitureItem,
  type Level,
  type Point2D,
  type Project
} from "@casastudio/schema";

import {
  createFurnitureFootprint2D,
  createWallFootprints2D
} from "../../geometry-2d/presentation/plan-footprints-2d";
import {
  createAxisPrecisionCandidate,
  resolvePrecisionTranslation,
  type PrecisionGuide2D,
  type PrecisionTranslationCandidate,
  type PrecisionTranslationResult
} from "../../geometry-2d/precision/precision-assistance-2d";

type Bounds = {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
  readonly centerX: number;
  readonly centerZ: number;
};

/** Resolves smart Furniture placement or rigid movement against same-plane plan geometry. */
export function resolveFurniturePrecisionTranslation(input: {
  readonly project: Project;
  readonly levelId: string;
  readonly moving: readonly FurnitureItem[];
  readonly rawDelta: Point2D;
  readonly pixelsPerWorldUnit: number;
  readonly grid: { readonly enabled: boolean; readonly spacing: number };
  readonly bypass?: boolean;
  readonly previous?: PrecisionTranslationResult;
  readonly isValid?: (delta: Point2D) => boolean;
}): PrecisionTranslationResult {
  const level = input.project.building.levels.find(
    (candidate) => candidate.id === input.levelId
  );
  if (!level || input.moving.length === 0 || input.bypass)
    return resolvePrecisionTranslation(input.rawDelta, [], {
      bypass: input.bypass
    });
  const movingIds = new Set(input.moving.map((item) => item.id));
  const movedPolygons = input.moving.map((item) =>
    translatePolygon(createFurnitureFootprint2D(item), input.rawDelta)
  );
  const aggregate = boundsOf(movedPolygons.flat());
  const faceReferencePolygons =
    movedPolygons.length === 1
      ? movedPolygons
      : [
          [
            { x: aggregate.minX, z: aggregate.minZ },
            { x: aggregate.maxX, z: aggregate.minZ },
            { x: aggregate.maxX, z: aggregate.maxZ },
            { x: aggregate.minX, z: aggregate.maxZ }
          ]
        ];
  const elevations = new Set(
    input.moving.flatMap((item) => {
      const room = resolveFurnitureRoom(input.project, item);
      return room ? [room.floorElevation] : [];
    })
  );
  const onePlane = elevations.size === 1;
  const floorElevation = onePlane ? [...elevations][0] : undefined;
  const candidates: PrecisionTranslationCandidate[] = [];

  if (onePlane) {
    candidates.push(
      ...createFaceCandidates(
        faceReferencePolygons,
        createWallFootprints2D(level),
        input.pixelsPerWorldUnit,
        "wall-face",
        "wall-face"
      )
    );
    const otherFurniture = input.project.building.furniture
      .filter((item) => {
        if (movingIds.has(item.id)) return false;
        return (
          resolveFurnitureRoom(input.project, item)?.floorElevation ===
          floorElevation
        );
      })
      .sort((first, second) => first.id.localeCompare(second.id));
    for (const other of otherFurniture) {
      candidates.push(
        ...createBoundsAlignmentCandidates(
          aggregate,
          boundsOf(createFurnitureFootprint2D(other)),
          `furniture:${other.id}`,
          input.pixelsPerWorldUnit
        )
      );
    }
    const roomIds = [
      ...new Set(input.moving.map((item) => item.roomId))
    ].sort();
    for (const roomId of roomIds) {
      const room = level.rooms.find((candidate) => candidate.id === roomId);
      const roomPoints = room ? roomBoundaryPoints(level, room.boundary) : [];
      if (roomPoints.length < 3) continue;
      const roomBounds = boundsOf(roomPoints);
      candidates.push(
        ...createFaceCandidates(
          faceReferencePolygons,
          [roomPoints],
          input.pixelsPerWorldUnit,
          "room-boundary",
          `room:${roomId}`
        ),
        axisCandidate(
          `room:${roomId}:center-x`,
          "object-center",
          "x",
          roomBounds.centerX - aggregate.centerX,
          input.pixelsPerWorldUnit,
          verticalGuide(roomBounds.centerX, roomBounds.minZ, roomBounds.maxZ)
        ),
        axisCandidate(
          `room:${roomId}:center-z`,
          "object-center",
          "z",
          roomBounds.centerZ - aggregate.centerZ,
          input.pixelsPerWorldUnit,
          horizontalGuide(roomBounds.centerZ, roomBounds.minX, roomBounds.maxX)
        )
      );
    }
  }

  if (input.grid.enabled && input.grid.spacing > 0) {
    const gridX =
      Math.round(aggregate.centerX / input.grid.spacing) * input.grid.spacing;
    const gridZ =
      Math.round(aggregate.centerZ / input.grid.spacing) * input.grid.spacing;
    candidates.push(
      axisCandidate(
        `grid:x:${gridX}`,
        "grid",
        "x",
        gridX - aggregate.centerX,
        input.pixelsPerWorldUnit
      ),
      axisCandidate(
        `grid:z:${gridZ}`,
        "grid",
        "z",
        gridZ - aggregate.centerZ,
        input.pixelsPerWorldUnit
      )
    );
  }
  return resolvePrecisionTranslation(input.rawDelta, candidates, {
    previous: input.previous,
    isValid: input.isValid
  });
}

/** Resolves rigid aggregate bounds against architectural points and the optional grid. */
export function resolveAggregatePrecisionTranslation(input: {
  readonly points: readonly Point2D[];
  readonly targetPoints: readonly {
    readonly id: string;
    readonly point: Point2D;
  }[];
  readonly rawDelta: Point2D;
  readonly pixelsPerWorldUnit: number;
  readonly grid: { readonly enabled: boolean; readonly spacing: number };
  readonly bypass?: boolean;
  readonly previous?: PrecisionTranslationResult;
  readonly isValid?: (delta: Point2D) => boolean;
}): PrecisionTranslationResult {
  if (input.points.length === 0)
    return resolvePrecisionTranslation(input.rawDelta, [], {
      bypass: input.bypass
    });
  const moved = input.points.map((point) => add(point, input.rawDelta));
  const bounds = boundsOf(moved);
  const candidates: PrecisionTranslationCandidate[] = [];
  for (const target of [...input.targetPoints].sort((a, b) =>
    a.id.localeCompare(b.id)
  )) {
    for (const [name, value] of [
      ["min", bounds.minX],
      ["center", bounds.centerX],
      ["max", bounds.maxX]
    ] as const) {
      candidates.push(
        axisCandidate(
          `${target.id}:x:${name}`,
          "vertex",
          "x",
          target.point.x - value,
          input.pixelsPerWorldUnit,
          verticalGuide(target.point.x, bounds.minZ, bounds.maxZ)
        )
      );
    }
    for (const [name, value] of [
      ["min", bounds.minZ],
      ["center", bounds.centerZ],
      ["max", bounds.maxZ]
    ] as const) {
      candidates.push(
        axisCandidate(
          `${target.id}:z:${name}`,
          "vertex",
          "z",
          target.point.z - value,
          input.pixelsPerWorldUnit,
          horizontalGuide(target.point.z, bounds.minX, bounds.maxX)
        )
      );
    }
  }
  if (input.grid.enabled && input.grid.spacing > 0) {
    const gridX =
      Math.round(bounds.centerX / input.grid.spacing) * input.grid.spacing;
    const gridZ =
      Math.round(bounds.centerZ / input.grid.spacing) * input.grid.spacing;
    candidates.push(
      axisCandidate(
        "aggregate:grid:x",
        "grid",
        "x",
        gridX - bounds.centerX,
        input.pixelsPerWorldUnit
      ),
      axisCandidate(
        "aggregate:grid:z",
        "grid",
        "z",
        gridZ - bounds.centerZ,
        input.pixelsPerWorldUnit
      )
    );
  }
  return resolvePrecisionTranslation(input.rawDelta, candidates, {
    bypass: input.bypass,
    previous: input.previous,
    isValid: input.isValid
  });
}

function createBoundsAlignmentCandidates(
  moving: Bounds,
  target: Bounds,
  id: string,
  pixelsPerWorldUnit: number
): PrecisionTranslationCandidate[] {
  return [
    axisCandidate(
      `${id}:left`,
      "object-edge",
      "x",
      target.minX - moving.minX,
      pixelsPerWorldUnit,
      verticalGuide(
        target.minX,
        Math.min(moving.minZ, target.minZ),
        Math.max(moving.maxZ, target.maxZ)
      )
    ),
    axisCandidate(
      `${id}:right`,
      "object-edge",
      "x",
      target.maxX - moving.maxX,
      pixelsPerWorldUnit,
      verticalGuide(
        target.maxX,
        Math.min(moving.minZ, target.minZ),
        Math.max(moving.maxZ, target.maxZ)
      )
    ),
    axisCandidate(
      `${id}:touch-left`,
      "object-edge",
      "x",
      target.maxX - moving.minX,
      pixelsPerWorldUnit,
      verticalGuide(
        target.maxX,
        Math.min(moving.minZ, target.minZ),
        Math.max(moving.maxZ, target.maxZ)
      )
    ),
    axisCandidate(
      `${id}:touch-right`,
      "object-edge",
      "x",
      target.minX - moving.maxX,
      pixelsPerWorldUnit,
      verticalGuide(
        target.minX,
        Math.min(moving.minZ, target.minZ),
        Math.max(moving.maxZ, target.maxZ)
      )
    ),
    axisCandidate(
      `${id}:center-x`,
      "object-center",
      "x",
      target.centerX - moving.centerX,
      pixelsPerWorldUnit,
      verticalGuide(
        target.centerX,
        Math.min(moving.minZ, target.minZ),
        Math.max(moving.maxZ, target.maxZ)
      )
    ),
    axisCandidate(
      `${id}:top`,
      "object-edge",
      "z",
      target.minZ - moving.minZ,
      pixelsPerWorldUnit,
      horizontalGuide(
        target.minZ,
        Math.min(moving.minX, target.minX),
        Math.max(moving.maxX, target.maxX)
      )
    ),
    axisCandidate(
      `${id}:bottom`,
      "object-edge",
      "z",
      target.maxZ - moving.maxZ,
      pixelsPerWorldUnit,
      horizontalGuide(
        target.maxZ,
        Math.min(moving.minX, target.minX),
        Math.max(moving.maxX, target.maxX)
      )
    ),
    axisCandidate(
      `${id}:touch-top`,
      "object-edge",
      "z",
      target.maxZ - moving.minZ,
      pixelsPerWorldUnit,
      horizontalGuide(
        target.maxZ,
        Math.min(moving.minX, target.minX),
        Math.max(moving.maxX, target.maxX)
      )
    ),
    axisCandidate(
      `${id}:touch-bottom`,
      "object-edge",
      "z",
      target.minZ - moving.maxZ,
      pixelsPerWorldUnit,
      horizontalGuide(
        target.minZ,
        Math.min(moving.minX, target.minX),
        Math.max(moving.maxX, target.maxX)
      )
    ),
    axisCandidate(
      `${id}:center-z`,
      "object-center",
      "z",
      target.centerZ - moving.centerZ,
      pixelsPerWorldUnit,
      horizontalGuide(
        target.centerZ,
        Math.min(moving.minX, target.minX),
        Math.max(moving.maxX, target.maxX)
      )
    )
  ];
}

function createFaceCandidates(
  movingPolygons: readonly (readonly Point2D[])[],
  targetPolygons: readonly (readonly Point2D[])[],
  pixelsPerWorldUnit: number,
  relation: "wall-face" | "room-boundary",
  idPrefix: string
): PrecisionTranslationCandidate[] {
  const candidates: PrecisionTranslationCandidate[] = [];
  movingPolygons.forEach((moving, movingIndex) => {
    edges(moving).forEach((movingEdge, movingEdgeIndex) => {
      const movingDirection = unit(subtract(movingEdge.end, movingEdge.start));
      if (!movingDirection) return;
      targetPolygons.forEach((target, targetIndex) => {
        edges(target).forEach((targetEdge, targetEdgeIndex) => {
          const targetDirection = unit(
            subtract(targetEdge.end, targetEdge.start)
          );
          if (
            !targetDirection ||
            Math.abs(dot(movingDirection, targetDirection)) < 0.9999
          )
            return;
          const normal = { x: -targetDirection.z, z: targetDirection.x };
          const signedDistance = dot(
            subtract(targetEdge.start, movingEdge.start),
            normal
          );
          const correction = {
            x: normal.x * signedDistance,
            z: normal.z * signedDistance
          };
          const shiftedStart = add(movingEdge.start, correction);
          const shiftedEnd = add(movingEdge.end, correction);
          if (
            !segmentsOverlapOnAxis(
              shiftedStart,
              shiftedEnd,
              targetEdge.start,
              targetEdge.end,
              targetDirection
            )
          )
            return;
          const movingMid = midpoint(shiftedStart, shiftedEnd);
          const halfGuideLength = Math.min(
            15,
            Math.hypot(
              shiftedEnd.x - shiftedStart.x,
              shiftedEnd.z - shiftedStart.z
            ) / 2
          );
          candidates.push({
            id: `${idPrefix}:${targetIndex}:${targetEdgeIndex}:${movingIndex}:${movingEdgeIndex}`,
            relation,
            axis: "both",
            correction,
            distancePixels:
              Math.hypot(correction.x, correction.z) * pixelsPerWorldUnit,
            guides: [
              {
                kind: "segment",
                start: {
                  x: movingMid.x - movingDirection.x * halfGuideLength,
                  z: movingMid.z - movingDirection.z * halfGuideLength
                },
                end: {
                  x: movingMid.x + movingDirection.x * halfGuideLength,
                  z: movingMid.z + movingDirection.z * halfGuideLength
                }
              }
            ]
          });
        });
      });
    });
  });
  return candidates;
}

function roomBoundaryPoints(
  level: Level,
  boundary: Level["rooms"][number]["boundary"]
): Point2D[] {
  return boundary.flatMap((edge) => {
    if (isFreeRoomBoundaryEdge(edge)) return [edge.start];
    const wall = level.walls.find((candidate) => candidate.id === edge.wallId);
    if (!wall) return [];
    return [edge.direction === "FORWARD" ? wall.start : wall.end];
  });
}

const axisCandidate = (
  id: string,
  relation: PrecisionTranslationCandidate["relation"],
  axis: "x" | "z",
  correction: number,
  pixelsPerWorldUnit: number,
  guide?: PrecisionGuide2D
) =>
  createAxisPrecisionCandidate({
    id,
    relation,
    axis,
    correction,
    pixelsPerWorldUnit,
    guides: guide ? [guide] : []
  });

const verticalGuide = (
  x: number,
  minZ: number,
  maxZ: number
): PrecisionGuide2D => ({
  kind: "line",
  start: { x, z: minZ - 20 },
  end: { x, z: maxZ + 20 }
});
const horizontalGuide = (
  z: number,
  minX: number,
  maxX: number
): PrecisionGuide2D => ({
  kind: "line",
  start: { x: minX - 20, z },
  end: { x: maxX + 20, z }
});

function boundsOf(points: readonly Point2D[]): Bounds {
  const minX = Math.min(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxZ = Math.max(...points.map((point) => point.z));
  return {
    minX,
    minZ,
    maxX,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2
  };
}

const translatePolygon = (polygon: readonly Point2D[], delta: Point2D) =>
  polygon.map((point) => add(point, delta));
const edges = (polygon: readonly Point2D[]) =>
  polygon.map((start, index) => ({
    start,
    end: polygon[(index + 1) % polygon.length]!
  }));
const add = (a: Point2D, b: Point2D): Point2D => ({
  x: a.x + b.x,
  z: a.z + b.z
});
const subtract = (a: Point2D, b: Point2D): Point2D => ({
  x: a.x - b.x,
  z: a.z - b.z
});
const dot = (a: Point2D, b: Point2D) => a.x * b.x + a.z * b.z;
const unit = (value: Point2D): Point2D | undefined => {
  const length = Math.hypot(value.x, value.z);
  return length > 1e-9
    ? { x: value.x / length, z: value.z / length }
    : undefined;
};
const midpoint = (a: Point2D, b: Point2D): Point2D => ({
  x: (a.x + b.x) / 2,
  z: (a.z + b.z) / 2
});
const segmentsOverlapOnAxis = (
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D,
  axis: Point2D
) => {
  const first = [dot(a, axis), dot(b, axis)].sort((x, y) => x - y);
  const second = [dot(c, axis), dot(d, axis)].sort((x, y) => x - y);
  return Math.min(first[1]!, second[1]!) >= Math.max(first[0]!, second[0]!);
};
