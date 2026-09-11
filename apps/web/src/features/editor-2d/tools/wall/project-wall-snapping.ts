import type { GeometryPresentationModel2D } from "../../../geometry-2d/presentation/geometry-presentation-model-2d";
import type {
  SvgViewportPoint,
  WorldPointXZ
} from "../../../geometry-2d/viewport/viewport-transform-2d";
import { precisionTolerance } from "../../../geometry-2d/precision/precision-assistance-2d";

/** Visible CSS-pixel radii used by Draw Wall precision assistance. */
export const drawWallSnapConfiguration = Object.freeze({
  tolerancePixels: precisionTolerance.activationPixels,
  distanceTieTolerancePixels: precisionTolerance.distanceTiePixels
});

/** Deterministic priority order for Draw Wall precision candidates. */
export const drawWallSnapPriority = Object.freeze([
  "vertex",
  "wall-endpoint",
  "wall-midpoint",
  "wall-intersection",
  "wall-interior",
  "orthogonal",
  "grid",
  "free"
] as const);

type SnapBase = {
  readonly geometryId: string;
  readonly point: WorldPointXZ;
  readonly visualDistancePixels: number;
};

/** Exact transient precision target resolved for a Draw Wall pointer. */
export type DrawWallSnapCandidate =
  | (SnapBase & { readonly kind: "vertex" })
  | (SnapBase & { readonly kind: "wall-endpoint"; readonly wallId: string })
  | (SnapBase & { readonly kind: "wall-midpoint"; readonly wallId: string })
  | (SnapBase & {
      readonly kind: "wall-intersection";
      readonly wallIds: [string, string];
    })
  | (SnapBase & { readonly kind: "wall-interior"; readonly wallId: string })
  | (SnapBase & {
      readonly kind: "orthogonal";
      readonly axis: "horizontal" | "vertical";
    })
  | (SnapBase & { readonly kind: "grid" })
  | (SnapBase & { readonly kind: "free" });

/** Shared Project-point snap result used by authoring and measurement tools. */
export type ProjectPointSnapCandidate = DrawWallSnapCandidate;

/** Optional editing context used after topology targets have been considered. */
export type DrawWallSnapOptions = {
  /** Suppresses all assistance for one active Alt/Option gesture sample. */
  readonly bypass?: boolean;
  readonly cssPixelsPerSvgUnit?: number;
  readonly tolerancePixels?: number;
  readonly worldPoint?: WorldPointXZ;
  readonly drawStart?: {
    readonly worldPoint: WorldPointXZ;
    readonly svgPoint: SvgViewportPoint;
  };
  readonly grid?: {
    readonly enabled: boolean;
    readonly spacing: number;
    readonly worldToSvgScale: number;
  };
};

/**
 * Resolves one Draw Wall point by stable screen-space priority.
 *
 * Topology candidates win in the documented order, followed by orthogonal and
 * grid assistance. Equal-distance candidates use stable identity. The final
 * free candidate preserves the unsnapped canonical world point.
 */
