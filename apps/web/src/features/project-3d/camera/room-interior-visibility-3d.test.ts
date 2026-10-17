import { describe, expect, it } from "vitest";
import {
  analyzeFurnitureVisibility3D,
  createInteriorVisibilityScene3D,
  furnitureFacingSamples3D
} from "./room-interior-visibility-3d";
import {
  furnitureSolid3D,
  segmentHitsInteriorSolid3D,
  createInteriorOcclusionQuery3D,
  spreadInteriorPoints3D
} from "./room-interior-geometry-3d";
import {
  syntheticInteriorCandidate3D as camera,
  syntheticInteriorFloor3D as floor,
  syntheticInteriorItem3D as item,
  syntheticInteriorWall3D as wall
} from "./room-interior-test-fixtures-3d";

describe("Canonical interior visibility approximation", () => {
  const object = item("object", 3.5, 3);
  const viewpoint = camera(3.5, 0.4, 3.5, 3);
  it("recognizes meaningful surface coverage, not just a center in the frustum", () => {
    const scene = createInteriorVisibilityScene3D(floor(), [], [object]);
    const result = analyzeFurnitureVisibility3D(
      scene,
      object,
      camera(3.5, 0.4, 3.5, 3, 62, 1.7, 0.8),
      4 / 3
    );
    expect(result.coverage).toBeGreaterThan(0.9);
    expect(result.screenArea).toBeGreaterThan(0.015);
    expect(result.occluded).toBe(0);
    expect(result.clipping).toBe(0);
  });
  it("rejects an object outside the frustum", () => {
    const scene = createInteriorVisibilityScene3D(floor(), [], [object]);
    const result = analyzeFurnitureVisibility3D(
      scene,
      object,
      camera(3.5, 0.4, 0, 0.4),
      4 / 3
    );
    expect(result.coverage).toBe(0);
    expect(result.inFrame).toBe(0);
  });
  it("distinguishes full visibility from clipping at an image edge", () => {
    const scene = createInteriorVisibilityScene3D(floor(), [], [object]);
    const full = analyzeFurnitureVisibility3D(scene, object, viewpoint, 4 / 3);
    const partial = analyzeFurnitureVisibility3D(
      scene,
      object,
      camera(3.5, 0.4, 1.8, 3),
      4 / 3
    );
    expect(partial.coverage).toBeGreaterThan(0);
    expect(partial.coverage).toBeLessThan(full.coverage);
    expect(partial.clipping).toBeGreaterThan(full.clipping);
  });
  it("detects complete architecture occlusion, retaining the frustum evidence", () => {
    const blocker = wall("partition", { x: 1, z: 1.5 }, { x: 6, z: 1.5 });
    const scene = createInteriorVisibilityScene3D(floor(), [blocker], [object]);
    const result = analyzeFurnitureVisibility3D(
      scene,
      object,
      viewpoint,
      4 / 3
    );
    expect(result.inFrame).toBe(1);
    expect(result.coverage).toBe(0);
    expect(result.occluded).toBe(1);
  });
  it("respects resolved architectural voids instead of blocking a whole wall envelope", () => {
    const blocker = wall("opening", { x: 2.5, z: 1.5 }, { x: 5, z: 1.5 }, true);
    const scene = createInteriorVisibilityScene3D(floor(), [blocker], [object]);
    const result = analyzeFurnitureVisibility3D(
      scene,
      object,
      viewpoint,
      4 / 3
    );
    expect(result.coverage).toBeGreaterThan(0.9);
  });
  it("measures partial occlusion by another canonical furniture volume", () => {
    const blocker = item("foreground", 3.15, 1.8, 0.7, 0.6, 1.6);
    const scene = createInteriorVisibilityScene3D(
      floor(),
      [],
      [object, blocker]
    );
    const result = analyzeFurnitureVisibility3D(
      scene,
      object,
      viewpoint,
      4 / 3
    );
    expect(result.inFrame).toBe(1);
    expect(result.coverage).toBeGreaterThan(0);
    expect(result.coverage).toBeLessThan(0.9);
    expect(result.occluded).toBeGreaterThan(0);
  });
  it("does not reward furniture hidden behind a larger item", () => {
    const blocker = item("foreground", 3.5, 1.7, 2.2, 0.6, 2.3);
    const scene = createInteriorVisibilityScene3D(
      floor(),
      [],
      [object, blocker]
    );
    expect(
      analyzeFurnitureVisibility3D(scene, object, viewpoint, 4 / 3).coverage
    ).toBe(0);
  });
  it("uses rotated physical footprints and samples on real surfaces", () => {
    const rotated = item("rotated", 3, 3, 3, 0.4, 1, Math.PI / 4);
    const solid = furnitureSolid3D(rotated);
    expect(solid.contour[0]!.z).not.toBeCloseTo(rotated.bounds.min.z);
    // Inside the world AABB, but outside the slender rotated physical volume.
    expect(
      segmentHitsInteriorSolid3D(
        { x: 2, y: 0.5, z: 2 },
        { x: 2, y: 0.5, z: 2.1 },
        solid
      )
    ).toBe(false);
    expect(
      segmentHitsInteriorSolid3D(
        { x: 3, y: 0.5, z: 1 },
        { x: 3, y: 0.5, z: 5 },
        solid
      )
    ).toBe(true);
    const samples = furnitureFacingSamples3D(rotated, viewpoint.pose.position);
    expect(samples.length).toBeLessThanOrEqual(27);
    const c = Math.cos(rotated.yaw),
      s = Math.sin(rotated.yaw);
    for (const p of samples) {
      const x = (p.x - 3) * c - (p.z - 3) * s,
        z = (p.x - 3) * s + (p.z - 3) * c;
      expect(Math.abs(x)).toBeLessThanOrEqual(1.5 + 1e-9);
      expect(Math.abs(z)).toBeLessThanOrEqual(0.2 + 1e-9);
      expect(Math.abs(x) > 1.49 || Math.abs(z) > 0.19 || p.y === 1).toBe(true);
    }
  });
  it("downweights a distant projected speck even when its surface is in frame", () => {
    const tiny = item("tiny", 3.5, 3, 0.02, 0.02, 0.02);
    const scene = createInteriorVisibilityScene3D(floor(), [], [tiny]);
    const result = analyzeFurnitureVisibility3D(
      scene,
      tiny,
      camera(3.5, -10, 3.5, 3, 54, 1.7, 0.01),
      4 / 3
    );
    expect(result.inFrame).toBe(1);
    expect(result.coverage).toBeLessThan(0.01);
  });
  it("changes visibility when a slender footprint rotates at the same center", () => {
    const aligned = item("slender", 3.5, 3, 3, 0.4, 1);
    const rotated = { ...aligned, yaw: Math.PI / 2 };
    const candidate = camera(3.5, 0.4, 3.5, 3, 54, 1.7, 0.8);
    const measure = (f: typeof aligned) =>
      analyzeFurnitureVisibility3D(
        createInteriorVisibilityScene3D(floor(), [], [f]),
        f,
        candidate,
        4 / 3
      );
    const across = measure(aligned);
    const away = measure(rotated);
    expect(across.screenArea).toBeGreaterThan(away.screenArea);
    expect(across.clipping).not.toEqual(away.clipping);
    expect(across.coverage).not.toEqual(away.coverage);
  });
  it("spreads bounded seeds deterministically through concave geometry without changing the source", () => {
    const points = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 2 },
      { x: 3, z: 0 }
    ];
    const before = structuredClone(points);
    expect(spreadInteriorPoints3D(points, 3)).toEqual([
      points[0],
      points[3],
      points[2]
    ]);
    expect(spreadInteriorPoints3D([...points].reverse(), 3)).toEqual(
      spreadInteriorPoints3D(points, 3)
    );
    expect(spreadInteriorPoints3D(points, 0)).toEqual([]);
    expect(points).toEqual(before);
  });
  it("conservatively marks a ray blocked if its deterministic traversal budget is exhausted", () => {
    const solids = Array.from({ length: 20 }, (_, i) =>
      furnitureSolid3D(item(`item-${i}`, 3.5, 3 + i * 0.1))
    );
    expect(
      createInteriorOcclusionQuery3D(solids, 1)(viewpoint.pose.position, {
        x: 3.5,
        y: 0.5,
        z: 5
      })
    ).toBe(true);
  });
});
