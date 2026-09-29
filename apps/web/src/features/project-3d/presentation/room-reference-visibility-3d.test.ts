import { Group, LineSegments, PerspectiveCamera, type Object3D } from "three";
import { describe, expect, it } from "vitest";

import type { RoomReferencePlan3D } from "../camera/room-reference-camera-3d";
import { applyRoomReferenceVisibility3D } from "./room-reference-visibility-3d";

describe("Room reference presentation isolation", () => {
  it("keeps target architecture and restores visibility and the user camera exactly", () => {
    const scene = new Group();
    const targetLevel = namedGroup("architectural-level:level-a");
    const otherLevel = namedGroup("architectural-level:level-b");
    otherLevel.visible = false;
    const targetFloor = namedGroup("architectural-floor:room-a");
    const otherFloor = namedGroup("architectural-floor:room-b");
    const targetWall = namedGroup("architectural-wall:wall-a");
    const opening = namedGroup("architectural-window:window-a");
    targetWall.add(opening);
    const relevantNonBoundaryWall = namedGroup("architectural-wall:wall-internal");
    const relevantDoor = namedGroup("architectural-door:door-internal");
    const relevantWindow = namedGroup("architectural-window:window-internal");
    const relevantWallOpening = namedGroup("architectural-wall-opening:opening-internal");
    relevantNonBoundaryWall.add(relevantDoor, relevantWindow, relevantWallOpening);
    const otherWall = namedGroup("architectural-wall:wall-b");
    const excludedOpening = namedGroup("architectural-window:window-b");
    otherWall.add(excludedOpening);
    const stair = namedGroup("architectural-staircase:stair-a");
    const otherStair = namedGroup("architectural-staircase:stair-b");
    const furniture = namedGroup("furniture:chair-a");
    const otherFurniture = namedGroup("furniture:chair-b");
    const outline = new LineSegments();
    targetFloor.add(outline);
    targetLevel.add(
      targetFloor,
      otherFloor,
      targetWall,
      relevantNonBoundaryWall,
      otherWall,
      stair,
      otherStair,
      furniture,
      otherFurniture
    );
    scene.add(targetLevel, otherLevel);
    const userCamera = new PerspectiveCamera();
    userCamera.position.set(17, 8, -4);
    scene.add(userCamera);
    const originalPosition = userCamera.position.clone();

    const restore = applyRoomReferenceVisibility3D(scene, createPlan());

    expect(targetLevel.visible).toBe(true);
    expect(otherLevel.visible).toBe(false);
    expect(targetFloor.visible).toBe(true);
    expect(otherFloor.visible).toBe(false);
    expect(targetWall.visible).toBe(true);
    expect(opening.visible).toBe(true);
    expect(relevantNonBoundaryWall.visible).toBe(true);
    expect(relevantDoor.visible).toBe(true);
    expect(relevantWindow.visible).toBe(true);
    expect(relevantWallOpening.visible).toBe(true);
    expect(otherWall.visible).toBe(false);
    expect(isEffectivelyVisible(excludedOpening)).toBe(false);
    expect(stair.visible).toBe(true);
    expect(otherStair.visible).toBe(false);
    expect(furniture.visible).toBe(true);
    expect(otherFurniture.visible).toBe(false);
    expect(outline.visible).toBe(false);
    expect(userCamera.position).toEqual(originalPosition);

    restore();

    expect(otherLevel.visible).toBe(false);
    expect(otherFloor.visible).toBe(true);
    expect(otherWall.visible).toBe(true);
    expect(excludedOpening.visible).toBe(true);
    expect(otherStair.visible).toBe(true);
    expect(otherFurniture.visible).toBe(true);
    expect(outline.visible).toBe(true);
    expect(userCamera.position).toEqual(originalPosition);
  });
});

function namedGroup(name: string): Group {
  const group = new Group();
  group.name = name;
  return group;
}

function isEffectivelyVisible(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function createPlan(): RoomReferencePlan3D {
  return {
    kind: "room-interior-a",
    target: {
      kind: "room",
      projectId: "project",
      levelId: "level-a",
      roomId: "room-a"
    },
    pose: {
      position: { x: 1, y: 1.5, z: 1 },
      target: { x: 0, y: 1, z: 0 },
      near: 0.1,
      far: 100
    },
    verticalFovDegrees: 58,
    bounds: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 2, y: 3, z: 2 },
      center: { x: 1, y: 1.5, z: 1 },
      size: { x: 2, y: 3, z: 2 }
    },
    wallIds: ["wall-a", "wall-internal"],
    staircaseIds: ["stair-a"],
    furnitureIds: ["chair-a"]
  };
}
