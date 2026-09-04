import type { Opening, Room, Wall } from "@casastudio/schema";
import type { Staircase } from "@casastudio/schema";
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
  readonly selectedStair?: { readonly staircase: Staircase };
  readonly selectedEditWall?: Wall;
  readonly transient: ProjectEditorTransientState;
  readonly setRoomMenuAnchor: Dispatch<SetStateAction<HTMLElement | null>>;
  readonly setStairMenuAnchor: Dispatch<SetStateAction<HTMLElement | null>>;
  readonly setRoomDetectionActive: Dispatch<SetStateAction<boolean>>;
  readonly handleDeleteSelectedOpening: () => void;
  readonly handleDeleteSelectedRoom: () => void;
  readonly handleDeleteSelectedStair: () => void;
  readonly handleDeleteSelectedWall: () => void;
  readonly handleFitViewport: () => void;
  readonly handleResetViewport: () => void;
  readonly handleConfirmStairAuthoring: () => void;
  readonly handleCancelStairAuthoring: () => void;
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
  selectedStair,
  selectedEditWall,
  transient,
  setRoomMenuAnchor,
  setStairMenuAnchor,
  setRoomDetectionActive,
  handleDeleteSelectedOpening,
  handleDeleteSelectedRoom,
  handleDeleteSelectedStair,
  handleDeleteSelectedWall,
  handleFitViewport,
  handleResetViewport,
  handleConfirmStairAuthoring,
  handleCancelStairAuthoring
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
        if (event.key === "Enter" && transient.interaction?.kind === "place-stair" && transient.interaction.locked) {
          event.preventDefault();
          handleConfirmStairAuthoring();
          return;
        }
        if (event.key === "Escape" && transient.interaction?.kind === "place-stair") {
          event.preventDefault();
          handleCancelStairAuthoring();
          return;
        }
        const tool = event.key.toLowerCase() === "d"
          ? "door"
          : event.key.toLowerCase() === "n"
            ? "window"
            : event.key.toLowerCase() === "m"
              ? "measure"
            : event.key.toLowerCase() === "s"
              ? "stair"
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
        selectedStair
      ) {
        event.preventDefault();
        handleDeleteSelectedStair();
        return;
      }
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
          setStairMenuAnchor(null);
          setRoomDetectionActive(false);
          if (transient.interaction?.kind === "place-stair") {
            dispatch(editorActiveToolChanged(null));
          }
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
    handleDeleteSelectedStair,
    handleResetViewport,
    handleConfirmStairAuthoring,
    handleCancelStairAuthoring,
    transient.interaction,
    transient.snapCandidate,
    setStairMenuAnchor,
    selectedLevel,
    selectedEditWall,
    selectedEditOpening,
    selectedRoom,
    selectedStair,
    saveInteractionBlocked,
    shortcutsOpen,
    workspaceMode,
    workspaceRepresentation
  ]);
}
