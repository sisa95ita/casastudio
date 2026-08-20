import { describe, expect, it } from "vitest";

import { getGeometryViewerShortcutAction } from "./geometry-viewer-shortcuts";

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
});
