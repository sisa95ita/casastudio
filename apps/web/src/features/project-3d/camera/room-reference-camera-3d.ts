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
  createArchitecturalCameraPose3D,
  type ArchitecturalCameraPose3D
} from "./architectural-camera-3d";
import { planRoomInteriors3D } from "./room-interior-planner-3d";
import type { InteriorCandidate3D } from "./room-interior-visibility-3d";
import { deriveRoomReferenceWallIds3D } from "../presentation/room-reference-relevance-3d";

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
  model: Pick<ArchitecturalScene3DModel, "sourceProjectId" | "levels">,
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

  const wallIds = deriveRoomReferenceWallIds3D(floor, level.walls);
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
  const wallHeight = relevantWalls.length
    ? Math.max(...relevantWalls.map((wall) => wall.height))
    : 2.4;
  const interiors = planRoomInteriors3D(
    floor,
    relevantWalls,
    furniture,
    stairs,
    bounds,
    aspect,
    wallHeight
  );
  // No safe candidate was found within the bounded photography policy.
  // Fail reference preparation rather than fabricate an eye inside canonical solids.
  if (!interiors) return Object.freeze([]);
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
      interiors.first.candidate,
      stairs.map((stair) => stair.id),
      furniture.map((item) => item.id)
    ),
    createInteriorPlan(
      "room-interior-b",
      common,
      interiors.second.candidate,
      stairs.map((stair) => stair.id),
      furniture.map((item) => item.id)
    )
  ]);
}

function createInteriorPlan(
  kind: "room-interior-a" | "room-interior-b",
  common: Pick<RoomReferencePlan3D, "target" | "bounds" | "wallIds">,
  candidate: InteriorCandidate3D,
  staircaseIds: readonly string[],
  furnitureIds: readonly string[]
): RoomReferencePlan3D {
  return Object.freeze({
    ...common,
    kind,
    pose: Object.freeze({
      ...candidate.pose,
      position: Object.freeze(candidate.pose.position),
      target: Object.freeze(candidate.pose.target)
    }),
    verticalFovDegrees: candidate.verticalFovDegrees,
    staircaseIds: Object.freeze([...staircaseIds]),
    furnitureIds: Object.freeze([...furnitureIds])
  });
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
