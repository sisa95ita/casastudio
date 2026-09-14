import { createArchitecturalWallShape } from "@casastudio/geometry";

import type { ProjectPreview } from "../../../core/api/api-types";
import { formatSvgNumber } from "../../geometry-2d/viewport/geometry-svg-helpers";
import {
  createFitToViewTransform,
  type ViewportBounds2D
} from "../../geometry-2d/viewport/viewport-transform-2d";

/** Stable SVG viewport used by every Project library thumbnail. */
export const projectPreviewViewport = Object.freeze({
  width: 320,
  height: 180,
  padding: 22
});

/** One fitted physical Wall strip in a read-only Project preview. */
export type ProjectPreviewWallShape = {
  readonly id: string;
  readonly svgPoints: string;
};

/** Immutable presentation data consumed by the Project preview SVG. */
export type ProjectPreviewModel = {
  readonly levelId?: string;
  readonly bounds?: ViewportBounds2D;
  readonly scale?: number;
  readonly wallShapes: readonly ProjectPreviewWallShape[];
  readonly empty: boolean;
};

/** Derives fitted, renderer-only Wall shapes from the list-level preview contract. */
export function createProjectPreviewModel(
  preview: ProjectPreview | undefined
): ProjectPreviewModel {
  const walls = (preview?.walls ?? []).filter(isDrawableWall);
  if (!preview || walls.length === 0) {
    return Object.freeze({
      levelId: preview?.levelId,
      wallShapes: Object.freeze([]),
      empty: true
    });
  }

  const physicalShapes = walls.map((wall) =>
    createArchitecturalWallShape({
      ...wall,
      height: 1,
      roomIds: [],
      openings: []
    })
  );
  const points = physicalShapes.flatMap((shape) => shape.points);
  const bounds = Object.freeze({
    minX: Math.min(...points.map((point) => point.x)),
    minZ: Math.min(...points.map((point) => point.z)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxZ: Math.max(...points.map((point) => point.z))
  });
  const transform = createFitToViewTransform({
    bounds,
    viewportWidth: projectPreviewViewport.width,
    viewportHeight: projectPreviewViewport.height,
    padding: projectPreviewViewport.padding
  });

  return Object.freeze({
    levelId: preview.levelId,
    bounds,
    scale: transform.scale,
    wallShapes: Object.freeze(
      physicalShapes.map((shape) => ({
        id: shape.wallId,
        svgPoints: shape.points
          .map((point) => transform.worldToScreen(point))
          .map(
            (point) => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`
          )
          .join(" ")
      }))
    ),
    empty: false
  });
}

const isDrawableWall = (wall: ProjectPreview["walls"][number]): boolean =>
  wall.thickness > 0 &&
  [wall.start.x, wall.start.z, wall.end.x, wall.end.z, wall.thickness].every(
    Number.isFinite
  ) &&
  (wall.start.x !== wall.end.x || wall.start.z !== wall.end.z);
