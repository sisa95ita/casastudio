import { describe, expect, it } from "vitest";

import {
  clearGeometrySelection,
  isGeometrySelectionMatch,
  selectBoundaryEdge,
  selectPolygon,
  selectVertex
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
    expect(clearGeometrySelection()).toBeUndefined();
  });

  it("matches selections only by kind and runtime geometry id", () => {
    const selection = selectBoundaryEdge("boundary-edge:shared-wall");

    expect(isGeometrySelectionMatch(selection, "BOUNDARY_EDGE", "boundary-edge:shared-wall")).toBe(
      true
    );
    expect(isGeometrySelectionMatch(selection, "POLYGON", "boundary-edge:shared-wall")).toBe(false);
    expect(isGeometrySelectionMatch(selection, "BOUNDARY_EDGE", "boundary-edge:other")).toBe(false);
  });
});
