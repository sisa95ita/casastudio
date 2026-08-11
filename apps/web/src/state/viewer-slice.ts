import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  type GeometrySelection,
  type GeometrySelectionState
} from "../geometry-playground/geometry-selection-state";
import type { RootState } from "./store";

/** Local application state shared by the geometry viewer and shell inspector. */
export type ViewerState = {
  readonly geometrySelection: {
    readonly selected: readonly GeometrySelection[];
    readonly hovered?: GeometrySelection;
  };
};

/** Initial serializable viewer state. */
export const initialViewerState: ViewerState = {
  geometrySelection: { selected: [] }
};

const viewerSlice = createSlice({
  name: "viewer",
  initialState: initialViewerState,
  reducers: {
    geometrySelectionChanged(state, action: PayloadAction<GeometrySelectionState>) {
      state.geometrySelection.selected = action.payload.selected.map((item) => ({ ...item }));
      state.geometrySelection.hovered = action.payload.hovered
        ? { ...action.payload.hovered }
        : undefined;
    },
    geometrySelectionCleared(state) {
      state.geometrySelection = {
        selected: [],
        hovered: state.geometrySelection.hovered
          ? { ...state.geometrySelection.hovered }
          : undefined
      };
    },
    geometrySelectionReset(state) {
      state.geometrySelection.selected = [];
      state.geometrySelection.hovered = undefined;
    }
  }
});

/** Focused actions for local geometry viewer selection state. */
export const {
  geometrySelectionChanged,
  geometrySelectionCleared,
  geometrySelectionReset
} = viewerSlice.actions;

/** Reducer for local geometry viewer application state. */
export const viewerReducer = viewerSlice.reducer;

/** Selects the current geometry entity selection without storing derived geometry. */
export const selectGeometrySelection = (state: RootState): GeometrySelectionState =>
  state.viewer.geometrySelection;
