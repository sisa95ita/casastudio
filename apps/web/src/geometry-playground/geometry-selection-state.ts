/**
 * Runtime entity kinds that can be selected in the Geometry Playground.
 */
export type GeometrySelectionKind = "POLYGON" | "BOUNDARY_EDGE" | "VERTEX";

/**
 * UI-only selection reference for immutable runtime geometry.
 *
 * The selection stores runtime geometry identifiers only. It deliberately does
 * not contain source project objects, editor commands, or mutation payloads.
 */
export type GeometrySelection = {
  readonly kind: GeometrySelectionKind;
  readonly geometryId: string;
};

/**
 * UI-only hover reference for immutable runtime geometry.
 */
export type GeometryHoverState = GeometrySelection | undefined;

/**
 * Creates a polygon selection reference.
 */
export const selectPolygon = (geometryId: string): GeometrySelection => ({
  kind: "POLYGON",
  geometryId
});

/**
 * Creates a boundary-edge selection reference.
 */
export const selectBoundaryEdge = (geometryId: string): GeometrySelection => ({
  kind: "BOUNDARY_EDGE",
  geometryId
});

/**
 * Creates a vertex selection reference.
 */
export const selectVertex = (geometryId: string): GeometrySelection => ({
  kind: "VERTEX",
  geometryId
});

/**
 * Clears the current geometry selection.
 */
export const clearGeometrySelection = (): undefined => undefined;

/**
 * Checks whether a UI selection points at the requested runtime entity.
 */
export const isGeometrySelectionMatch = (
  selection: GeometrySelection | undefined,
  kind: GeometrySelectionKind,
  geometryId: string
): boolean => selection?.kind === kind && selection.geometryId === geometryId;
