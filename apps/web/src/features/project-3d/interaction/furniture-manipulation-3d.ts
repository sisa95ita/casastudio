import {
  convertPhysicalLength,
  resolveFurnitureRoom,
  type FurnitureItem,
  type MetricLengthUnit,
  type Project
} from "@casastudio/schema";

import { toThreeLength } from "../model/architectural-scene-3d-model";

/** Renderer-space point restricted to the stable horizontal manipulation plane. */
export type FurniturePlanPoint3D = Readonly<{ x: number; z: number }>;

/** Converts a Three X/Z intersection back to canonical Project X/Z coordinates. */
export function threePlanPointToProject(
  point: FurniturePlanPoint3D,
  targetUnit: MetricLengthUnit
): FurniturePlanPoint3D {
  const z = convertPhysicalLength(-point.z, "m", targetUnit);
  return Object.freeze({
    x: convertPhysicalLength(point.x, "m", targetUnit),
    z: z === 0 ? 0 : z
  });
}

/** Resolves the immutable Three-world drag plane from canonical Room ownership. */
export function furnitureDragPlaneY3D(
  project: Project,
  item: FurnitureItem
): number | undefined {
  const owner = resolveFurnitureRoom(project, item);
  return owner
    ? toThreeLength(owner.floorElevation, project.units.length)
    : undefined;
}

/** Preserves the original pointer-to-anchor delta throughout a planar drag. */
export function furniturePositionFromGrabOffset(
  original: FurniturePlanPoint3D,
  grabStart: FurniturePlanPoint3D,
  pointer: FurniturePlanPoint3D
): FurniturePlanPoint3D {
  return Object.freeze({
    x: original.x + pointer.x - grabStart.x,
    z: original.z + pointer.z - grabStart.z
  });
}

/** Derives canonical degree rotation around an item's center without normalization. */
export function furnitureRotationFromPointer(
  originalRotation: number,
  center: FurniturePlanPoint3D,
  start: FurniturePlanPoint3D,
  pointer: FurniturePlanPoint3D
): number {
  const initial = Math.atan2(start.z - center.z, start.x - center.x);
  const current = Math.atan2(pointer.z - center.z, pointer.x - center.x);
  const delta = Math.atan2(
    Math.sin(initial - current),
    Math.cos(initial - current)
  );
  return originalRotation + (delta * 180) / Math.PI;
}
