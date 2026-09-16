import { resolveBuiltinFurnitureDefinition, resolveFurnitureRoom, type FurnitureItem, type Project } from "@casastudio/schema";
import { resolveFurnitureAsset, type FurnitureAssetDefinition } from "../assets/furniture-asset-registry";
import { createBoundsFromPoints, projectPointToThree, toThreeLength, type SceneBounds3D, type ScenePoint3D } from "./architectural-scene-3d-model";

/** Immutable Room-owned furnishing; all physical coordinates and dimensions are in meters. */
export type FurnitureModel3D = Readonly<{
  id: string;
  roomId: string;
  roomName: string;
  levelId: string;
  definitionId: string;
  name: string;
  category: string;
  position: ScenePoint3D;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  yaw: number;
  asset?: FurnitureAssetDefinition;
  bounds: SceneBounds3D;
}>;

/** Converts canonical right-handed degrees through the Project-Z reflection without quantization. */
export function furnitureYaw3D(rotation: number): number {
  return -(rotation / 180) * Math.PI;
}

/** Chooses a credible asset or exact-dimension fallback without clamping or changing Project data. */
export function canAdaptFurnitureAsset(item: FurnitureItem, asset: FurnitureAssetDefinition): boolean {
  const definition = resolveBuiltinFurnitureDefinition(item.definitionId);
  if (!definition) return false;
  const ratios = [item.width / definition.defaultWidth, item.depth / definition.defaultDepth, item.height / definition.defaultHeight];
  return Math.max(...ratios) / Math.min(...ratios) <= asset.deformation.maxAnisotropy;
}

/** Normalizes native bounds after orientation correction, then fits each physical axis exactly. */
export function furnitureAssetTransform(asset: FurnitureAssetDefinition, target: Pick<FurnitureModel3D, "width" | "depth" | "height">) {
  const c = Math.cos(asset.yaw), s = Math.sin(asset.yaw);
  const points: ScenePoint3D[] = [];
  for (const x of [asset.nativeMin[0], asset.nativeMax[0]])
    for (const y of [asset.nativeMin[1], asset.nativeMax[1]])
      for (const z of [asset.nativeMin[2], asset.nativeMax[2]])
        points.push({ x: x * c + z * s, y, z: -x * s + z * c });
  const bounds = createBoundsFromPoints(points)!;
  return Object.freeze({
    offset: Object.freeze([-bounds.center.x, -bounds.min.y, -bounds.center.z] as const),
    scale: Object.freeze([target.width / bounds.size.x, target.height / bounds.size.y, target.depth / bounds.size.z] as const),
    yaw: asset.yaw
  });
}

/** Derives semantic furnishings before rendering, including exact rotated envelopes and Room floor tops. */
export function createFurnitureModels3D(project: Project): readonly FurnitureModel3D[] {
  return Object.freeze(project.building.furniture.flatMap((item) => {
    const owner = resolveFurnitureRoom(project, item);
    if (!owner) return [];
    const definition = resolveBuiltinFurnitureDefinition(item.definitionId);
    const position = projectPointToThree(item.position, owner.floorElevation, project.units.length);
    const width = toThreeLength(item.width, project.units.length);
    const depth = toThreeLength(item.depth, project.units.length);
    const height = toThreeLength(item.height, project.units.length);
    const yaw = furnitureYaw3D(item.rotation);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const corners: ScenePoint3D[] = [];
    for (const x of [-width / 2, width / 2]) for (const z of [-depth / 2, depth / 2])
      for (const y of [0, height]) corners.push({ x: position.x + x * c + z * s, y: position.y + y, z: position.z - x * s + z * c });
    const resource = resolveFurnitureAsset(item.definitionId);
    return [Object.freeze({ id: item.id, roomId: item.roomId, roomName: owner.room.name ?? item.roomId,
      levelId: owner.level.id, definitionId: item.definitionId, name: item.name ?? definition?.name ?? "Unknown Furniture",
      category: definition?.category ?? "GENERIC", position, width, depth, height, rotation: item.rotation, yaw,
      asset: resource && canAdaptFurnitureAsset(item, resource) ? resource : undefined,
      bounds: createBoundsFromPoints(corners)!
    })];
  }));
}
