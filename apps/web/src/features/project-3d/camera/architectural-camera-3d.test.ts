import { describe, expect, it } from "vitest";

import {
  createArchitecturalCameraPose3D,
  createArchitecturalOrbitLimits3D,
  createArchitecturalScreenParityLandmarks3D,
  projectScenePointToArchitecturalScreen3D
} from "./architectural-camera-3d";
import { projectPointToThree } from "../model/architectural-scene-3d-model";

describe("architectural 3D camera", () => {
  it("creates a finite deterministic oblique pose for empty scenes", () => {
    const first = createArchitecturalCameraPose3D(undefined, 16 / 9);
    const second = createArchitecturalCameraPose3D(undefined, 16 / 9);

    expect(first).toEqual(second);
    expect(first.position.x).toBeGreaterThan(first.target.x);
    expect(first.position.y).toBeGreaterThan(first.target.y);
    expect(first.position.z).toBeGreaterThan(first.target.z);
    expect(first.near).toBeGreaterThan(0);
    expect(first.far).toBeGreaterThanOrEqual(100);
  });

  it.each([
    ["small", { min: { x: 0, y: 0, z: 0 }, max: { x: 0.4, y: 0.3, z: 0.5 }, center: { x: 0.2, y: 0.15, z: 0.25 }, size: { x: 0.4, y: 0.3, z: 0.5 } }],
    ["wide with Furniture", { min: { x: -25, y: -0.18, z: -3 }, max: { x: 42, y: 3, z: 5 }, center: { x: 8.5, y: 1.41, z: 1 }, size: { x: 67, y: 3.18, z: 8 } }],
    ["tall with elevated Room and Stair", { min: { x: -4, y: -0.18, z: -5 }, max: { x: 7, y: 22, z: 8 }, center: { x: 1.5, y: 10.91, z: 1.5 }, size: { x: 11, y: 22.18, z: 13 } }]
  ] as const)("frames finite %s bounds with practical clipping", (_name, bounds) => {
    const pose = createArchitecturalCameraPose3D(bounds, 16 / 9);
    const limits = createArchitecturalOrbitLimits3D(bounds);

    expect(Object.values(pose.position).every(Number.isFinite)).toBe(true);
    expect(Object.values(pose.target).every(Number.isFinite)).toBe(true);
    expect(pose.target).toEqual(bounds.center);
    expect(pose.near).toBeGreaterThan(0);
    expect(pose.far).toBeGreaterThan(pose.near);
    expect(limits.minDistance).toBeGreaterThan(0);
    expect(limits.maxDistance).toBeGreaterThan(limits.minDistance);
  });

  it("matches the authoritative 2D screen ordering for asymmetric landmarks", () => {
    const bounds = {
      min: { x: -3, y: 0, z: -5 },
      max: { x: 4, y: 0, z: 2 },
      center: { x: 0.5, y: 0, z: -1.5 },
      size: { x: 7, y: 0, z: 7 }
    } as const;
    const pose = createArchitecturalCameraPose3D(bounds, 16 / 9);
    const landmarks = {
      leftIrregularFacade: projectPointToThree({ x: -300, z: 100 }, 0, "cm"),
      rightRoomSequence: projectPointToThree({ x: 400, z: 100 }, 0, "cm"),
      topRoom: projectPointToThree({ x: 50, z: 500 }, 0, "cm"),
      bottomEntrance: projectPointToThree({ x: 50, z: -200 }, 0, "cm")
    };
    const projected = Object.fromEntries(
      Object.entries(landmarks).map(([name, point]) => [
        name,
        projectScenePointToArchitecturalScreen3D(point, pose, 16 / 9)
      ])
    );

    expect(projected.leftIrregularFacade!.x)
      .toBeLessThan(projected.rightRoomSequence!.x);
    expect(projected.topRoom!.y).toBeLessThan(projected.bottomEntrance!.y);
    expect(projected.leftIrregularFacade!.x).toBeLessThan(0);
    expect(projected.rightRoomSequence!.x).toBeGreaterThan(0);
  });

  it("derives semantic bounds landmarks with the same screen-space parity", () => {
    const bounds = {
      min: { x: -2, y: 0, z: -6 },
      max: { x: 5, y: 3.2, z: 1 },
      center: { x: 1.5, y: 1.6, z: -2.5 },
      size: { x: 7, y: 3.2, z: 7 }
    } as const;
    const pose = createArchitecturalCameraPose3D(bounds, 4 / 3);
    const landmarks = createArchitecturalScreenParityLandmarks3D(bounds);
    const screen = Object.fromEntries(
      Object.entries(landmarks).map(([name, point]) => [
        name,
        projectScenePointToArchitecturalScreen3D(point, pose, 4 / 3)!
      ])
    );

    expect(screen.left!.x).toBeLessThan(screen.right!.x);
    expect(screen.top!.y).toBeLessThan(screen.bottom!.y);
  });
});
