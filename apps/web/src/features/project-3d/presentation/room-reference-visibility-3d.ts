import type { Object3D } from "three";

import type { RoomReferencePlan3D } from "../camera/room-reference-camera-3d";

/** Applies a temporary reference-only isolation mask and returns exact restoration. */
export function applyRoomReferenceVisibility3D(
  scene: Object3D,
  plan: RoomReferencePlan3D
): () => void {
  const previous = new Map<Object3D, boolean>();
  scene.traverse((object) => previous.set(object, object.visible));

  for (const object of previous.keys()) {
    if (
      object.name === "architectural-reference-ground" ||
      object.name === "architectural-reference-grid" ||
      object.type === "LineSegments"
    ) {
      object.visible = false;
    }
    if (object.name.startsWith("architectural-level:")) {
      object.visible =
        object.name === `architectural-level:${plan.target.levelId}`;
    } else if (object.name.startsWith("architectural-floor:")) {
      object.visible =
        object.name === `architectural-floor:${plan.target.roomId}`;
    } else if (object.name.startsWith("architectural-wall:")) {
      object.visible = plan.wallIds.some(
        (id) => object.name === `architectural-wall:${id}`
      );
    } else if (object.name.startsWith("architectural-staircase:")) {
      object.visible = plan.staircaseIds.some(
        (id) => object.name === `architectural-staircase:${id}`
      );
    } else if (object.name.startsWith("furniture:")) {
      object.visible = plan.furnitureIds.some(
        (id) => object.name === `furniture:${id}`
      );
    }
  }

  return () => {
    previous.forEach((visible, object) => {
      object.visible = visible;
    });
  };
}
