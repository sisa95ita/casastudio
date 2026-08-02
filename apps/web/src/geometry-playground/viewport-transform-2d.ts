import type { BoundingBox } from "@casastudio/geometry";

/**
 * Screen-space point in the SVG viewport coordinate system.
 *
 * SVG uses `x` to the right and `y` downward. CasaStudio runtime plan geometry
 * is level-local XZ data, so callers should obtain these points through the
 * shared viewport transform rather than duplicating projection math.
 */
export type ScreenPoint = {
  readonly x: number;
  readonly y: number;
};

/**
 * Level-local runtime point on CasaStudio's XZ blueprint plane.
 */
export type WorldPointXZ = {
  readonly x: number;
  readonly z: number;
};

/**
 * Immutable numeric parameters for projecting XZ geometry into SVG space.
 */
export type ViewportTransform2DParameters = {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
};

/**
 * Inputs used to fit a world-space XZ bounding box into a fixed SVG viewport.
 */
export type FitToViewTransformOptions = {
  readonly bounds: BoundingBox;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly padding: number;
};

/**
 * Projects immutable level-local XZ geometry into an SVG viewport.
 *
 * The mapping is intentionally small and renderer-adjacent rather than a full
 * editor view model: world `X` maps to screen `X`, world `Z` maps to screen
 * `Y`, and the `Z` axis is inverted because SVG's vertical axis increases
 * downward while the runtime XZ plane uses mathematical polygon orientation.
 */
export class ViewportTransform2D {
  /**
   * Uniform world-to-screen scale used for both X and Z dimensions.
   */
  readonly scale: number;
  /**
   * Screen-space X translation applied after scaling world X.
   */
  readonly offsetX: number;
  /**
   * Screen-space Y translation applied after scaling and inverting world Z.
   */
  readonly offsetY: number;

  /**
   * Creates an immutable transform from precomputed fit-to-view parameters.
   */
  constructor(parameters: ViewportTransform2DParameters) {
    this.scale = parameters.scale;
    this.offsetX = parameters.offsetX;
    this.offsetY = parameters.offsetY;
    Object.freeze(this);
  }

  /**
   * Converts a level-local XZ point into an SVG XY point without mutating the
   * runtime vertex or centroid that supplied it.
   */
  worldToScreen(point: WorldPointXZ): ScreenPoint {
    return {
      x: point.x * this.scale + this.offsetX,
      y: -point.z * this.scale + this.offsetY
    };
  }

  /**
   * Scales a world-space length with the same uniform factor used for points.
   */
  scaleLength(length: number): number {
    return length * this.scale;
  }
}

/**
 * Builds a uniform fit-to-view transform for one level's diagnostic SVG.
 *
 * The algorithm preserves aspect ratio, applies padding on every side when the
 * viewport allows it, and guards zero-width or zero-height bounds by fitting a
 * one-unit span for scale calculation while still centering the actual geometry.
 */
export const createFitToViewTransform = ({
  bounds,
  viewportWidth,
  viewportHeight,
  padding
}: FitToViewTransformOptions): ViewportTransform2D => {
  const safeViewportWidth = Math.max(1, viewportWidth);
  const safeViewportHeight = Math.max(1, viewportHeight);
  const safePadding = Math.max(
    0,
    Math.min(padding, safeViewportWidth / 2 - 0.5, safeViewportHeight / 2 - 0.5)
  );
  const rawWidth = Math.max(0, bounds.maxX - bounds.minX);
  const rawHeight = Math.max(0, bounds.maxZ - bounds.minZ);
  const fitWidth = Math.max(1, rawWidth);
  const fitHeight = Math.max(1, rawHeight);
  const availableWidth = Math.max(1, safeViewportWidth - safePadding * 2);
  const availableHeight = Math.max(1, safeViewportHeight - safePadding * 2);
  const scale = Math.min(availableWidth / fitWidth, availableHeight / fitHeight);
  const contentWidth = rawWidth * scale;
  const contentHeight = rawHeight * scale;
  const left = (safeViewportWidth - contentWidth) / 2;
  const top = (safeViewportHeight - contentHeight) / 2;

  return new ViewportTransform2D({
    scale,
    offsetX: left - bounds.minX * scale,
    offsetY: top + bounds.maxZ * scale
  });
};
