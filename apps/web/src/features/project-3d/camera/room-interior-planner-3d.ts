import type {
  Floor3D,
  SceneBounds3D,
  ScenePoint3D,
  ScenePlanVector3D,
  Wall3D
} from "../model/architectural-scene-3d-model";
import type { FurnitureModel3D } from "../model/furniture-3d-model";
import type { Staircase3D } from "../model/staircase-3d-model";
import { createArchitecturalCameraClippingPlanes3D } from "./architectural-camera-3d";
import {
  averageInteriorPoints3D,
  insidePlanPolygon3D,
  planClearance3D,
  spreadInteriorPoints3D
} from "./room-interior-geometry-3d";
import { roomInteriorCameraPolicy3D as policy } from "./room-interior-policy-3d";
import {
  analyzeInteriorVisibility3D,
  createInteriorVisibilityScene3D,
  type InteriorCandidate3D,
  type InteriorVisibilityScene3D
} from "./room-interior-visibility-3d";
import {
  interiorComplementTerms3D,
  interiorPoseDifference3D,
  interiorScoreTerms3D,
  scoreInteriorComplement3D,
  scoreInteriorOverview3D
} from "./room-interior-score-3d";

export function isSafeInteriorEye3D(
  eye: ScenePoint3D,
  floor: Floor3D,
  scene: InteriorVisibilityScene3D,
  perimeterClearance: number = policy.perimeterClearance
): boolean {
  if (
    !insidePlanPolygon3D(eye, floor.contour) ||
    planClearance3D(eye, floor.contour) < perimeterClearance
  )
    return false;
  return scene.solids.every((solid) => {
    const furniture = solid.id.startsWith("furniture:");
    if (
      !furniture &&
      (eye.y < solid.bottom - policy.solidClearance ||
        eye.y > solid.top + policy.solidClearance)
    )
      return true;
    return (
      !insidePlanPolygon3D(eye, solid.contour) &&
      planClearance3D(eye, solid.contour) >=
        (furniture ? policy.furnitureClearance : policy.solidClearance)
    );
  });
}

/** Triangles guarantee valid interior seeds; edge insets also explore useful perimeter photography. */
export function generateInteriorCandidates3D(
  floor: Floor3D,
  scene: InteriorVisibilityScene3D,
  bounds: SceneBounds3D,
  wallHeight: number
): readonly InteriorCandidate3D[] {
  const triangles = floor.triangles.map((triangle) =>
    triangle.map((i) => floor.contour[i]!)
  );
  const centers = triangles.map(averageInteriorPoints3D);
  const seeds = triangles.flatMap((vertices) => {
    const center = averageInteriorPoints3D(vertices);
    const inset = (point: ScenePlanVector3D) => {
      const distance = Math.hypot(point.x - center.x, point.z - center.z);
      const t = Math.min(
        policy.maximumInsetFraction,
        policy.perimeterInset / (distance || 1)
      );
      return {
        x: point.x * (1 - t) + center.x * t,
        z: point.z * (1 - t) + center.z * t
      };
    };
    return [
      center,
      ...vertices.map(inset),
      ...vertices.flatMap((a, i) => {
        const b = vertices[(i + 1) % 3]!;
        return [0.25, 0.5, 0.75].map((t) =>
          inset({ x: a.x * (1 - t) + b.x * t, z: a.z * (1 - t) + b.z * t })
        );
      })
    ];
  });
  const height = Math.min(
    policy.eyeHeight,
    wallHeight - policy.ceilingClearance
  );
  // Do not force the minimum eye height through an unusually low ceiling.
  if (height < policy.minimumEyeHeight) return [];
  const toEye = (p: ScenePlanVector3D): ScenePoint3D => ({
    ...p,
    y: floor.y + height
  });
  const boundedSeeds = spreadInteriorPoints3D(
    seeds,
    policy.maximumPositionSeeds
  ).map(toEye);
  let valid = boundedSeeds.filter((p) => isSafeInteriorEye3D(p, floor, scene));
  if (!valid.length)
    valid = boundedSeeds.filter((p) =>
      isSafeInteriorEye3D(p, floor, scene, policy.narrowPerimeterClearance)
    );
  const positions = spreadInteriorPoints3D(valid, policy.maximumPositions).sort(
    (a, b) => a.x - b.x || a.z - b.z
  );
  if (!positions.length) return [];

  const areas = triangles.map(
    ([a, b, c]) =>
      Math.abs((b!.x - a!.x) * (c!.z - a!.z) - (b!.z - a!.z) * (c!.x - a!.x)) /
      2
  );
  const area = areas.reduce((a, b) => a + b, 0) || 1;
  const roomCenter = {
    x: centers.reduce((sum, p, i) => sum + p.x * areas[i]!, 0) / area,
    z: centers.reduce((sum, p, i) => sum + p.z * areas[i]!, 0) / area
  };
  const interiorCenter = insidePlanPolygon3D(roomCenter, floor.contour)
    ? roomCenter
    : [...centers].sort(
        (a, b) =>
          Math.hypot(a.x - roomCenter.x, a.z - roomCenter.z) -
          Math.hypot(b.x - roomCenter.x, b.z - roomCenter.z)
      )[0]!;
  const items = scene.furniture;
  const weight =
    items.reduce((sum, f) => sum + Math.sqrt(f.width * f.depth), 0) || 1;
  const layoutCenter = items.length
    ? {
        x:
          items.reduce(
            (sum, f) => sum + f.position.x * Math.sqrt(f.width * f.depth),
            0
          ) / weight,
        z:
          items.reduce(
            (sum, f) => sum + f.position.z * Math.sqrt(f.width * f.depth),
            0
          ) / weight
      }
    : interiorCenter;
  const blend = (p: ScenePlanVector3D): ScenePlanVector3D => ({
    x:
      p.x * policy.layoutTargetWeight +
      interiorCenter.x * (1 - policy.layoutTargetWeight),
    z:
      p.z * policy.layoutTargetWeight +
      interiorCenter.z * (1 - policy.layoutTargetWeight)
  });
  const targetPoints = [
    interiorCenter,
    blend(layoutCenter),
    ...spreadInteriorPoints3D(
      items.length ? items.map((f) => f.position) : centers,
      2
    ).map(blend)
  ].slice(0, policy.maximumTargets);
  const targets = [
    ...new Map(
      targetPoints.map((p) => [`${p.x.toFixed(8)}:${p.z.toFixed(8)}`, p])
    ).values()
  ];
  const candidates: InteriorCandidate3D[] = [];
  for (const position of positions)
    for (const aim of targets) {
      const distance = Math.hypot(position.x - aim.x, position.z - aim.z);
      if (distance < policy.minimumLookDistance) continue;
      // Floor/layout composition with an explicit maximum pitch; never a top-down camera.
      const targetY = Math.max(
        Math.min(position.y, floor.y + policy.compositionTargetHeight),
        position.y -
          distance *
            Math.tan((policy.maximumDownwardPitchDegrees * Math.PI) / 180)
      );
      const target = { x: aim.x, y: targetY, z: aim.z };
      for (const verticalFovDegrees of policy.verticalFovs)
        candidates.push({
          verticalFovDegrees,
          pose: {
            position,
            target,
            ...createArchitecturalCameraClippingPlanes3D(bounds, distance)
          }
        });
    }
  return candidates;
}

