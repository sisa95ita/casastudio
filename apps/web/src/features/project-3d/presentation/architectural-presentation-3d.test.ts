import { describe, expect, it } from "vitest";

import {
  architecturalPresentationProfile3D,
  createArchitecturalKeyLight3D
} from "./architectural-presentation-3d";

describe("architectural 3D presentation", () => {
  it("keeps a finite immutable material and lighting profile", () => {
    const profile = architecturalPresentationProfile3D;

    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.materials)).toBe(true);
    expect(Object.values(profile.materials).every(Object.isFrozen)).toBe(true);
    for (const surface of Object.values(profile.materials)) {
      expect(surface.roughness).toBeGreaterThanOrEqual(0);
      expect(surface.roughness).toBeLessThanOrEqual(1);
      expect(surface.metalness).toBeGreaterThanOrEqual(0);
      expect(surface.metalness).toBeLessThanOrEqual(1);
      expect(surface.opacity ?? 1).toBeGreaterThan(0);
      expect(surface.opacity ?? 1).toBeLessThanOrEqual(1);
      expect(Object.values(surface).every((value) =>
        typeof value === "string" || Number.isFinite(value)
      )).toBe(true);
    }
    expect(profile.materials.wall.color).not.toBe(profile.materials.floorTop.color);
    expect(profile.materials.floorTop.color).not.toBe(profile.materials.floorEdge.color);
    expect(profile.materials.stairWalking.color).not.toBe(profile.materials.stairStructure.color);
    expect(profile.interaction.hover).not.toBe(profile.interaction.selected);
  });

  it("derives a finite scale-aware key light and shadow frustum", () => {
    const light = createArchitecturalKeyLight3D({
      min: { x: -40, y: -0.2, z: -6 },
      max: { x: 70, y: 18, z: 12 },
      center: { x: 15, y: 8.9, z: 3 },
      size: { x: 110, y: 18.2, z: 18 }
    });

    expect(Object.values(light.position).every(Number.isFinite)).toBe(true);
    expect(light.position.y).toBeGreaterThan(light.target.y);
    expect(light.shadowExtent).toBeGreaterThan(110);
    expect(light.shadowNear).toBeGreaterThan(0);
    expect(light.shadowFar).toBeGreaterThan(light.shadowNear);
  });
});
