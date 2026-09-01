import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import type { SceneBounds3D } from "../model/architectural-scene-3d-model";
import { createArchitecturalCameraPose3D } from "./architectural-camera-3d";

type CameraControllerProps = {
  readonly bounds?: SceneBounds3D;
  readonly controlsRef: React.RefObject<React.ElementRef<typeof OrbitControls> | null>;
  readonly fitRequest: number;
  readonly resetRequest: number;
  readonly onCameraChange: () => void;
};

/** Applies deterministic fit/reset requests without placing camera objects in app state. */
export function CameraController({
  bounds,
  controlsRef,
  fitRequest,
  resetRequest,
  onCameraChange
}: CameraControllerProps) {
  const { camera, size, invalidate } = useThree();
  const framingStateRef = useRef({ fitRequest, resetRequest, hasFramed: false });

  useEffect(() => {
    const controls = controlsRef.current;
    const previous = framingStateRef.current;
    const fitChanged = fitRequest !== previous.fitRequest;
    const resetChanged = resetRequest !== previous.resetRequest;
    const preserveCurrentDirection = previous.hasFramed && fitChanged && !resetChanged;
    const dampingEnabled = controls?.enableDamping;
    if (controls) {
      controls.enableDamping = false;
      controls.update();
    }
    const viewingDirection = preserveCurrentDirection && controls
      ? {
          x: camera.position.x - controls.target.x,
          y: camera.position.y - controls.target.y,
          z: camera.position.z - controls.target.z
        }
      : undefined;
    const pose = createArchitecturalCameraPose3D(
      bounds,
      size.width / size.height,
      45,
      viewingDirection
    );
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.near = pose.near;
    camera.far = pose.far;
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    camera.updateProjectionMatrix();
    controls?.target.set(pose.target.x, pose.target.y, pose.target.z);
    controls?.update();
    if (controls && dampingEnabled !== undefined) {
      controls.enableDamping = dampingEnabled;
    }
    framingStateRef.current = { fitRequest, resetRequest, hasFramed: true };
    onCameraChange();
    invalidate();
  }, [
    bounds,
    camera,
    controlsRef,
    fitRequest,
    invalidate,
    onCameraChange,
    resetRequest,
    size.height,
    size.width
  ]);

  return null;
}
