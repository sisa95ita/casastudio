import { describe, expect, it } from "vitest";

import {
  createArchitecturalCameraPose3D,
  createArchitecturalScreenParityLandmarks3D,
  projectScenePointToArchitecturalScreen3D
} from "./architectural-camera-3d";
import { projectPointToThree } from "./architectural-scene-3d-model";

describe("architectural 3D camera", () => {
  it("creates a finite deterministic oblique pose for empty scenes", () => {
    const first = createArchitecturalCameraPose3D(undefined, 16 / 9);
    const second = createArchitecturalCameraPose3D(undefined, 16 / 9);

    expect(first).toEqual(second);
    expect(first.position.x).toBe(first.target.x);
    expect(first.position.y).toBeGreaterThan(first.target.y);
    expect(first.position.z).toBeGreaterThan(first.target.z);
    expect(first.near).toBeGreaterThan(0);
    expect(first.far).toBeGreaterThanOrEqual(100);
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
