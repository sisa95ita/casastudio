/**
 * Keyboard actions supported by the read-only geometry viewer.
 *
 * The action identifiers are UI-only and intentionally separate from editor
 * commands, so navigation shortcuts never introduce undoable domain mutations.
 */
export type GeometryViewerShortcutAction =
  "CLEAR_SELECTION" | "DELETE_SELECTION" | "FIT_VIEWPORT" | "RESET_VIEWPORT";

/**
 * User-facing shortcut metadata consumed by the shortcut guide.
 */
export type GeometryViewerShortcutDefinition = {
  readonly action: GeometryViewerShortcutAction;
  readonly key: string;
  readonly translationKey: string;
};

/**
 * Stable shortcut registry for the shared geometry viewer.
 */
export const geometryViewerShortcuts: readonly GeometryViewerShortcutDefinition[] =
  Object.freeze([
    Object.freeze({
      action: "CLEAR_SELECTION",
      key: "Escape",
      translationKey: "shortcuts.cancelInteraction"
    }),
    Object.freeze({
      action: "DELETE_SELECTION",
      key: "Delete / Backspace",
      translationKey: "shortcuts.deleteWall"
    }),
    Object.freeze({
      action: "FIT_VIEWPORT",
      key: "F",
      translationKey: "shortcuts.fitViewport"
    }),
    Object.freeze({
      action: "RESET_VIEWPORT",
      key: "R",
      translationKey: "shortcuts.resetViewport"
    })
  ]);

/** Keyboard commands available while a local Project editing session is active. */
export const geometryEditorShortcuts = Object.freeze([
  Object.freeze({
    action: "SELECT_TOOL",
    key: "V",
    translationKey: "shortcuts.selectTool"
  }),
  Object.freeze({
    action: "DRAW_WALL_TOOL",
    key: "W",
    translationKey: "shortcuts.drawWallTool"
  }),
  Object.freeze({
    action: "DOOR_TOOL",
    key: "D",
    translationKey: "shortcuts.doorTool"
  }),
  Object.freeze({
    action: "WINDOW_TOOL",
    key: "N",
    translationKey: "shortcuts.windowTool"
  }),
  Object.freeze({
    action: "MEASURE_TOOL",
    key: "M",
    translationKey: "shortcuts.measureTool"
  }),
  Object.freeze({
    action: "STAIR_TOOL",
    key: "S",
    translationKey: "shortcuts.stairTool"
  }),
  Object.freeze({
    action: "FURNITURE_TOOL",
    key: "U",
    translationKey: "shortcuts.furnitureTool"
  }),
  Object.freeze({
    action: "UNDO",
    key: "Ctrl/Cmd + Z",
    translationKey: "shortcuts.undo"
  }),
  Object.freeze({
    action: "REDO",
    key: "Ctrl/Cmd + Shift + Z · Ctrl/Cmd + Y",
    translationKey: "shortcuts.redo"
  }),
  Object.freeze({
    action: "TEMPORARY_PAN",
    key: "Space + drag",
    translationKey: "shortcuts.panViewport"
  })
]);

/**
 * Resolves a keyboard event into a viewer shortcut action.
 */
export const getGeometryViewerShortcutAction = (
  event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey"> & {
    readonly target?: EventTarget | null;
  }
): GeometryViewerShortcutAction | undefined => {
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    isEditableShortcutTarget(event.target)
  ) {
    return undefined;
  }

  if (event.key === "Escape") {
    return "CLEAR_SELECTION";
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    return "DELETE_SELECTION";
  }

  const normalizedKey = event.key.toLowerCase();

  if (normalizedKey === "f") {
    return "FIT_VIEWPORT";
  }

  if (normalizedKey === "r") {
    return "RESET_VIEWPORT";
  }

  return undefined;
};

/** Whether a shortcut target reserves text-editing keyboard behavior. */
export const isEditableShortcutTarget = (
  target: EventTarget | null | undefined
): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    Boolean(target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], .MuiInputBase-root'
    ))
  );
};
