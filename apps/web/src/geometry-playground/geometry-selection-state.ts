/**
 * Geometry entity kinds supported by the interactive viewer.
 */
export type GeometrySelectionKind = "POLYGON" | "BOUNDARY_EDGE" | "VERTEX";

/**
 * UI-only selection reference for immutable presented geometry.
 *
 * The selection stores geometry identifiers only. It deliberately does
 * not contain source project objects, editor commands, or mutation payloads.
 */
export type GeometrySelection = {
  readonly kind: GeometrySelectionKind;
  readonly geometryId: string;
};

/**
 * UI-only interaction state for immutable presented geometry.
 *
 * Selected and hovered entities are deliberately separate so click selection,
 * hover previews, and command handling can compose without duplicating server
 * or runtime geometry data.
 */
export type GeometrySelectionState = {
  readonly selected: readonly GeometrySelection[];
  readonly hovered?: GeometrySelection;
};

/**
 * UI-only hover reference for immutable presented geometry.
 */
export type GeometryHoverState = GeometrySelectionState["hovered"];

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
 * Creates a frozen UI selection state from geometry ID references.
 */
export const createGeometrySelectionState = (
  selected: readonly GeometrySelection[] = [],
  hovered?: GeometrySelection
): GeometrySelectionState =>
  Object.freeze({
    selected: Object.freeze([...selected]),
    hovered
  });

/**
 * Clears selected entities while preserving the current hover reference.
 */
export const clearGeometrySelection = (
  state: GeometrySelectionState = createGeometrySelectionState()
): GeometrySelectionState => createGeometrySelectionState([], state.hovered);

/**
 * Clears the hover reference while preserving selected entities.
 */
export const clearGeometryHover = (
  state: GeometrySelectionState = createGeometrySelectionState()
): GeometrySelectionState => createGeometrySelectionState(state.selected);

/**
 * Replaces the selected set with a single geometry reference.
 */
export const replaceGeometrySelection = (
  selection: GeometrySelection
): GeometrySelectionState => createGeometrySelectionState([selection]);

/**
 * Sets the hover reference while leaving the selected set unchanged.
 */
export const setGeometryHover = (
  state: GeometrySelectionState,
  hovered: GeometryHoverState
): GeometrySelectionState =>
  createGeometrySelectionState(state.selected, hovered);

/**
 * Adds or removes a geometry reference from the selected set.
 */
export const toggleGeometrySelection = (
  state: GeometrySelectionState,
  selection: GeometrySelection
): GeometrySelectionState => {
  const isSelected = isGeometrySelectionMatch(
    state.selected,
    selection.kind,
    selection.geometryId
  );

  if (isSelected) {
    return createGeometrySelectionState(
      state.selected.filter(
        (item) => !isSameGeometrySelection(item, selection)
      ),
      state.hovered
    );
  }

  return createGeometrySelectionState(
    [...state.selected, selection],
    state.hovered
  );
};

/**
 * Applies viewer click selection semantics.
 *
 * Plain clicks replace the current selected set, except that clicking an
 * already-selected entity removes it. Additive clicks toggle one entity,
 * which currently maps to Shift-click in the SVG viewer.
 */
export const applyGeometrySelectionClick = (
  state: GeometrySelectionState,
  selection: GeometrySelection,
  additive: boolean
): GeometrySelectionState =>
  additive ||
  isGeometrySelectionMatch(state.selected, selection.kind, selection.geometryId)
    ? toggleGeometrySelection(state, selection)
    : createGeometrySelectionState([selection], state.hovered);

/**
 * Checks whether a UI selection points at the requested runtime entity.
 */
export const isGeometrySelectionMatch = (
  selection: GeometrySelection | readonly GeometrySelection[] | undefined,
  kind: GeometrySelectionKind,
  geometryId: string
): boolean =>
  selection
    ? "kind" in selection
      ? selection.kind === kind && selection.geometryId === geometryId
      : selection.some((item) =>
          isGeometrySelectionMatch(item, kind, geometryId)
        )
    : false;

const isSameGeometrySelection = (
  first: GeometrySelection,
  second: GeometrySelection
): boolean =>
  first.kind === second.kind && first.geometryId === second.geometryId;
