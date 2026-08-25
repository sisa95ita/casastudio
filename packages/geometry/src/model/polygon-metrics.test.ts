import { describe, expect, it } from "vitest";

import { calculatePolygonInteriorAnchor } from "./polygon-metrics.js";

describe("polygon interior label anchor", () => {
  it("keeps a concave Room label inside real polygon geometry", () => {
    const vertices = [
      vertex(0, 0),
      vertex(120, 0),
      vertex(120, 30),
      vertex(30, 30),
      vertex(30, 120),
      vertex(0, 120)
    ];

    const anchor = calculatePolygonInteriorAnchor(vertices);

    expect(anchor).toBeDefined();
    expect(anchor!.x).toBeGreaterThan(0);
    expect(anchor!.z).toBeGreaterThan(0);
    expect(anchor!.x < 30 || anchor!.z < 30).toBe(true);
  });
});

function vertex(x: number, z: number) {
  return { x, z };
}
