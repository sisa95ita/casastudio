import {
  createBoundsFromPoints,
  createWall3D,
  triangulateFloorContour3D,
  type Floor3D,
  type ScenePlanVector3D
} from "../model/architectural-scene-3d-model";
import type { FurnitureModel3D } from "../model/furniture-3d-model";
import { furnitureLocalPoint3D } from "./room-interior-geometry-3d";
import type { InteriorCandidate3D } from "./room-interior-visibility-3d";

export function syntheticInteriorFloor3D(
  coordinates: readonly (readonly [number, number])[] = [
    [0, 0],
    [7, 0],
    [7, 5],
    [0, 5]
  ]
): Floor3D {
  const contour = coordinates.map(([x, z]) => ({ x, z }));
  return {
    id: "floor",
    roomId: "room",
    y: 0,
    bottomY: -0.18,
    thickness: 0.18,
    area: 35,
    contour,
    boundaryKinds: contour.map(() => "WALL"),
    boundaryWallIds: contour.map((_, i) => `edge-${i}`),
    triangles: triangulateFloorContour3D(contour)
  };
}

export function syntheticInteriorItem3D(
  id: string,
  x: number,
  z: number,
  width = 1,
  depth = 1,
  height = 0.8,
  yaw = 0
): FurnitureModel3D {
  const base = {
    id,
    roomId: "room",
    levelId: "level",
    roomName: "Room",
    definitionId: "generic",
    name: "Object",
    category: "GENERIC",
    position: { x, y: 0, z },
    width,
    depth,
    height,
    yaw,
    rotation: (-yaw * 180) / Math.PI
  };
  const corners = [-0.5, 0.5].flatMap((x) =>
    [-0.5, 0.5].flatMap((z) =>
      [0, 1].map((y) =>
        furnitureLocalPoint3D(
          base as FurnitureModel3D,
          x * width,
          y * height,
          z * depth
        )
      )
    )
  );
  return { ...base, bounds: createBoundsFromPoints(corners)! };
}

export function syntheticInteriorWall3D(
  id: string,
  a: ScenePlanVector3D,
  b: ScenePlanVector3D,
  open = false
) {
  return createWall3D(
    {
      id,
      start: { x: a.x, z: -a.z },
      end: { x: b.x, z: -b.z },
      height: 2.8,
      thickness: 0.16,
      roomIds: ["room"],
      openings: open
        ? [
            {
              id: `opening-${id}`,
              type: "OPENING",
              offsetFromStart: 0.5,
              width: 1,
              height: 2.4,
              elevation: 0
            }
          ]
        : []
    },
    0,
    "m"
  );
}

export function syntheticInteriorWalls3D(floor: Floor3D) {
  return floor.contour.map((a, i) =>
    syntheticInteriorWall3D(
      `edge-${i}`,
      a,
      floor.contour[(i + 1) % floor.contour.length]!
    )
  );
}

export function syntheticInteriorCandidate3D(
  x: number,
  z: number,
  targetX: number,
  targetZ: number,
  fov = 54,
  y = 1.7,
  targetY = 1.1
): InteriorCandidate3D {
  return {
    pose: {
      position: { x, y, z },
      target: { x: targetX, y: targetY, z: targetZ },
      near: 0.01,
      far: 100
    },
    verticalFovDegrees: fov
  };
}

export function syntheticInteriorBounds3D(floor: Floor3D) {
  return createBoundsFromPoints(
    floor.contour.flatMap((p) => [0, 2.8].map((y) => ({ ...p, y })))
  )!;
}
