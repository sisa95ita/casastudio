import type { DesignReferenceViewKind, DesignTarget } from "@casastudio/ai";

import {
  createBoundsFromPoints,
  type ArchitecturalScene3DModel,
  type Floor3D,
  type LevelReference3D,
  type SceneBounds3D,
  type ScenePoint3D,
  type ScenePlanVector3D
} from "../model/architectural-scene-3d-model";
import {
  createArchitecturalCameraClippingPlanes3D,
  createArchitecturalCameraPose3D,
  type ArchitecturalCameraPose3D
} from "./architectural-camera-3d";

export const automaticRoomReferenceKinds = Object.freeze([
  "room-axonometric",
  "room-interior-a",
  "room-interior-b"
] as const satisfies readonly DesignReferenceViewKind[]);

/** Pure reference-render recipe derived only from immutable architectural geometry. */
export type RoomReferencePlan3D = Readonly<{
  kind: (typeof automaticRoomReferenceKinds)[number];
  target: DesignTarget;
  pose: ArchitecturalCameraPose3D;
  verticalFovDegrees: number;
  bounds: SceneBounds3D;
  wallIds: readonly string[];
  staircaseIds: readonly string[];
  furnitureIds: readonly string[];
}>;

/**
 * Derives the three stable Room views without consulting a mounted camera.
 * Interior eyes are chosen from triangulation-backed points, so concave Room
 * contours never require a rectangular or axis-aligned assumption.
 */
export function createRoomReferencePlans3D(
  model: ArchitecturalScene3DModel,
  target: DesignTarget,
  aspect = 4 / 3
): readonly RoomReferencePlan3D[] {
  const level = model.levels.find(
    (candidate) => candidate.id === target.levelId
  );
  const floor = level?.floors.find(
    (candidate) => candidate.roomId === target.roomId
  );
  if (!level || !floor || floor.contour.length < 3) return Object.freeze([]);

  const wallIds = Object.freeze([
    ...new Set(floor.boundaryWallIds.filter((id): id is string => Boolean(id)))
  ]);
  const stairs = level.staircases.filter(
    (stair) =>
      stair.fromRoomId === target.roomId || stair.toRoomId === target.roomId
  );
  const furniture = level.furniture.filter(
    (item) => item.roomId === target.roomId
  );
  const relevantWalls = level.walls.filter((wall) => wallIds.includes(wall.id));
  const bounds = collectRoomReferenceBounds3D(
    floor,
    relevantWalls,
    stairs,
    furniture
  );
  const wallHeight = Math.max(2.4, ...relevantWalls.map((wall) => wall.height));
  const targetPoint = Object.freeze({
    x: bounds.center.x,
    y: floor.y + Math.min(wallHeight * 0.48, 1.35),
    z: bounds.center.z
  });
  const interiorEyes = deriveInteriorEyes(floor, targetPoint, wallHeight);
  const axonometricPose = createArchitecturalCameraPose3D(
    bounds,
    aspect,
    42,
    dominantContourDirection(floor.contour)
  );
  const common = { target, bounds, wallIds } as const;
  return Object.freeze([
    Object.freeze({
      ...common,
      kind: "room-axonometric" as const,
      pose: axonometricPose,
      verticalFovDegrees: 42,
      staircaseIds: Object.freeze(stairs.map((stair) => stair.id)),
      furnitureIds: Object.freeze(furniture.map((item) => item.id))
    }),
    createInteriorPlan(
      "room-interior-a",
      common,
      interiorEyes[0],
      targetPoint,
      stairs.map((stair) => stair.id),
      furniture.map((item) => item.id)
    ),
    createInteriorPlan(
      "room-interior-b",
      common,
      interiorEyes[1],
      targetPoint,
      stairs.map((stair) => stair.id),
      furniture.map((item) => item.id)
    )
  ]);
}

