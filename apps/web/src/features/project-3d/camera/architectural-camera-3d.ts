import type { SceneBounds3D, ScenePoint3D } from "../model/architectural-scene-3d-model";

/** Deterministic perspective-camera placement for an architectural scene. */
export type ArchitecturalCameraPose3D = Readonly<{
  position: ScenePoint3D;
  target: ScenePoint3D;
  near: number;
  far: number;
}>;

/** Scale-aware OrbitControls limits derived without reading mounted Three objects. */
export type ArchitecturalOrbitLimits3D = Readonly<{
  minDistance: number;
  maxDistance: number;
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

/** Elevated three-quarter direction used by initial and reset framing. */
export const architecturalPlanAlignedDirection3D: ScenePoint3D = Object.freeze({
  x: 0.52,
  y: 0.72,
  z: 1
});

/** Deterministic breathing room around complete physical scene bounds. */
export const architecturalCameraFramingPadding3D = 1.18;

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
  const sceneRadius = getArchitecturalSceneRadius3D(framingBounds);
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const distance = Math.max(
    3,
    sceneRadius / Math.sin(limitingFov / 2) * architecturalCameraFramingPadding3D
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
  const clipping = createArchitecturalCameraClippingPlanes3D(
    framingBounds,
    distance
  );
  return Object.freeze({
    position: Object.freeze({
      x: target.x + direction.x * distance,
      y: target.y + direction.y * distance,
      z: target.z + direction.z * distance
    }),
    target,
    ...clipping
  });
}

/** Derives practical clipping planes for close inspection and whole-building views. */
export function createArchitecturalCameraClippingPlanes3D(
  bounds: SceneBounds3D | undefined,
  cameraDistance: number
): Readonly<{ near: number; far: number }> {
  const radius = getArchitecturalSceneRadius3D(bounds ?? emptyArchitecturalSceneBounds3D);
  const safeDistance = Number.isFinite(cameraDistance) && cameraDistance > 0
    ? cameraDistance
    : radius * 3;
  return Object.freeze({
    near: Math.max(0.01, Math.min(0.1, radius / 1000)),
    far: Math.max(100, safeDistance + radius * 6)
  });
}

/** Derives useful zoom limits from complete renderer-neutral scene bounds. */
export function createArchitecturalOrbitLimits3D(
  bounds: SceneBounds3D | undefined
): ArchitecturalOrbitLimits3D {
  const radius = getArchitecturalSceneRadius3D(bounds ?? emptyArchitecturalSceneBounds3D);
  return Object.freeze({
    minDistance: Math.max(0.08, Math.min(0.5, radius * 0.02)),
    maxDistance: Math.max(25, radius * 10)
  });
}

/** Returns a nonzero radius that contains every corner of the given bounds. */
function getArchitecturalSceneRadius3D(bounds: SceneBounds3D): number {
  return Math.max(Math.hypot(bounds.size.x, bounds.size.y, bounds.size.z) / 2, 1);
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
