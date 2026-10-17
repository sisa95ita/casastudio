import type {
  InteriorCandidate3D,
  InteriorVisibility3D
} from "./room-interior-visibility-3d";
import { roomInteriorCameraPolicy3D as policy } from "./room-interior-policy-3d";

const mean = (values: readonly number[]): number =>
  values.reduce((a, b) => a + b, 0) / (values.length || 1);
export type InteriorScoreTerms3D = Readonly<{
  instances: number;
  coverage: number;
  diversity: number;
  room: number;
  architecture: number;
  clipping: number;
  occlusion: number;
  proximity: number;
  domination: number;
  distortion: number;
  empty: number;
}>;

/** Normalized, inspectable rewards and penalties. No scores enter provider metadata. */
export function interiorScoreTerms3D(
  visibility: InteriorVisibility3D,
  candidate: InteriorCandidate3D
): InteriorScoreTerms3D {
  const items = visibility.furniture;
  const useful = items.filter((f) => f.coverage >= policy.meaningfulCoverage);
  const totalWeight = items.reduce((sum, f) => sum + f.weight, 0) || 1;
  let diversity = 0;
  if (items.length > 1) {
    const xs = items.map((f) => f.center.x),
      zs = items.map((f) => f.center.z);
    const extent = Math.max(
      1,
      Math.hypot(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...zs) - Math.min(...zs)
      )
    );
    for (let i = 0; i < useful.length; i++)
      for (let j = i + 1; j < useful.length; j++) {
        const a = useful[i]!,
          b = useful[j]!;
        diversity = Math.max(
          diversity,
          (Math.hypot(a.center.x - b.center.x, a.center.z - b.center.z) /
            extent) *
            Math.min(a.coverage, b.coverage)
        );
      }
    diversity *= useful.length / items.length;
  }
  const room = mean(visibility.room);
  return {
    instances: useful.length / (items.length || 1),
    coverage:
      items.reduce((sum, f) => sum + f.coverage * f.weight, 0) / totalWeight,
    diversity,
    room,
    architecture: mean(visibility.architecture),
    clipping: mean(items.map((f) => f.clipping * f.inFrame)),
    occlusion: mean(items.map((f) => f.occluded)),
    proximity: visibility.proximity,
    domination: Math.max(
      visibility.nearWall,
      Math.max(
        0,
        ...items.map((f) =>
          Math.min(
            1,
            Math.max(
              0,
              (f.screenArea * f.coverage - policy.dominantObjectScreenArea) /
                (1 - policy.dominantObjectScreenArea)
            )
          )
        )
      )
    ),
    distortion: Math.max(
      0,
      Math.min(
        1,
        (candidate.verticalFovDegrees - policy.verticalFovs[0]!) /
          policy.distortionRangeDegrees
      )
    ),
    empty: items.length
      ? 1 - Math.max(room, mean(items.map((f) => f.coverage)))
      : 1 - room
  };
}

export function scoreInteriorOverview3D(terms: InteriorScoreTerms3D): number {
  const w = policy.weights;
  return (
    w.instances * terms.instances +
    w.coverage * terms.coverage +
    w.diversity * terms.diversity +
    w.room * terms.room +
    w.architecture * terms.architecture -
    w.clipping * terms.clipping -
    w.occlusion * terms.occlusion -
    w.proximity * terms.proximity -
    w.domination * terms.domination -
    w.distortion * terms.distortion -
    w.empty * terms.empty
  );
}

export function interiorPoseDifference3D(
  a: InteriorCandidate3D,
  b: InteriorCandidate3D
): Readonly<{ position: number; direction: number }> {
  const position = Math.hypot(
    a.pose.position.x - b.pose.position.x,
    a.pose.position.z - b.pose.position.z
  );
  const direction = (c: InteriorCandidate3D) => ({
    x: c.pose.target.x - c.pose.position.x,
    z: c.pose.target.z - c.pose.position.z
  });
  const da = direction(a),
    db = direction(b);
  const cosine =
    (da.x * db.x + da.z * db.z) /
    (Math.hypot(da.x, da.z) * Math.hypot(db.x, db.z) || 1);
  return {
    position,
    direction: (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI
  };
}

/** B earns marginal evidence for precisely the samples/items A leaves poorly represented. */
export function interiorComplementTerms3D(
  a: InteriorVisibility3D,
  b: InteriorVisibility3D,
  first: InteriorCandidate3D,
  candidate: InteriorCandidate3D
) {
  const firstItems = new Map(a.furniture.map((f) => [f.id, f.coverage]));
  const gain = (previous: readonly number[], next: readonly number[]) =>
    mean(next.map((v, i) => v * (1 - (previous[i] ?? 0))));
  const furniture = mean(
    b.furniture.map((f) => f.coverage * (1 - (firstItems.get(f.id) ?? 0)))
  );
  const similarity = b.furniture.length
    ? mean(
        b.furniture.map(
          (f) => 1 - Math.abs(f.coverage - (firstItems.get(f.id) ?? 0))
        )
      )
    : mean(b.room.map((v, i) => 1 - Math.abs(v - (a.room[i] ?? 0))));
  const difference = interiorPoseDifference3D(first, candidate);
  const poseSimilarity =
    (Math.max(0, 1 - difference.position / policy.minimumPositionDifference) +
      Math.max(
        0,
        1 - difference.direction / policy.minimumDirectionDifferenceDegrees
      )) /
    2;
  return {
    furniture,
    room: gain(a.room, b.room),
    architecture: gain(a.architecture, b.architecture),
    duplicate: similarity * 0.5 + poseSimilarity * 0.5
  };
}

export function scoreInteriorComplement3D(
  terms: ReturnType<typeof interiorComplementTerms3D>,
  overviewScore: number
): number {
  const w = policy.complementWeights;
  return (
    w.furniture * terms.furniture +
    w.room * terms.room +
    w.architecture * terms.architecture -
    w.duplicate * terms.duplicate +
    w.quality * overviewScore
  );
}
