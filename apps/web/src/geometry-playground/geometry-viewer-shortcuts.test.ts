import { describe, expect, it } from "vitest";

import {
  geometryEditorShortcuts,
  getGeometryViewerShortcutAction,
  isEditableShortcutTarget
} from "./geometry-viewer-shortcuts";

describe("geometry viewer shortcuts", () => {
  it("maps supported keys to viewer actions", () => {
    expect(
      getGeometryViewerShortcutAction({
        key: "Escape",
        altKey: false,
        ctrlKey: false,
        metaKey: false
      })
    ).toBe("CLEAR_SELECTION");
    expect(
      getGeometryViewerShortcutAction({
        key: "f",
        altKey: false,
        ctrlKey: false,
        metaKey: false
      })
    ).toBe("FIT_VIEWPORT");
    expect(
      getGeometryViewerShortcutAction({
        key: "R",
        altKey: false,
        ctrlKey: false,
        metaKey: false
      })
    ).toBe("RESET_VIEWPORT");
    expect(
      getGeometryViewerShortcutAction({
        key: "Delete",
        altKey: false,
        ctrlKey: false,
        metaKey: false
      })
    ).toBe("DELETE_SELECTION");
    expect(
      getGeometryViewerShortcutAction({
        key: "Backspace",
        altKey: false,
        ctrlKey: false,
        metaKey: false
      })
    ).toBe("DELETE_SELECTION");
  });

  it("ignores modified shortcuts and editable targets", () => {
    const input = document.createElement("input");

    expect(
      getGeometryViewerShortcutAction({
        key: "f",
        altKey: false,
        ctrlKey: true,
        metaKey: false
      })
    ).toBeUndefined();
    expect(
      getGeometryViewerShortcutAction({
        key: "f",
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        target: input
      })
    ).toBeUndefined();
  });

  it("documents temporary pan and both Redo bindings without duplicate actions", () => {
    expect(
      geometryEditorShortcuts.filter((shortcut) => shortcut.translationKey === "shortcuts.redo")
    ).toEqual([
      expect.objectContaining({
        action: "REDO",
        key: "Ctrl/Cmd + Shift + Z · Ctrl/Cmd + Y"
      })
    ]);
    expect(geometryEditorShortcuts).toContainEqual(
      expect.objectContaining({
        action: "TEMPORARY_PAN",
        key: "Space + drag",
        translationKey: "shortcuts.panViewport"
      })
    );
  });

  it("recognizes editable descendants of MUI and semantic text controls", () => {
    const muiControl = document.createElement("div");
    muiControl.className = "MuiInputBase-root";
    const descendant = document.createElement("span");
    muiControl.append(descendant);
    document.body.append(muiControl);

    expect(isEditableShortcutTarget(descendant)).toBe(true);
    muiControl.remove();
  });
});
