import { describe, expect, it } from "vitest";

import {
  applyGeometrySelectionClick,
  clearGeometryHover,
  clearGeometrySelection,
  createGeometrySelectionState,
  isGeometrySelectionMatch,
  replaceGeometrySelection,
  selectBoundaryEdge,
  selectPolygon,
  selectVertex,
  setGeometryHover,
  toggleGeometrySelection
} from "./geometry-selection-state";

describe("geometry selection state", () => {
  it("selects a polygon by runtime geometry id", () => {
    expect(selectPolygon("polygon:left-room")).toEqual({
      kind: "POLYGON",
      geometryId: "polygon:left-room"
    });
  });

  it("selects a boundary edge by runtime geometry id", () => {
    expect(selectBoundaryEdge("boundary-edge:shared-wall")).toEqual({
      kind: "BOUNDARY_EDGE",
      geometryId: "boundary-edge:shared-wall"
    });
  });

  it("selects a vertex by runtime geometry id", () => {
    expect(selectVertex("vertex:0:0")).toEqual({
      kind: "VERTEX",
      geometryId: "vertex:0:0"
    });
  });

  it("clears selection", () => {
    const hover = selectVertex("vertex:0:0");
    const state = createGeometrySelectionState(
      [selectPolygon("polygon:left-room")],
      hover
    );

    expect(clearGeometrySelection(state)).toEqual({
      selected: [],
      hovered: hover
    });
  });

  it("tracks hover independently from selected geometry", () => {
    const selected = selectPolygon("polygon:left-room");
    const hovered = selectVertex("vertex:0:0");
    const state = setGeometryHover(
      createGeometrySelectionState([selected]),
      hovered
    );

    expect(state.selected).toEqual([selected]);
    expect(state.hovered).toEqual(hovered);
    expect(clearGeometryHover(state)).toEqual({
      selected: [selected],
      hovered: undefined
    });
  });

  it("replaces selection for ordinary clicks", () => {
    const state = createGeometrySelectionState([
      selectPolygon("polygon:left-room")
    ]);
    const nextSelection = selectBoundaryEdge("boundary-edge:shared-wall");

    expect(applyGeometrySelectionClick(state, nextSelection, false)).toEqual({
      selected: [nextSelection],
      hovered: undefined
    });
    expect(replaceGeometrySelection(nextSelection)).toEqual({
      selected: [nextSelection],
      hovered: undefined
    });
  });

  it("deselects an already-selected entity on an ordinary click", () => {
    const polygon = selectPolygon("polygon:left-room");
    const state = createGeometrySelectionState([polygon]);

    expect(applyGeometrySelectionClick(state, polygon, false)).toEqual({
      selected: [],
      hovered: undefined
    });
  });

  it("adds and removes selections for additive clicks", () => {
    const polygon = selectPolygon("polygon:left-room");
    const edge = selectBoundaryEdge("boundary-edge:shared-wall");
    const selectedState = createGeometrySelectionState([polygon]);
    const addedState = toggleGeometrySelection(selectedState, edge);

    expect(addedState.selected).toEqual([polygon, edge]);
    expect(toggleGeometrySelection(addedState, polygon).selected).toEqual([
      edge
    ]);
  });

  it("uses shift-click semantics to toggle multi-selection", () => {
    const polygon = selectPolygon("polygon:left-room");
    const edge = selectBoundaryEdge("boundary-edge:shared-wall");
    const state = createGeometrySelectionState([polygon]);

    expect(applyGeometrySelectionClick(state, edge, true).selected).toEqual([
      polygon,
      edge
    ]);
    expect(applyGeometrySelectionClick(state, polygon, true).selected).toEqual(
      []
    );
  });

  it("matches selections only by kind and runtime geometry id", () => {
    const selection = selectBoundaryEdge("boundary-edge:shared-wall");
    const selectionState = createGeometrySelectionState([selection]);

    expect(
      isGeometrySelectionMatch(
        selection,
        "BOUNDARY_EDGE",
        "boundary-edge:shared-wall"
      )
    ).toBe(true);
    expect(
      isGeometrySelectionMatch(
        selectionState.selected,
        "BOUNDARY_EDGE",
        "boundary-edge:shared-wall"
      )
    ).toBe(true);
    expect(
      isGeometrySelectionMatch(
        selection,
        "POLYGON",
        "boundary-edge:shared-wall"
      )
    ).toBe(false);
    expect(
      isGeometrySelectionMatch(
        selection,
        "BOUNDARY_EDGE",
        "boundary-edge:other"
      )
    ).toBe(false);
  });
});