export function resolveDrawWallSnapCandidate(
  pointer: SvgViewportPoint,
  model: GeometryPresentationModel2D,
  rawOptions: DrawWallSnapOptions | number = {},
  legacyTolerancePixels?: number
): DrawWallSnapCandidate {
  const options: DrawWallSnapOptions =
    typeof rawOptions === "number"
      ? {
          cssPixelsPerSvgUnit: rawOptions,
          tolerancePixels: legacyTolerancePixels
        }
      : rawOptions;
  const cssScale = options.cssPixelsPerSvgUnit ?? 1;
  if (options.bypass) {
    return {
      kind: "free",
      geometryId: "free",
      point: options.worldPoint ?? { x: pointer.x, z: -pointer.y },
      visualDistancePixels: 0
    };
  }
  const tolerance =
    options.tolerancePixels ?? drawWallSnapConfiguration.tolerancePixels;
  const withinTolerance = (distance: number) =>
    distance * cssScale <= tolerance;
  const wallEdges = model.boundaryEdges.filter(
    (edge): edge is typeof edge & { readonly sourceWallId: string } =>
      edge.sourceKind !== "FREE" && edge.sourceWallId !== undefined
  );

  const vertex = chooseNearest(
    model.vertices.flatMap((candidate) => {
      if (candidate.wallBacked === false) return [];
      const distance = svgDistance(pointer, candidate.point);
      return withinTolerance(distance)
        ? [
            {
              kind: "vertex" as const,
              geometryId: candidate.geometryId,
              point: candidate.coordinates,
              visualDistancePixels: distance * cssScale
            }
          ]
        : [];
    })
  );
  if (vertex) return vertex;

  const endpoint = chooseNearest(
    wallEdges.flatMap((edge) =>
      (
        [
          { label: "start", value: edge.start },
          { label: "end", value: edge.end }
        ] as const
      ).flatMap(({ label, value }) => {
        const distance = svgDistance(pointer, value.screen);
        return withinTolerance(distance)
          ? [
              {
                kind: "wall-endpoint" as const,
                geometryId: `${edge.geometryId}:${label}`,
                wallId: edge.sourceWallId,
                point: value.world,
                visualDistancePixels: distance * cssScale
              }
            ]
          : [];
      })
    )
  );
  if (endpoint) return endpoint;

  const midpoint = chooseNearest(
    wallEdges.flatMap((edge) => {
      const distance = svgDistance(pointer, edge.midpoint);
      return withinTolerance(distance)
        ? [
            {
              kind: "wall-midpoint" as const,
              geometryId: `${edge.geometryId}:midpoint`,
              wallId: edge.sourceWallId,
              point: interpolate(edge.start.world, edge.end.world, 0.5),
              visualDistancePixels: distance * cssScale
            }
          ]
        : [];
    })
  );
  if (midpoint) return midpoint;

  const intersections: DrawWallSnapCandidate[] = [];
  wallEdges.forEach((first, firstIndex) => {
    wallEdges.slice(firstIndex + 1).forEach((second) => {
      const found = segmentIntersection(
        first.start.screen,
        first.end.screen,
        second.start.screen,
        second.end.screen
      );
      if (!found) return;
      const distance = svgDistance(pointer, found.point);
      if (!withinTolerance(distance)) return;
      intersections.push({
        kind: "wall-intersection",
        geometryId: [first.geometryId, second.geometryId].sort().join("&"),
        wallIds: [first.sourceWallId, second.sourceWallId].sort() as [
          string,
          string
        ],
        point: interpolate(
          first.start.world,
          first.end.world,
          found.firstParameter
        ),
        visualDistancePixels: distance * cssScale
      });
    });
  });
  const intersection = chooseNearest(intersections);
  if (intersection) return intersection;

  const wallInterior = chooseNearest(
    wallEdges.flatMap((edge) => {
      const projection = projectOntoSegment(
        pointer,
        edge.start.screen,
        edge.end.screen
      );
      if (
        !projection ||
        !withinTolerance(projection.distance) ||
        projection.parameter <= 0 ||
        projection.parameter >= 1
      )
        return [];
      return [
        {
          kind: "wall-interior" as const,
          geometryId: edge.geometryId,
          wallId: edge.sourceWallId,
          point: interpolate(
            edge.start.world,
            edge.end.world,
            projection.parameter
          ),
          visualDistancePixels: projection.distance * cssScale
        }
      ];
    })
  );
  if (wallInterior) return wallInterior;

  if (options.drawStart && options.worldPoint) {
    const orthogonal = [
      {
        kind: "orthogonal" as const,
        geometryId: "orthogonal:horizontal",
        axis: "horizontal" as const,
        point: { x: options.worldPoint.x, z: options.drawStart.worldPoint.z },
        visualDistancePixels:
          Math.abs(pointer.y - options.drawStart.svgPoint.y) * cssScale
      },
      {
        kind: "orthogonal" as const,
        geometryId: "orthogonal:vertical",
        axis: "vertical" as const,
        point: { x: options.drawStart.worldPoint.x, z: options.worldPoint.z },
        visualDistancePixels:
          Math.abs(pointer.x - options.drawStart.svgPoint.x) * cssScale
      }
    ].filter((candidate) => candidate.visualDistancePixels <= tolerance);
    const candidate = chooseNearest(orthogonal);
    if (candidate) return candidate;
  }

  const grid =
    options.worldPoint && options.grid
      ? resolveGridSnapCandidate(options.worldPoint, {
          ...options.grid,
          cssPixelsPerSvgUnit: cssScale,
          tolerancePixels: tolerance
        })
      : undefined;
  if (grid) return grid;

  return {
    kind: "free",
    geometryId: "free",
    point: options.worldPoint ?? { x: pointer.x, z: -pointer.y },
    visualDistancePixels: 0
  };
}

