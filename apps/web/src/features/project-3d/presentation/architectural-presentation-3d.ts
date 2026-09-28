import type {
  SceneBounds3D,
  ScenePoint3D
} from "../model/architectural-scene-3d-model";

/** Surface roles shared by the renderer's restrained architectural palette. */
export type ArchitecturalMaterialRole3D =
  | "wall"
  | "floorTop"
  | "floorEdge"
  | "floorBottom"
  | "door"
  | "openingFrame"
  | "glazing"
  | "stairWalking"
  | "stairStructure"
  | "furnitureFallback"
  | "furnitureFallbackPlinth";

/** Renderer-neutral parameters for one reusable architectural surface. */
export type ArchitecturalMaterialProfile3D = Readonly<{
  color: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  transmission?: number;
  ior?: number;
}>;

/** Deliberately small scene-finish contract; none of these values are persisted. */
export type ArchitecturalPresentationProfile3D = Readonly<{
  materials: Readonly<Record<ArchitecturalMaterialRole3D, ArchitecturalMaterialProfile3D>>;
  interaction: Readonly<{
    hover: string;
    selected: string;
  }>;
  world: Readonly<{
    background: string;
    ground: string;
    gridMajor: string;
    gridMinor: string;
  }>;
  lighting: Readonly<{
    hemisphereSky: string;
    hemisphereGround: string;
    hemisphereIntensity: number;
    keyColor: string;
    keyIntensity: number;
    exposure: number;
  }>;
  shadows: Readonly<{
    mapSize: number;
    bias: number;
    normalBias: number;
    frustumPadding: number;
  }>;
}>;

const material = (
  value: ArchitecturalMaterialProfile3D
): ArchitecturalMaterialProfile3D => Object.freeze(value);

/** CasaStudio's immutable default architectural scene finish. */
export const architecturalPresentationProfile3D: ArchitecturalPresentationProfile3D =
  Object.freeze({
    materials: Object.freeze({
      wall: material({ color: "#d8cbbb", roughness: 0.82, metalness: 0 }),
      floorTop: material({ color: "#b9a98f", roughness: 0.88, metalness: 0 }),
      floorEdge: material({ color: "#8f877b", roughness: 0.94, metalness: 0 }),
      floorBottom: material({ color: "#8f877b", roughness: 0.94, metalness: 0 }),
      door: material({ color: "#766a5d", roughness: 0.8, metalness: 0 }),
      openingFrame: material({ color: "#555d5e", roughness: 0.72, metalness: 0.04 }),
      glazing: material({
        color: "#b8d7dc",
        roughness: 0.16,
        metalness: 0,
        opacity: 0.32,
        transmission: 0.12,
        ior: 1.45
      }),
      stairWalking: material({ color: "#b4a58e", roughness: 0.86, metalness: 0 }),
      stairStructure: material({ color: "#85898a", roughness: 0.92, metalness: 0 }),
      furnitureFallback: material({ color: "#9fa29c", roughness: 0.82, metalness: 0 }),
      furnitureFallbackPlinth: material({ color: "#626864", roughness: 0.9, metalness: 0 })
    }),
    interaction: Object.freeze({
      hover: "#d49a58",
      selected: "#246caf"
    }),
    world: Object.freeze({
      background: "#f4f0e9",
      ground: "#eee8de",
      gridMajor: "#c8beb0",
      gridMinor: "#ddd5ca"
    }),
    lighting: Object.freeze({
      hemisphereSky: "#fffaf0",
      hemisphereGround: "#aaa295",
      hemisphereIntensity: 1.05,
      keyColor: "#fff3df",
      keyIntensity: 2.15,
      exposure: 1.05
    }),
    shadows: Object.freeze({
      mapSize: 1024,
      bias: -0.00015,
      normalBias: 0.025,
      frustumPadding: 1.35
    })
  });

/** World-space directional-light and orthographic shadow-camera placement. */
export type ArchitecturalKeyLight3D = Readonly<{
  position: ScenePoint3D;
  target: ScenePoint3D;
  shadowExtent: number;
  shadowNear: number;
  shadowFar: number;
}>;

/** Scales the single shadow-casting key light to the complete visible scene. */
export function createArchitecturalKeyLight3D(
  bounds: SceneBounds3D | undefined,
  profile = architecturalPresentationProfile3D
): ArchitecturalKeyLight3D {
  const target = bounds?.center ?? { x: 0, y: 0, z: 0 };
  const span = Math.max(bounds?.size.x ?? 5, bounds?.size.y ?? 0, bounds?.size.z ?? 5, 2);
  const distance = span * 1.5;
  const position = Object.freeze({
    x: target.x + distance * 0.65,
    y: (bounds?.max.y ?? target.y) + distance,
    z: target.z + distance * 0.45
  });
  const lightDistance = Math.hypot(
    position.x - target.x,
    position.y - target.y,
    position.z - target.z
  );
  return Object.freeze({
    position,
    target: Object.freeze({ ...target }),
    shadowExtent: span * profile.shadows.frustumPadding,
    shadowNear: Math.max(0.1, span * 0.02),
    shadowFar: lightDistance + span * 2.5
  });
}
