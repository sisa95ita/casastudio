import { Edges, RoundedBox, useGLTF } from "@react-three/drei";
import { Component, Suspense, useLayoutEffect, useMemo, type ReactNode } from "react";
import { MeshStandardMaterial, type Mesh, type Object3D } from "three";
import { furnitureAssetTransform, type FurnitureModel3D } from "./model/furniture-3d-model";
import type { FurnitureAssetDefinition } from "./assets/furniture-asset-registry";
import type { ArchitecturalEntityPresentationState3D } from "./interaction/architectural-viewer-interaction-3d";
import { architecturalPresentationProfile3D } from "./presentation/architectural-presentation-3d";

const furnitureFallbackMaterial3D = new MeshStandardMaterial(
  architecturalPresentationProfile3D.materials.furnitureFallback
);
const furnitureFallbackPlinthMaterial3D = new MeshStandardMaterial(
  architecturalPresentationProfile3D.materials.furnitureFallbackPlinth
);

/** Isolates a failed resource to its own furnishing, leaving its semantic parent selectable. */
export class FurnitureAssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Loads only visible, adaptable resources, keeping exact bounds during loading and failure. */
export function FurnitureAsset3D({ model, state }: { model: FurnitureModel3D; state: ArchitecturalEntityPresentationState3D }) {
  const fallback = <FurnitureFallback3D model={model} />;
  return <group position={[model.position.x, model.position.y, model.position.z]} rotation={[0, model.yaw, 0]}>
    {model.asset ? <FurnitureAssetBoundary key={model.asset.resource} fallback={fallback}>
      <Suspense fallback={fallback}><LoadedFurnitureAsset model={model} asset={model.asset} /></Suspense>
    </FurnitureAssetBoundary> : fallback}
    {state !== "idle" && <mesh position={[0, model.height / 2, 0]} raycast={() => undefined}>
      <boxGeometry args={[model.width, model.height, model.depth]} />
      <meshBasicMaterial visible={false} />
      <Edges color={state === "selected"
        ? architecturalPresentationProfile3D.interaction.selected
        : architecturalPresentationProfile3D.interaction.hover} raycast={() => undefined} />
    </mesh>}
  </group>;
}

/** Shares cached geometry/materials while giving every static instance its own Object3D hierarchy. */
function LoadedFurnitureAsset({ model, asset }: { model: FurnitureModel3D; asset: FurnitureAssetDefinition }) {
  // Explicitly disable Drei's optional remote Draco decoder and unused Meshopt support.
  const { scene } = useGLTF(asset.resource, false, false);
  const instance = useMemo(() => scene.clone(true), [scene]);
  const transform = useMemo(() => furnitureAssetTransform(asset, model), [asset, model]);
  useLayoutEffect(() => prepareFurnitureInstance3D(instance), [instance]);
  // Cache owns geometry, materials and embedded textures. Unmount must not dispose shared resources.
  return <group scale={[...transform.scale]} dispose={null}>
    <group position={[...transform.offset]}><group rotation={[0, transform.yaw, 0]}>
      <primitive object={instance} dispose={null} />
    </group></group>
  </group>;
}

/** Enables normal architectural shadow participation without touching shared GLB resources. */
export function prepareFurnitureInstance3D(instance: Object3D): () => void {
  const meshes: Array<Readonly<{
    mesh: Mesh;
    castShadow: boolean;
    receiveShadow: boolean;
  }>> = [];
  instance.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    meshes.push({
      mesh,
      castShadow: mesh.castShadow,
      receiveShadow: mesh.receiveShadow
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return () => {
    for (const original of meshes) {
      original.mesh.castShadow = original.castShadow;
      original.mesh.receiveShadow = original.receiveShadow;
    }
  };
}

/** Neutral chamfered volume and recessed plinth occupying the exact canonical physical envelope. */
function FurnitureFallback3D({ model }: { model: FurnitureModel3D }) {
  const plinth = Math.min(model.height * 0.06, 0.04);
  const radius = Math.min(model.width, model.depth, model.height) * 0.025;
  return <group name="furniture-fallback">
    <RoundedBox args={[model.width, model.height - plinth, model.depth]} radius={radius} smoothness={2}
      position={[0, (model.height + plinth) / 2, 0]} material={furnitureFallbackMaterial3D}
      castShadow receiveShadow dispose={null} />
    <mesh position={[0, plinth / 2, 0]} material={furnitureFallbackPlinthMaterial3D}
      castShadow receiveShadow dispose={null}>
      <boxGeometry args={[model.width * 0.9, plinth, model.depth * 0.9]} />
    </mesh>
  </group>;
}
