import type { Point2D } from "@casastudio/schema";

/** CSS-pixel activation and release distances shared by 2D precision gestures. */
export const precisionTolerance = Object.freeze({
  activationPixels: 10,
  releasePixels: 13,
  distanceTiePixels: 1e-6
});

/** Product-level relationships that may influence one plan-space translation. */
export type PrecisionRelation =
  | "vertex"
  | "wall-endpoint"
  | "wall-midpoint"
  | "wall-intersection"
  | "wall-interior"
  | "wall-face"
  | "room-boundary"
  | "object-edge"
  | "object-center"
  | "horizontal-alignment"
  | "vertical-alignment"
  | "orthogonal"
  | "grid";

/** One restrained world-space guide rendered only for the active gesture. */
export type PrecisionGuide2D = {
  readonly kind: "line" | "segment";
  readonly start: Point2D;
  readonly end: Point2D;
  readonly label?: string;
};

/** Pure translation candidate with stable identity, ranking, and explanation geometry. */
export type PrecisionTranslationCandidate = {
  readonly id: string;
  readonly relation: PrecisionRelation;
  readonly axis: "x" | "z" | "both";
  readonly correction: Point2D;
  readonly distancePixels: number;
  readonly guides: PrecisionGuide2D[];
};

/** Exact snapped delta and the candidates responsible for it. */
export type PrecisionTranslationResult = {
  readonly delta: Point2D;
  readonly active: PrecisionTranslationCandidate[];
  readonly guides: PrecisionGuide2D[];
};

const priority: Readonly<Record<PrecisionRelation, number>> = Object.freeze({
  vertex: 0,
  "wall-endpoint": 1,
  "wall-midpoint": 2,
  "wall-intersection": 3,
  "wall-interior": 4,
  "wall-face": 5,
  "room-boundary": 6,
  orthogonal: 7,
  "object-edge": 8,
  "object-center": 9,
  "horizontal-alignment": 10,
  "vertical-alignment": 10,
  grid: 11
});

/**
 * Resolves bounded translation assistance by semantic priority, visible distance,
 * and stable identity. Axis candidates may compose, while angled candidates are
 * applied as one indivisible vector. The optional validator sees the exact final
 * delta that preview and commit will share.
 */
export function resolvePrecisionTranslation(
  rawDelta: Point2D,
  candidates: readonly PrecisionTranslationCandidate[],
  options: {
    readonly bypass?: boolean;
    readonly tolerancePixels?: number;
    readonly previous?: PrecisionTranslationResult;
    readonly isValid?: (delta: Point2D) => boolean;
  } = {}
): PrecisionTranslationResult {
  if (options.bypass) return emptyResult(rawDelta);
  const tolerance =
    options.tolerancePixels ?? precisionTolerance.activationPixels;
  const previousIds = new Set(
    options.previous?.active.map((candidate) => candidate.id) ?? []
  );
  const compare = createCandidateComparator(previousIds);
  const eligible = candidates
    .filter(
      (candidate) =>
        candidate.distancePixels <= tolerance ||
        (previousIds.has(candidate.id) &&
          candidate.distancePixels <= precisionTolerance.releasePixels)
    )
    .sort(compare);
  const both = eligible.filter((candidate) => candidate.axis === "both");
  const x = eligible.filter((candidate) => candidate.axis === "x");
  const z = eligible.filter((candidate) => candidate.axis === "z");
  const proposals: {
    delta: Point2D;
    active: PrecisionTranslationCandidate[];
  }[] = [
    ...both.map((candidate) => ({
      delta: add(rawDelta, candidate.correction),
      active: [candidate]
    })),
    ...x.flatMap((xCandidate) =>
      z.map((zCandidate) => ({
        delta: add(rawDelta, add(xCandidate.correction, zCandidate.correction)),
        active: [xCandidate, zCandidate]
      }))
    ),
    ...x.map((candidate) => ({
      delta: add(rawDelta, candidate.correction),
      active: [candidate]
    })),
    ...z.map((candidate) => ({
      delta: add(rawDelta, candidate.correction),
      active: [candidate]
    }))
  ].sort((first, second) => compareProposals(first, second, compare));

  const accepted = proposals.find(
    (proposal) => options.isValid?.(proposal.delta) ?? true
  );
  return accepted
    ? {
        delta: accepted.delta,
        active: accepted.active,
        guides: accepted.active.flatMap((candidate) => candidate.guides)
      }
    : emptyResult(rawDelta);
}

/** Creates a stable axis candidate from a world-space correction. */
export function createAxisPrecisionCandidate(input: {
  readonly id: string;
  readonly relation: PrecisionRelation;
  readonly axis: "x" | "z";
  readonly correction: number;
  readonly pixelsPerWorldUnit: number;
  readonly guides?: readonly PrecisionGuide2D[];
}): PrecisionTranslationCandidate {
  return {
    id: input.id,
    relation: input.relation,
    axis: input.axis,
    correction:
      input.axis === "x"
        ? { x: input.correction, z: 0 }
        : { x: 0, z: input.correction },
    distancePixels: Math.abs(input.correction) * input.pixelsPerWorldUnit,
    guides: [...(input.guides ?? [])]
  };
}

function compareCandidates(
  first: PrecisionTranslationCandidate,
  second: PrecisionTranslationCandidate
): number {
  const semantic = priority[first.relation] - priority[second.relation];
  if (semantic !== 0) return semantic;
  const distance = first.distancePixels - second.distancePixels;
  return Math.abs(distance) > precisionTolerance.distanceTiePixels
    ? distance
    : first.id.localeCompare(second.id);
}

function createCandidateComparator(previousIds: ReadonlySet<string>) {
  return (
    first: PrecisionTranslationCandidate,
    second: PrecisionTranslationCandidate
  ): number => {
    const firstPrevious = previousIds.has(first.id);
    const secondPrevious = previousIds.has(second.id);
    if (firstPrevious !== secondPrevious) {
      const previous = firstPrevious ? first : second;
      const alternative = firstPrevious ? second : first;
      const higherPriorityAppeared =
        priority[alternative.relation] < priority[previous.relation];
      if (!higherPriorityAppeared) return firstPrevious ? -1 : 1;
    }
    return compareCandidates(first, second);
  };
}

function compareProposals(
  first: { readonly active: readonly PrecisionTranslationCandidate[] },
  second: { readonly active: readonly PrecisionTranslationCandidate[] },
  compare: (
    first: PrecisionTranslationCandidate,
    second: PrecisionTranslationCandidate
  ) => number
): number {
  const firstSorted = [...first.active].sort(compare);
  const secondSorted = [...second.active].sort(compare);
  for (
    let index = 0;
    index < Math.max(firstSorted.length, secondSorted.length);
    index += 1
  ) {
    const a = firstSorted[index];
    const b = secondSorted[index];
    if (!a) return 1;
    if (!b) return -1;
    const comparison = compare(a, b);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

const add = (first: Point2D, second: Point2D): Point2D => ({
  x: first.x + second.x,
  z: first.z + second.z
});

const emptyResult = (delta: Point2D): PrecisionTranslationResult => ({
  delta,
  active: [],
  guides: []
});