/** Shared resolver for tools that acquire a point in canonical Project space. */
export const resolveProjectPointSnapCandidate = resolveDrawWallSnapCandidate;

/** Resolves grid-only authoring alignment using the shared visible tolerance. */
export function resolveGridSnapCandidate(
  worldPoint: WorldPointXZ,
  options: {
    readonly enabled: boolean;
    readonly spacing: number;
    readonly worldToSvgScale: number;
    readonly cssPixelsPerSvgUnit?: number;
    readonly tolerancePixels?: number;
  }
): Extract<DrawWallSnapCandidate, { readonly kind: "grid" }> | undefined {
  if (
    !options.enabled ||
    !Number.isFinite(options.spacing) ||
    options.spacing <= 0
  ) {
    return undefined;
  }
  const point = {
    x: Math.round(worldPoint.x / options.spacing) * options.spacing,
    z: Math.round(worldPoint.z / options.spacing) * options.spacing
  };
  const visualDistancePixels =
    Math.hypot(point.x - worldPoint.x, point.z - worldPoint.z) *
    options.worldToSvgScale *
    (options.cssPixelsPerSvgUnit ?? 1);
  if (
    visualDistancePixels >
    (options.tolerancePixels ?? drawWallSnapConfiguration.tolerancePixels)
  ) {
    return undefined;
  }
  return {
    kind: "grid",
    geometryId: `grid:${point.x}:${point.z}`,
    point,
    visualDistancePixels
  };
}

function chooseNearest<T extends DrawWallSnapCandidate>(
  candidates: readonly T[]
): T | undefined {
  return [...candidates].sort((first, second) => {
    const difference = first.visualDistancePixels - second.visualDistancePixels;
    return Math.abs(difference) >
      drawWallSnapConfiguration.distanceTieTolerancePixels
      ? difference
      : first.geometryId.localeCompare(second.geometryId);
  })[0];
}

function projectOntoSegment(
  pointer: SvgViewportPoint,
  start: SvgViewportPoint,
  end: SvgViewportPoint
) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) return undefined;
  const parameter = Math.max(
    0,
    Math.min(
      1,
      ((pointer.x - start.x) * deltaX + (pointer.y - start.y) * deltaY) /
        lengthSquared
    )
  );
  const point = {
    x: start.x + deltaX * parameter,
    y: start.y + deltaY * parameter
  };
  return { point, parameter, distance: svgDistance(pointer, point) };
}

function segmentIntersection(
  firstStart: SvgViewportPoint,
  firstEnd: SvgViewportPoint,
  secondStart: SvgViewportPoint,
  secondEnd: SvgViewportPoint
):
  | { readonly point: SvgViewportPoint; readonly firstParameter: number }
  | undefined {
  const firstDelta = {
    x: firstEnd.x - firstStart.x,
    y: firstEnd.y - firstStart.y
  };
  const secondDelta = {
    x: secondEnd.x - secondStart.x,
    y: secondEnd.y - secondStart.y
  };
  const denominator =
    firstDelta.x * secondDelta.y - firstDelta.y * secondDelta.x;
  if (denominator === 0) return undefined;
  const relative = {
    x: secondStart.x - firstStart.x,
    y: secondStart.y - firstStart.y
  };
  const firstParameter =
    (relative.x * secondDelta.y - relative.y * secondDelta.x) / denominator;
  const secondParameter =
    (relative.x * firstDelta.y - relative.y * firstDelta.x) / denominator;
  const epsilon = 1e-9;
  if (
    firstParameter <= epsilon ||
    firstParameter >= 1 - epsilon ||
    secondParameter <= epsilon ||
    secondParameter >= 1 - epsilon
  )
    return undefined;
  return {
    point: {
      x: firstStart.x + firstDelta.x * firstParameter,
      y: firstStart.y + firstDelta.y * firstParameter
    },
    firstParameter
  };
}

function interpolate(
  start: WorldPointXZ,
  end: WorldPointXZ,
  parameter: number
): WorldPointXZ {
  return {
    x: start.x + (end.x - start.x) * parameter,
    z: start.z + (end.z - start.z) * parameter
  };
}

function svgDistance(
  first: SvgViewportPoint,
  second: SvgViewportPoint
): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
