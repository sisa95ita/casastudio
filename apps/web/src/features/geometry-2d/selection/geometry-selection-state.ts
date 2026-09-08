/**
 * Geometry entity kinds supported by the interactive viewer.
 */
export type GeometrySelectionKind =
  | "FURNITURE"
  | "POLYGON"
  | "BOUNDARY_EDGE"
  | "VERTEX"
  | "WALL"
  | "DOOR"
  | "WINDOW"
  | "OPENING"
  | "STAIRCASE"
  | "STAIR_FLIGHT"
  | "STAIR_LANDING";

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

/** Creates a canonical physical Wall selection reference. */
export const selectWall = (geometryId: string): GeometrySelection => ({
  kind: "WALL",
  geometryId
});

/** Creates a Door selection reference. */
export const selectDoor = (geometryId: string): GeometrySelection => ({
  kind: "DOOR",
  geometryId
});

/** Creates a Window selection reference. */
export const selectWindow = (geometryId: string): GeometrySelection => ({
  kind: "WINDOW",
  geometryId
});

/** Creates a generic Wall Opening selection reference. */
export const selectWallOpening = (geometryId: string): GeometrySelection => ({
  kind: "OPENING",
  geometryId
});

/** Creates a root Staircase selection reference. */
export const selectStaircase = (geometryId: string): GeometrySelection => ({
  kind: "STAIRCASE",
  geometryId
});

/** Creates an owned StairFlight selection reference. */
export const selectStairFlight = (geometryId: string): GeometrySelection => ({
  kind: "STAIR_FLIGHT",
  geometryId
});

/** Creates an owned StairLanding selection reference. */
export const selectStairLanding = (geometryId: string): GeometrySelection => ({
  kind: "STAIR_LANDING",
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
    selected: Object.freeze(dedupeGeometrySelections(selected)),
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
 * Plain clicks replace the current selected set. Modifier clicks toggle one
 * entity while retaining the deterministic order of every other selection.
 */
export const applyGeometrySelectionClick = (
  state: GeometrySelectionState,
  selection: GeometrySelection,
  additive: boolean
): GeometrySelectionState =>
  additive
    ? toggleGeometrySelection(state, selection)
    : createGeometrySelectionState([selection], state.hovered);

/** Adds selections in candidate order without removing existing members. */
export const unionGeometrySelection = (
  state: GeometrySelectionState,
  selections: readonly GeometrySelection[]
): GeometrySelectionState =>
  createGeometrySelectionState(
    [...state.selected, ...selections],
    state.hovered
  );

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

const dedupeGeometrySelections = (
  selections: readonly GeometrySelection[]
): GeometrySelection[] => {
  const seen = new Set<string>();
  return selections.filter((selection) => {
    const key = `${selection.kind}:${selection.geometryId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
