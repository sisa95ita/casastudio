import { LevelGeometry } from "@casastudio/geometry";

import type { GeometryLevel } from "../../../core/api/api-types";
import { collectGeometrySnapshotLevelBounds } from "../../geometry-2d/adapters/geometry-snapshot-presentation-adapter";
import { geometrySvgViewport } from "../../geometry-2d/viewer/GeometrySvgViewer";
import { collectLevelBounds } from "../../geometry-2d/viewport/geometry-svg-helpers";
import {
  createFitViewportState,
  resetViewportState,
  type ViewportState
} from "../../geometry-2d/viewport/viewport-transform-2d";

/** Creates the fitted initial viewport for a runtime or authoritative Geometry level. */
export const createInitialViewportState = (
  level: GeometryLevel | LevelGeometry | undefined
): ViewportState => {
  let bounds;
  try {
    bounds = level
      ? level instanceof LevelGeometry
        ? collectLevelBounds(level)
        : collectGeometrySnapshotLevelBounds(level)
      : undefined;
  } catch {
    return resetViewportState();
  }

  return bounds
    ? createFitViewportState({
        bounds,
        viewportWidth: geometrySvgViewport.width,
        viewportHeight: geometrySvgViewport.height,
        padding: geometrySvgViewport.padding
      })
    : resetViewportState();
};
