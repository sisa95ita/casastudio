import type { SceneBounds3D, ScenePoint3D } from "../model/architectural-scene-3d-model";

/** Deterministic perspective-camera placement for an architectural scene. */
export type ArchitecturalCameraPose3D = Readonly<{
  position: ScenePoint3D;
  target: ScenePoint3D;
  near: number;
  far: number;
}>;

/** Normalized viewport position whose X grows rightward and Y grows downward. */
export type ArchitecturalScreenPoint3D = Readonly<{
  x: number;
  y: number;
  depth: number;
}>;

/** Semantic plan landmarks used to verify parity with the 2D viewport. */
export type ArchitecturalScreenParityLandmarks3D = Readonly<{
  left: ScenePoint3D;
  right: ScenePoint3D;
  top: ScenePoint3D;
  bottom: ScenePoint3D;
}>;

/** Default framing used when a Project contains no reference geometry. */
export const emptyArchitecturalSceneBounds3D: SceneBounds3D = Object.freeze({
  min: Object.freeze({ x: -2.5, y: 0, z: -2.5 }),
  max: Object.freeze({ x: 2.5, y: 0, z: 2.5 }),
  center: Object.freeze({ x: 0, y: 0, z: 0 }),
  size: Object.freeze({ x: 5, y: 0, z: 5 })
});

/** Yaw-free elevated direction used by initial and reset framing. */
export const architecturalPlanAlignedDirection3D: ScenePoint3D = Object.freeze({
  x: 0,
  y: 0.6,
  z: 0.8
});

/** Calculates a restrained oblique camera pose from physical scene bounds. */
export function createArchitecturalCameraPose3D(
  bounds: SceneBounds3D | undefined,
  aspect: number,
  verticalFieldOfViewDegrees = 45,
  viewingDirection: ScenePoint3D = architecturalPlanAlignedDirection3D
): ArchitecturalCameraPose3D {
  const framingBounds = bounds ?? emptyArchitecturalSceneBounds3D;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const verticalFov = verticalFieldOfViewDegrees * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * safeAspect);
  const sceneRadius = Math.max(
    Math.hypot(
      framingBounds.size.x,
      framingBounds.size.y,
      framingBounds.size.z
    ) / 2,
    1
  );
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const distance = Math.max(
    3,
    sceneRadius / Math.sin(limitingFov / 2) * 1.2
  );
  const directionLength = Math.hypot(
    viewingDirection.x,
    viewingDirection.y,
    viewingDirection.z
  );
  const safeDirection = directionLength > 0 && Number.isFinite(directionLength)
    ? viewingDirection
    : architecturalPlanAlignedDirection3D;
  const safeDirectionLength = safeDirection === viewingDirection
    ? directionLength
    : Math.hypot(
        safeDirection.x,
        safeDirection.y,
        safeDirection.z
      );
  const direction = {
    x: safeDirection.x / safeDirectionLength,
    y: safeDirection.y / safeDirectionLength,
    z: safeDirection.z / safeDirectionLength
  };
  const target = Object.freeze({ ...framingBounds.center });
  return Object.freeze({
    position: Object.freeze({
      x: target.x + direction.x * distance,
      y: target.y + direction.y * distance,
      z: target.z + direction.z * distance
    }),
    target,
    near: Math.max(0.01, distance / 1000),
    far: Math.max(100, distance + sceneRadius * 20)
  });
}

/**
 * Derives representative plan-axis landmarks from scene bounds.
 *
 * The top landmark uses minimum Three Z because Project +Z is centralized as
 * Three -Z by the architectural scene derivation.
 */
export function createArchitecturalScreenParityLandmarks3D(
  bounds: SceneBounds3D
): ArchitecturalScreenParityLandmarks3D {
  const y = bounds.min.y;
  return Object.freeze({
    left: Object.freeze({ x: bounds.min.x, y, z: bounds.center.z }),
    right: Object.freeze({ x: bounds.max.x, y, z: bounds.center.z }),
    top: Object.freeze({ x: bounds.center.x, y, z: bounds.min.z }),
    bottom: Object.freeze({ x: bounds.center.x, y, z: bounds.max.z })
  });
}

/**
 * Projects a renderer-neutral scene point into normalized DOM-like screen
 * coordinates without constructing a Three camera or requiring WebGL.
 */
export function projectScenePointToArchitecturalScreen3D(
  point: ScenePoint3D,
  pose: ArchitecturalCameraPose3D,
  aspect: number,
  verticalFieldOfViewDegrees = 45
): ArchitecturalScreenPoint3D | undefined {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const forwardVector = {
    x: pose.target.x - pose.position.x,
    y: pose.target.y - pose.position.y,
    z: pose.target.z - pose.position.z
  };
  const forwardLength = Math.hypot(
    forwardVector.x,
    forwardVector.y,
    forwardVector.z
  );
  if (!Number.isFinite(forwardLength) || forwardLength === 0) return undefined;
  const forward = {
    x: forwardVector.x / forwardLength,
    y: forwardVector.y / forwardLength,
    z: forwardVector.z / forwardLength
  };
  const rightLength = Math.hypot(forward.x, forward.z);
  if (!Number.isFinite(rightLength) || rightLength === 0) return undefined;
  const right = {
    x: -forward.z / rightLength,
    y: 0,
    z: forward.x / rightLength
  };
  const up = {
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x
  };
  const relative = {
    x: point.x - pose.position.x,
    y: point.y - pose.position.y,
    z: point.z - pose.position.z
  };
  const depth = dot3D(relative, forward);
  if (!Number.isFinite(depth) || depth <= 0) return undefined;
  const verticalFov = verticalFieldOfViewDegrees * Math.PI / 180;
  const verticalScale = depth * Math.tan(verticalFov / 2);
  const horizontalScale = verticalScale * safeAspect;
  return Object.freeze({
    x: dot3D(relative, right) / horizontalScale,
    y: -dot3D(relative, up) / verticalScale,
    depth
  });
}

/** Computes a scalar product for renderer-neutral scene vectors. */
function dot3D(left: ScenePoint3D, right: ScenePoint3D): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}
