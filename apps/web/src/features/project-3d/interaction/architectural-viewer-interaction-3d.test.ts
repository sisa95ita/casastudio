import { describe, expect, it } from "vitest";

import { getArchitecturalEntityKey3D } from "./architectural-selection-3d";
import {
  getArchitecturalEntityColor3D,
  getArchitecturalEntityPresentationState3D,
  getProject3DShortcutAction,
  hasPointerGestureExceededSelectionThreshold3D
} from "./architectural-viewer-interaction-3d";

describe("architectural 3D viewer interaction", () => {
  it("keeps hover and CasaStudio-blue selection visually distinct", () => {
    const wall = { kind: "wall" as const, id: "wall-a", levelId: "ground" };
    const key = getArchitecturalEntityKey3D(wall);

    expect(getArchitecturalEntityPresentationState3D(wall, "", key)).toBe("hovered");
    expect(getArchitecturalEntityPresentationState3D(wall, key, key)).toBe("selected");
    expect(getArchitecturalEntityColor3D("#d9c8b2", "hovered")).toBe("#e7b980");
    expect(getArchitecturalEntityColor3D("#d9c8b2", "selected")).toBe("#246caf");
  });

  it("does not treat an Orbit drag as a selection click", () => {
    const origin = { x: 100, y: 100 };

    expect(hasPointerGestureExceededSelectionThreshold3D(origin, { x: 104, y: 103 }))
      .toBe(false);
    expect(hasPointerGestureExceededSelectionThreshold3D(origin, { x: 106, y: 100 }))
      .toBe(true);
    expect(hasPointerGestureExceededSelectionThreshold3D(origin, { x: 190, y: 65 }))
      .toBe(true);
  });

  it.each([
    ["f", "fit"],
    ["F", "fit"],
    ["r", "reset"],
    ["R", "reset"],
    ["Escape", "clear-selection"]
  ] as const)("maps %s to %s", (key, action) => {
    expect(getProject3DShortcutAction({
      key,
      altKey: false,
      ctrlKey: false,
      metaKey: false
    })).toBe(action);
  });

  it("does not claim modified shortcuts", () => {
    expect(getProject3DShortcutAction({
      key: "f",
      altKey: false,
      ctrlKey: true,
      metaKey: false
    })).toBeUndefined();
  });
});
