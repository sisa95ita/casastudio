import { describe, expect, it } from "vitest";

import { selectPolygon } from "../geometry-playground/geometry-selection-state";
import { createAppStore } from "./store";
import {
  geometrySelectionChanged,
  geometrySelectionCleared,
  selectGeometrySelection
} from "./viewer-slice";

describe("Redux application state", () => {
  it("creates the typed store with the real viewer slice", () => {
    const store = createAppStore();

    expect(store.getState()).toEqual({
      viewer: { geometrySelection: { selected: [], hovered: undefined } }
    });
  });

  it("selects and updates serializable viewer selection without domain objects", () => {
    const store = createAppStore();
    const selected = selectPolygon("polygon-one");

    store.dispatch(
      geometrySelectionChanged({
        selected: [selected],
        hovered: selected
      })
    );
    expect(selectGeometrySelection(store.getState())).toEqual({
      selected: [selected],
      hovered: selected
    });

    store.dispatch(geometrySelectionCleared());
    expect(selectGeometrySelection(store.getState())).toEqual({
      selected: [],
      hovered: selected
    });
  });
});