function createInteriorPlan(
  kind: "room-interior-a" | "room-interior-b",
  common: Pick<RoomReferencePlan3D, "target" | "bounds" | "wallIds">,
  position: ScenePoint3D,
  target: ScenePoint3D,
  staircaseIds: readonly string[],
  furnitureIds: readonly string[]
): RoomReferencePlan3D {
  const distance = Math.hypot(
    position.x - target.x,
    position.y - target.y,
    position.z - target.z
  );
  return Object.freeze({
    ...common,
    kind,
    pose: Object.freeze({
      position,
      target,
      ...createArchitecturalCameraClippingPlanes3D(common.bounds, distance)
    }),
    verticalFovDegrees: 58,
    staircaseIds: Object.freeze([...staircaseIds]),
    furnitureIds: Object.freeze([...furnitureIds])
  });
}

function deriveInteriorEyes(
  floor: Floor3D,
  target: ScenePoint3D,
  wallHeight: number
): readonly [ScenePoint3D, ScenePoint3D] {
  const candidates = floor.triangles.flatMap((triangle) => {
    const points = triangle.map((index) => floor.contour[index]!);
    const centroid = averagePlanPoints(points);
    return [
      centroid,
      ...points.map((vertex) => ({
        x: vertex.x * 0.55 + centroid.x * 0.45,
        z: vertex.z * 0.55 + centroid.z * 0.45
      }))
    ];
  });
  const unique = [
    ...new Map(
      candidates.map((point) => [
        `${point.x.toFixed(8)}:${point.z.toFixed(8)}`,
        point
      ])
    ).values()
  ];
  let first = unique[0] ?? floor.contour[0]!;
  let second = unique[1] ?? floor.contour[1] ?? first;
  let maximumDistance = -1;
  for (const left of unique) {
    for (const right of unique) {
      const distance = Math.hypot(left.x - right.x, left.z - right.z);
      if (distance > maximumDistance) {
        maximumDistance = distance;
        first = left;
        second = right;
      }
    }
  }
  const eyeY = floor.y + Math.max(1.2, Math.min(1.65, wallHeight * 0.58));
  const toEye = (point: ScenePlanVector3D): ScenePoint3D =>
    Object.freeze({
      x: point.x,
      y: eyeY,
      z: point.z
    });
  const eyes = [toEye(first), toEye(second)] as const;
  // Stable ordering is independent of polygon start vertex and edit history.
  return [...eyes].sort(
    (left, right) =>
      left.x - right.x ||
      left.z - right.z ||
      distance3D(left, target) - distance3D(right, target)
  ) as unknown as readonly [ScenePoint3D, ScenePoint3D];
}

function dominantContourDirection(
  contour: readonly ScenePlanVector3D[]
): ScenePoint3D {
  let longest = { x: 1, z: 1, length: 0 };
  contour.forEach((start, index) => {
    const end = contour[(index + 1) % contour.length]!;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length > longest.length) longest = { x: dx, z: dz, length };
  });
  const safeLength = longest.length || 1;
  return Object.freeze({
    x: longest.x / safeLength + 0.48,
    y: 1.18,
    z: longest.z / safeLength + 0.48
  });
}

function collectRoomReferenceBounds3D(
  floor: Floor3D,
  walls: LevelReference3D["walls"],
  stairs: LevelReference3D["staircases"],
  furniture: LevelReference3D["furniture"]
): SceneBounds3D {
  const points: ScenePoint3D[] = floor.contour.flatMap((point) => [
    { ...point, y: floor.bottomY },
    { ...point, y: floor.y }
  ]);
  walls.forEach((wall) => {
    wall.bodySections.forEach((section) => {
      section.contour.forEach((point) => {
        points.push(
          { ...point, y: wall.origin.y + section.bottom },
          { ...point, y: wall.origin.y + section.top }
        );
      });
    });
  });
  stairs.forEach((stair) => {
    if (stair.bounds) points.push(stair.bounds.min, stair.bounds.max);
  });
  furniture.forEach((item) => points.push(item.bounds.min, item.bounds.max));
  return createBoundsFromPoints(points)!;
}

function averagePlanPoints(
  points: readonly ScenePlanVector3D[]
): ScenePlanVector3D {
  return Object.freeze({
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length
  });
}

function distance3D(left: ScenePoint3D, right: ScenePoint3D): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}
