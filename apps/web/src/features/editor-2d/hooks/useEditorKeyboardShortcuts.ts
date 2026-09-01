import type { Opening, Room, Wall } from "@casastudio/schema";
import { useEffect, type Dispatch, type SetStateAction } from "react";

import type { AppDispatch } from "../../../app/store/store";
import {
  editorActiveToolChanged,
  editorRedoRequested,
  editorSelectionCleared,
  editorTransientInteractionCleared,
  editorUndoRequested,
  type ProjectEditorTransientState,
  type ProjectWorkspaceMode
} from "../state/project-editor-slice";
import {
  geometrySelectionCleared
} from "../state/viewer-slice";
import {
  getGeometryViewerShortcutAction,
  isEditableShortcutTarget
} from "../../geometry-2d/viewport/geometry-viewer-shortcuts";

type UseEditorKeyboardShortcutsOptions = {
  readonly dispatch: AppDispatch;
  readonly selectedLevel: unknown;
  readonly workspaceRepresentation: "2d" | "3d";
  readonly shortcutsOpen: boolean;
  readonly saveInteractionBlocked: boolean;
  readonly workspaceMode: ProjectWorkspaceMode;
  readonly selectedEditOpening?: { readonly wall: Wall; readonly opening: Opening };
  readonly selectedRoom?: Room;
  readonly selectedEditWall?: Wall;
  readonly transient: ProjectEditorTransientState;
  readonly setRoomMenuAnchor: Dispatch<SetStateAction<HTMLElement | null>>;
  readonly setRoomDetectionActive: Dispatch<SetStateAction<boolean>>;
  readonly handleDeleteSelectedOpening: () => void;
  readonly handleDeleteSelectedRoom: () => void;
  readonly handleDeleteSelectedWall: () => void;
  readonly handleFitViewport: () => void;
  readonly handleResetViewport: () => void;
};

/** Registers the Project editor keyboard interaction contract. */
export function useEditorKeyboardShortcuts({
  dispatch,
  selectedLevel,
  workspaceRepresentation,
  shortcutsOpen,
  saveInteractionBlocked,
  workspaceMode,
  selectedEditOpening,
  selectedRoom,
  selectedEditWall,
  transient,
  setRoomMenuAnchor,
  setRoomDetectionActive,
  handleDeleteSelectedOpening,
  handleDeleteSelectedRoom,
  handleDeleteSelectedWall,
  handleFitViewport,
  handleResetViewport
}: UseEditorKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!selectedLevel) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (workspaceRepresentation !== "2d") return;
      if (shortcutsOpen || saveInteractionBlocked) return;
      const target = event.target as HTMLElement | null;
      if (
        typeof target?.closest === "function" &&
        target.closest('[role="dialog"]')
      ) return;
      const isTextInput = isEditableShortcutTarget(target);
      const modifier = event.metaKey || event.ctrlKey;
      if (workspaceMode === "edit" && modifier && !isTextInput) {
        const key = event.key.toLowerCase();
        if (key === "z") {
          event.preventDefault();
          dispatch(event.shiftKey ? editorRedoRequested() : editorUndoRequested());
          return;
        }
        if (key === "y") {
          event.preventDefault();
          dispatch(editorRedoRequested());
          return;
        }
      }
      if (workspaceMode === "edit" && !modifier && !isTextInput) {
        const tool = event.key.toLowerCase() === "d"
          ? "door"
          : event.key.toLowerCase() === "n"
            ? "window"
            : event.key.toLowerCase() === "m"
              ? "measure"
            : event.key.toLowerCase() === "w"
              ? "draw-wall"
              : event.key.toLowerCase() === "v"
                ? "select"
                : undefined;
        if (tool) {
          event.preventDefault();
          dispatch(editorActiveToolChanged(tool));
          return;
        }
      }
      const action = getGeometryViewerShortcutAction(event);
      if (!action) return;
      if (
        action === "DELETE_SELECTION" &&
        workspaceMode === "edit" &&
        selectedEditOpening
      ) {
        event.preventDefault();
        handleDeleteSelectedOpening();
        return;
      }
      if (
        action === "DELETE_SELECTION" &&
        workspaceMode === "edit" &&
        selectedRoom
      ) {
        event.preventDefault();
        handleDeleteSelectedRoom();
        return;
      }
      if (
        action === "DELETE_SELECTION" &&
        workspaceMode === "edit" &&
        selectedEditWall
      ) {
        event.preventDefault();
        handleDeleteSelectedWall();
        return;
      }
      if (action === "DELETE_SELECTION") return;
      event.preventDefault();
      if (action === "CLEAR_SELECTION") {
        if (
          workspaceMode === "edit" &&
          (transient.interaction !== null ||
            transient.snapCandidate !== undefined)
        ) {
          dispatch(editorTransientInteractionCleared());
          setRoomMenuAnchor(null);
          setRoomDetectionActive(false);
        } else {
          dispatch(
            workspaceMode === "edit"
              ? editorSelectionCleared()
              : geometrySelectionCleared()
          );
        }
      } else if (action === "FIT_VIEWPORT") {
        handleFitViewport();
      } else {
        handleResetViewport();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    dispatch,
    handleFitViewport,
    handleDeleteSelectedWall,
    handleDeleteSelectedOpening,
    handleDeleteSelectedRoom,
    handleResetViewport,
    transient.interaction,
    transient.snapCandidate,
    selectedLevel,
    selectedEditWall,
    selectedEditOpening,
    selectedRoom,
    saveInteractionBlocked,
    shortcutsOpen,
    workspaceMode,
    workspaceRepresentation
  ]);
}
