import type { FurnitureItem, Opening, Room, Wall } from "@casastudio/schema";
import type { Staircase } from "@casastudio/schema";
import { useEffect } from "react";

import type { AppDispatch } from "../../../app/store/store";
import {
  editorActiveToolChanged,
  editorToolToggled,
  editorOpeningAuthoringTypeChanged,
  editorRedoRequested,
  editorSelectionCleared,
  editorTransientInteractionCleared,
  editorUndoRequested,
  type ProjectEditorTransientState,
  type ProjectWorkspaceMode
} from "../state/project-editor-slice";
import { geometrySelectionCleared } from "../state/viewer-slice";
import {
  getGeometryViewerShortcutAction,
  isEditableShortcutTarget
} from "../../geometry-2d/viewport/geometry-viewer-shortcuts";

type UseEditorKeyboardShortcutsOptions = {
  readonly selectedFurniture?: FurnitureItem;
  readonly handleDeleteSelectedFurniture?: () => void;
  readonly dispatch: AppDispatch;
  readonly selectedLevel: unknown;
  readonly workspaceRepresentation: "2d" | "3d";
  readonly shortcutsOpen: boolean;
  readonly saveInteractionBlocked: boolean;
  readonly workspaceMode: ProjectWorkspaceMode;
  readonly selectedEditOpening?: {
    readonly wall: Wall;
    readonly opening: Opening;
  };
  readonly selectedRoom?: Room;
  readonly selectedStair?: { readonly staircase: Staircase };
  readonly selectedEditWall?: Wall;
  readonly transient: ProjectEditorTransientState;
  readonly handleDeleteSelectedOpening: () => void;
  readonly handleDeleteSelectedRoom: () => void;
  readonly handleDeleteSelectedStair: () => void;
  readonly handleDeleteSelectedWall: () => void;
  readonly handleFitViewport: () => void;
  readonly handleResetViewport: () => void;
  readonly handleCancelStairAuthoring: () => void;
  readonly selectionCount?: number;
  readonly handleDeleteSelection?: () => void;
  readonly handleNudgeSelection?: (delta: {
    readonly x: number;
    readonly z: number;
  }) => void;
};

/** Registers the Project editor keyboard interaction contract. */
export function useEditorKeyboardShortcuts({
  selectedFurniture,
  handleDeleteSelectedFurniture,
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
  handleDeleteSelectedOpening,
  handleDeleteSelectedRoom,
  handleDeleteSelectedStair,
  handleDeleteSelectedWall,
  handleFitViewport,
  handleResetViewport,
  handleCancelStairAuthoring,
  selectionCount = 0,
  handleDeleteSelection,
  handleNudgeSelection
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
      )
        return;
      const isTextInput = isEditableShortcutTarget(target);
      const modifier = event.metaKey || event.ctrlKey;
      if (workspaceMode === "edit" && modifier && !isTextInput) {
        const key = event.key.toLowerCase();
        if (key === "z") {
          event.preventDefault();
          dispatch(
            event.shiftKey ? editorRedoRequested() : editorUndoRequested()
          );
          return;
        }
        if (key === "y") {
          event.preventDefault();
          dispatch(editorRedoRequested());
          return;
        }
      }
      if (workspaceMode === "edit" && !modifier && !isTextInput) {
        if (
          event.key === "Escape" &&
          transient.interaction?.kind === "place-stair"
        ) {
          event.preventDefault();
          handleCancelStairAuthoring();
          return;
        }
        const key = event.key.toLowerCase();
        if (
          transient.interaction === null &&
          selectionCount > 0 &&
          event.key.startsWith("Arrow")
        ) {
          const distance = event.shiftKey ? 10 : 1;
          const delta =
            event.key === "ArrowLeft"
              ? { x: -distance, z: 0 }
              : event.key === "ArrowRight"
                ? { x: distance, z: 0 }
                : event.key === "ArrowUp"
                  ? { x: 0, z: distance }
                  : event.key === "ArrowDown"
                    ? { x: 0, z: -distance }
                    : undefined;
          if (delta) {
            event.preventDefault();
            handleNudgeSelection?.(delta);
            return;
          }
        }
        if (key === "d" || key === "n" || key === "o") {
          event.preventDefault();
          const openingType =
            key === "d" ? "DOOR" : key === "n" ? "WINDOW" : "OPENING";
          if (
            transient.interaction?.kind === "place-opening" &&
            transient.interaction.openingType === openingType
          ) {
            dispatch(editorToolToggled("openings"));
          } else {
            dispatch(editorActiveToolChanged("openings"));
            dispatch(editorOpeningAuthoringTypeChanged(openingType));
          }
          return;
        }
        const tool =
          key === "r" && !event.shiftKey
            ? "room"
            : key === "u"
              ? "furniture"
              : key === "m"
                ? "measure"
                : key === "s"
                  ? "stair"
                  : key === "w"
                    ? "draw-wall"
                    : key === "v"
                      ? "select"
                      : undefined;
        if (tool) {
          event.preventDefault();
          dispatch(editorToolToggled(tool));
          return;
        }
      }
      const action = getGeometryViewerShortcutAction(event);
      if (!action) return;
      if (
        action === "DELETE_SELECTION" &&
        workspaceMode === "edit" &&
        selectionCount > 1
      ) {
        event.preventDefault();
        handleDeleteSelection?.();
        return;
      }
      if (
        action === "DELETE_SELECTION" &&
        workspaceMode === "edit" &&
        selectedFurniture
      ) {
        event.preventDefault();
        handleDeleteSelectedFurniture?.();
        return;
      }
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
          dispatch(editorActiveToolChanged("select"));
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
    selectedFurniture,
    handleDeleteSelectedFurniture,
    dispatch,
    handleFitViewport,
    handleDeleteSelectedWall,
    handleDeleteSelectedOpening,
    handleDeleteSelectedRoom,
    handleDeleteSelectedStair,
    handleResetViewport,
    handleCancelStairAuthoring,
    handleDeleteSelection,
    handleNudgeSelection,
    selectionCount,
    transient.interaction,
    transient.snapCandidate,
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
