import type { GeometryPresentationModel2D } from "../geometry-playground/geometry-presentation-model-2d";
import type {
  SvgViewportPoint,
  WorldPointXZ
} from "../geometry-playground/viewport-transform-2d";

/** Visible CSS-pixel radius used by Draw Wall topology snapping. */
export const drawWallSnapConfiguration = Object.freeze({
  tolerancePixels: 10,
  distanceTieTolerancePixels: 1e-6
});

/** Exact transient topology target resolved for the Draw Wall pointer. */
export type DrawWallSnapCandidate =
  | {
      readonly kind: "vertex";
      readonly geometryId: string;
      readonly point: WorldPointXZ;
      readonly visualDistancePixels: number;
    }
  | {
      readonly kind: "wall-interior";
      readonly geometryId: string;
      readonly wallId: string;
      readonly point: WorldPointXZ;
      readonly visualDistancePixels: number;
    };

/**
 * Resolves the nearest eligible Draw Wall topology target in SVG viewBox space.
 *
 * Vertices always win over Wall interiors. Equal-distance candidates use
 * stable geometry identity so resolution does not depend on array order. SVG
 * distances are converted to visible CSS pixels before applying tolerance.
 */
export function resolveDrawWallSnapCandidate(
  pointer: SvgViewportPoint,
  model: GeometryPresentationModel2D,
  cssPixelsPerSvgUnit = 1,
  tolerancePixels = drawWallSnapConfiguration.tolerancePixels
): DrawWallSnapCandidate | undefined {
  const vertexCandidates = model.vertices.flatMap((vertex) => {
    const visualDistancePixels =
      svgViewportDistance(pointer, vertex.point) * cssPixelsPerSvgUnit;
    return visualDistancePixels <= tolerancePixels
      ? [
          {
            kind: "vertex" as const,
            geometryId: vertex.geometryId,
            point: vertex.coordinates,
            visualDistancePixels
          }
        ]
      : [];
  });
  const vertex = chooseNearest(vertexCandidates);
  if (vertex) return vertex;

  const wallCandidates = model.boundaryEdges.flatMap((edge) => {
    const projection = projectOntoScreenSegment(
      pointer,
      edge.start.screen,
      edge.end.screen
    );
    if (
      !projection ||
      projection.distance * cssPixelsPerSvgUnit > tolerancePixels ||
      svgViewportDistance(projection.point, edge.start.screen) *
          cssPixelsPerSvgUnit <=
        tolerancePixels ||
      svgViewportDistance(projection.point, edge.end.screen) *
          cssPixelsPerSvgUnit <=
        tolerancePixels
    ) {
      return [];
    }

    return [
      {
        kind: "wall-interior" as const,
        geometryId: edge.geometryId,
        wallId: edge.sourceWallId,
        point: {
          x: edge.start.world.x +
            (edge.end.world.x - edge.start.world.x) * projection.parameter,
          z: edge.start.world.z +
            (edge.end.world.z - edge.start.world.z) * projection.parameter
        },
        visualDistancePixels: projection.distance * cssPixelsPerSvgUnit
      }
    ];
  });

  return chooseNearest(wallCandidates);
}

function chooseNearest<T extends DrawWallSnapCandidate>(
  candidates: readonly T[]
): T | undefined {
  return [...candidates].sort((first, second) => {
    const difference =
      first.visualDistancePixels - second.visualDistancePixels;
    return Math.abs(difference) >
      drawWallSnapConfiguration.distanceTieTolerancePixels
      ? difference
      : first.geometryId.localeCompare(second.geometryId);
  })[0];
}

function projectOntoScreenSegment(
  pointer: SvgViewportPoint,
  start: SvgViewportPoint,
  end: SvgViewportPoint
):
  | {
      readonly point: SvgViewportPoint;
      readonly parameter: number;
      readonly distance: number;
    }
  | undefined {
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
  return {
    point,
    parameter,
    distance: svgViewportDistance(pointer, point)
  };
}

/** Measures Euclidean distance between two SVG viewBox points. */
function svgViewportDistance(
  first: SvgViewportPoint,
  second: SvgViewportPoint
): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
