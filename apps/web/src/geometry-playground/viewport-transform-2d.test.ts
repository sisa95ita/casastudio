import { describe, expect, it } from "vitest";

import { createFitToViewTransform, ViewportTransform2D } from "./viewport-transform-2d";

describe("ViewportTransform2D", () => {
  it("maps world X to screen X", () => {
    const transform = new ViewportTransform2D({ scale: 2, offsetX: 10, offsetY: 90 });

    expect(transform.worldToScreen({ x: 5, z: 0 }).x).toBe(20);
  });

  it("maps increasing world Z upward through SVG Y-axis inversion", () => {
    const transform = new ViewportTransform2D({ scale: 2, offsetX: 0, offsetY: 100 });

    expect(transform.worldToScreen({ x: 0, z: 40 }).y).toBeLessThan(
      transform.worldToScreen({ x: 0, z: 10 }).y
    );
  });

  it("fits bounds with uniform aspect-preserving scale and padding", () => {
    const transform = createFitToViewTransform({
      bounds: { minX: 0, minZ: 0, maxX: 600, maxZ: 300 },
      viewportWidth: 800,
      viewportHeight: 500,
      padding: 50
    });

    expect(transform.scaleLength(1)).toBeCloseTo(700 / 600);
    expect(transform.worldToScreen({ x: 0, z: 0 }).x).toBeCloseTo(50);
    expect(transform.worldToScreen({ x: 600, z: 300 }).x).toBeCloseTo(750);
    expect(transform.worldToScreen({ x: 0, z: 300 }).y).toBeGreaterThanOrEqual(50);
    expect(transform.worldToScreen({ x: 0, z: 0 }).y).toBeLessThanOrEqual(450);
  });

  it("does not produce invalid values for zero-width or zero-height bounds", () => {
    const verticalLine = createFitToViewTransform({
      bounds: { minX: 10, minZ: 0, maxX: 10, maxZ: 300 },
      viewportWidth: 800,
      viewportHeight: 500,
      padding: 40
    });
    const horizontalLine = createFitToViewTransform({
      bounds: { minX: 0, minZ: 20, maxX: 300, maxZ: 20 },
      viewportWidth: 800,
      viewportHeight: 500,
      padding: 40
    });

    [verticalLine, horizontalLine].forEach((transform) => {
      const point = transform.worldToScreen({ x: 10, z: 20 });
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(Number.isFinite(transform.scaleLength(1))).toBe(true);
    });
  });

  it("is deterministic for identical input", () => {
    const input = {
      bounds: { minX: -20, minZ: 10, maxX: 180, maxZ: 210 },
      viewportWidth: 640,
      viewportHeight: 480,
      padding: 32
    };

    expect(createFitToViewTransform(input)).toEqual(createFitToViewTransform(input));
  });
});
