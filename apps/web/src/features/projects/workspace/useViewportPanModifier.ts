import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { isEditableShortcutTarget } from "../../geometry-2d/viewport/geometry-viewer-shortcuts";
import type { ProjectWorkspaceMode } from "../../editor-2d/state/project-editor-slice";

/** Tracks the temporary Space-key pan override used by the editable 2D canvas. */
export function useViewportPanModifier(
  mode: ProjectWorkspaceMode,
  shortcutsOpen: boolean,
  interactionBlocked: boolean
): readonly [boolean, Dispatch<SetStateAction<boolean>>] {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const enabled = mode === "edit" && !shortcutsOpen && !interactionBlocked;
    if (!enabled) {
      setActive(false);
      return;
    }

    const handleSpaceDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const roomDimensionInput =
        typeof target?.matches === "function" &&
        target.matches('input[type="number"]') &&
        target.closest('[data-room-authoring-parameters="true"]') !== null;
      if (
        (event.key !== " " && event.code !== "Space") ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (isEditableShortcutTarget(event.target) && !roomDimensionInput)
      ) {
        return;
      }

      event.preventDefault();
      if (roomDimensionInput) target?.blur();
      setActive(true);
    };
    const handleSpaceUp = (event: KeyboardEvent) => {
      if (event.key !== " " && event.code !== "Space") return;
      event.preventDefault();
      setActive(false);
    };
    const handleWindowBlur = () => setActive(false);

    window.addEventListener("keydown", handleSpaceDown, true);
    window.addEventListener("keyup", handleSpaceUp, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleSpaceDown, true);
      window.removeEventListener("keyup", handleSpaceUp, true);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [interactionBlocked, mode, shortcutsOpen]);

  return [active, setActive] as const;
}