/** Internal diagnostics are pure/testable and deliberately absent from reference contracts. */
export function planRoomInteriors3D(
  floor: Floor3D,
  walls: readonly Wall3D[],
  furniture: readonly FurnitureModel3D[],
  stairs: readonly Staircase3D[],
  bounds: SceneBounds3D,
  aspect: number,
  wallHeight: number
) {
  const scene = createInteriorVisibilityScene3D(
    floor,
    walls,
    furniture,
    stairs
  );
  const candidates = generateInteriorCandidates3D(
    floor,
    scene,
    bounds,
    wallHeight
  );
  const evaluated = candidates.map((candidate, index) => {
    const visibility = analyzeInteriorVisibility3D(scene, candidate, aspect);
    const terms = interiorScoreTerms3D(visibility, candidate);
    return {
      candidate,
      index,
      visibility,
      terms,
      score: scoreInteriorOverview3D(terms)
    };
  });
  // Stable generation order breaks numeric ties; no mounted camera/GLB-loading state is consulted.
  const first = [...evaluated].sort(
    (a, b) => b.score - a.score || a.index - b.index
  )[0];
  if (!first) return undefined;
  const alternatives = evaluated.filter((entry) => {
    const difference = interiorPoseDifference3D(
      first.candidate,
      entry.candidate
    );
    return (
      difference.position >= policy.minimumPositionDifference &&
      difference.direction >= policy.minimumDirectionDifferenceDegrees
    );
  });
  const pool = alternatives.length
    ? alternatives
    : evaluated.filter((entry) => entry.index !== first.index);
  const second = pool
    .map((entry) => {
      const terms = interiorComplementTerms3D(
        first.visibility,
        entry.visibility,
        first.candidate,
        entry.candidate
      );
      return {
        ...entry,
        complementTerms: terms,
        complementScore: scoreInteriorComplement3D(terms, entry.score)
      };
    })
    .sort(
      (a, b) => b.complementScore - a.complementScore || a.index - b.index
    )[0];
  return { first, second: second ?? first, candidateCount: candidates.length };
}
